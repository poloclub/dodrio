<script>
  import Header from './Header.svelte';
  import GraphView from './GraphView.svelte';
  import Dependency from './dependency-view/Dependency.svelte';
  import Atlas from './Atlas.svelte';
  import AtlasSide from './AtlasSide.svelte';
  import Tooltip from './TooltipGlobal.svelte';
  import LowerAtlas from './LowerAtlas.svelte';
  import TableModal from './TableModal.svelte';
  import { graphViewConfigStore, instanceViewConfigStore,
    mapViewConfigStore, lowerMapViewConfigStore, comparisonViewStore,
    tooltipConfigStore, sideStore } from './store';
  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  // Set up the tooltip
  let tooltip = null;
  let atlasSVGWidth = null;
  let atlasSVGHeight = null;
  const headerHeight = 50;

  let downButton;
  let buttonDown = true;
  let downButtonPos = {
    width: 50,
    height: 20
  };

  let tooltipConfig = {
    show: false,
    html: '1.23',
    left: 0,
    top: 0,
    width: 80,
    maxWidth: 80,
    fontSize: '1em'
  };

  tooltipConfigStore.subscribe(value => {tooltipConfig = value;});

  let sideInfo = {};
  sideStore.subscribe(value => {sideInfo = value;});

  let lowerContainerDIV = null;
  let graphViewDIV = null;
  let graphViewConfig = {
    compWidth: null,
    compHeight: null
  };
  
  let originalInstanceViewHeight = null;
  let instanceViewDIV = null;
  let instanceViewConfig = {
    compWidth: null,
    compHeight: null
  };

  let comparisonViewConfig = {};
  comparisonViewStore.subscribe(value => {
    comparisonViewConfig = value;
  });

  let mapViewDIV = null;
  let mapViewConfig = {
    compWidth: null,
    compHeight: null
  };

  let lowerMapViewDIV = null;
  let lowerMapViewConfig = {
    compWidth: null,
    compHeight: null
  };

  /**
   * Open the large map view.
   */
  const atlasOpened = () => {
    mapViewDIV.style['display'] = '';
    mapViewDIV.style['opacity'] = '1';
  };

  /**
   * Close the large map view.
   */
  const atlasClosed = () => {

    d3.select(mapViewDIV)
      .select('.legend-container')
      .style('display', 'none');

    let svg =  d3.select(mapViewDIV)
      .select('.atlas-svg-container')
      .style('width', '100%')
      .style('height', '100%')
      .select('.atlas-svg-full');

    atlasSVGWidth = svg.attr('width');
    atlasSVGHeight = svg.attr('height');

    svg.attr('width', null)
      .attr('height', null)
      .style('padding-top', '36px')
      .style('padding-left', '8px')
      .style('width', '100%')
      .style('height', '100%');
    
    mapViewDIV.style['width'] = `${lowerMapViewConfig.compWidth}px`;
    mapViewDIV.style['height'] = `${lowerMapViewConfig.compHeight}px`;
    mapViewDIV.style['opacity'] = 0;

    const transitionEnd = () => {
      mapViewDIV.style['display'] = 'none';
      mapViewDIV.style['visibility'] = '';
      mapViewDIV.style['width'] = '1000px';
      mapViewDIV.style['height'] = '100%';

      d3.select(mapViewDIV)
        .select('.legend-container')
        .style('display', null);

      d3.select(mapViewDIV)
        .select('.atlas-svg-container')
        .style('width', null)
        .style('height', null)
        .select('.atlas-svg-full')
        .style('padding-top', null)
        .style('padding-left', null)
        .style('width', null)
        .style('height', null)
        .attr('width', atlasSVGWidth)
        .attr('height', atlasSVGHeight);

      mapViewDIV.removeEventListener('transitionend', transitionEnd);
    };

    mapViewDIV.addEventListener('transitionend', transitionEnd);
  };

  const downButtonClicked = () => {

    // Enter comparison view
    if (buttonDown) {
      instanceViewDIV.style.height = '100%';
      lowerContainerDIV.style.bottom = `-${graphViewConfig.compHeight - 10}px`;
      downButton.style.top = `${originalInstanceViewHeight + headerHeight
        - downButtonPos.height / 2 + graphViewConfig.compHeight - 10}px`;

      comparisonViewConfig.height = Math.floor(instanceViewDIV.clientHeight) - 5;
      comparisonViewConfig.inComparison = true;
      comparisonViewStore.set(comparisonViewConfig);
    } else {
      // Exit comparison view
      instanceViewDIV.style.height = '34%';
      lowerContainerDIV.style.bottom = '0px';
      downButton.style.top = `${originalInstanceViewHeight + headerHeight
        - downButtonPos.height / 2}px`;

      comparisonViewConfig.height = originalInstanceViewHeight - 5;
      comparisonViewConfig.inComparison = false;
      comparisonViewStore.set(comparisonViewConfig);
    }

    buttonDown = !buttonDown;
  };

  const comparisonOpenHandler = () => {
    instanceViewDIV.style.height = '100%';
    lowerContainerDIV.style.bottom = `-${graphViewConfig.compHeight - 10}px`;
    downButton.style.top = `${originalInstanceViewHeight + headerHeight
      - downButtonPos.height / 2 + graphViewConfig.compHeight - 10}px`;
    buttonDown = false;

    comparisonViewConfig.height = Math.floor(instanceViewDIV.clientHeight) - 5;
    comparisonViewConfig.inComparison = true;
    comparisonViewStore.set(comparisonViewConfig);
  };

  const comparisonCloseHandler = () => {
    instanceViewDIV.style.height = '34%';
    lowerContainerDIV.style.bottom = '0px';
    downButton.style.top = `${originalInstanceViewHeight + headerHeight
      - downButtonPos.height / 2}px`;
    buttonDown = true;

    comparisonViewConfig.height = originalInstanceViewHeight - 5;
    comparisonViewConfig.inComparison = false;
    comparisonViewStore.set(comparisonViewConfig);
  };

  onMount(() => {
    graphViewConfig.compWidth = Math.floor(graphViewDIV.clientWidth);
    graphViewConfig.compHeight = Math.floor(graphViewDIV.clientHeight);
    graphViewConfigStore.set(graphViewConfig);

    instanceViewConfig.compWidth = Math.floor(instanceViewDIV.clientWidth);
    // Need to offset the horizontal scroll bar height
    instanceViewConfig.compHeight = Math.floor(instanceViewDIV.clientHeight) - 5;
    instanceViewConfigStore.set(instanceViewConfig);
    originalInstanceViewHeight = Math.floor(instanceViewDIV.clientHeight);

    lowerMapViewConfig.compWidth = Math.floor(lowerMapViewDIV.clientWidth);
    lowerMapViewConfig.compHeight = Math.floor(lowerMapViewDIV.clientHeight);
    lowerMapViewConfigStore.set(lowerMapViewConfig);

    // Need to offset the padding
    mapViewConfig.compWidth = Math.floor(mapViewDIV.clientWidth - 10);
    mapViewConfig.compHeight = Math.floor(mapViewDIV.clientHeight - 10);
    mapViewConfigStore.set(mapViewConfig);

    // Hide the large map view
    mapViewDIV.style['opacity'] = '0';
    mapViewDIV.style['visibility'] = 'hidden';
    atlasClosed();

    // Position the down button
    // console.log(headerHeight, downButtonPos.height);
    downButton.style.top = `${Math.floor(instanceViewDIV.clientHeight) + headerHeight
      - downButtonPos.height / 2}px`;
    downButton.style.left = `${graphViewConfig.compWidth - downButtonPos.width / 2}px`;
    downButton.style.width = `${downButtonPos.width}px`;
    downButton.style.height = `${downButtonPos.height}px`;
    downButton.style.visibility = 'visible';
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
    // overflow: hidden;
    overflow: show;
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

  .instance-container {
    width: 100%;
    // height: 100%;
    height: 34%;
    overflow: hidden;
    box-sizing: border-box;
  }

  .lower-container {
    border-top: solid 1px $gray-border;
    width: 100%;
    height: 66%;
    overflow: hidden;
    box-sizing: border-box;
    display: flex;
    flex-direction: row;

    background: hsla(0, 0%, 99%);
    box-shadow: 0 -5px 5px hsla(0, 0%, 0%, 0.07);

    position: absolute;
    bottom: 0;

    transition: bottom 300ms ease-in-out;
  }

  .graph-container {
    //border: solid 1px $gray-border;
    width: 100%;
    height: 100%;
    overflow: hidden;
    box-sizing: border-box;
    position: relative;
  }

  .lower-atlas-container {
    width: 60%;
    height: 100%;
    overflow: hidden;
    box-sizing: border-box;
    border-left: solid 1px $gray-border;
  }

  .atlas-container {
    width: 1000px;
    max-width: 100%;
    height: 100%;
    position: absolute;
    right: 0;
    bottom: 0;
    overflow: hidden;
    z-index: 11;
    padding: 10px 0 0 10px;
    transition: width 500ms ease-in-out, height 500ms ease-in-out, opacity 500ms ease-in-out;
  }

  .atlas-sidebar {
    justify-self: flex-end;
    background: hsl(0, 0%, 98%);
    box-shadow: -3px 0 5px hsla(0, 0%, 0%, 0.1);
    position: absolute;
    right: 989px;
    top: 300px;
    width: 400px;
    height: 450px;
  }

  .hidden {
    visibility: hidden;
  }

  :global(.atlas-container.closed) {
    transition: right 700ms ease-in-out, background-color 100ms ease-in-out 600ms;
  }

  .down-button {
    position: absolute;
    width: 50px;
    height: 8px;
    font-size: 0.7em;
    visibility: hidden;
    border-radius: 15px;
    z-index: 10;
    cursor: pointer;

    border: 1px solid $gray-border;
    background: white;
    box-shadow: 0px 0px 6px hsla(0, 0%, 0%, 0.2);
    transition: background 300ms ease-in-out, top 300ms ease-in-out;

    &:hover {
      background: change-color($brown-icon, $lightness:90%);
    }
  }

  .icon-wrapper {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    opacity: 1;

    svg {
      height: 20px;
      color: $brown-icon;
    }
  }

  .up-down {
    transform: rotate(180deg);
  }

</style>

<div class='main'>

  <Header />

  <Tooltip bind:this={tooltip}/>
 
  <div class='main-content'>
    <div class='select-container'>

    </div>

    <div class='attention-container'>
      <!-- Instance View -->
      <div class='instance-container' bind:this={instanceViewDIV}>
        <Dependency on:close={comparisonCloseHandler} on:open={comparisonOpenHandler}/>
      </div>

      
      <div class='lower-container' bind:this={lowerContainerDIV}>
        <!-- Graph View -->
        <div class='graph-container' bind:this={graphViewDIV} >
          <GraphView />
        </div>

        <div class='lower-atlas-container' bind:this={lowerMapViewDIV}>
          <LowerAtlas on:open={atlasOpened}/>
        </div>
      </div>


      <!-- Map view -->
      <div class='atlas-container' style='visibility=hidden' bind:this={mapViewDIV}>
        <Atlas on:close={atlasClosed}/>
      </div>

      <div class='atlas-sidebar' class:hidden={!sideInfo.show}>
        <AtlasSide />
      </div>

    </div>

    <TableModal on:xClicked={() => {}} on:urlTyped={() => {}}/>

    <div class='down-button' bind:this={downButton}>
      <div class='icon-wrapper' on:click={downButtonClicked}>
        <svg class='icon-down' class:up-down={!buttonDown} viewBox='0 0 512 512'>
          <path fill='none' stroke='currentColor' stroke-linecap='round'
            stroke-linejoin='round' stroke-width='80' d='M112 184l144 144 144-144'/>
        </svg>
      </div>
    </div>

  </div>

</div>