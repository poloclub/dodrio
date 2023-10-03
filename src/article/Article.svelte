<script>
  import Youtube from './Youtube.svelte';
  let currentPlayer;
</script>

<style lang="scss">
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
    border-bottom: 1px solid #eaecef;
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
    color: #3273dc;
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
  .figure,
  .video {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .dodrio-text {
    color: hsl(27, 47%, 26%);
    font-family: 'Fredoka One';
  }

  .paper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    margin-top: 30px;
  }

  .paper-image {
    height: 100%;
    border-radius: 5px;
    border: 2px solid hsla(0, 0%, 90%);
    margin-right: 15px;

    img {
      height: 110px;
    }

    &:hover {
      box-shadow: 2px 2px 3px hsla(0, 0%, 0%, 0.1);
    }
  }

  .paper-info__title {
    font-weight: 500;
    a {
      color: #444;
    }
  }

  .paper-info {
    display: flex;
    flex-direction: column;
  }
</style>

<body>
  <div id="description">
    <h2>
      What is <span class="dodrio-text"
        ><img
          class="icon is-rounded"
          src="PUBLIC_URL/figures/dodrio-logo.svg"
          style="height: 30px; width: 30px;"
          alt="Dodrio logo"
        />&nbsp;Dodrio</span
      >?
    </h2>
    <p>
      <a
        href="https://arxiv.org/pdf/1706.03762.pdf"
        title="Attention Is All You Need">Transformers</a
      >
      are sequence transduction models that excel at modeling long-term dependencies
      with non-sequential processing. These attributes have made Transformers pervasive
      in the NLP domain as natural language tasks benefit from the multi-headed attention
      mechanism to more effectively model longer text, and non-sequential computations
      no longer inhibit parallelization. Transformers now replace
      <a
        href="http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.676.4320&rep=rep1&type=pdf"
        title="Long Short-Term Memory">LSTMs</a
      >
      as the state-of-the-art model architecture for
      <a
        href="https://www.aclweb.org/anthology/W18-5446.pdf"
        title="GLUE NLP Benchmarks">NLP tasks</a
      >.
    </p>
    <p>
      We present <span class="dodrio-text">Dodrio</span>, an interactive
      visualization tool to help NLP researchers and practitioners analyze and
      compare attention mechanisms with linguistic knowledge.
    </p>
    <h2>Why is <span class="dodrio-text">Dodrio</span> useful?</h2>
    <p>
      In a large, pre-trained, high-performing model like <a
        href="https://www.aclweb.org/anthology/N19-1423.pdf"
        title="BERT">BERT</a
      >, there are 12 layers each with 12 distinct self-attention heads.
      Attention heads in Transformers are comprised of weights incurred from
      tokens when calculating the next representation of the current token.
      These attention weights then make up an attention map at every attention
      head (a detailed explanation of this matrix calculation is available
      <a
        href="http://jalammar.github.io/illustrated-transformer/"
        title="Self-attention Calculation">here</a
      >). As every token in a sentence attends to every other token, we have 12
      &times; 12 &times; number of tokens &times; number of tokens attention
      weights in BERT per text instance! In addition, researchers find some
      attention heads are correlated to linguistic knowledge such as word
      semantics and text syntactic dependencies. Therefore, to more easily
      analyze attention weights, researchers need (1) <em>abstractions</em> and
      (2) <em>linguistic knowledge contexts</em>.
    </p>
    <p>
      <span class="dodrio-text">Dodrio</span> addresses the challenges of
      interpreting attention weights through an interactive visualization system
      that provides <em>attention head summarization</em> and
      <em>semantic and syntractic knowledge contexts</em>. By identifying the
      linguistic properties that an attention head attends to in the
      <em>Attention Head Overview</em>
      (bottom right), you can click the attention head to explore the semantic
      and syntactic significance of the sentence at the selected attention head.
      If you are interested in the lexical dependencies in a sentence, you can
      explore a syntactically important head in the <em>Dependency View</em> and
      accompanying <em>Comparison View</em> (top), while semantically important
      heads can be investigated in the <em>Semantic Attention Graph</em> view
      (bottom left). We encourage you to further investigate the multi-headed
      attention mechanism across various text instances with interesting
      linguistic features (eg. coreferences, word sense, etc.) in the
      <em>Instance Selection View</em>
      by clicking the
      <img
        class="icon is-rounded"
        src="PUBLIC_URL/figures/edit.svg"
        alt="edit icon"
      /> icon in the toolbar at the top of the interface.
    </p>
    <h2>Interactive features</h2>
    <ol>
      <li>
        <strong>Explore sentences with interesting lexical features</strong> by
        changing the active instance being visualized
        <img
          class="icon is-rounded"
          src="PUBLIC_URL/figures/edit.svg"
          alt="edit sentence icon"
        /> to understand how a Transformer attends to tokens in a sentence when solving
        language tasks.
      </li>
      <li>
        <strong>Open the expanded <em>Attention Head Overview</em></strong> by
        clicking the
        <img
          class="is-rounded"
          style="height: 26px;"
          src="PUBLIC_URL/figures/article-overview-detail.png"
          alt="detail icon"
        /> button to see an detailed overview of attention heads.
      </li>
      <li>
        <strong
          >Edit the <em>Semantic Attention Graph</em> visualization parameters</strong
        >
        to more easily identify strong attention weights and customize the graph
        representation by adjusting the parameters in
        <i class="fas fa-sliders-h" />.
      </li>
      <li>
        <strong>Filter dependency relations</strong> visualized by selecting the
        <img
          class="is-rounded"
          style="height: 26px;"
          src="PUBLIC_URL/figures/article-syntactic-rel-selection.png"
          alt="filter relations icon"
        /> icon in the upper toolbar.
      </li>
    </ol>
    <h2>Video Tutorial</h2>
    <ul>
      <li class="video-link" on:click={currentPlayer.play(0)}>
        Dodrio Introduction
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
      <Youtube
        videoId="qB-T9j7UTgE"
        playerId="demo_video"
        bind:this={currentPlayer}
      />
    </div>

    <h2>How is <span class="dodrio-text">Dodrio</span> implemented?</h2>
    <p>
      <span class="dodrio-text">Dodrio</span> visualizes Transformer data
      generated offline as detailed
      <a href="https://github.com/poloclub/dodrio/tree/master/data-generation"
        >here</a
      >. Try visualizing your own model/dataset! The entire interactive system
      is written in Javascript using
      <a href="https://svelte.dev/"><em>Svelte</em></a>
      framework and <a href="https://d3js.org/"><em>D3.js</em></a> for
      visualizations. You only need a web browser to start exploring the
      attention mechanism in complex Transformers today!

      <span class="dodrio-text">Dodrio</span> is an
      <a href="https://github.com/poloclub/dodrio">open-source project</a>; if
      you have any questions, feel free to open an issue
      <a href="https://github.com/poloclub/dodrio/issues">here</a>. To learn
      more about <span class="dodrio-text">Dodrio</span>, please check out our
      pre-print paper
      <a href="https://arxiv.org/abs/2103.14625"
        >"Dodrio: Exploring Transformer Models with Interactive Visualization."</a
      >
    </p>

    <div class="paper">
      <div class="paper-image">
        <a href="https://arxiv.org/abs/2103.14625">
          <!-- <img src='https://i.imgur.com/PqfUQEN.png' alt='paper'> -->
          <img src="https://i.imgur.com/PE4GN50.png" alt="paper" />
        </a>
      </div>

      <div class="paper-info">
        <div class="paper-info__title">
          <a href="https://arxiv.org/abs/2103.14625">
            Dodrio: Exploring Transformer Models with Interactive Visualization
          </a>
        </div>
        <div class="paper-info__author">
          <a href="https://zijie.wang/">Zijie J. Wang</a>,
          <a href="https://www.linkedin.com/in/robert-turko/">Robert Turko</a>,
          and
          <a href="https://www.cc.gatech.edu/~dchau/">Duen Horng (Polo) Chau</a
          >.
        </div>
        <div class="paper-info__venue">
          <em>arXiv preprint arXiv:2103.14625. 2021.</em>
        </div>
      </div>
    </div>

    <h2>Who developed <span class="dodrio-text">Dodrio</span>?</h2>
    <p>
      <span class="dodrio-text">Dodrio</span> was created by
      <a href="https://zijie.wang/">Jay Wang</a>,
      <a href="https://www.linkedin.com/in/robert-turko/">Robert Turko</a>, and
      <a href="https://www.cc.gatech.edu/~dchau/">Polo Chau</a> in the College of
      Computing at Georgia Tech. This work was supported in part by NSF grants IIS-1563816,
      CNS-1704701, NASA NSTRF, DARPA GARD, gifts from Bosch, Intel, NVIDIA, Google,
      Amazon.
    </p>
  </div>
</body>
