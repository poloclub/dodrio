<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  let graphSVG = null;
  let graphData = null;

  const SVGWidth = 800;
  const SVGHeight = 800;

  const SVGPadding = { top: 3, left: 3, right: 3, bottom: 3 };

  const minNodeRadius = 19;
  const maxNodeRadius = 40;

  let config = {
    borderConstraint: true,
    showHiddenLink: false,
    showHiddenNode: false,
    autoAttention: true,
  };

  let forceStrength = { manyBody: 0, attention: 0, textOrder: 0 };

  const round = (num, decimal) => {
    return Math.round((num + Number.EPSILON) * 10 ** decimal) / 10 ** decimal;
  };

  const createCircleLayout = (nodes, center, radius) => {
    let nodeIndexArray = nodes.map((d) => +d.id);

    // Create a scale to map index to radial
    let extent = d3.extent(nodeIndexArray);

    // Need to add an extra index to play around 0 = 2 * PI overlapping
    extent[1] += 1;

    let radialScale = d3
      .scaleLinear()
      .domain(extent)
      .range([Math.PI, -Math.PI]);

    // Add position to the node objects
    nodes.forEach((d) => {
      let alpha = radialScale(d.id);
      d.x = round(center.x + radius * Math.sin(alpha), 2);
      d.y = round(center.y + radius * Math.cos(alpha), 2);
      d.headX = round(
        center.x + (radius - minNodeRadius * 1.1) * Math.sin(alpha),
        2
      );
      d.headY = round(
        center.x + (radius - minNodeRadius * 1.1) * Math.cos(alpha),
        2
      );
    });
  };

  const drawGraph = () => {
    // Filter the links based on the weight
    const weightThreshold = 0.05;

    let svg = d3
      .select(graphSVG)
      .attr('width', SVGWidth)
      .attr('height', SVGHeight);

    // Add a border
    svg
      .append('rect')
      .attr('class', 'border-rect')
      .attr('width', SVGWidth)
      .attr('height', SVGHeight)
      .style('stroke', 'black')
      .style('fill', 'none');

    // Create the data lists
    let links = graphData.links.filter((d) => d.weight > weightThreshold);

    // Map nodes and links to arrays of objects
    let nodes = graphData.nodes.map((d) => Object.create(d));
    links = links.map((d) => Object.create(d));

    // Calculate the node positions
    createCircleLayout(
      nodes,
      { x: SVGWidth / 2, y: SVGHeight / 2 },
      SVGWidth / 2 - minNodeRadius - SVGPadding.left
    );

    // Create links
    let nodeByID = new Map(nodes.map((d) => [d.id, d]));
    let bilinks = [];

    links.forEach((d) => {
      let source = nodeByID.get(d.source);
      let target = nodeByID.get(d.target);

      bilinks.push({
        source: source,
        target: target,
        selfLoop: source === target,
      });
    });

    // console.log(bilinks);

    // Maintain a set of all existing node indices
    let nodeIndices = new Set();
    graphData.nodes.forEach((d) => nodeIndices.add(+d.id));

    createCircleLayout(
      nodes,
      { x: SVGWidth / 2, y: SVGHeight / 2 },
      SVGWidth / 2 - minNodeRadius - SVGPadding.left
    );

    // console.log(nodes);

    // Add arrow markers
    const arrowBoxWidth = 20;
    const arrowBoxHeight = 20;
    svg
      .append('defs')
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

    const drawLines = (d) => {
      return `M ${d.source.headX} ${d.source.headY} L ${d.target.headX} ${d.target.headY}`;
    };

    const bezierCurveFunc = (d) => {
      let center = { x: SVGWidth / 2, y: SVGHeight / 2 };
      let controlAlpha = 4 / 5;

      // Two control points symmetric regarding the center point
      let controlP1 = {
        x: center.x + (d.source.headX - center.x) * controlAlpha,
        y: center.y + (d.source.headY - center.x) * controlAlpha,
      };

      let controlP2 = {
        x: center.x + (d.target.headX - center.x) * controlAlpha,
        y: center.y + (d.target.headY - center.x) * controlAlpha,
      };

      return `M ${d.source.headX},${d.source.headY} C${controlP1.x}, ${controlP1.y},
       ${controlP2.x}, ${controlP2.y}, ${d.target.headX},${d.target.headY}`;
    };

    // Draw edges
    let linkLines = svg
      .append('g')
      .attr('class', 'attention-link-group')
      .attr('stroke', '#C2C2C2')
      .selectAll('path')
      .data(bilinks)
      .join('path')
      .attr('d', bezierCurveFunc)
      //.attr('d', drawLines)
      .attr('marker-end', 'url(#arrow)')
      .attr('class', 'link');

    // Add token nodes
    let nodeGroups = svg
      .append('g')
      .attr('class', 'node-group')
      .selectAll('g.node')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .attr('transform', (d) => `translate(${d.x}, ${d.y})`);

    // Add circle to each node
    // Create a color scale to represent the text order
    let colorScale = d3
      .scaleLinear()
      .domain(d3.extent(nodeIndices))
      .range([d3.rgb('#D4E5F4'), d3.rgb('#1E6CB0')]);

    nodeGroups
      .append('circle')
      .attr('class', 'node-circle')
      .attr('r', minNodeRadius)
      .style('fill', (d) => colorScale(d.id));

    // Add token text to each node
    nodeGroups
      .append('text')
      .attr('class', 'node-text')
      .text((d) => d.token);

    nodeGroups.append('title').text((d) => d.token);

    // Register UI elements from the control panel
    // bindSlider('attention', simulation, 0, 10, initAttentionStrength);
    // bindSlider('textOrder', simulation, 0, 10, initTextOrderStrength);
    // bindSlider('manyBody', simulation, -1000, 0, initManyBodyStrength);

    // bindCheckBox(simulation, links);
  };

  onMount(async () => {
    console.log('loading matrix');
    graphData = await d3.json('PUBLIC_URL/data/twitter_graph_800_9_7.json');
    console.log('loaded matrix');

    drawGraph();
  });
