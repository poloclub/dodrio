<script>
  import Header from './Header.svelte';
  import GraphView from './GraphView.svelte';
  import EmbeddingView from './EmbeddingView.svelte';
  import Dependency from './dependency-view/Dependency.svelte';
  import Atlas from './Atlas.svelte';
  import TableView from './TableView.svelte';
  import { graphViewConfigStore, embeddingViewConfigStore, instanceViewConfigStore,
    tableViewConfigStore, mapViewConfigStore } from './store';
  import { onMount } from 'svelte';

  let graphViewDIV = null;
  let graphViewConfig = {
    compWidth: null,
    compHeight: null
  };
  
  let embeddingViewDIV = null;
  let embeddingViewConfig = {
    compWidth: null,
    compHeight: null
  };
  
  let instanceViewDIV = null;
  let instanceViewConfig = {
    compWidth: null,
    compHeight: null
  };

  let mapViewDIV = null;
  let mapViewConfig = {
    compWidth: null,
    compHeight: null
  };

  let tableViewDIV = null;
  let tableViewConfig = {
    compWidth: null,
    compHeight: null
  };

  const atlasOpened = () => {
    mapViewDIV.style['right'] = '0';
    mapViewDIV.style['background-color'] = 'hsla(0, 100%, 100%, 1)';
    mapViewDIV.classList.remove('closed');
  };

  const atlasClosed = () => {
    mapViewDIV.style['right'] = `-${Math.floor(mapViewConfig.compWidth) - 60}px`;
    mapViewDIV.style['background-color'] = 'hsla(0, 100%, 100%, 0)';
    mapViewDIV.classList.add('closed');
  };

  onMount(() => {
    graphViewConfig.compWidth = Math.floor(graphViewDIV.clientWidth);
    graphViewConfig.compHeight = Math.floor(graphViewDIV.clientHeight);
    graphViewConfigStore.set(graphViewConfig);

    instanceViewConfig.compWidth = Math.floor(instanceViewDIV.clientWidth);
    // Need to offset the horizontal scroll bar height
    instanceViewConfig.compHeight = Math.floor(instanceViewDIV.clientHeight) - 5;
    instanceViewConfigStore.set(instanceViewConfig);

    // mapViewConfig.compWidth = Math.floor(mapViewDIV.clientWidth);
    // mapViewConfig.compHeight = Math.floor(mapViewDIV.clientHeight);
    // mapViewConfigStore.set(mapViewConfig);

    // embeddingViewConfig.compWidth = Math.floor(embeddingViewDIV.clientWidth);
    // embeddingViewConfig.compHeight = Math.floor(embeddingViewDIV.clientHeight);
    // embeddingViewConfigStore.set(embeddingViewConfig);

    // tableViewConfig.compWidth = Math.floor(tableViewDIV.clientWidth);
    // tableViewConfig.compHeight = Math.floor(tableViewDIV.clientHeight);
    // tableViewConfigStore.set(tableViewConfig);
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
    // width: min(700px, 80%);
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
    overflow: visible;
    flex-direction: column;
    box-sizing: border-box;
    position: relative;
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
    height: 100%;
    // height: 50%;
    overflow: hidden;
    box-sizing: border-box;
  }

  .graph-container {
    //border: solid 1px $gray-border;
    width: 100%;
    // height: 100%;
    overflow: hidden;
    box-sizing: border-box;
  }

  .atlas-container {
    width: 100%;
    max-width: 100%;
    height: 100%;
    position: absolute;
    right: 0;
    background-color: hsla(0, 100%, 100%, 1);
    transition: right 500ms ease-in-out, background-color 100ms ease-in-out;
    overflow: hidden;
    z-index: 10;
  }

  :global(.atlas-container.closed) {
    transition: right 700ms ease-in-out, background-color 100ms ease-in-out 600ms;
  }

</style>

<div class='main'>

  <Header />
 
  <div class='main-content'>
    <div class='select-container'>

      <!-- Embedding view -->
      <!-- <div class='embedding-container' bind:this={embeddingViewDIV}>
        <EmbeddingView />
      </div> -->

      <!-- Table view -->
      <!-- <div class='table-container' bind:this={tableViewDIV}>
        <TableView />
      </div> -->

    </div>

    <div class='attention-container'>
      <!-- Instance View -->
      <div class='instance-container' bind:this={instanceViewDIV}>
        <Dependency />
      </div>

      <!-- Graph View -->
      <div class='graph-container' bind:this={graphViewDIV} >
        <!-- <GraphView /> -->
      </div>

      <!-- Map view -->
      <!-- <div class='atlas-container' bind:this={mapViewDIV}>
        <Atlas on:open={atlasOpened} on:close={atlasClosed}/>
      </div> -->

    </div>

  </div>
  <!-- <GraphView /> -->

</div>