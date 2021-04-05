# -----------------------------------------------------------
# This is a script to generate the files necessary to run
# Dodrio locally on a custom dataset. More documentation
# is available in the README.md.
#
# (C) 2021 Jay Wang, Robert Turko, Polo Chau
# College of Computing, Georgia Tech
# Released under the MIT License
# emails: {jayw, rturko3, polo}@gatech.edu
# -----------------------------------------------------------

import torch
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import random
import os
import csv
import math
import pickle
import stanza
import umap

from typing import Dict, List
from functools import partial
from transformers import AdamW, BertConfig, BertForSequenceClassification, \
    BertTokenizer, get_constant_schedule_with_warmup, PreTrainedTokenizer
from torch.utils.data.sampler import BatchSampler, RandomSampler, Sampler, \
    SequentialSampler, SubsetRandomSampler
from torch.utils.data import Dataset
from torch.nn import functional
from torch import nn
from tqdm import tqdm
from sklearn.metrics import accuracy_score, confusion_matrix, \
    precision_recall_fscore_support
from sklearn.model_selection import train_test_split
from sklearn.metrics.pairwise import cosine_similarity
from collections import defaultdict, OrderedDict, Counter
from json import load, dump

from captum.attr import DeepLift, GuidedBackprop, InputXGradient, Occlusion, \
    Saliency, configure_interpretable_embedding_layer, \
    remove_interpretable_embedding_layer

from captum.attr import visualization as viz

from transformers.modeling_bert import (
    BertLayer, BertEncoder, BertModel, BertSelfAttention, BertAttention
)
                                        
from transformers.modeling_utils import (
    apply_chunking_to_forward
)

from datasets import load_dataset

#########################################################################
##################### Constants/Customization ###########################
#########################################################################

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print('Using device:', device)

trained_model = True
num_labels = 2
class_label = {0: 'negative', 1: 'positive'}
num_layers = 12
num_heads = 12
dataset_name = 'sst2'

tokenizer = BertTokenizer.from_pretrained('bert-base-uncased')

#########################################################################
##################### Helper Classes/Functions ##########################
#########################################################################

def identity(x):
    return x

class SortedSampler(Sampler):
    """
    https://pytorchnlp.readthedocs.io/en/latest/_modules/torchnlp/samplers
    /sorted_sampler.html#SortedSampler
    Samples elements sequentially, always in the same order.
    Args:
        data (iterable): Iterable data.
        sort_key (callable): Specifies a function of one argument that is
        used to extract a
            numerical comparison key from each list element.
    Example:
        >>> list(SortedSampler(range(10), sort_key=lambda i: -i))
        [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
    """

    def __init__(self, data, sort_key=identity):
        super().__init__(data)
        self.data = data
        self.sort_key = sort_key
        zip_ = [(i, self.sort_key(row)) for i, row in enumerate(self.data)]
        zip_ = sorted(zip_, key=lambda r: r[1])
        self.sorted_indexes = [item[0] for item in zip_]

    def __iter__(self):
        return iter(self.sorted_indexes)

    def __len__(self):
        return len(self.data)


class BucketBatchSampler(BatchSampler):
    """ 
    https://github.com/PetrochukM/PyTorch-NLP/blob/master/torchnlp
    /samplers/bucket_batch_sampler.py
    `BucketBatchSampler` toggles between `sampler` batches and sorted batches.
    Typically, the `sampler` will be a `RandomSampler` allowing the user to
    toggle between random batches and sorted batches. A larger
    `bucket_size_multiplier` is more sorted and vice versa.

    Args:
        sampler (torch.data.utils.sampler.Sampler):
        batch_size (int): Size of mini-batch.
        drop_last (bool): If `True` the sampler will drop the last batch if
            its size would be less than `batch_size`.
        sort_key (callable, optional): Callable to specify a comparison key
        for sorting.
        bucket_size_multiplier (int, optional): Buckets are of size
            `batch_size * bucket_size_multiplier`.

    Example:
        >>> from torchnlp.random import set_seed
        >>> set_seed(123)
        >>>
        >>> from torch.utils.data.sampler import SequentialSampler
        >>> sampler = SequentialSampler(list(range(10)))
        >>> list(BucketBatchSampler(sampler, batch_size=3, drop_last=False))
        [[6, 7, 8], [0, 1, 2], [3, 4, 5], [9]]
        >>> list(BucketBatchSampler(sampler, batch_size=3, drop_last=True))
        [[0, 1, 2], [3, 4, 5], [6, 7, 8]]
    """

    def __init__(self,
                 dataset: Dataset,
                 batch_size,
                 collate_fn,
                 drop_last=False,
                 shuffle=True,
                 sort_key=identity,
                 bucket_size_multiplier=100):

        self.dataset = dataset
        if shuffle:
            sampler = RandomSampler(dataset)
        else:
            sampler = SequentialSampler(dataset)

        super().__init__(sampler, batch_size, drop_last)
        self.sort_key = sort_key
        self.collate_fn = collate_fn
        self.bucket_sampler = BatchSampler(sampler,
                                           min(
                                               batch_size *
                                               bucket_size_multiplier,
                                               len(sampler)),
                                           False)

    def __iter__(self):
        for bucket in self.bucket_sampler:
            sorted_sampler = SortedSampler([self.dataset[i] for i in bucket],
                                           self.sort_key)
            for batch in SubsetRandomSampler(
                    list(BatchSampler(sorted_sampler, self.batch_size,
                                      self.drop_last))):
                tt = self.collate_fn([self.dataset[bucket[i]] for i in batch])
                yield self.collate_fn([self.dataset[bucket[i]] for i in batch])

    def __len__(self):
        if self.drop_last:
            return len(self.sampler) // self.batch_size
        else:
            return math.ceil(len(self.sampler) / self.batch_size)

def collate_sst2(instances: List[Dict],
                 tokenizer: PreTrainedTokenizer,
                 return_attention_masks: bool = True,
                 pad_to_max_length: bool = False,
                 device='cuda') -> List[torch.Tensor]:
    """
    Tokenize the input text.
    Return [token, mask, label]
    """
    
    token_ids = [tokenizer.encode(_x['sentence'], max_length=64, truncation=True) for _x in instances]
    
    if pad_to_max_length:
        batch_max_len = 64
    else:
        batch_max_len = max([len(_s) for _s in token_ids])
        
    padded_ids_tensor = torch.tensor(
        [_s + [tokenizer.pad_token_id] * (batch_max_len - len(_s)) for _s in
         token_ids])
    
    labels = torch.tensor([_x['label'] for _x in instances], dtype=torch.long)

    output_tensors = [padded_ids_tensor]
    if return_attention_masks:
        output_tensors.append(padded_ids_tensor > 0)
    output_tensors.append(labels)

    return list(_t.to(device) for _t in output_tensors)


collate_fn = partial(collate_sst2,
                     tokenizer=tokenizer,
                     device=device,
                     return_attention_masks=True,
                     pad_to_max_length=True)

