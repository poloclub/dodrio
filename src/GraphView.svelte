<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  let graphSVG = null;
  let graphData = null;

  const SVGWidth = 800;
  const SVGHeight = 800;

  const minNodeRadius = 19;
  const maxNodeRadius = 30;

  const drag = (simulation) => {
  
    const dragstarted = (event) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    
    const dragged = (event) => {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    
    const dragended = (event) => {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
    
    return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
  }

  const borderConstraint = (d, nodeRaiusScale) => {
    let curRadius = minNodeRadius;
    if (d.saliency !== undefined) {
      const curRadius = nodeRaiusScale(+d.saliency);
    }
    const left = Math.max(curRadius, Math.min(SVGWidth - curRadius, d.x));
    const top = Math.max(curRadius, Math.min(SVGHeight - curRadius, d.y));
    return {top: top, left: left};
  }

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
    links = links.map(d => Object.create(d));
    let nodes = graphData.nodes.map(d => Object.create(d));

    // Add intermediate nodes to create bezier curves
    let nodeByID = new Map(nodes.map(d => [d.id, d]));
    let bilinks = [];

    links.forEach(d => {
      let source = nodeByID.get(d.source);
      let target = nodeByID.get(d.target);
      let intermediate = {};

      let curBilink = [source, intermediate, target];
      curBilink.selfLoop = false;
      
      if (source === target) {
        curBilink.selfLoop = true;
      }
      
      nodes.push(intermediate);
      links.push({source: source, target: intermediate},
        {source: intermediate, target: target});

      bilinks.push(curBilink);
    });

    console.log(bilinks[0].selfLoop);

    // Create a scale for the node radius
    let allSaliencyScores = nodes.map(d => +d.saliency);

    let nodeRaiusScale = d3.scaleLinear()
      .domain(d3.extent(allSaliencyScores))
      .range([minNodeRadius, maxNodeRadius])
      .nice();
    
    // Define the force
    let simulation = d3.forceSimulation(nodes);

    // Force 1 (Link force)
    simulation.force("link", d3.forceLink(links)
      .id(d => d.id)
    );
    
    // Force 2 (ManyBody force)
    simulation.force("charge", d3.forceManyBody()
      .strength(-250)
    );

    // Force 3 (Cneter force)
    simulation.force("center", d3.forceCenter(SVGWidth / 2, SVGHeight / 2));

    // Change the min alpha so that the nodes do not shake at the end (end earlier)
    // The default alphaMin is 0.0001
    simulation.alphaMin(0.01);

    let linkLines = svg.append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("path")
      .data(bilinks)
      .join("path")
      .attr('class', 'link');
      //.attr("stroke-width", d => Math.sqrt(d.weight));

    let nodeGroups = svg.append("g")
      .attr('class', 'node-group')
      .selectAll("g.node")
      // Need to filter out intermediate nodes
      .data(nodes.filter(d => d.id !== undefined))
      .join("g")
      .attr('class', 'node')
      .call(drag(simulation));

    // Add circle to each node
    nodeGroups.append('circle')
      .attr('class', 'node-circle')
      .attr("r", d => nodeRaiusScale(+d.saliency))
      .style("fill", 'skyblue');
    
    // Add token text to each node
    nodeGroups.append('text')
      .attr('class', 'node-text')
      .text(d => d.token);

    nodeGroups.append("title")
      .text(d => d.token);

    simulation.on("tick", () => {
      linkLines.attr("d", d => {
        const sCoord = borderConstraint(d[0], nodeRaiusScale);
        const iCoord = borderConstraint(d[1], nodeRaiusScale);
        const tCoord = borderConstraint(d[2], nodeRaiusScale);

        return 'M' + sCoord.left + ',' + sCoord.top
          + 'S' + iCoord.left + ',' + iCoord.top
          + ' ' + tCoord.left + ',' + tCoord.top;
      });

      nodeGroups.attr("transform", d => {
        // Maker sure the ndoes are inside the box
        // const curRadius = nodeRaiusScale(+d.saliency);
        // const top = Math.max(curRadius, Math.min(SVGWidth - curRadius, d.x));
        // const left = Math.max(curRadius, Math.min(SVGHeight - curRadius, d.y));
        const coord = borderConstraint(d, nodeRaiusScale);
        return `translate(${coord.left}, ${coord.top})`;
      });
    });

    // invalidation.then(() => simulation.stop());
  }

  onMount(async () => {
    console.log('loading matrix');
    graphData = await d3.json('/data/twitter_graph_800_9_7.json');
    console.log('loaded matrix');

    drawGraph();
  })
</script>

<style>

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
  <svg class='graph-svg' bind:this={graphSVG}></svg>
</div>