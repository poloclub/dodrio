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
    // Need to offset the horizontal scroll bar height
    instanceViewConfig.compHeight = Math.floor(instanceViewDIV.clientHeight) - 5;
    instanceViewConfigStore.set(instanceViewConfig);

    tableViewConfig.compWidth = tableViewDIV.clientWidth;
    tableViewConfig.compHeight = tableViewDIV.clientHeight;
    tableViewConfigStore.set(tableViewConfig);
  });

</script>

<style type='text/scss'>
  @import 'define';
  
  .main-content {
    border-bottom: solid 1px $gray-border;
    height: min(800px, calc(100vh - 50px));
    width: 100vw;
    display: flex;
    box-sizing: border-box;
  }

  .select-container {
    border-right: solid 1px $gray-border;
    width: min(700px, 80%);
    height: 100%;
    display: flex;
    overflow:scroll;
    flex-direction: column;
    box-sizing: border-box;
  }

  .attention-container {
    //border: solid 1px $gray-border;
    width: 100%;
    height: 100%;
    display: flex;
    overflow:scroll;
    flex-direction: column;
    box-sizing: border-box;
  }

  .embedding-container {
    border-bottom: solid 1px $gray-border;
    width: 100%;
    height: 80%;
    box-sizing: border-box;
    // overflow:scroll;
  }

  .table-container {
    //border-bottom: solid 1px $gray-border;
    width: 100%;
    height: 100%;
    overflow:scroll;
    box-sizing: border-box;
  }

  .instance-container {
    border-bottom: solid 1px $gray-border;
    width: 100%;
    height: 50%;
    overflow: hidden;
    box-sizing: border-box;
  }

  .graph-container {
    //border: solid 1px $gray-border;
    width: 100%;
    height: 100%;
    overflow: hidden;
    box-sizing: border-box;
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

    <div class='attention-container'>
      <!-- Instance View -->
      <div class='instance-container' bind:this={instanceViewDIV}>
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