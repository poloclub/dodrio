<script>
  import { onMount } from 'svelte';
  let graphSVG = null;
  let graphData = null;

  const width = 500;
  const height = 500;

  const drag = simulation => {
  
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    
    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    
    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
    
    return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
  }

  const drawGraph = () => {
    let links = graphData.links.map(d => Object.create(d));
    let nodes = graphData.nodes.map(d => Object.create(d));
    
    console.log(links, nodes);

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id))
      .force("charge", d3.forceManyBody())
      .force("center", d3.forceCenter(width / 2, height / 2));

    let svg = d3.select(graphSVG);

    const link = svg.append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", d => Math.sqrt(d.value));

    const node = svg.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 5)
      .style("fill", d => {console.log(d); return +d.id < 0 ? 'orange' : 'skyblue';})
      .call(drag(simulation));

    node.append("title")
      .text(d => d.token);

    simulation.on("tick", () => {
      link.attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node.attr("cx", d => d.x)
        .attr("cy", d => d.y);
    });

    // invalidation.then(() => simulation.stop());
  }

  onMount(async () => {
    console.log('loading matrix');
    graphData = await d3.json('/data/graph_data.json');
    console.log('loaded matrix');

    drawGraph();
  })
</script>

<style>
</style>

<div class='graph-view'>
  <svg class='graph-svg' bind:this={graphSVG} width=500 height=500></svg>
</div>