class EarlyStopping:
    def __init__(self, mode='min', min_delta=0, patience=10, percentage=False):
        self.mode = mode
        self.min_delta = min_delta
        self.patience = patience
        self.best = None
        self.num_bad_epochs = 0
        self.is_better = None
        self._init_is_better(mode, min_delta, percentage)

        if patience == 0:
            self.is_better = lambda a, b: True
            self.step = lambda a: False

    def step(self, metrics):
        if self.best is None:
            self.best = metrics
            return False

        if np.isnan(metrics):
            return True

        if self.is_better(metrics, self.best):
            self.num_bad_epochs = 0
            self.best = metrics
        else:
            self.num_bad_epochs += 1

        if self.num_bad_epochs >= self.patience:
            return True

        return False

    def _init_is_better(self, mode, min_delta, percentage):
        if mode not in {'min', 'max'}:
            raise ValueError('mode ' + mode + ' is unknown!')
        if not percentage:
            if mode == 'min':
                self.is_better = lambda a, best: a < best - min_delta
            if mode == 'max':
                self.is_better = lambda a, best: a > best + min_delta
        else:
            if mode == 'min':
                self.is_better = lambda a, best: a < best - (
                        best * min_delta / 100)
            if mode == 'max':
                self.is_better = lambda a, best: a > best + (
                        best * min_delta / 100)

def train_model(model: torch.nn.Module,
                train_dl: BatchSampler,
                dev_dl: BatchSampler,
                optimizer: torch.optim.Optimizer,
                scheduler: torch.optim.lr_scheduler.LambdaLR,
                n_epochs: int,
                labels: int = 2,
                early_stopping: EarlyStopping = None) -> (Dict, Dict):

    # Define the performance metric
    best_val, best_model_weights = {'val_f1': 0}, None

    for ep in range(n_epochs):
        for batch in tqdm(train_dl, desc='Training'):
            model.train()
            optimizer.zero_grad()
            loss, _ = model(batch[0], attention_mask=batch[1],
                            labels=batch[2].long())[:2]

            loss.backward()
            optimizer.step()
            scheduler.step()

        val_p, val_r, val_f1, val_loss, _, _ = eval_model(model, dev_dl, labels)
        current_val = {
            'val_f1': val_f1, 'val_p': val_p, 'val_r': val_r,
            'val_loss': val_loss, 'ep': ep
        }
        print(current_val, flush=True)

        # Early stopping
        if current_val['val_f1'] > best_val['val_f1']:
            best_val = current_val
            best_model_weights = model.state_dict()

        if early_stopping and early_stopping.step(val_f1):
            print('Early stopping...')
            break

    return best_model_weights, best_val


def eval_model(model: torch.nn.Module, test_dl: BatchSampler, labels,
               measure=None):
    model.eval()

    with torch.no_grad():
        labels_all = []
        logits_all = []
        losses = []

        for batch in tqdm(test_dl, desc="Evaluation"):
            loss, logits_val = model(batch[0], attention_mask=batch[1],
                                     labels=batch[2].long())[:2]
            losses.append(loss.item())

            labels_all += batch[2].detach().cpu().numpy().tolist()
            logits_all += logits_val.detach().cpu().numpy().tolist()

        prediction = np.argmax(np.asarray(logits_all).reshape(-1, labels),
                               axis=-1)

        if measure == 'acc':
            p, r = None, None
            f1 = accuracy_score(labels_all, prediction)

        else:
            p, r, f1, _ = precision_recall_fscore_support(labels_all,
                                                          prediction,
                                                          average='macro')
            print(confusion_matrix(labels_all, prediction), flush=True)

        return p, r, f1, np.mean(losses), labels_all, prediction.tolist()

def create_model():
    transformer_config = BertConfig.from_pretrained('bert-base-uncased', num_labels=num_labels)

    if init_only:
        model = BertForSequenceClassification(config=transformer_config).to(device)

    else:
        model = BertForSequenceClassification.from_pretrained(
            'bert-base-uncased',
            config=transformer_config
        ).to(device)

    param_optimizer = list(model.named_parameters())
    no_decay = ['bias', 'LayerNorm.bias', 'LayerNorm.weight']
    optimizer_grouped_parameters = [
        {
            'params': [p for n, p in param_optimizer if
                       not any(nd in n for nd in no_decay)],
            'weight_decay': 0.01
        },
        {
            'params': [p for n, p in param_optimizer if
                       any(nd in n for nd in no_decay)],
            'weight_decay': 0.0
        }]

    optimizer = AdamW(optimizer_grouped_parameters, lr=lr)
    es = EarlyStopping(patience=patience, percentage=False, mode='max', min_delta=0.0)
    scheduler = get_constant_schedule_with_warmup(optimizer, num_warmup_steps=0.05)

    return model, optimizer, scheduler, es

# We need this to generate saliency scores.
class BertModelWrapper(torch.nn.Module):
    """
    We need this wrapper because the model is expected to output only one item
    in the forward function in captum.
    """
    def __init__(self, model):
        super(BertModelWrapper, self).__init__()
        self.model = model

    def forward(self, input, attention_mask, labels):
        output = self.model(input, attention_mask=attention_mask)
        return output[0]

