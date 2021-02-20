<script>
</script>

<style type='text/scss'>
  @import 'define';

  #header {
    height: 50px;
    display: flex;
    padding: 0 20px;
    align-items: center;
    background: $brown-dark;
    justify-content: space-between;
  }

  #logo {
    display: flex;
    align-items: baseline;
  }

  #logo-text {
    font-size: 30px;
    color: white;
    font-family: 'Fredoka One';
    margin-right: 10px;
  }

  #logo-tagline {
    font-size: 23px;
    color: $brown-light;
    font-family: 'Neucha';
  }

  .icons {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    color: white;
  }

  .icon {
    font-size: 1.4rem;
    margin-left: 15px;
    display: flex;
    align-items: center;
    color: white;
  }

</style>

<div id="header">

  <div id="logo">
    <div id="logo-text">
      Dodrio
    </div>
    
    <div id='logo-tagline'>
      Exploring transformer models in your browser! 
    </div>
  </div>

  <div class="icons">
  
    <a target="_blank" href="https://arxiv.org/abs/2004.15004">
      <div class="icon" title="Research paper">
        <i class="fas fa-file-pdf"></i>
      </div>
    </a>

    <a target="_blank" href="https://youtu.be/HnWIHWFbuUQ">
      <div class="icon" title="Demo video">
        <i class="fab fa-youtube"></i>
      </div>
    </a>

    <a target="_blank" href="https://github.com/poloclub/cnn-explainer">
      <div class="icon" title="Open-source code">
        <i class="fab fa-github"></i>
      </div>
    </a>

  </div>
</div>