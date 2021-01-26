<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  let graphSVG = null;
  let graphData = null;

  const SVGWidth = 800;
  const SVGHeight = 800;

  const SVGPadding = {top: 3, left: 3, right: 3, bottom: 3};

  const minNodeRadius = 19;
  const maxNodeRadius = 30;

  let forceStrength = {manyBody: 0, attention: 0, textOrder: 0};

  const drag = (simulation) => {
  
    const dragstarted = (event) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    };
    
    const dragged = (event) => {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    };
    
    const dragended = (event) => {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    };
    
    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  };

  const borderConstraint = (d, nodeRadiusScale) => {
    let curRadius = minNodeRadius;
    if (d.saliency !== undefined) {
      curRadius = nodeRadiusScale(+d.saliency);
    }

    let width = SVGWidth - SVGPadding.left - SVGPadding.right;
    let height = SVGWidth - SVGPadding.top - SVGPadding.bottom;

    const left = Math.max(SVGPadding.left + curRadius, Math.min(width - curRadius, d.x));
    const top = Math.max(SVGPadding.top + curRadius, Math.min(height - curRadius, d.y));
    return {top: top, left: left};
  };

  const bindSlider = (name, simulation, min, max, defaultValue) => {
    let slider = d3.select(`#${name}`)
      .property('value', ((defaultValue - min) / (max - min)) * 1000);

    slider.on('input', () => {
      let sliderValue = +slider.property('value');
      let value = (sliderValue / 1000) * (max - min) + min;
      console.log(name, value);

      switch (name) {
      case 'attention':
        simulation.force('attentionLink').strength(value);
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

    // Add text order hidden links
    let hiddenLinks = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      let hiddenLink = {
        source: +nodes[i].id,
        target: +nodes[i + 1].id
      };
      hiddenLinks.push(hiddenLink);
    }
    // hiddenLinks.push({
    //   source: +nodes[nodes.length - 1].id,
    //   target: nodes[0].id
    // });
    hiddenLinks = hiddenLinks.map(d => Object.create(d));
    
    console.log(nodes, links);

    // Add intermediate nodes to create bezier curves
    let nodeByID = new Map(nodes.map(d => [d.id, d]));
    let bilinks = [];

    links.forEach(d => {
      let source = nodeByID.get(d.source);
      let target = nodeByID.get(d.target);
      let intermediate = {};

      let curBilink = [source, intermediate, target];
      curBilink.selfLoop = source === target;
      
      nodes.push(intermediate);
      links.push({source: source, target: intermediate},
        {source: intermediate, target: target});

      bilinks.push(curBilink);
    });

    // Create a scale for the node radius
    let allSaliencyScores = nodes.map(d => +d.saliency);
    let nodeRadiusScale = d3.scaleLinear()
      .domain(d3.extent(allSaliencyScores))
      .range([minNodeRadius, maxNodeRadius])
      .nice();
    
    // Define the force
    let simulation = d3.forceSimulation(nodes);
    const initManyBodyStrength = -700;
    const initAttentionStrength = 0.1;
    const initTextOrderStrength = 2;

    // Force 1 (ManyBody force)
    simulation.force('charge', d3.forceManyBody()
      .strength(initManyBodyStrength)
    );

    // Force 2 (Center force)
    simulation.force('center', d3.forceCenter(SVGWidth / 2, SVGHeight / 2));

    // Force 3 (Link force)
    simulation.force('attentionLink', d3.forceLink(links)
      .id(d => d.id)
      .strength(initAttentionStrength)
    );
    
    // Force 4 (Text order link force)
    simulation.force('textLink', d3.forceLink(hiddenLinks)
      .id(d => d.id)
      .strength(initTextOrderStrength)
    );

    // Change the min alpha so that the nodes do not shake at the end (end earlier)
    // The default alphaMin is 0.0001
    simulation.alphaMin(0.01);

    let linkLines = svg.append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll('path')
      .data(bilinks)
      .join('path')
      .attr('class', 'link');

    let textLinkLines = svg.append('g')
      .attr('stroke', 'red')
      .attr('stroke-opacity', 1)
      .selectAll('line')
      .data(hiddenLinks)
      .join('line')
      .attr('class', 'link');

    let nodeGroups = svg.append('g')
      .attr('class', 'node-group')
      .selectAll('g.node')
      // Need to filter out intermediate nodes
      .data(nodes.filter(d => d.id !== undefined))
      .join('g')
      .attr('class', 'node')
      .call(drag(simulation));

    // Add circle to each node
    nodeGroups.append('circle')
      .attr('class', 'node-circle')
      .attr('r', d => nodeRadiusScale(+d.saliency))
      .style('fill', 'skyblue');
    
    // Add token text to each node
    nodeGroups.append('text')
      .attr('class', 'node-text')
      .text(d => d.token);

    nodeGroups.append('title')
      .text(d => d.token);

    simulation.on('tick', () => {
      // Update the attention links
      linkLines.attr('d', d => {
        const sCoord = borderConstraint(d[0], nodeRadiusScale);
        const iCoord = borderConstraint(d[1], nodeRadiusScale);
        const tCoord = borderConstraint(d[2], nodeRadiusScale);

        if (d.selfLoop) {
          // Need to handle the arc manually if there is a self loop
          const iVec = [iCoord.left - sCoord.left, iCoord.top - sCoord.top];
          const iVecNorm = Math.sqrt((iVec[0] ** 2 + iVec[1] ** 2));

          // Rotate 90 degree
          // Normalized the rotate direction, use alpha to control magnitude
          const alpha = 50;
          const iVecClock90 = [-iVec[1] / iVecNorm * alpha, iVec[0] / iVecNorm * alpha];
          const iVecCounterClock90 = [iVec[1] / iVecNorm * alpha, -iVec[0] / iVecNorm * alpha];

          const leftControl = [sCoord.left + iVec[0] + iVecClock90[0],
            sCoord.top + iVec[1] + iVecClock90[1]];
          const rightControl = [sCoord.left + iVec[0] + iVecCounterClock90[0],
            sCoord.top + iVec[1] + iVecCounterClock90[1]];

          // console.log(iVec, iVecClock90, leftControl, rightControl);

          // Draw a bezier curve with two control points (which are left anr right
          // perpendicular to the self loop node -> intermediate node vector)
          return 'M' + sCoord.left + ',' + sCoord.top
            + 'C' + leftControl[0] + ',' + leftControl[1]
            + ' ' + rightControl[0] + ',' + rightControl[1]
            + ' ' + tCoord.left + ',' + tCoord.top;

        } else {
          // Draw simple reflective bezier curve if not self loop
          return 'M' + sCoord.left + ',' + sCoord.top
            + 'S' + iCoord.left + ',' + iCoord.top
            + ' ' + tCoord.left + ',' + tCoord.top;
        }
      });

      // Update the nodes
      nodeGroups.attr('transform', d => {
        // Maker sure the nodes are inside the box
        const coord = borderConstraint(d, nodeRadiusScale);
        return `translate(${coord.left}, ${coord.top})`;
      });

      // Update the text links
      textLinkLines
        .attr('x1', d => borderConstraint(d.source, nodeRadiusScale).left)
        .attr('y1', d => borderConstraint(d.source, nodeRadiusScale).top)
        .attr('x2', d => borderConstraint(d.target, nodeRadiusScale).left)
        .attr('y2', d => borderConstraint(d.target, nodeRadiusScale).top);

    });

    bindSlider('attention', simulation, -5, 5, initAttentionStrength);
    bindSlider('textOrder', simulation, -5, 5, initTextOrderStrength);
    bindSlider('manyBody', simulation, -1000, 1000, initManyBodyStrength);

  };

  onMount(async () => {
    console.log('loading matrix');
    graphData = await d3.json('/data/twitter_graph_800_9_7.json');
    console.log('loaded matrix');

    drawGraph();
  });
</script>

<style>

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
    <label for='attention'>Attention Strength</label>
    <input type="range" min="0" max="1000" value="500" class="slider" id="attention">

    <label for='textOrder'>Text Order Strength</label>
    <input type="range" min="0" max="1000" value="500" class="slider" id="textOrder">

    <label for='manyBody'>ManyBody Strength</label>
    <input type="range" min="0" max="1000" value="500" class="slider" id="manyBody">
  </div>

  <div class='svg-container'>
    <svg class='graph-svg' bind:this={graphSVG}></svg>
  </div>
  
</div>