# We need this to extract gradients.
class MyBertSelfAttention(nn.Module):
    def __init__(self, config):
        super().__init__()
        if config.hidden_size % config.num_attention_heads != 0 and not hasattr(config, "embedding_size"):
            raise ValueError(
                "The hidden size (%d) is not a multiple of the number of attention "
                "heads (%d)" % (config.hidden_size, config.num_attention_heads)
            )

        self.num_attention_heads = config.num_attention_heads
        self.attention_head_size = int(config.hidden_size / config.num_attention_heads)
        self.all_head_size = self.num_attention_heads * self.attention_head_size

        self.query = nn.Linear(config.hidden_size, self.all_head_size)
        self.key = nn.Linear(config.hidden_size, self.all_head_size)
        self.value = nn.Linear(config.hidden_size, self.all_head_size)

        self.dropout = nn.Dropout(config.attention_probs_dropout_prob)
        self.position_embedding_type = getattr(config, "position_embedding_type", "absolute")
        if self.position_embedding_type == "relative_key" or self.position_embedding_type == "relative_key_query":
            self.max_position_embeddings = config.max_position_embeddings
            self.distance_embedding = nn.Embedding(2 * config.max_position_embeddings - 1, self.attention_head_size)

    def transpose_for_scores(self, x):
        new_x_shape = x.size()[:-1] + (self.num_attention_heads, self.attention_head_size)
        x = x.view(*new_x_shape)
        return x.permute(0, 2, 1, 3)

    def forward(
        self,
        hidden_states,
        attention_mask=None,
        head_mask=None,
        encoder_hidden_states=None,
        encoder_attention_mask=None,
        output_attentions=False,
    ):
        mixed_query_layer = self.query(hidden_states)

        # If this is instantiated as a cross-attention module, the keys
        # and values come from an encoder; the attention mask needs to be
        # such that the encoder's padding tokens are not attended to.
        if encoder_hidden_states is not None:
            mixed_key_layer = self.key(encoder_hidden_states)
            mixed_value_layer = self.value(encoder_hidden_states)
            attention_mask = encoder_attention_mask
        else:
            mixed_key_layer = self.key(hidden_states)
            mixed_value_layer = self.value(hidden_states)

        query_layer = self.transpose_for_scores(mixed_query_layer)
        key_layer = self.transpose_for_scores(mixed_key_layer)
        value_layer = self.transpose_for_scores(mixed_value_layer)

        # Take the dot product between "query" and "key" to get the raw attention scores.
        attention_scores = torch.matmul(query_layer, key_layer.transpose(-1, -2))

        if self.position_embedding_type == "relative_key" or self.position_embedding_type == "relative_key_query":
            seq_length = hidden_states.size()[1]
            position_ids_l = torch.arange(seq_length, dtype=torch.long, device=hidden_states.device).view(-1, 1)
            position_ids_r = torch.arange(seq_length, dtype=torch.long, device=hidden_states.device).view(1, -1)
            distance = position_ids_l - position_ids_r
            positional_embedding = self.distance_embedding(distance + self.max_position_embeddings - 1)
            positional_embedding = positional_embedding.to(dtype=query_layer.dtype)  # fp16 compatibility

            if self.position_embedding_type == "relative_key":
                relative_position_scores = torch.einsum("bhld,lrd->bhlr", query_layer, positional_embedding)
                attention_scores = attention_scores + relative_position_scores
            elif self.position_embedding_type == "relative_key_query":
                relative_position_scores_query = torch.einsum("bhld,lrd->bhlr", query_layer, positional_embedding)
                relative_position_scores_key = torch.einsum("bhrd,lrd->bhlr", key_layer, positional_embedding)
                attention_scores = attention_scores + relative_position_scores_query + relative_position_scores_key

        attention_scores = attention_scores / math.sqrt(self.attention_head_size)
        if attention_mask is not None:
            # Apply the attention mask is (precomputed for all layers in BertModel forward() function)
            attention_scores = attention_scores + attention_mask

        # Normalize the attention scores to probabilities.
        attention_probs = nn.Softmax(dim=-1)(attention_scores)

        # This is actually dropping out entire tokens to attend to, which might
        # seem a bit unusual, but is taken from the original Transformer paper.
        attention_probs = self.dropout(attention_probs)

        # Mask heads if we want to
        if head_mask is not None:
            attention_probs = attention_probs * head_mask

        # Track the gradient of attention_probs
        attention_probs.retain_grad()
        
        context_layer = torch.matmul(attention_probs, value_layer)

        context_layer = context_layer.permute(0, 2, 1, 3).contiguous()
        new_context_layer_shape = context_layer.size()[:-2] + (self.all_head_size,)
        context_layer = context_layer.view(*new_context_layer_shape)

        outputs = (context_layer, attention_probs) if output_attentions else (context_layer,)
        return outputs
    
class MyBertAttention(BertAttention):
    def __init__(self, config):
        super().__init__(config)
        # Replace BertSelfAttention with MyBertSelfAttention
        self.self = MyBertSelfAttention(config)
        
class MyBertLayer(BertLayer):
    def __init__(self, config):
        super().__init__(config)
        # Replace BertAttention with MyBertAttention
        self.attention = MyBertAttention(config)
    
    def forward(
        self,
        hidden_states,
        attention_mask=None,
        head_mask=None,
        encoder_hidden_states=None,
        encoder_attention_mask=None,
        output_attentions=False,
    ):
        self_attention_outputs = self.attention(
            hidden_states,
            attention_mask,
            head_mask,
            output_attentions=output_attentions,
        )
        attention_output = self_attention_outputs[0]
        outputs = self_attention_outputs[1:]  # add self attentions if we output attention weights
        # print(attention_output.shape, len(outputs), outputs[0].shape)

        if self.is_decoder and encoder_hidden_states is not None:
            assert hasattr(
                self, "crossattention"
            ), f"If `encoder_hidden_states` are passed, {self} has to be instantiated with cross-attention layers by setting `config.add_cross_attention=True`"
            cross_attention_outputs = self.crossattention(
                attention_output,
                attention_mask,
                head_mask,
                encoder_hidden_states,
                encoder_attention_mask,
                output_attentions,
            )
            attention_output = cross_attention_outputs[0]
            outputs = outputs + cross_attention_outputs[1:]  # add cross attentions if we output attention weights

        layer_output = apply_chunking_to_forward(
            self.feed_forward_chunk, self.chunk_size_feed_forward, self.seq_len_dim, attention_output
        )
        # print(layer_output.shape)
        outputs = (layer_output,) + outputs
        return outputs

    
class MyBertEncoder(BertEncoder):
    def __init__(self, config):
        super().__init__(config)
        # Replace BertLayer with MyBertLayer
        self.layer = nn.ModuleList([MyBertLayer(config) for _ in range(config.num_hidden_layers)])
        
        
class MyBertModel(BertModel):
    def __init__(self, config, add_pooling_layer=True):
        super().__init__(config, add_pooling_layer)
        # Replace BertEncoder with MyBertEncoder
        self.encoder = MyBertEncoder(config)


class MyBertForSequenceClassification(BertForSequenceClassification):
    def __init__(self, config):
        super().__init__(config)
        # Replace BertModel with MyBertModel
        self.bert = MyBertModel(config)

def find_longest_300_sentences(longest_tokens):
	longest_token_dict = []

	for t in longest_tokens:
	    longest_token_dict.append({
	        'attention_id': t[0],
	        'tokens': tokens[t[0]]
	    })

	for k in tqdm(range(len(longest_token_dict))):
	    cur_tokens = longest_token_dict[k]['tokens']
	    
	    for j in dataset_test:
	        target_idx = -1
	        target_tokens = j['sentence']
	        target_token_ids = tokenizer.encode(target_tokens, max_length=64, truncation=True)
	        target_tokens = [tokenizer.ids_to_tokens[id] for id in target_token_ids]
	        overlap_rate = len(set(cur_tokens).intersection(set(target_tokens))) / len(set(cur_tokens).union(set(target_tokens)))
	        if overlap_rate > 0.95:
	            target_idx = j['idx']
	            break
	    
	    longest_token_dict[k]['idx'] = target_idx

	for k in tqdm(range(len(longest_token_dict))):
	    if longest_token_dict[k]['idx'] != -1:
	        continue

	    cur_tokens = longest_token_dict[k]['tokens']
	    
	    for j in dataset_test:
	        target_idx = -1
	        target_tokens = j['sentence']
	        target_token_ids = tokenizer.encode(target_tokens, max_length=64, truncation=True)
	        target_tokens = [tokenizer.ids_to_tokens[id] for id in target_token_ids]
	        overlap_rate = len(set(cur_tokens).intersection(set(target_tokens))) / len(set(cur_tokens).union(set(target_tokens)))
	        if overlap_rate > 0.93:
	            target_idx = j['idx']
	            break

	    longest_token_dict[k]['idx'] = target_idx

	return longest_token_dict

