<script>
  import { onMount } from 'svelte';
  import Tooltip from './TooltipGlobal.svelte';
  import { lowerMapViewConfigStore, attentionHeadColorStore,
    tooltipConfigStore } from './store';
  import { createEventDispatcher } from 'svelte';
  import * as d3 from 'd3';

  let svg = null;
  let atlasData = null;
  let attentions = null;
  let saliencies = null;
  let tokenSize = null;

  // Tooltip variables
  let tooltipConfig = null;
  tooltipConfigStore.subscribe(value => {tooltipConfig = value;});

  let viewContainer = null;

  const red = d3.hcl(23, 85, 56);
  const purple = d3.hcl(328, 85, 56);
  const blue = d3.hcl(274, 85, 56);

  let instanceID = 1562;
  const dispatch = createEventDispatcher();
  let isShown = true;

  let SVGWidth = 800;
  let SVGHeight = 800;

  let instanceViewConfig = undefined;

  const SVGPadding = {top: 40, left: 10, right: 10, bottom: 3};

  const ease = d3.easeCubicInOut;

  const round = (num, decimal) => {
    return Math.round((num + Number.EPSILON) * (10 ** decimal)) / (10 ** decimal);
  };

  const padZeroLeft = (num, digit) => {
    return Array(Math.max(digit - String(num).length + 1, 0)).join(0) + num;
  };

  const createGraph = () => {

    const layerNum = attentions.length;
    const headNum = attentions[0].length;
    const layerNameWidth = 35;

    let availableWidth = SVGWidth - layerNameWidth - SVGPadding.left - SVGPadding.right;
    let availableHeight = SVGHeight - SVGPadding.top - SVGPadding.bottom;

    let availableLength = Math.min(availableHeight, availableWidth);
    // console.log(SVGHeight, availableLength, availableWidth, availableHeight);
    const gridGap = 8;

    const gridLength = Math.floor((availableHeight - (layerNum - 1) * gridGap) / layerNum);
    const maxOutRadius = gridLength / 2;
    const minOutRadius = 3;

    let adjustedRowGap = Math.floor((availableWidth - maxOutRadius - headNum * gridLength) / (layerNum - 1));
    let adjustedColGap = Math.floor((availableHeight - layerNum * gridLength) / (layerNum - 1));

    svg = d3.select(svg)
      .attr('width', availableWidth + layerNameWidth)
      .attr('height', availableHeight);

    // Add a border
    svg.append('rect')
      .attr('class', 'border-rect')
      .attr('width', availableLength)
      .attr('height', availableLength)
      .style('stroke', 'black')
      .style('fill', 'none');

    let donutGroup = svg.append('g')
      .attr('class', 'donut-group')
      .attr('transform', `translate(${SVGPadding.left + maxOutRadius + layerNameWidth}, ${maxOutRadius})`);
    
    // Create color scale
    let hueScale = d3.scaleLinear()
      .domain([-1, 0, 1])
      .range([red, purple, blue]);

    let lightnessScale = d3.scaleLinear()
      .domain([0, 1])
      .range([130, 40]);

    // Use square root scale
    let outRadiusScale = d3.scaleLinear()
      .domain([0, 1])
      .range([minOutRadius, maxOutRadius]);

    let ringRadiusScale = d3.scaleLinear()
      .domain([0, 1])
      .range([4, 7]);

    let scales = {
      hueScale: hueScale,
      lightnessScale: lightnessScale,
      outRadiusScale: outRadiusScale,
      ringRadiusScale: ringRadiusScale
    };

    let donuts = donutGroup.selectAll('g.donut')
      .data(atlasData)
      .join('g')
      .attr('class', 'donut')
      .style('cursor', 'pointer')
      .attr('transform', d => `translate(${d.head * (maxOutRadius * 2 + adjustedRowGap)},
        ${(layerNum - d.layer - 1) * (maxOutRadius * 2 + adjustedColGap)})`);

    // Draw the donuts
    donuts.each((d, i, g) => drawDonut(d, i, g, scales));

    donuts.on('mouseover',
      (e, d) => {
        // Show the tooltip
        let node = e.currentTarget;
        let position = node.getBoundingClientRect();
        let curWidth = position.right - position.left;

        let tooltipCenterX = position.x + curWidth / 2;
        let tooltipCenterY = position.y - 40;

        tooltipConfig.html = `Layer ${d.layer + 1} Head ${d.head + 1}`;
        tooltipConfig.width = 130;
        tooltipConfig.maxWidth = 130;
        tooltipConfig.left = tooltipCenterX - tooltipConfig.width / 2;
        tooltipConfig.top = tooltipCenterY;
        tooltipConfig.fontSize = '0.8em';
        tooltipConfig.show = true;
        tooltipConfigStore.set(tooltipConfig);
      })
      .on('mouseleave', () => {
        tooltipConfig.show = false;
        tooltipConfigStore.set(tooltipConfig);
      });

    // Draw horizontal lines between rows
    donutGroup.selectAll('g.row-line-group')
      .data(Array(layerNum - 1).fill(0).map( (_, i) => i))
      .join('g')
      .attr('class', 'row-line-group')
      .append('path')
      .attr('d', d => {
        return `M${-maxOutRadius}
        ${(layerNum - d - 1 - 1/2) * (maxOutRadius * 2 + adjustedColGap)}
        L${headNum * (maxOutRadius * 2 + adjustedRowGap) - maxOutRadius}
        ${(layerNum - d - 1 - 1/2) * (maxOutRadius * 2 + adjustedColGap)}`;
      })
      .style('stroke', 'hsla(0, 0%, 0%, 0.1)');

    // Draw the label names
    let nameGroup = svg.append('g')
      .attr('class', 'name-group')
      .attr('transform', `translate(${SVGPadding.left}, ${maxOutRadius})`);
    
    nameGroup.selectAll('g.layer-name-group')
      .data(Array(layerNum).fill(0).map( (_, i) => i))
      .join('g')
      .attr('class', 'layer-name-group')
      .attr('transform', d => `translate(${layerNameWidth - 5},
        ${(layerNum - d - 1) * (maxOutRadius * 2 + adjustedColGap)})`)
      .append('text')
      .text(d => d > 2 ? d + 1 : `Layer ${d + 1}`);

    console.log(atlasData);

    d3.select(viewContainer)
      .select('.head-arrow')
      .style('top', `${70 - 40}px`)
      .style('left', `${availableWidth - 170}px`);

    d3.select(viewContainer)
      .select('.layer-arrow')
      .style('top', `${70}px`)
      .style('left', `${availableWidth + 10}px`);
  };

  const drawDonut = (d, i, g, scales) => {
    let donut = d3.select(g[i]);

    let outRadius = scales.outRadiusScale(d.confidence);
    let ringRadius = scales.ringRadiusScale(d.confidence);
    let inRadius = Math.max(0, outRadius - ringRadius);

    // Draw the rings
    // Arc's center is at (0, 0) on the local coordinate
    let arc = d3.arc()
      .outerRadius(outRadius)
      .innerRadius(0)
      .startAngle(0)
      .endAngle(Math.PI * 2);

    let color = d3.hcl(scales.hueScale(d.syntactic - d.semantic));
    color.l = scales.lightnessScale(Math.max(d.semantic, d.syntactic));

    donut.append('path')
      .attr('class', 'donut-chart')
      .attr('d', arc)
      .style('fill', color);

    // Draw the edges
    // Figure out the token positions
    let tokenPos = [];
    for (let i = 0; i < tokenSize; i++) {
      let curAngle = -Math.PI / 2 + i * (Math.PI * 2 / tokenSize);
      tokenPos.push({
        x: Math.cos(curAngle) * inRadius,
        y: Math.sin(curAngle) * inRadius,
        token: d.token,
        id: i
      });
    }
  };

  const initData = async (attentionFile, saliencyFile, atlasFile) => {
    // Init attention data
    attentions = await d3.json(attentionFile);

    // init atlas data
    atlasData = await d3.json(atlasFile);
    
    // Init saliency data
    saliencies = await d3.json(saliencyFile);
    saliencies = saliencies[instanceID];
    tokenSize = saliencies.tokens.length;
  };

  const badgeClicked = () => {
    if (isShown) {
      dispatch('close');
      isShown = false;

      d3.select(viewContainer)
        .select('.svg-container')
        .transition('move')
        .duration(700)
        .ease(ease)
        .style('opacity', 0);

      // Change the badge style
      d3.timer(() => {
        let badge = d3.select(viewContainer)
          .select('.badge')
          .style('border-left', '1px solid hsl(0, 0%, 90.2%)')
          .style('border-radius', '5px')
          .style('box-shadow', '-3px 3px 3px hsla(0, 0%, 0%, 0.06)')
          .style('margin-left', '5px');
        
        badge.select('.badge-title')
          .style('visibility', 'hidden');

        badge.select('.icon-wrapper > img')
          .attr('src', '/figures/map-marked-alt-solid.svg');
      }, 400);
    } else {
      dispatch('open');
      isShown = true;

      d3.select(viewContainer)
        .select('.svg-container')
        .transition('move')
        .duration(700)
        .ease(ease)
        .style('opacity', 1);

      // Change the badge style
      d3.timer(() => {
        let badge = d3.select(viewContainer)
          .select('.badge')
          .style('border-left', null)
          .style('border-radius', '0 5px 5px 0')
          .style('box-shadow', null)
          .style('margin-left', null);
        
        badge.select('.badge-title')
          .style('visibility', 'visible');

        badge.select('.icon-wrapper > img')
          .attr('src', '/figures/chevron-right-solid.svg');
      }, 400);
    }
  };

  onMount(async () => {
    // Load the attention and atlas data
    if (attentions == null || atlasData == null || saliencies == null) {
      initData(
        `/data/sst2-attention-data/attention-${padZeroLeft(instanceID, 4)}.json`,
        '/data/sst2-saliency-list-grad-l1.json',
        '/data/sst2-atlas.json'
      );
    }
  });

  lowerMapViewConfigStore.subscribe(async value => {
    if (value.compHeight !== undefined && value.compWidth !== undefined){
      if (instanceViewConfig === undefined ||
        (instanceViewConfig.compHeight !== value.compHeight &&
        instanceViewConfig.compWidth !== value.compWidth)
      ){
        instanceViewConfig = value;
        
        SVGWidth = instanceViewConfig.compWidth;
        SVGHeight = instanceViewConfig.compHeight;

        // Load the attention and atlas data
        if (attentions == null || atlasData == null || saliencies == null) {
          initData(
            `/data/sst2-attention-data/attention-${padZeroLeft(instanceID, 4)}.json`,
            '/data/sst2-saliency-list-grad-l1.json',
            '/data/sst2-atlas.json'
          ).then(createGraph);
        } else {
          createGraph();
        }
      }
    }
  });
  

