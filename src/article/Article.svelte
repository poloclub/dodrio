<script>
  import Youtube from './Youtube.svelte';
  let currentPlayer;
</script>

<style>
	#description {
    margin-bottom: 60px;
    margin-left: auto;
    margin-right: auto;
    max-width: 78ch;
  }
  #description h2 {
    color: #444;
    font-size: 40px;
    font-weight: 450;
    margin-bottom: 12px;
    margin-top: 60px;
  }
  #description h4 {
    color: #444;
    font-size: 32px;
    font-weight: 450;
    margin-bottom: 8px;
    margin-top: 44px;
  }
  #description h6 {
    color: #444;
    font-size: 24px;
    font-weight: 450;
    margin-bottom: 8px;
    margin-top: 44px;
  }
  #description p {
    margin: 16px 0;
  }
  #description p img {
    vertical-align: middle;
  }
  #description .figure-caption {
    font-size: 13px;
    margin-top: 5px;
  }
  #description ol {
    margin-left: 40px;
  }
  #description p, 
  #description div,
  #description li {
    color: #555;
    font-size: 17px;
    line-height: 1.6;
  }
  #description small {
    font-size: 12px;
  }
  #description ol li img {
    vertical-align: middle;
  }
  #description .video-link {
    color: #3273DC;
    cursor: pointer;
    font-weight: normal;
    text-decoration: none;
  }
  #description ul {
      list-style-type: disc;
      margin-top: -10px;
      margin-left: 40px;
      margin-bottom: 15px;
  }
    
  #description a:hover, 
  #description .video-link:hover {
    text-decoration: underline;
  }
  .figure, .video {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .dodrioText {
    color: hsl(27, 47%, 26%);
    font-family: 'Fredoka One';
  }
</style>

<body>
  <div id="description">
    <h2>What is <span class='dodrioText'><img class="icon is-rounded" src="PUBLIC_URL/figures/dodrio-logo.svg" alt="Dodrio logo">&nbsp;Dodrio</span>?</h2>
      <p>
  		  <a href="https://arxiv.org/pdf/1706.03762.pdf" title="Attention Is All You Need">Transformers</a> are sequence transduction models that excel at modeling long-term dependencies with non-sequential processing. These attributes have made Transformers pervasive in the NLP domain as natural language tasks benefit from the multi-headed attention mechanism to more effectively model longer text, and non-sequential computations no longer inhibit parallelization. Transformers now replace <a href="http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.676.4320&rep=rep1&type=pdf" title="Long Short-Term Memory">LSTMs</a> as the state-of-the-art model architecture for <a href="https://www.aclweb.org/anthology/W18-5446.pdf" title="GLUE NLP Benchmarks">NLP tasks</a>.
      </p>
      <p>
        We present <span class='dodrioText'>Dodrio</span>, an interactive visualization tool to help NLP researchers and practitioners analyze and compare attention mechanisms with linguistic knowledge.
      </p>
    <h2>Why is <span class='dodrioText'>Dodrio</span> useful?</h2>
    	<p>
    		In a large, pre-trained, high-performing model like <a href="https://www.aclweb.org/anthology/N19-1423.pdf" title="BERT">BERT</a>, there are 12 layers each with 12 distinct attention heads. Attention heads in Transformers are comprised of weights incurred from tokens when calculating the next representation of the current token. We call these attention weights, which make up an attention map at every attention head (a detailed explanation of this matrix calculation is available <a href="http://jalammar.github.io/illustrated-transformer/" title="Self-attention Calculation">here</a>). As every token in a sentence attends to every other token, we have 12 &times; 12 &times; number of tokens &times; number of tokens attention weights in BERT per text instance! We need more context to identify interesting attention weights.
    	</p>
      <p>
        <span class='dodrioText'>Dodrio</span> addresses the challenges of interpretting attention weights with interactive visualization. By identifying the linguistic properties that an attention head attends to in the <em>Attention Head Overview</em>, a user can click the attention head to explore the semantic and syntactic significance of the sentence at the selected attention head. If you are interested in the lexical dependencies in a sentence, you can explore a syntactically important head in the <em>Dependency View</em> and accompanying <em>Comparison View</em>, while semantically important heads can be investigated in the <em>Semantic Attention Graph</em> view. We encourage you to further investigate the multi-headed attention mechanism accross various text instances with interesting linguistic features (eg. coreferences, word sense, etc.) in the <em>Instance Selection View</em> by clicking the <img class="icon is-rounded" src="PUBLIC_URL/figures/edit.svg" alt="edit icon"> icon in the toolbar at the top of the interface.
      </p>
    <h2>Interactive features</h2>
    <ol>
    	<li><strong>Explore sentences with interesting lexical features</strong> by changing the active instance being visualized <img class="icon is-rounded" src="PUBLIC_URL/figures/edit.svg" alt="edit sentence icon"/> to understand how a Transformer attends to tokens in a sentence when solving language tasks.</li>
    	<li><strong>Edit the <em>Semantic Attention Graph</em> visualization parameters</strong> to more easily identify strong attention weights and customize the graph representation by adjusting the parameters in <i class="fas fa-sliders-h"></i>.</li>
    	<li><strong>Filter dependency relations</strong> visualized by selecting the <img class="is-rounded" width="20%" src="PUBLIC_URL/figures/article-syntactic-rel-selection.png" alt="filter relations icon"/> icon in the upper toolbar.</li>
    </ol> 
    <h2>Video Tutorial</h2>
    <ul>
      <li class="video-link" on:click={currentPlayer.play(0)}>
        <span class="dodrioText">Dodrio</span> Introduction
        <small>(0:00-0:08)</small>
      </li>
      <li class="video-link" on:click={currentPlayer.play(8)}>
        <em>Attention Head Overview</em>
        <small>(0:08-0:36)</small>
      </li>
      <li class="video-link" on:click={currentPlayer.play(36)}>
        <em>Semantic Attention Graph</em>
        <small>(0:36-1:19)</small>
      </li>
      <li class="video-link" on:click={currentPlayer.play(79)}>
        <em>Dependency View</em> and <em>Dependency Comparison View</em>
        <small>(1:19-1:49)</small>
      </li>
      <li class="video-link" on:click={currentPlayer.play(109)}>
        <em>Instance Selection View</em>
        <small>(1:49-1:53)</small>
      </li>
      <li class="video-link" on:click={currentPlayer.play(117)}>
        Credits
        <small>(1:57-1:59)</small>
      </li>
    </ul>
    <div class="video">
      <Youtube videoId="uboTKqPNU5Y" playerId="demo_video" bind:this={currentPlayer}/>
    </div>

    <h2>How is <span class='dodrioText'>Dodrio</span> implemented?</h2>
    <p>
      <span class='dodrioText'>Dodrio</span> visualizes Transformer data generated offline as detailed <a href="https://github.com/poloclub/dodrio/tree/master/data-generation">here</a>. Try visualizing your own model/dataset! The entire interactive system is written in Javascript using <a href="https://svelte.dev/"><em>Svelte</em></a> framework and <a href="https://d3js.org/"><em>D3.js</em></a> for visualizations. You only need a web browser to start exploring the attention mechanism in complex Transformers today!
    </p>

    <h2>Who developed <span class='dodrioText'>Dodrio</span>?</h2>
    <p>
      <span class='dodrioText'>Dodrio</span> was created by 
      <a href="https://zijie.wang/">Jay Wang</a>,
      <a href="https://www.linkedin.com/in/robert-turko/">Robert Turko</a>, and
      <a href="https://www.cc.gatech.edu/~dchau/">Polo Chau</a> in the College of Computing at Georgia Tech.
      This work was supported in part by NSF grants IIS-1563816, CNS-1704701, NASA NSTRF, DARPA GARD, gifts from Intel, NVIDIA, Google, Amazon.
    </p>
  </div>
</body>