#################### Gradient Sorting List Helpers #####################

def reshape_attentions(test_attentions):
	# Each batch has a different dimension, so we need to reshape the arrays
	# (zero padding)
	reshaped_attentions = []
	reshaped_attention_grads = []

	for t in tqdm(range(len(test_attentions))):    
	    swapped_tensor = np.swapaxes(test_attentions[t], 0, 1)
	    target_shape = (swapped_tensor.shape[0], num_layers, num_heads, 64, 64)
	        
	    target_tensor = np.zeros(target_shape)
	    cur_shape = swapped_tensor.shape
	    target_tensor[:cur_shape[0],
	                  :cur_shape[1],
	                  :cur_shape[2],
	                  :cur_shape[3],
	                  :cur_shape[4]] = swapped_tensor
	    reshaped_attentions.append(target_tensor)
	    
	    swapped_tensor = np.swapaxes(test_attentions_grad[t], 0, 1)
	    target_tensor = np.zeros(target_shape)
	    cur_shape = swapped_tensor.shape
	    target_tensor[:cur_shape[0],
	                  :cur_shape[1],
	                  :cur_shape[2],
	                  :cur_shape[3],
	                  :cur_shape[4]] = swapped_tensor
	    reshaped_attention_grads.append(target_tensor)

	all_attention_grads = np.concatenate(reshaped_attention_grads, axis=0)
	all_attentions = np.concatenate(reshaped_attentions, axis=0)
	return all_attention_grads, all_attentions

def find_max_grad_sum(all_test_attentions_grads, batch_id, top_k):
    """
    Find the layer and head ID for the attention head having the largest sum of
    absolute values of gradients for the given batch.
    
    Args:
        all_test_attentions_grads(array): attention gradients, shape=(200, num_layers, num_heads, d)
        batch_id(int): ID of the intersted batch
        top_k(int): Number of heads to return.
    """

    cur_means, cur_indexes = [], []

    # Find the attention gradient sum 
    for layer in range(all_test_attentions_grads.shape[1]):
        for head in range(all_test_attentions_grads.shape[2]):
            cur_index = (layer, head)
            cur_mean = np.sum(np.abs(all_test_attentions_grads[batch_id, layer, head]))
            
            cur_means.append(cur_mean)
            cur_indexes.append(cur_index)

    # Sort the gradient sum with the index
    mean_index = [(cur_means[i], cur_indexes[i]) for i in range(len(cur_means))]
    mean_index = sorted(mean_index, key=lambda x: x[0], reverse=True)
    
    return mean_index[:top_k]

###################### Dependency Parsing Helpers #######################

def concatenate_split_words(lst):
    it = iter(lst)
    prev = next(it)
    tmp = prev
    for ele in it:
        if ele[:2] != '##':
            yield tmp
            tmp = ele
        else:
            tmp += ele[2:]
        prev = ele
    yield tmp
    
def build_token_word_offset_mapping(padding_stripped_list):
    consecutive_split_word_count = 0
    total_split_word_count = 0
    split_word_idxs_list = []
    for i, token in enumerate(padding_stripped_list):
        if token[:2] == '##':
            if padding_stripped_list[i + 1][:2] == '##':
                consecutive_split_word_count += 1
                total_split_word_count += 1
                continue
            consecutive_split_word_count += 1
            total_split_word_count += 1
            split_word_idxs_list.append((i - total_split_word_count, consecutive_split_word_count))
        else:
            consecutive_split_word_count = 0
    return split_word_idxs_list

def rematch_attentions():
	longest_token_dict = load(open('./outputs/' + dataset_name + '-longest-300-id.json', 'r'))

	token_to_attention_id = {}
	for i, t in enumerate(tokens):
	    token_to_attention_id[frozenset(t)] = i
	    
	founded_tokens = []

	for i, t in tqdm(enumerate(longest_token_dict)):
	    if (frozenset(t['tokens']) in token_to_attention_id):
	        cur_attention_id = token_to_attention_id[frozenset(t['tokens'])]
	        founded_tokens.append(cur_attention_id)
	        longest_token_dict[i]['attention_id'] = cur_attention_id

	return longest_token_dict

#################### Syntactic Sorting List Helpers #####################

# Code for evaluating individual attention maps and baselines

def evaluate_predictor(prediction_fn, dependency_tagged_list):
    """Compute accuracies for each relation for the given predictor."""
    n_correct, n_incorrect = Counter(), Counter()
    for example in dependency_tagged_list:
        words = example["words"]
        predictions = prediction_fn(example)
        for i, (p, y, r) in enumerate(zip(predictions, example["heads"],
                                          example["tags"])):
            is_correct = (p == y)
            if r == "poss" and p < len(words):
            # Special case for poss (see discussion in Section 4.2)
                if i < len(words) and words[i + 1] == "'s" or words[i + 1] == "s'":
                    is_correct = (predictions[i + 1] == y)
            if is_correct:
                n_correct[r] += 1
                n_correct["all"] += 1
            else:
                n_incorrect[r] += 1
                n_incorrect["all"] += 1
    return {k: n_correct[k] / float(n_correct[k] + n_incorrect[k])
            for k in n_incorrect.keys()}

def attn_head_predictor(layer, head, mode="normal"):
    """Assign each word the most-attended-to other word as its head."""
    def predict(example):
        attn = np.array(example["attentions"][layer][head])
        if mode == "transpose":
            attn = attn.T
        elif mode == "both":
            attn += attn.T
        else:
            assert mode == "normal"
        # ignore attention to self and [CLS]/[SEP] tokens
        attn[range(attn.shape[0]), range(attn.shape[0])] = 0
        attn = attn[1:-1, 1:-1]
        return np.argmax(attn, axis=-1) + 1  # +1 because ROOT is at index 0
    return predict

def offset_predictor(offset):
    """Simple baseline: assign each word the word a fixed offset from
    it (e.g., the word to its right) as its head."""
    def predict(example):
        return [max(0, min(i + offset + 1, len(example["words"])))
                for i in range(len(example["words"]))]
    return predict

def get_scores(dependency_tagged_list, mode="normal"):
    """Get the accuracies of every attention head."""
    scores = defaultdict(dict)
    for layer in range(num_layers):
        for head in range(num_heads):
            scores[layer][head] = evaluate_predictor(
                attn_head_predictor(layer, head, mode), dependency_tagged_list)
    return scores

def get_all_scores(reln):
    """Get all attention head scores for a particular relation."""
    all_scores = []
    for key, layer_head_scores in attn_head_scores.items():
        for layer, head_scores in layer_head_scores.items():
            for head, scores in head_scores.items():
                all_scores.append((scores[reln], layer, head, key))
    return sorted(all_scores, reverse=True)

