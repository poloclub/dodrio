<script>
  import { onMount } from 'svelte';
  import { instanceViewConfigStore } from './store';
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

  let SVGWidth = 800;
  let SVGHeight = 800;

  let instanceViewConfig = undefined;
  let SVGInitialized = false;

  const SVGPadding = {top: 3, left: 15, right: 15, bottom: 3};
  const textTokenPadding = {top: 3, left: 3, right: 3, bottom: 3};

  const ease = d3.easeCubicInOut;
  const animationTime = 300;

  const round = (num, decimal) => {
    return Math.round((num + Number.EPSILON) * (10 ** decimal)) / (10 ** decimal);
  };

  const padZeroLeft = (num, digit) => {
    return Array(Math.max(digit - String(num).length + 1, 0)).join(0) + num;
  };

  const initSVG = () => {
    svg = d3.select(svg)
      .attr('width', SVGWidth)
      .attr('height', SVGHeight);

    // Add a border
    svg.append('rect')
      .attr('class', 'border-rect')
      .attr('width', SVGWidth)
      .attr('height', SVGHeight)
      .style('stroke', 'black')
      .style('fill', 'none');

    // Add arrow markers
    let arrowMarker = svg.append('defs');

    arrowMarker.append('marker')
      .attr('id', 'dep-arrow')
      .attr('viewBox', [0, 0, 10, 10])
      .attr('refX', 0)
      .attr('refY', 5)
      .attr('markerWidth', 10)
      .attr('markerHeight', 7)
      .attr('orient', 'auto')
      .attr('stroke-width', 1)
      .attr('markerUnits', 'userSpaceOnUse')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('stroke', 'black')
      .attr('fill', 'black');

    SVGInitialized = true;
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
    initSVG();

    const minOutRadius = 10;
    const maxOutRadius = 25;

    // let arc = d3.arc()
    //   .innerRadius(15)
    //   .outerRadius(outRadius)
    //   .startAngle(0)
    //   .endAngle(Math.PI * 2);
    
    // let tokens = data.words.map(d => {return {'token': d, 'value': 1};});

    // let pie = d3.pie()
    //   .sort(null)
    //   .value(d => d.value);

    // let arcs = pie(tokens);

    // console.log(arcs);

    let donutGroup = svg.append('g')
      .attr('class', 'donut-group')
      .attr('transform', 'translate(60, 150)');
    
    // Create color scale
    let hueScale = d3.scaleLinear()
      .domain([-1, 0, 1])
      .range([red, purple, blue]);
    
    let chromaScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0, 100]);

    let alphaScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0, 1]);

    let lightnessScale = d3.scaleLinear()
      .domain([0, 1])
      .range([130, 40]);

    // Use square root scale
    let outRadiusScale = d3.scalePow()
      .exponent(0.5)
      .domain([0, 1])
      .range([minOutRadius, maxOutRadius]);

    let scales = {
      hueScale: hueScale,
      lightnessScale: lightnessScale,
      outRadiusScale: outRadiusScale
    };

    // atlasData = atlasData.slice(2, 4);

    let donuts = donutGroup.selectAll('g.donut')
      .data(atlasData)
      .join('g')
      .attr('class', 'donut')
      .attr('transform', d => `translate(${d.head * (maxOutRadius * 2 + 5)},
        ${d.layer * (maxOutRadius * 2 + 5)})`);

    // Draw the donuts
    let start = new Date();
    donuts.each((d, i, g) => drawDonut(d, i, g, scales));
    console.log('rendering', new Date() - start);

    console.log(atlasData);
        
    // Draw the legend
    // create2DColorLegend();

  };

  const drawDonut = (d, i, g, scales) => {
    let donut = d3.select(g[i]);

    let outRadius = scales.outRadiusScale(d.confidence);
    const ringRadius = 7;
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

    // donut.selectAll('circle.dot')
    //   .data(tokenPos)
    //   .join('circle')
    //   .attr('class', 'dot')
    //   .attr('cx', d => d.x)
    //   .attr('cy', d => d.y)
    //   .attr('r', 1);

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
    overflow-x: scroll;
    position: relative;
    cursor: default;
  }

  .atlas-view {
    display: flex;
    flex-direction: row;
  }

  .legend-canvas-container {
    position: absolute;
  }

  .legend-container {
    position: absolute;
    right: 10px;
    bottom: 20px;
    display: flex;
    flex-direction: column;

    :first-child {
      margin-bottom: 25px;
    }
  }

 .svg-container {
    position: relative;
  }


</style>

<div class='atlas-view' bind:this={viewContainer}>

  <div class='svg-container'>
    <div class='legend-canvas-container'></div>

    <svg class='atlas-svg' bind:this={svg}></svg>

    <div class='legend-container'>
      <img src='/figures/size-legend.png' width='160px' alt='size legend'>
      <img src='/figures/legend.png' width='200px' alt='color legend'>

    </div>
  </div>
  
</div>