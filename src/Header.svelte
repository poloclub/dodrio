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
    font-size: 2rem;
    color: white;
    font-family: 'Fredoka One';
    margin-right: 10px;
  }

  #logo-icon {
    width: 26px;
    margin-right: 10px;
  }

  #logo-tagline {
    font-size: 1.5rem;
    color: $brown-light;
    font-family: 'Neucha';
  }

  .icons {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    color: white;

    :not(:last-child) {
      margin-right: 15px;
    }
  }

  .icon {
    font-size: 1.5rem;
    display: flex;
    align-items: center;
    color: white;
  }

</style>

<div id="header">

  <div id="logo">
    <div id='logo-icon'>
      <img src='PUBLIC_URL/figures/dodrio-logo.svg' alt='logo'>
    </div>
    <div id="logo-text">
      Dodrio
    </div>
    
    <div id='logo-tagline'>
      Exploring transformer models in your browser! 
    </div>
  </div>

  <div class="icons">
  
    <a class="icon-a" target="_blank" href="https://arxiv.org/abs/2103.14625">
      <div class="icon" title="Research paper">
        <i class="fas fa-file-pdf"></i>
      </div>
    </a>

    <a target="_blank" href="https://youtu.be/uboTKqPNU5Y">
      <div class="icon" title="Demo video">
        <i class="fab fa-youtube"></i>
      </div>
    </a>

    <a target="_blank" href="https://github.com/poloclub/dodrio">
      <div class="icon" title="Open-source code">
        <i class="fab fa-github"></i>
      </div>
    </a>

  </div>
</div>