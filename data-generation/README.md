# Customize Dodrio for Your Use Case

Dodrio visualizes Transformers from files that are generated offline. These files are generated in a 9-step process detailed in [`dodrio-data-gen.py`](dodrio-data-gen.py). The steps are detailed below:

| Order  | Step | Description |
| ------------- | ------------- | ------------- |
| 1 | [Train Model](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L870) | We fine-tune a BERT-Base Transformer on a sentiment-classification task for visualization. This can be changed to fit the needs of the user. |
| 2 | [Extract Attention Weights and Gradients](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L932) | As attention weights are the backbone of Dodrio's visualization goals, this step is very important for many of the visualization components. We also extract gradients, which a user can experiment with in the Attention Head Overview. |
| 3 | [Generate Saliency Scores](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L1037) | Saliency scores are necessary for many views in Dodrio, most notably the Semantic Attention Graph. If present, we should use ground-truth sentiment scores. |
| 4 | [Generate Semantic Sorting List](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L1165) | The Semantic Sorting List ranks all attention heads by their semantic significance.* It is necessary in the Attention Head Overview and Dependency View. |
| 5 | [Generate Dependency Tree](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L1200) | Dependency relations are necessary for the Dependency View and the Syntactic Sorting List. If no ground-truth POS tags are present, we use the [CoreNLP Parser](https://stanfordnlp.github.io/CoreNLP/), but if a user has a dataset with true POS tags, they can edit the [`stanza.Pipeline`](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L1206) as documented [here](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L1206). |
| 6 | [Generate Syntactic Sorting List](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L1275) | The Syntactic Sorting List ranks all attention heads by their syntactic significance.* It is necessary in the Attention Head Overview and Dependency View. |
| 7 | [Generate Confidence Sorting List](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L1355) | The Confidence Sorting List ranks all attention heads by their importance.* It is necessary in the Attention Head Overview and Dependency View. |
| 8 | [Generate Sentence Selection Data](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L1385) | We generate the UMAP embedding data from the model and necessary data to populate the data in the table from the Sentence Selection View. The table data will have to be customized depending on the NLP task being visualized. |
| 9 | [Generate Atlas List](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L1474) | We use the Atlas List to encode the Attention Head Overview. |

\*The semantic, syntactic, and confidence sorting data calculations are explained in [our paper](https://arxiv.org/abs/2103.14625).

By default, Dodrio visualizes a fine-tuned [BERT-Base](https://arxiv.org/abs/1810.04805) model on a sentiment classification task using [SST2](https://nlp.stanford.edu/sentiment/index.html), a [GLUE benchmark](https://gluebenchmark.com/) movie review dataset. If you wish to visualize a different model or a different dataset, here are some pointers for the changes in [`dodrio-data-gen.py`](dodrio-data-gen.py) to generate the necessary files for Dodrio.

## Swap out Model

### Set Constants

To fine-tune a different transformer model, begin by setting [`trained_model`](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L64) to `false` to indicate that the model has not been trained along with setting [`num_layers`](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L67) to the number of self-attention layers in the new model and [`num_heads`](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L68) to the number of attention heads per layer. For the training process, you can adjust the [hyperparameters](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L883) as well.

### Swap Model

To swap out to model when generating the necessary files, you will need to change occurrences that load the model using [`BertForSequenceClassification`](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L349) depending on the task the model is fine-tuned on.

## Swap out Dataset

### Set Constants

If you change the dataset being visualized, should start by setting constants like [`num_labels`](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L65) depending on the number of labels in a dataset for classification tasks along with the accompanying [`class_label`](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L66) dictionary, which maps integers to their corresponding class label. You should also edit [`dataset_name`](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L69), so that output files have the appropriate dataset name appended to the filename.

### Swap Dataset

You should start by swapping out the loaded models in [`dataset_train`](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L892), [`dataset_vali`](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L891), and [`dataset_test`](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L873). The primary change needed, so that the correct files can be generate across datasets are changes to the function [`collate_sst2`](https://github.com/poloclub/dodrio/blob/dd7a98bb26335cf960e7e508b683ff02d4a4a1ea/data-generation/dodrio-data-gen.py#L182) (which should be renamed as well). Changes to this function will affect how entries within the dataset are processed/tokenized. For non-classification NLP tasks, more significant changes will need to be made across the file to support visualization in Dodrio.
For the demo, we choose the sample with `instanceID=1562`. You would need to change this variable across [different views](https://github.com/poloclub/dodrio/search?q=instanceID) for your custom dataset.
If you have any questions or problems, feel free to [open an issue](https://github.com/poloclub/dodrio/issues/new/choose).