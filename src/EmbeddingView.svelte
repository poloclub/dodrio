<script>
  import { onMount, afterUpdate } from 'svelte';
  import { embeddingViewConfigStore } from './store';
  import * as d3 from 'd3';
  
  // Shared states
  let embeddingViewConfig = undefined;

  let embeddingSVG = null;
  let embeddingData = null;
  let longest300

  const SVGWidth = 435;
  const SVGHeight = 345;

  let labelColorMap = {
    0 : 'red',
    1 : 'grey',
    2 : 'green'
  }

  const drawEmbeddingsPlot = () => {

    const zoom = d3.zoom()
        .on('zoom', (event) => {
        svg.attr('transform', event.transform);
      })
      .scaleExtent([1, 10])
      .extent([[0, 0], [SVGWidth, SVGHeight]]);

    let svg = d3.select(embeddingSVG)
      .attr('width', SVGWidth)
      .attr('height', SVGHeight)
      .call(zoom);

    let x = d3.scaleLinear()
      .domain([-6, 14])
      .range([ 0, SVGWidth ]);
    svg.append("g")
      .attr("transform", "translate(0," + SVGHeight + ")")
      .call(d3.axisBottom(x));

    let y = d3.scaleLinear()
      .domain([0, 12])
      .range([ SVGHeight, 0]);
    svg.append("g")
      .attr("transform", "translate(0," + SVGWidth + ")")
      .call(d3.axisLeft(y));


    // Add dots
    svg.append('g')
      .selectAll("dot")
      .data(embeddingData)
      .enter()
      .append("circle")
      .attr("cx", function (d) { return x(d.coords[0]); } )
      .attr("cy", function (d) { return y(d.coords[1]); } )
      .attr("r", 2)
      .style("fill", function (d) { return labelColorMap[d.label] })
      .style("opacity", 0.3) 
      .style("stroke", "white")

  }

  const renderEmbeddings = async () => {
    console.log('loading embeddings');
    embeddingData = await d3.json('/data/embeddings_twitter_top_300.json');
    console.log('loaded embeddings');

    drawEmbeddingsPlot();
  };

  embeddingViewConfigStore.subscribe(value => {
    if (value.compHeight !== undefined && value.compWidth !== undefined){
      if (embeddingViewConfig === undefined ||
        (embeddingViewConfig.compHeight !== value.compHeight &&
        embeddingViewConfig.compWidth !== value.compWidth)
      ){
        embeddingViewConfig = value;
        renderEmbeddings();
      }
    }
  });

  
</script>

<style type="text/scss">

</style>

<div class='embedding-view'>
  

  <div class='svg-container'>
    <svg class='embedding-svg' bind:this={embeddingSVG}></svg>
  </div>
  
</div>