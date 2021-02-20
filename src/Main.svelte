<script>
  import Header from './Header.svelte';
  import GraphView from './GraphView.svelte';
</script>

<style type='text/scss'>
  @import 'define';
  
  .main-content {
    border: solid 3px red;
    height: min(800px, calc(100vh - 50px));
    width: 100vw;
    display: flex;
  }

  .select-container {
    border: solid 3px red;
    width: min(700px, 80%);
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .attention-container {
    border: solid 2px red;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .embedding-container {
    border: solid 2px red;
    width: 100%;
    height: 80%;
  }

  .table-container {
    border: solid 2px red;
    width: 100%;
    height: 100%;
  }

  .instance-container {
    border: solid 2px red;
    width: 100%;
    height: 50%;
  }

  .graph-container {
    border: solid 2px red;
    width: 100%;
    height: 100%;
  }


</style>

<div class='main'>

  <Header />
 
  <div class='main-content'>
    <div class='select-container'>

      <!-- Embedding view -->
      <div class='embedding-container'>

      </div>

      <!-- Table view -->
      <div class='table-container'>

      </div>

    </div>

    <div class='attention-container'>
      <!-- Instance View -->
      <div class='instance-container'>

      </div>

      <!-- Graph View -->
      <div class='graph-container'>
        <!-- <GraphView /> -->
      </div>

    </div>

  </div>
  <!-- <GraphView /> -->

</div>