</script>

<style lang="scss">
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
    opacity: 0.5;
  }
</style>

<div class="graph-view">
  <div class="control-panel">
    <!-- Sliders -->
    <div class="slider">
      <label for="attention"
        >Attention Strength [{config.autoAttention
          ? 'auto'
          : round(forceStrength.attention, 2)}]
      </label>
      <input
        type="range"
        min="0"
        max="1000"
        value="500"
        class="slider"
        id="attention"
      />
    </div>

    <div class="slider">
      <label for="textOrder"
        >Text Order Strength [{round(forceStrength.textOrder, 2)}]</label
      >
      <input
        type="range"
        min="0"
        max="1000"
        value="500"
        class="slider"
        id="textOrder"
      />
    </div>

    <div class="slider">
      <label for="manyBody"
        >ManyBody Strength [{round(forceStrength.manyBody, 2)}]</label
      >
      <input
        type="range"
        min="0"
        max="1000"
        value="500"
        class="slider"
        id="manyBody"
      />
    </div>

    <!-- Checkboxes -->
    <div class="checkbox">
      <input type="checkbox" id="checkbox-auto-attention" />
      <label for="checkbox-auto-attention">Auto attention strength </label>
    </div>

    <div class="checkbox">
      <input type="checkbox" id="checkbox-hidden-link" />
      <label for="checkbox-hidden-link">Show hidden link</label>
    </div>

    <div class="checkbox">
      <input type="checkbox" id="checkbox-hidden-node" />
      <label for="checkbox-hidden-node">Show hidden node</label>
    </div>

    <div class="checkbox">
      <input type="checkbox" id="checkbox-border" />
      <label for="checkbox-border">Border Constraint</label>
    </div>
  </div>

  <div class="svg-container">
    <svg class="graph-svg" bind:this={graphSVG} />
  </div>
</div>
