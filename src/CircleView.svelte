<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  let graphSVG = null;
  let graphData = null;

  const SVGWidth = 800;
  const SVGHeight = 800;

  const SVGPadding = {top: 3, left: 3, right: 3, bottom: 3};

  const minNodeRadius = 19;
  const maxNodeRadius = 40;

  let config = {
    borderConstraint: true,
    showHiddenLink: false,
    showHiddenNode: false,
    autoAttention: true,
  };

  let forceStrength = {manyBody: 0, attention: 0, textOrder: 0};

  const round = (num, decimal) => {
    return Math.round((num + Number.EPSILON) * (10 ** decimal)) / (10 ** decimal);
  };

  const bindCheckBox = (simulation, links) => {
    // Border checkbox
    let borderCheckBox = d3.select('#checkbox-border')
      .property('checked', config.borderConstraint);

    borderCheckBox.on('change', (event) => {
      config.borderConstraint = event.target.checked;
      simulation.alpha(0.2).restart();
    });

    // Hidden links
    let hiddenLinkCheckBox = d3.select('#checkbox-hidden-link')
      .property('checked', config.showHiddenLink);
    
    hiddenLinkCheckBox.on('change', (event) => {
      config.showHiddenLink = event.target.checked;
      d3.select(graphSVG)
        .select('g.text-link-group')
        .style('visibility', config.showHiddenLink ? 'visible' : 'hidden');
    });

    // Hidden nodes
    let hiddenNodeCheckBox = d3.select('#checkbox-hidden-node')
      .property('checked', config.showHiddenNode);
    
    hiddenNodeCheckBox.on('change', (event) => {
      config.showHiddenNode = event.target.checked;
      d3.select(graphSVG)
        .select('g.hidden-node-group')
        .style('visibility', config.showHiddenNode ? 'visible' : 'hidden');
      simulation.alpha(0.05).restart();
    });

    // Automatic attention link strength checkbox
    let autoCheckBox = d3.select('#checkbox-auto-attention')
      .property('checked', config.autoAttention);
    
    autoCheckBox.on('change', (event) => {
      config.autoAttention = event.target.checked;

      if (config.autoAttention) {
        simulation.force('attentionLink', d3.forceLink(links)
          .id(d => d.id));
        simulation.alpha(0.3).restart();
      } else {
        simulation.force('attentionLink')
          .strength(forceStrength.attention);
        simulation.alpha(0.3).restart();
      }
    });

  };

  const bindSlider = (name, simulation, min, max, defaultValue) => {
    let slider = d3.select(`#${name}`)
      .property('value', ((defaultValue - min) / (max - min)) * 1000);

    slider.on('input', () => {
      let sliderValue = +slider.property('value');
      let value = (sliderValue / 1000) * (max - min) + min;
      forceStrength[name] = value;

      switch (name) {
      case 'attention':
        simulation.force('attentionLink').strength(value);
        // Disable the auto attention
        d3.select('#checkbox-auto-attention')
          .property('checked', false);
        config.autoAttention = false;
        break;
      case 'textOrder':
        simulation.force('textLink').strength(value);
        break;
      case 'manyBody':
        simulation.force('charge').strength(value);
        break;
      }

      simulation.restart();
    });

    slider.on('mousedown', (event) => {
      if (!event.active) simulation.alphaTarget(0.2).restart();
    });

    slider.on('mouseup', (event) => {
      if (!event.active) simulation.alphaTarget(0);
    });
  };

  const createCircleLayout = (nodes, center, radius) => {
    let nodeIndexArray = nodes.map(d => +d.id);

    // Create a scale to map index to radial
    let extent = d3.extent(nodeIndexArray);

    // Need to add an extra index to play around 0 = 2 * PI overlapping
    extent[1] += 1;

    let radialScale = d3.scaleLinear()
      .domain(extent)
      .range([Math.PI, -Math.PI]);
    
    // Add position to the node objects
    nodes.forEach(d => {
      let alpha = radialScale(d.id);
      d.x = center.x + radius * Math.sin(alpha);
      d.y = center.y + radius * Math.cos(alpha);
    });
  };

  const drawGraph = () => {
    // Filter the links based on the weight
    const weightThreshold = 0.05;

    let svg = d3.select(graphSVG)
      .attr('width', SVGWidth)
      .attr('height', SVGHeight);

    // Add a border
    svg.append('rect')
      .attr('class', 'border-rect')
      .attr('width', SVGWidth)
      .attr('height', SVGHeight)
      .style('stroke', 'black')
      .style('fill', 'none');

    // Create the data lists
    let links = graphData.links.filter(d => d.weight > weightThreshold);

    // Map nodes and links to arrays of objects
    let nodes = graphData.nodes.map(d => Object.create(d));
    links = links.map(d => Object.create(d));

    // Maintain a set of all existing node indices
    let nodeIndices = new Set();
    graphData.nodes.forEach(d => nodeIndices.add(+d.id));

    createCircleLayout(
      nodes,
      {x: SVGWidth / 2, y: SVGHeight / 2},
      SVGWidth / 2 - minNodeRadius - SVGPadding.left
    );

    console.log(nodes);

    // Add arrow markers
    const arrowBoxWidth = 20;
    const arrowBoxHeight = 20;
    svg.append('defs')
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', [0, 0, arrowBoxWidth, arrowBoxHeight])
      .attr('refX', arrowBoxWidth / 2)
      .attr('refY', arrowBoxHeight / 2)
      .attr('markerWidth', arrowBoxWidth)
      .attr('markerHeight', arrowBoxHeight)
      .attr('orient', 'auto-start-reverse')
      .append('path')
      .attr('d', 'M0,5 L0,15 L8,10')
      .attr('stroke', '#C2C2C2')
      .attr('fill', '#C2C2C2');

    // Add attention links
    // let linkLines = svg.append('g')
    //   .attr('class', 'attention-link-group')
    //   .attr('stroke', '#C2C2C2')
    //   .selectAll('path')
    //   .data(bilinks)
    //   .join('path')
    //   .attr('marker-end', 'url(#arrow)')
    //   .attr('class', 'link');

    // Add token nodes
    let nodeGroups = svg.append('g')
      .attr('class', 'node-group')
      .selectAll('g.node')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x}, ${d.y})`);

    // Add circle to each node
    // Create a color scale to represent the text order
    let colorScale = d3.scaleLinear()
      .domain(d3.extent(nodeIndices))
      .range([d3.rgb('#D4E5F4'), d3.rgb('#1E6CB0')]);
    
    nodeGroups.append('circle')
      .attr('class', 'node-circle')
      .attr('r', minNodeRadius)
      .style('fill', d => colorScale(d.id));
    
    // Add token text to each node
    nodeGroups.append('text')
      .attr('class', 'node-text')
      .text(d => d.token);

    nodeGroups.append('title')
      .text(d => d.token);


    // Register UI elements from the control panel
    // bindSlider('attention', simulation, 0, 10, initAttentionStrength);
    // bindSlider('textOrder', simulation, 0, 10, initTextOrderStrength);
    // bindSlider('manyBody', simulation, -1000, 0, initManyBodyStrength);

    // bindCheckBox(simulation, links);

  };

  onMount(async () => {
    console.log('loading matrix');
    graphData = await d3.json('/data/twitter_graph_800_9_7.json');
    console.log('loaded matrix');

    drawGraph();
  });
</script>

<style type="text/scss">

  .graph-view {
    display: flex;
    flex-direction: row;
  }

  .control-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-right: 50px;
  }

  .slider {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .checkbox {
    display: flex;
    flex-direction: row;
    align-items: baseline;
    margin-bottom: 5px;

    input {
      margin-right: 7px;
    }
  }

  :global(.node-circle) {
    stroke: #fff;
    stroke-width: 1.5; 
  }
  
  :global(.node-text) {
    dominant-baseline: middle;
    text-anchor: middle;
    font-size: 10px;
    cursor: default;
  }

  :global(.link) {
    fill: none;
  }

</style>

<div class='graph-view'>
  <div class='control-panel'>
    <!-- Sliders -->
    <div class='slider'>
      <label for='attention'>Attention Strength
        [{config.autoAttention ? 'auto' : round(forceStrength.attention, 2)}]
      </label>
      <input type="range" min="0" max="1000" value="500" class="slider" id="attention">
    </div>

    <div class='slider'>
      <label for='textOrder'>Text Order Strength [{round(forceStrength.textOrder, 2)}]</label>
      <input type="range" min="0" max="1000" value="500" class="slider" id="textOrder">
    </div>

    <div class='slider'>
      <label for='manyBody'>ManyBody Strength [{round(forceStrength.manyBody, 2)}]</label>
      <input type="range" min="0" max="1000" value="500" class="slider" id="manyBody">
    </div>

    <!-- Checkboxes -->
    <div class='checkbox'>
      <input type="checkbox" id="checkbox-auto-attention">
      <label for="checkbox-auto-attention">Auto attention strength </label>
    </div>

    <div class='checkbox'>
      <input type="checkbox" id="checkbox-hidden-link">
      <label for="checkbox-hidden-link">Show hidden link</label>
    </div>

    <div class='checkbox'>
      <input type="checkbox" id="checkbox-hidden-node">
      <label for="checkbox-hidden-node">Show hidden node</label>
    </div>

    <div class='checkbox'>
      <input type="checkbox" id="checkbox-border">
      <label for="checkbox-border">Border Constraint</label>
    </div>
    
  </div>

  <div class='svg-container'>
    <svg class='graph-svg' bind:this={graphSVG}></svg>
  </div>
  
</div>