######################## Atlas List Helpers #############################

def generate_mean_semantic_list():
	semantic_sort_list = load(open('./outputs/' + dataset_name + '-sorted-saliency-heads.json', 'r'))

	# Take the average rank of heads for different sentences
	attention_semantic_rank = {}
	for i in range(num_layers):
	    for j in range(num_heads):
	        attention_semantic_rank[(i, j)] = {'similarity_scores': []}

	for k in semantic_sort_list:
	    for s in semantic_sort_list[k]:
	        attention_semantic_rank[(s[1][0], s[1][1])]['similarity_scores'].append(s[0])

	mean_semantic_scores = np.zeros((num_layers, num_heads))
	for i in range(num_layers):
	    for j in range(num_heads):
	        mean_semantic_scores[i, j] = np.mean(attention_semantic_rank[(i, j)]['similarity_scores'])

	return mean_semantic_scores

def generate_mean_syntactic_list():
	syntactic_sort_list = load(open('./outputs/' + dataset_name + '-sorted-syntactic-heads.json', 'r'))

	attention_syntactic_rank = {}
	for i in range(num_layers):
	    for j in range(num_heads):
	        attention_syntactic_rank[(i, j)] = {'accs': []}
	        
	for k in syntactic_sort_list:
	    for h in syntactic_sort_list[k]['top_heads']:
	        attention_syntactic_rank[(h['head'][0], h['head'][1])]['accs'].append(h['acc'])

	mean_syntactic_scores = np.zeros((num_layers, num_heads))
	for i in range(num_layers):
	    for j in range(num_heads):
	        cur_array = attention_syntactic_rank[(i, j)]['accs']
	        if len(cur_array) == 0:
	            mean_syntactic_scores[i, j] = 0
	        else:
	            mean_syntactic_scores[i, j] = np.max(cur_array)

	mean_syntactic_scores = np.nan_to_num(mean_syntactic_scores, 0)
	return mean_syntactic_scores

def generate_mean_gradient_list():
	grad_sort_list = load(open('./outputs/' + dataset_name + '-sorted-grad-heads.json', 'r'))

	attention_grad_rank = {}
	for i in range(num_layers):
	    for j in range(num_heads):
	        attention_grad_rank[(i, j)] = {'grads': []}
	        
	for k in grad_sort_list:
	    for h in grad_sort_list[k]:
	        attention_grad_rank[(h[1][0], h[1][1])]['grads'].append(h[0])

	variances = []
	for i in range(num_layers):
	    for j in range(num_heads):
	        variances.append(np.std(attention_grad_rank[(i, j)]['grads']))

	mean_grad_scores = np.zeros((num_layers, num_heads))
	for i in range(num_layers):
	    for j in range(num_heads):
	        mean_grad_scores[i, j] = np.mean(attention_grad_rank[(i, j)]['grads'])

	return mean_grad_scores

def generate_mean_confidence_list():
	confidence_scores = load(open('./outputs/' + dataset_name + '-mean-confidence-heads.json', 'r'))

	mean_confidence_scores = np.zeros((12, 12))

	for t in confidence_scores:
	    mean_confidence_scores[t[1][0], t[1][1]] = t[0]

	return mean_confidence_scores


#########################################################################
######################## 1. Train Model #################################
#########################################################################

dataset_test = load_dataset('glue', 'sst2', split='train[:3%]')
if not trained_model:
	print("1. Training Model...")
	seed = 202136
	random.seed(seed)
	torch.manual_seed(seed)
	torch.cuda.manual_seed_all(seed)
	torch.backends.cudnn.deterministic = True
	np.random.seed(seed)

	# Hyper-parameters
	init_only = False
	lr = 2e-5
	batch_size = 8
	epochs = 10
	patience = 4

	# Load data
	dataset_vali = load_dataset('glue', 'sst2', split='train[3%:6%]')
	dataset_train = load_dataset('glue', 'sst2', split='train[6%:]')
	test_dl = BucketBatchSampler(batch_size=batch_size,
	                             sort_key=lambda x: len(x['sentence']),
	                             dataset=dataset_test,
	                             collate_fn=collate_fn)

	model, optimizer, scheduler, es = create_model()

	train_dl = BucketBatchSampler(batch_size=batch_size,
	                              sort_key=lambda x: len(x['sentence']),
	                              dataset=dataset_train,
	                              collate_fn=collate_fn)

	dev_dl = BucketBatchSampler(batch_size=batch_size,
	                            sort_key=lambda x: len(x['sentence']),
	                            dataset=dataset_vali,
	                            collate_fn=collate_fn)

	num_train_optimization_steps = int(epochs * len(train_dl) / batch_size)

	if init_only:
	    best_model_w, best_perf = model.state_dict(), {'val_f1': 0}
	    
	else:
	    best_model_w, best_perf = train_model(model, train_dl, dev_dl,
	                                          optimizer, scheduler,
	                                          epochs, num_labels, es)

	checkpoint = {
	    'performance': best_perf,
	    'model': best_model_w
	}

	print(best_perf)

	torch.save(checkpoint, './outputs/saved-bert-' + dataset_name + '.pt')

	print('F1', best_perf['val_f1'])

#########################################################################
########## 2. Extract Attention Weights and Gradients ###################
#########################################################################

print("2. Extracting Attention Weights and Gradients...")
batch_size = 16
test_dl = BucketBatchSampler(batch_size=batch_size,
                             sort_key=lambda x: len(x['sentence']),
                             dataset=dataset_test,
                             collate_fn=collate_fn)

transformer_config = BertConfig.from_pretrained('bert-base-uncased', num_labels=num_labels)
my_model = MyBertForSequenceClassification.from_pretrained(
            'bert-base-uncased',
            config=transformer_config
        ).to(device)

checkpoint = torch.load('./outputs/saved-bert-'  + dataset_name + '.pt')
my_model.load_state_dict(checkpoint['model'])

# Retrieve model output
token_ids = []
test_attentions = []
test_attentions_grad = []
test_predicts = []
test_labels = []
test_softmaxes = []
for batch in tqdm(test_dl):
    tokens, masks, labels = (batch[0].to(device),
                             batch[1].to(device),
                             batch[2].to(device))
    
    # Compute the attetion and gradients
    my_loss, my_logit, attentions = my_model(tokens,
                                             attention_mask=masks,
                                             labels=labels.long(),
                                             output_attentions=True)
    
    softmax_scores = functional.softmax(my_logit, dim=1)
    my_predicts = torch.argmax(softmax_scores, dim=1).detach().cpu().numpy().tolist()
    test_predicts.extend(my_predicts)
    test_labels.extend(labels.detach().cpu().numpy().tolist())
    test_softmaxes.extend(softmax_scores.detach().cpu().numpy().tolist())
    
    my_loss.backward()
    
    # Attention dimension [num_layer, batch_size, num_head, token_size, token_size]
    all_attention = np.array([a.detach().cpu().numpy() for a in attentions])
    test_attentions.append(all_attention)
    
    # Attention gradient dimension [num_layer, batch_size, num_head, token_size, token_size]
    all_attention_grad = np.array([a.grad.detach().cpu().numpy() for a in attentions])
    test_attentions_grad.append(all_attention_grad)
    
    # Store the current tokens
    token_ids += batch[0].detach().cpu().numpy().tolist()

