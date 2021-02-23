<script>
  import Header from './Header.svelte';
  import GraphView from './GraphView.svelte';
  import EmbeddingView from './EmbeddingView.svelte';
  import Dependency from './Dependency.svelte';
  import TableView from './TableView.svelte';
  import { graphViewConfigStore, embeddingViewConfigStore, instanceViewConfigStore, tableViewConfigStore } from './store';
  import { onMount } from 'svelte';

  let graphViewDIV = undefined;
  let graphViewConfig = {
    compWidth: undefined,
    compHeight: undefined
  };
  
  let embeddingViewDIV = undefined;
  let embeddingViewConfig = {
    compWidth: undefined,
    compHeight: undefined
  };
  
  let instanceViewDIV = undefined;
  let instanceViewConfig = {
    compWidth: undefined,
    compHeight: undefined
  };

  let tableViewDIV = undefined;
  let tableViewConfig = {
    compWidth: undefined,
    compHeight: undefined
  };

  onMount(() => {
    graphViewConfig.compWidth = Math.floor(graphViewDIV.clientWidth);
    graphViewConfig.compHeight = Math.floor(graphViewDIV.clientHeight);
    graphViewConfigStore.set(graphViewConfig);

    embeddingViewConfig.compWidth = Math.floor(embeddingViewDIV.clientWidth);
    embeddingViewConfig.compHeight = Math.floor(embeddingViewDIV.clientHeight);
    embeddingViewConfigStore.set(embeddingViewConfig);

    instanceViewConfig.compWidth = Math.floor(instanceViewDIV.clientWidth);
    instanceViewConfig.compHeight = Math.floor(instanceViewDIV.clientHeight);
    instanceViewConfigStore.set(instanceViewConfig);

    tableViewConfig.compWidth = tableViewDIV.clientWidth;
    tableViewConfig.compHeight = tableViewDIV.clientHeight;
    tableViewConfigStore.set(tableViewConfig);
  });

</script>

<style type='text/scss'>
  @import 'define';
  
  .main-content {
    border: solid 2px $gray-light;
    height: min(800px, calc(100vh - 50px));
    width: 100vw;
    display: flex;
  }

  .select-container {
    border: solid 2px $gray-light;
    width: min(700px, 80%);
    height: 100%;
    display: flex;
    overflow:scroll;
    flex-direction: column;
  }

  .attention-container {
    border: solid 2px $gray-light;
    width: 100%;
    height: 100%;
    display: flex;
    overflow:scroll;
    flex-direction: column;
  }

  .embedding-container {
    border: solid 2px $gray-light;
    width: 100%;
    height: 80%;
    // overflow:scroll;
  }

  .table-container {
    border: solid 2px $gray-light;
    width: 100%;
    height: 100%;
    overflow:scroll;
  }

  .instance-container {
    border: solid 2px $gray-light;
    width: 100%;
    height: 50%;
    overflow:scroll;
  }

  .graph-container {
    border: solid 2px $gray-light;
    width: 100%;
    height: 100%;
    overflow: scroll;
  }


</style>

<div class='main'>

  <Header />
 
  <div class='main-content'>
    <div class='select-container'>

      <!-- Embedding view -->
      <div class='embedding-container' bind:this={embeddingViewDIV}>
        <EmbeddingView />
      </div>

      <!-- Table view -->
      <div class='table-container' bind:this={tableViewDIV}>
        <TableView />
      </div>

    </div>

    <div class='attention-container' bind:this={instanceViewDIV}>
      <!-- Instance View -->
      <div class='instance-container'>
        <Dependency />
      </div>

      <!-- Graph View -->
      <div class='graph-container' bind:this={graphViewDIV} >
        <GraphView />
      </div>

    </div>

  </div>
  <!-- <GraphView /> -->

</div>