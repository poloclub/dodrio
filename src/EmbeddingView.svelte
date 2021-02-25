<script>
  import { onMount, afterUpdate } from 'svelte';
  import { embeddingViewConfigStore, currInstanceStore } from './store';
  import Tooltip from './Tooltip.svelte';
  import * as d3 from 'd3';
  
  // Shared states
  let embeddingViewConfig = undefined;

  let embeddingSVG = null;
  let embeddingData = null;
  let selectedInstanceId = 23;
  let previousSelectedInstanceId = -1;

  let SVGWidth = null;
  let SVGHeight = null;

  let tooltip = null;
  let tooltipLeft = 0;
  let tooltipTop = 0;
  let tooltipHtml = 'tooltip';
  let tooltipWidth = 100;
  let tooltipShow = false;
  let toolTipFontSize = '0.5em';
  let charactersToIncludeInTooltip = 30;

  let labelColorMap = {
    0 : 'red',
    1 : 'grey',
    2 : 'skyblue'
  };

  $: selectedInstanceId, function() {
    // When selectedInstanceId store value changes, update
    // embedding highlight.
    d3.select('#circle-' + previousSelectedInstanceId)
      .attr('r', 5)
      .style('opacity', 0.3);
    d3.select('#circle-' + selectedInstanceId)
      .attr('r', 9)
      .style('opacity', 1);
    previousSelectedInstanceId = selectedInstanceId;
  }();

  const drawEmbeddingsPlot = () => {

    const zoom = d3.zoom()
      .on('zoom', (event) => {
        svg.select('g').attr('transform', event.transform);
      })
      .scaleExtent([0.5, 10])

    let svg = d3.select(embeddingSVG)
      .attr('width', SVGWidth)
      .attr('height', SVGHeight)
      .attr("viewBox", [0, 0, SVGWidth, SVGHeight])
      .style('fill', '#eee')
      .call(zoom);

    let x = d3.scaleLinear()
      .domain([-6, 14])
      .range([ 0, SVGWidth ]);

    let y = d3.scaleLinear()
      .domain([0, 12])
      .range([ SVGHeight, 0]);

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
      .on('click', transferEmbeddingPointHighlights)
      .on("mouseover", showTooltip)
      .on("mouseleave", function(d) {
        tooltipShow = false;
      } );
  };

  function showTooltip(event, d) {
    let node = event.currentTarget;
    let position = node.getBoundingClientRect();
    let curWidth = position.right - position.left;
    let tooltipCenterX = position.x + curWidth / 2;
    let tooltipCenterY = position.y - 40 + window.scrollY;
    tooltipShow = true;

    tooltipHtml = buildTooltipSentenceHtml(d.sentence)
    tooltipLeft = tooltipCenterX - tooltipWidth / 2;
    tooltipTop = tooltipCenterY;
  }

  function buildTooltipSentenceHtml(sentence) {
    // We want to split the sentence around the halfway point
    // but not split the sentence mid-word.
  
    let sentenceHalfwayIdx = Math.floor(charactersToIncludeInTooltip/2);
    let sentenceSplitIdxBeforeHalf = sentenceHalfwayIdx
    let sentenceSplitIdxAfterHalf = sentenceHalfwayIdx
    while(sentence.charAt(sentenceSplitIdxBeforeHalf) != ' ') {
      sentenceSplitIdxBeforeHalf--;
    }
    while(sentence.charAt(sentenceSplitIdxAfterHalf) != ' ') {
      sentenceSplitIdxAfterHalf++;
    }
    let sentenceSplitIdx = (Math.min(Math.abs(sentenceHalfwayIdx - sentenceSplitIdxBeforeHalf))
                          > Math.min(Math.abs(sentenceHalfwayIdx - sentenceSplitIdxAfterHalf))) 
                          ? sentenceSplitIdxAfterHalf : sentenceSplitIdxBeforeHalf;

    tooltipHtml = sentence.substring(0, sentenceSplitIdx)
                + '<br>'
                + sentence.substring(sentenceSplitIdx, Math.floor(charactersToIncludeInTooltip))
                + '...';
    return tooltipHtml;
  }

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
    <Tooltip bind:this={tooltip}
    left={tooltipLeft}
    top={tooltipTop}
    tooltipHtml={tooltipHtml}
    width={tooltipWidth}
    tooltipShow={tooltipShow}
    fontSize={toolTipFontSize}
  />
    <svg class='embedding-svg' bind:this={embeddingSVG}></svg>
  </div>
  
</div>