tokens = []
for i in range(len(token_ids)):
    cur_token_ids = token_ids[i]
    cur_tokens = [tokenizer.ids_to_tokens[id] for id in cur_token_ids]
    tokens.append(cur_tokens)

#########################################################################
################ 2.1 Choose longest 300 sentences #######################
#########################################################################

token_lengths = [(j, len([i for i in tokens[j] if i != '[PAD]'])) for j in range(len(tokens))]
longest_tokens = sorted(token_lengths, key=lambda x: x[1], reverse=True)[:300]

longest_token_dict = find_longest_300_sentences(longest_tokens)
dump(longest_token_dict, open('./outputs/' + dataset_name + '-longest-300-id.json', 'w'))

#########################################################################
################ 2.2 Extract Gradient Sorting List ######################
#########################################################################

all_attention_grads, all_attentions = reshape_attentions(test_attentions)
all_test_attentions_grads = all_attention_grads.reshape(
    (all_attention_grads.shape[0], num_layers, num_heads, -1)
)

sorted_grad_index = {}
for b in tqdm(range(all_test_attentions_grads.shape[0])):
    all_values = find_max_grad_sum(all_test_attentions_grads, b, num_layers * num_heads)
    sorted_grad_index[b] = all_values

longest_sorted_grad_index = {}
for t in longest_token_dict:
    cur_index = sorted_grad_index[t['attention_id']]
    cur_index = [[round(t[0], 4), [t[1][0], t[1][1]]] for t in cur_index]
    longest_sorted_grad_index[t['idx']] = cur_index

dump(longest_sorted_grad_index, open('./outputs/' + dataset_name + '-sorted-grad-heads.json', 'w'))

#########################################################################
################### 2.3 Extract Attention Maps ##########################
#########################################################################

for t in tqdm(longest_token_dict):
    token_all_attentions = np.round(all_attentions[t['attention_id'], :, :, :, :], 4).tolist()
    # Use the default hugging face id to save, but if your dataset doesn't have default ids,
    # then you must assign ids prior to running this pipeline.
    dump(token_all_attentions, open('./outputs/' + dataset_name + '-attention-data/attention-{:04}.json'.format(t['idx']), 'w'))

#########################################################################
################### 3. Generate Saliency Scores #########################
#########################################################################

print("3. Generating Saliency Scores...")
transformer_config = BertConfig.from_pretrained('bert-base-uncased', num_labels=num_labels)
original_model = BertForSequenceClassification.from_pretrained(
    'bert-base-uncased',
    config=transformer_config
).to(device)

checkpoint = torch.load('./outputs/saved-bert-' + dataset_name + '.pt')
original_model.load_state_dict(checkpoint['model'])
model = BertModelWrapper(original_model)

# Hyper-parameters
batch_size = 16
aggregator = 'l1'


# Replace the original embedding layer with an interpretable embeddign layer
ablator = Saliency(model)
interpretable_embedding = configure_interpretable_embedding_layer(model,
                                                                  'model.bert.embeddings')

token_ids = []
class_attr_list = defaultdict(lambda: [])
for batch in tqdm(test_dl):
    # Use the interpretable embedding instead of the original embedding layer
    input_embeddings = interpretable_embedding.indices_to_embeddings(batch[0])
    
    # Compute the attributes
    class_attr = defaultdict(lambda: [])
    for clss in class_label.keys():
        attributions = ablator.attribute(
            input_embeddings,
            abs=False,
            target=clss,
            additional_forward_args=(batch[1], batch[2])
        )
        
        
        # Summarize the attributes across the embedding to one token
        if aggregator == 'mean':
            attributions = attributions.mean(dim=-1).squeeze(0)
            attributions = attributions / torch.norm(attributions)
        elif aggregator == 'l1':
            attributions = attributions.norm(p=1, dim=-1).squeeze(0)
        
        class_attr_list[clss] += [[column for column in row] for
                                  row in attributions.detach().cpu().numpy()]
    
    # Store the current tokens
    token_ids += batch[0].detach().cpu().numpy().tolist()

# Map token id to tokens, and add their associated saliency map values
test_saliencies_longest = []
for l in longest_token_dict:
    saliencies = []
    target_tokens = l['tokens']
    
    for i in range(len(token_ids)):
        cur_tokens = token_ids[i]
        cur_tokens = [tokenizer.ids_to_tokens[id] for id in cur_tokens]

        overlap_rate = len(set(cur_tokens).intersection(set(target_tokens))) / len(set(cur_tokens).union(set(target_tokens)))
        if overlap_rate > 0.98:

            for j, token in enumerate(cur_tokens):
                token_sal = {'token': token}
                for clss in class_label.keys():
                    token_sal[class_label[clss]] = float(class_attr_list[clss][i][j])
                saliencies.append(token_sal)
                
            break
    
    test_saliencies_longest.append({
        'tokens': saliencies,
        'meta': {
            'true_label': class_label[test_labels[l['attention_id']]],
            'predicted_label': class_label[test_predicts[l['attention_id']]],
            'softmax_scores': {
                class_label[0]: test_softmaxes[l['attention_id']][0],
                class_label[1]: test_softmaxes[l['attention_id']][1]
            }
        }
    })

test_saliencies_longest = {}
for l in tqdm(longest_token_dict):
    saliencies = []
    target_tokens = [t for t in l['tokens'] if t != '[PAD]']
    found = False
    
    for i in range(len(token_ids)):
        cur_tokens = token_ids[i]
        cur_tokens = [tokenizer.ids_to_tokens[id] for id in cur_tokens if id != 0]

        overlap_rate = len(set(cur_tokens).intersection(set(target_tokens))) / len(set(cur_tokens).union(set(target_tokens)))
        if overlap_rate > 0.95:

            for j, token in enumerate(cur_tokens):
                token_sal = {'token': token}
                for clss in class_label.keys():
                    token_sal[class_label[clss]] = float(class_attr_list[clss][i][j])
                saliencies.append(token_sal)
            
            found = True

            break
    
    if not found:
        print(l)
    
    test_saliencies_longest[l['idx']] = {
        'tokens': saliencies,
        'meta': {
            'true_label': class_label[test_labels[l['attention_id']]],
            'predicted_label': class_label[test_predicts[l['attention_id']]],
            'softmax_scores': {
                class_label[0]: test_softmaxes[l['attention_id']][0],
                class_label[1]: test_softmaxes[l['attention_id']][1]
            }
        }
    }

dump(test_saliencies_longest, open('./outputs/' + dataset_name + '-saliency-list-grad-l1', 'w'))

