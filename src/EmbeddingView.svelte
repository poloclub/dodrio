<script>
  import { onMount, afterUpdate } from 'svelte';
  import { embeddingViewConfigStore, currInstanceStore } from './store';
  import * as d3 from 'd3';
  
  // Shared states
  let embeddingViewConfig = undefined;

  let embeddingSVG = null;
  let embeddingData = null;
  let selectedInstanceId = 23;
  let previousSelectedInstanceId = -1;

  let SVGWidth = null;
  let SVGHeight = null;

  let labelColorMap = {
    0 : 'red',
    1 : 'grey',
    2 : 'skyblue'
  };

  $: {
    // previousSelectedInstanceId = selectedInstanceId;
    d3.select('#circle-' + previousSelectedInstanceId)
      .attr('r', 5)
      .style('opacity', 0.3);
    d3.select('#circle-' + selectedInstanceId)
      .attr('r', 9)
      .style('opacity', 1);
    previousSelectedInstanceId = selectedInstanceId;
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
    svg.append('g')
      .attr('transform', 'translate(0,' + SVGHeight + ')')
      .call(d3.axisBottom(x));

    let y = d3.scaleLinear()
      .domain([0, 12])
      .range([ SVGHeight, 0]);
    svg.append('g')
      .attr('transform', 'translate(0,' + SVGWidth + ')')
      .call(d3.axisLeft(y));


    // Add dots
    svg.append('g')
      .selectAll('dot')
      .data(embeddingData)
      .enter()
      .append('circle')
      .attr('id', function(d) { return 'circle-' + d.id; })
      .attr('cx', function (d) { return x(d.coords[0]); } )
      .attr('cy', function (d) { return y(d.coords[1]); } )
      .attr('r', function(d) {
        return d.id == selectedInstanceId ? 9 : 5;
      })
      .style('fill', function (d) { return labelColorMap[d.label] })
      .style('opacity', function(d) {
        return d.id == selectedInstanceId ? 1 : 0.3;
      }) 
      .style('stroke', 'white')
      .on('click', transferEmbeddingPointHighlights);
  };

  function transferEmbeddingPointHighlights(d) {
    let data = d.originalTarget.__data__;
    d3.select('#circle-' + selectedInstanceId)
      .attr('r', 5)
      .style('opacity', 0.3);
    currInstanceStore.set(data.id);
    d3.select(this)
      .attr('r', 9)
      .style('opacity', 1);
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
        SVGWidth = embeddingViewConfig.compWidth;
        SVGHeight = embeddingViewConfig.compHeight;
        renderEmbeddings();
      }
    }
  });

  currInstanceStore.subscribe(value => {
    selectedInstanceId = value;
  });
  
</script>

<style type='text/scss'>

</style>

<div class='embedding-view'>
  

  <div class='svg-container'>
    <svg class='embedding-svg' bind:this={embeddingSVG}></svg>
  </div>
  
</div>