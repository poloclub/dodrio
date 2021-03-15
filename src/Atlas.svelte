<script>
  import { onMount } from 'svelte';
  import { instanceViewConfigStore } from './store';
  import { createEventDispatcher } from 'svelte';
  import * as d3 from 'd3';

  let svg = null;
  let atlasData = null;
  let attentions = null;
  let saliencies = null;
  let tokenSize = null;

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
  let SVGInitialized = false;

  const SVGPadding = {top: 3, left: 10, right: 10, bottom: 3};

  const ease = d3.easeCubicInOut;
  const animationTime = 300;

  const round = (num, decimal) => {
    return Math.round((num + Number.EPSILON) * (10 ** decimal)) / (10 ** decimal);
  };

  const padZeroLeft = (num, digit) => {
    return Array(Math.max(digit - String(num).length + 1, 0)).join(0) + num;
  };

  const create2DColorLegend = () => {

    let canvasX = 750;
    let canvasY = 100;
    let canvasWidth = 50;
    let canvasHeight = 50;
  
    let canvas = d3.select(viewContainer)
      .select('.legend-canvas-container')
      .style('top', `${canvasY}px`)
      .style('left', `${canvasX}px`)
      .append('canvas')
      .attr('class', 'legend-canvas')
      .attr('width', canvasWidth)
      .attr('height', canvasHeight);
    
    let context = canvas.node().getContext('2d');
    let image = context.createImageData(canvasWidth, canvasHeight);

    // Create the color scale
    // Row: red <== purple ==> Blue
    // Column: high luminance <==> low luminance
    let hueScale = d3.scaleLinear()
      .domain([0, 0.5, 1])
      .range([red, purple, blue]);

    let luminanceScale = d3.scaleLinear()
      .domain([0, 1])
      .range([40, 130]);

    let alphaScale = d3.scaleLinear()
      .domain([0, 1])
      .range([1, 0.05]);

    for (let i = 0; i < canvasWidth * canvasHeight * 4; i+=4) {
      let pixelIndex = Math.floor(i / 4);
      let row = Math.floor(pixelIndex / canvasHeight);
      let column = pixelIndex % canvasWidth;

      // console.log(row, column);

      let color = d3.hcl(hueScale(column / (canvasWidth - 1)));
      color.opacity = alphaScale(row / (canvasHeight - 1));

      color = d3.rgb(color);
      
      image.data[i] = color.r;
      image.data[i + 1] = color.g;
      image.data[i + 2] = color.b;
      image.data[i + 3] = color.opacity * 255;
    }

    context.putImageData(image, 0, 0);    
  };

  const createGraph = () => {

    const layerNum = attentions.length;
    const headNum = attentions[0].length;

    let availableWidth = SVGWidth - 210 - SVGPadding.left - SVGPadding.right;
    let availableHeight = SVGHeight - 70 - SVGPadding.top - SVGPadding.bottom;

    let availableLength = Math.min(availableHeight, availableWidth);
    console.log(SVGHeight, availableLength, availableWidth, availableHeight);
    const gridGap = 5;

    const gridLength = Math.floor((availableLength - (layerNum - 1) * gridGap) / layerNum);
    const maxOutRadius = gridLength / 2;
    const minOutRadius = 10;

    let adjustedRowGap = Math.floor((availableWidth - headNum * gridLength) / (layerNum + 1));
    let adjustedColGap = Math.floor((availableHeight - layerNum * gridLength) / (layerNum + 1));

    svg = d3.select(svg)
      .attr('width', availableWidth)
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
      .attr('transform', `translate(${SVGPadding.left + maxOutRadius}, ${maxOutRadius})`);
    
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
      .attr('transform', d => `translate(${d.head * (maxOutRadius * 2 + adjustedRowGap)},
        ${d.layer * (maxOutRadius * 2 + adjustedColGap)})`);

    // Draw the donuts
    donuts.each((d, i, g) => drawDonut(d, i, g, scales));

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
      .innerRadius(inRadius)
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

    // Create the links
    let links = [];
    let threshold = 0;

    for (let i = 0; i < tokenSize; i++) {
      for (let j = 0; j < tokenSize; j++) {
        let curAttention = attentions[d.layer][d.head][i][j];
        if (curAttention > threshold) {
          links.push({
            source: i,
            target: j,
            attention: curAttention,
            id: `${i}-${j}`
          });
        }
      }
    }

    links = links.sort((a, b) => b.attention - a.attention).slice(0, 150);

    // Define link width scale
    let linkWidthScale = d3.scaleLinear()
      .domain(d3.extent(links.map(d => d.attention)))
      .range([0.2, 0.7]);

    let linkOpacityScale = d3.scaleLinear()
      // .domain(d3.extent(links.map(d => d.attention)))
      .domain([0, 1])
      .range([0.1, 1]);

    // Draw the links as bezier curves
    donut.selectAll('path.donut-link')
      .data(links, d => d.id)
      .join('path')
      .attr('class', 'donut-link')
      .attr('d', d => {
        let source = tokenPos[d.source];
        let target = tokenPos[d.target];
        const center = {x: 0, y: 0};
        const radialCurveAlpha = 2 / 5;
        
        // Two control points symmetric regarding the center point
        let controlP1 = {
          x: center.x + (source.x - center.x) * radialCurveAlpha,
          y: center.y + (source.y - center.x) * radialCurveAlpha
        };

        let controlP2 = {
          x: center.x + (target.x - center.x) * radialCurveAlpha,
          y: center.y + (target.y - center.x) * radialCurveAlpha
        };
        
        return `M ${source.x},${source.y} C${controlP1.x}, ${controlP1.y},
          ${controlP2.x}, ${controlP2.y}, ${target.x},${target.y}`;
      })
      .style('fill', 'none')
      .style('stroke', color)
      .style('stroke-width', d => linkWidthScale(d.attention))
      .style('opacity', d => linkOpacityScale(d.attention));

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

  instanceViewConfigStore.subscribe(async value => {
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

  .legend-container {
    padding-bottom: 25px;
    display: flex;
    flex-direction: column;
    pointer-events: none;

    :first-child {
      margin-bottom: 35px;
    }
  }

  .badge {
    position: absolute;
    left: 0px;
    top: 10px;
    font-size: 1.2em;
    z-index: 2;

    display: flex;
    flex-direction: row;
    align-items: center;;
    justify-content: flex-start;

    border-radius: 0 5px 5px 0;
    border-top: 1px solid hsl(0, 0%, 90%);
    border-right: 1px solid hsl(0, 0%, 90%);
    border-bottom: 1px solid hsl(0, 0%, 90%);
    background: hsla(0, 0%, 100%, 0.65);
    padding: 8px 15px;

    cursor: pointer;

    .icon-wrapper {
      margin-right: 10px;
      display: flex;
      flex-direction: row;
      align-items: center;

      img {
        height: 1.2em;
      }
    }

    &:hover {
      background: hsla(0, 0%, 96%, 0.65);
    }
  }

  .atlas-svg-container {
    position: relative;
  }

  .head-arrow {
    position: absolute;
    width: 160px;
    pointer-events: none;
  }

  .layer-arrow {
    position: absolute;
    height: 160px;
    pointer-events: none;
  }

</style>

<div class='atlas-view' bind:this={viewContainer}>

  <div class='badge' on:click={badgeClicked}>
    <div class='icon-wrapper active'>
      <!-- <i class="fas fa-chevron-right"></i> -->
      <img src='/figures/chevron-right-solid.svg' alt='map icon'>
    </div>

    <div class='badge-title'>
      Attention Head Map
    </div>
    
  </div>

  <div class='svg-container'>

    <div class='atlas-svg-container'>
      <svg class='atlas-svg' bind:this={svg}></svg>
    </div>

    <div class='legend-container'>
      <img src='/figures/size-legend.png' width='160px' alt='size legend'>
      <img src='/figures/legend.png' width='200px' alt='color legend'>
    </div>

  </div>

  <img class='head-arrow' width=160 src='/figures/head-arrow.png' alt='head arrow'>
  <img class='layer-arrow' height=160 src='/figures/layer-arrow.png' alt='layer arrow'>
  
</div>