#########################################################################
################# 4. Generate Semantic Sorting List #####################
#########################################################################

print("4. Generating Semantic Sorting List...")
cosine_scores = {}

for l in tqdm(range(len(longest_token_dict))):
    
    cur_saliencies = []
    cur_idx = longest_token_dict[l]['idx']
    for t in test_saliencies_longest[cur_idx]['tokens']:
        if t['token'] == '[PAD]':
            break
        cur_saliencies.append(t[test_saliencies_longest[cur_idx]['meta']['predicted_label']])
        
    attention_id = longest_token_dict[l]['attention_id']
    
    scores = []
    for layer in range(all_attentions[attention_id].shape[0]):
        for head in range(all_attentions[attention_id].shape[1]):
            cur_attention = all_attentions[attention_id, layer, head, :len(cur_saliencies), :len(cur_saliencies)]
            cur_attention_sum = np.sum(cur_attention, axis=0)
            assert(len(cur_saliencies) == len(cur_attention_sum))
            cos_score = cosine_similarity([cur_saliencies], [cur_attention_sum])[0][0]
            
            scores.append([cos_score, [layer, head]])

    # Sort before adding to the score list
    scores = sorted(scores, key=lambda x: x[0], reverse=True)
    
    cosine_scores[longest_token_dict[l]['idx']] = scores

dump(cosine_scores, open('./outputs/' + dataset_name + '-sorted-saliency-heads.json', 'w'))

#########################################################################
#################### 5. Generate Dependency Tree ########################
#########################################################################

print("5. Generating Dependency Tree...")
# This parser can be adjusted or removed if the dataset has human labels.
stanza.download('en')     
nlp = stanza.Pipeline('en',
                      use_gpu=True,
                      tokenize_pretokenized=True,
                      processors='tokenize,mwt,pos,lemma,depparse')

# We have to re-match the attentionID if we extract attentions from a different time.
# If this pipeline is not broken up, then we don't need this.
longest_token_dict = rematch_attentions()

longest_tokens = [tokens[i['attention_id']] for i in longest_token_dict]
longest_attentions = all_attentions[[i['attention_id'] for i in longest_token_dict], :, :, :, :].copy()

# Collect dependencies for visualized instances.
dependency_tag_list = []
for i in tqdm(range(len(longest_tokens))):
    instance = longest_tokens[i]
    padding_stripped_list = list(filter(lambda a: a != '[PAD]', instance))
    token_word_offset_mapping = build_token_word_offset_mapping(padding_stripped_list)
    words = list(concatenate_split_words(padding_stripped_list))
    
    attentions_per_instance = longest_attentions[i].copy()
    for index, offset in token_word_offset_mapping:
        attentions_per_instance[:, :, :, index] = np.sum(attentions_per_instance[:, :, :, index:index+offset+1], axis=-1)
        attentions_per_instance[:, :, index, :] = np.mean(attentions_per_instance[:, :, index:index+offset+1, :], axis=2)
        attentions_per_instance = np.delete(np.delete(attentions_per_instance[:,:,:],
                                                      slice(index+1, index+offset+1), axis=3)[:,:,:,:],
                                            slice(index+1, index+offset+1), axis=2)

    # Crop the attention map to only hold attentions for valid tokens (not padding tokens or split tokens)
    attentions_per_instance = attentions_per_instance[:,:,:len(words),:len(words)]
    
    doc = nlp([words[1:len(words)-1]]) # strip away [CLS] and [SEP] tokens
    tags = [word.deprel for sentence in doc.sentences for word in sentence.words]
    heads = [word.head for sentence in doc.sentences for word in sentence.words]
    dependency_tag_list.append({
        'words': words[1:len(words)-1],
        'attentions': attentions_per_instance, # [num_layers, num_heads, word_count + 2, word_count + 2]
        'tags': tags, # [word_count]
        'heads': heads
    })

dependency_dicts = {}
for i in tqdm(range(len(dependency_tag_list))):
    dependency_list = []
    cur_instance= dependency_tag_list[i]
    cur_idx = longest_token_dict[i]['idx']

    for i in range(len(cur_instance['words'])):
        cur_head = cur_instance['heads'][i] - 1
        cur_tag = cur_instance['tags'][i]

        cur_obj = {'child': i, 'parent': cur_head, 'relation': cur_tag}

        # Root node
        if (cur_head == -1):
            cur_obj['parent'] = None

        dependency_list.append(cur_obj)

    dependency_dict = {
        'list': dependency_list,
        'words': cur_instance['words']
    }
    
    dependency_dicts[cur_idx] = dependency_dict

dump(dependency_dicts, open('./outputs/' + dataset_name + '-dependencies.json', 'w'))

#########################################################################
################# 6. Generate Syntactic Sorting List ####################
#########################################################################

print("6. Generating Syntactic Sorting List")
# Collect dependencies for entire dataset.
all_dep_tagged_instance_list = []
for i in tqdm(range(all_attentions.shape[0])):
    instance = tokens[i]
    padding_stripped_list = list(filter(lambda a: a != '[PAD]', instance))
    token_word_offset_mapping = build_token_word_offset_mapping(padding_stripped_list)
    words = list(concatenate_split_words(padding_stripped_list))
    
    attentions_per_instance = all_attentions[i].copy()
    for index, offset in token_word_offset_mapping:
        attentions_per_instance[:, :, :, index] = np.sum(attentions_per_instance[:, :, :, index:index+offset+1], axis=-1)
        attentions_per_instance[:, :, index, :] = np.mean(attentions_per_instance[:, :, index:index+offset+1, :], axis=2)
        attentions_per_instance = np.delete(np.delete(attentions_per_instance[:,:,:],
                                                      slice(index+1, index+offset+1), axis=3)[:,:,:,:],
                                            slice(index+1, index+offset+1), axis=2)

    # Crop the attention map to only hold attentions for valid tokens (not padding tokens or split tokens)
    attentions_per_instance = attentions_per_instance[:,:,:len(words),:len(words)]
    
    doc = nlp([words[1:len(words)-1]]) # strip away [CLS] and [SEP] tokens
    tags = [word.deprel for sentence in doc.sentences for word in sentence.words]
    heads = [word.head for sentence in doc.sentences for word in sentence.words]
    all_dep_tagged_instance_list.append({
        'words': words[1:len(words)-1],
        'attentions': attentions_per_instance, # [num_layers, num_heads, word_count + 2, word_count + 2]
        'tags': tags, # [word_count]
        'heads': heads
    })

# Find the most common relations in our data
pos_counts = Counter()
for instance in all_dep_tagged_instance_list:
    for pos in instance["tags"]:
        pos_counts[pos] += 1


# attn_head_scores[direction][layer][head][dep_relation] = accuracy
attn_head_scores = {
    "dep->head": get_scores(all_dep_tagged_instance_list ,"normal"),
    "head<-dep": get_scores(all_dep_tagged_instance_list ,"transpose")
}
# baseline_scores[offset][dep_relation] = accuracy
baseline_scores = {
    i: evaluate_predictor(offset_predictor(i), all_dep_tagged_instance_list) for i in range(-3, 3)
}