</script>

<style type='text/scss'>

  @import 'define';

  :global(.layer-name-group text) {
    dominant-baseline: middle;
    text-anchor: end;
    font-size: 0.7em;
    fill: hsla(0, 0%, 0%, 0.3);
  }

  .svg-container {
    width: 100%;
    height: 100%;
    overflow-x: hidden;
    position: relative;
    cursor: default;

    display: flex;
    flex-direction: row;
    justify-content: space-around;
    align-items: flex-end;
  }

  .atlas-view {
    display: flex;
    flex-direction: row;
    max-width: 100%;
    position: relative;
    height: 100%;
    overflow: hidden;
    transition: max-width 1000ms ease-in-out;
  }

  .atlas-svg-container {
    position: relative;
  }

  .control-row {
    position: absolute;
    top: 0;
    left: 0;
    cursor: default;
    padding-top: 5px;
    display: flex;
    flex-direction: row;
    align-items: center;
    user-select: none;
    font-size: 0.9rem;
    z-index: 5;
  }

  .lower-atlas-label {
    color: hsl(0, 0%, 50%);
    font-size: 1.3rem;
    margin: 0 20px 0 20px;
  }

  .expand-button {
    padding: 0 0.4em;
    height: 1.8em;
    font-size: 1em;
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .select-row {
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;

    border-radius: 5px;
    border: 1px solid change-color($brown-dark, $lightness: 90%);
    margin-right: 5px;

    &:hover {
      background: change-color($brown-dark, $alpha: 0.05);
    }
  }

  .icon-wrapper {
    margin-right: 5px;
    display: flex;
    flex-direction: row;
    align-items: center;
    opacity: 0.5;

    img {
      height: 1.2em;
    }
  }

</style>

<div class='atlas-view' bind:this={viewContainer}>

  <div class='control-row'>

    <div class='lower-atlas-label'>
      Attention Head Overview
    </div>

    <div class='select-row'>
      <div class='relation-container' on:click={() => dispatch('open')}>
        <div class='expand-button'>
          <div class='icon-wrapper'>
            <img src='/figures/expand-outline.svg' alt='expanding icon'>
          </div>
          Show Detail
        </div>
      </div>
    </div>

  </div>


  <div class='svg-container'>

    <div class='atlas-svg-container'>
      <svg class='atlas-svg' bind:this={svg}></svg>
    </div>

  </div>
  
</div>