# Compare the best attention head to baselines across the most common relations.
reln_top_heads = {}
for row, (reln, _) in enumerate([("all", 0)] + pos_counts.most_common()):
    if reln == "root" or reln == "punct":
        continue
    if pos_counts[reln] < 100 and reln != "all":
        break
    
    cur_sorted_scores = sorted([s for s in get_all_scores(reln)], reverse=True)
    uas, layer, head, direction = cur_sorted_scores[0]
    baseline_uas, baseline_offset = max(
        (scores[reln], i) for i, scores in baseline_scores.items())

    reln_top_heads[reln] = {'base_acc': baseline_uas, 'top_heads': []}
    
    for s in cur_sorted_scores:
        if s[0] < baseline_uas:
            break
        reln_top_heads[reln]['top_heads'].append({
            'head': [s[1], s[2]],
            'acc': s[0]
        })
    
    print("{:8s} | {:5d} | attn: {:.1f} | offset={:2d}: {:.1f} | {:}-{:} {:}".format(
        reln[:8], pos_counts[reln], 100 * uas, baseline_offset, 100 * baseline_uas,
        layer, head, direction))

dump(reln_top_heads, open('./outputs/' + dataset_name + '-sorted-syntactic-heads.json', 'w'))

#########################################################################
################# 7. Generate Confidence Sorting List ###################
#########################################################################

print("7. Generating Confidence Sorting List...")
all_attentions_max = np.max(all_attentions, axis=(3, 4))
all_attentions_confidence = np.mean(all_attentions_max, axis=0)

confidence_scores = []
for i in range(num_layers):
    for j in range(num_heads):
        confidence_scores.append([all_attentions_confidence[i, j], [i, j]])
confidence_scores = sorted(confidence_scores, key=lambda x: x[0], reverse=True)

dump(confidence_scores, open('./outputs/' + dataset_name + '-mean-confidence-heads.json', 'w'))

longest_attentions = all_attentions[[i['attention_id'] for i in longest_token_dict], :, :, :, :].copy()
longest_attentions_confidence = np.max(longest_attentions, axis=(3, 4))
sorted_confidence_dict = {}
for i in tqdm(range(len(longest_token_dict))):
    cur_confidence_scores = []
    for j in range(num_layers):
        for k in range(num_heads):
            cur_confidence_scores.append([longest_attentions_confidence[i, j, k], [j, k]])
    
    cur_confidence_scores = sorted(cur_confidence_scores, key=lambda x: x[0], reverse=True)
    sorted_confidence_dict[longest_token_dict[i]['idx']] = cur_confidence_scores

dump(sorted_confidence_dict, open('./outputs/' + dataset_name + '-sorted-confidence-heads.json', 'w'))

#########################################################################
############# 8. Generate Sentence Selection Data #######################
############### UMAP Embedding Data & Table Data ########################
#########################################################################

print("8. Generating Sentence Selection Data...")
transformer_config = BertConfig.from_pretrained('bert-base-uncased', num_labels=2, output_hidden_states = True)
model = BertForSequenceClassification.from_pretrained(
    'bert-base-uncased',
    config=transformer_config
).to(device)

checkpoint = torch.load('./outputs/saved-bert-' + dataset_name + '.pt')
model.load_state_dict(checkpoint['model'])

data_list = []
for j in longest_token_dict:
    for i in dataset_test:
        if i['idx'] == j['idx']:
            data_list.append({
                    'idx': i['idx'],
                    'sentence': i['sentence'],
                    'label': i['label']
                })

token_ids_instances = [tokenizer.encode(i['sentence'], max_length=64, truncation=True) for i in data_list]
hidden_states = []
with torch.no_grad():    
    for i in tqdm(range(len(token_ids_instances))):
        token_ids = torch.tensor([token_ids_instances[i]]).to(device)
        outputs = model(token_ids)
        hidden_states.append(outputs[1])

# Concatenate the tensors for all layers.
token_embeddings = [torch.stack(i, dim=0) for i in hidden_states]

# Remove dimension 1, the "batches".
token_embeddings = [torch.squeeze(i, dim=1) for i in token_embeddings]

# Swap dimensions 0 and 1.
token_embeddings = [i.permute(1,0,2) for i in token_embeddings]

total_token_vecs_cat = []
for token_embedding in token_embeddings:
    token_vecs_cat = []
    for token in token_embedding:
        cat_vec = torch.cat((token[-1], token[-2], token[-3], token[-4]), dim=0)
        token_vecs_cat.append(cat_vec)
    total_token_vecs_cat.append(token_vecs_cat)

token_vecs = [i[-2][0] for i in hidden_states]

sentence_embedding = [torch.mean(i, dim=0) for i in token_vecs]

embedding = umap.UMAP(n_neighbors=90,
                      min_dist=0.3,
                      n_components=2,
                      metric='correlation').fit_transform([i.detach().cpu().numpy() for i in sentence_embedding])

embedding_list = []
for i, instance in enumerate(data_list):
    embedding_list.append({
        'id': instance['idx'],
        'sentence': instance['sentence'],
        'coords': embedding[i].tolist(),
        'label': instance['label'],
    })

dump(embedding_list, open('./outputs/embedding-list-' + dataset_name + '.json', 'w'))

table_list = []
with torch.no_grad():
	for i in data_list:
		tokens = torch.tensor(tokenizer.encode(i['sentence']))
		tokens_batch = tokens.reshape((1, -1)).to(device)

		outputs = model(tokens_batch, output_attentions=True)
		softmax_scores = functional.softmax(outputs[0], dim=1)
		predicted_label = torch.argmax(softmax_scores).item()
		table_list.append({
		        'id': i['idx'],
		        'sentence': i['sentence'],
		        'true_label': i['label'],
		        'predicted_label': predicted_label,
		        'logit_distance': outputs[0].max().tolist()
		        })

dump(table_list, open('./outputs/table-list-' + dataset_name + '.json', 'w'))

#########################################################################
###################### 9. Generate Atlas List ###########################
#########################################################################

print("9. Generating Atlas List...")

mean_semantic_scores = generate_mean_semantic_list()
mean_syntactic_scores = generate_mean_syntactic_list()
mean_grad_scores = generate_mean_gradient_list()
mean_confidence_scores = generate_mean_confidence_list()

atlas_list = []
for layer in range(num_layers):
    for head in range(num_heads):
        atlas_list.append({
            'layer': layer,
            'head': head,
            'semantic': mean_semantic_scores[layer, head],
            'syntactic': mean_syntactic_scores[layer, head],
            'gradient': mean_grad_scores[layer, head],
            'confidence': mean_confidence_scores[layer, head]
        })

dump(atlas_list, open('./outputs/' + dataset_name + '-atlas.json', 'w'))