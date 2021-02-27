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
  let tooltipWidth = 150;
  let tooltipShow = false;
  let toolTipFontSize = '0.65em';
  let charactersToIncludeInTooltip = 30;

  let circleRadius = 5;
  let selectedCircleRadius = 9;
  let hoveredCircleRadius = 7;
  let circleOpacity = 0.3;
  let selectedCircleOpacity = 1;
  let hoveredCircleOpacity = 1;
  let labelColorMap = {
    0 : 'red',
    1 : 'grey',
    2 : 'skyblue'
  };

  $: selectedInstanceId, function() {
    // When selectedInstanceId store value changes, update
    // embedding highlight.
    d3.select('#circle-' + previousSelectedInstanceId)
      .attr('r', circleRadius)
      .style('opacity', circleOpacity);
    d3.select('#circle-' + selectedInstanceId)
      .attr('r', selectedCircleRadius)
      .style('opacity', selectedCircleOpacity)
      .raise();
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
      .domain([Math.min(...embeddingData.map(({coords}) => coords[0])),
              Math.max(...embeddingData.map(({coords}) => coords[0]))])
      .range([ 0, SVGWidth ]);

    let y = d3.scaleLinear()
      .domain([Math.min(...embeddingData.map(({coords}) => coords[1])),
              Math.max(...embeddingData.map(({coords}) => coords[1]))])
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
        return d.id == selectedInstanceId ? selectedCircleRadius : circleRadius;
      })
      .style('fill', function (d) { return labelColorMap[d.label] })
      .style('opacity', function(d) {
        return d.id == selectedInstanceId ? selectedCircleOpacity : circleOpacity;
      }) 
      .style('stroke', 'white')
      .on('click', transferEmbeddingPointHighlights)
      .on("mouseover", function(event, d) {
        showTooltip(event, d);
        highlightCircleOnMouseover(d);
      })
      .on("mouseleave", function(event, d) {
        tooltipShow = false;
        unhighlightCircleOnMouseout(d);
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

  // We want to split the sentence around the halfway point
  // but not split the sentence mid-word.
  function buildTooltipSentenceHtml(sentence) {
    let sentenceHalfwayIdx = Math.floor(charactersToIncludeInTooltip / 2);
    let sentenceSplitIdxBeforeHalf = sentenceHalfwayIdx
    let sentenceSplitIdxAfterHalf = sentenceHalfwayIdx
    while(sentenceSplitIdxBeforeHalf >= 0 && sentence.charAt(sentenceSplitIdxBeforeHalf) != ' ') {
      sentenceSplitIdxBeforeHalf--;
    }
    while(sentenceSplitIdxAfterHalf < Math.min(charactersToIncludeInTooltip, sentence.length)
          && sentence.charAt(sentenceSplitIdxAfterHalf) != ' ') {
      sentenceSplitIdxAfterHalf++;
    }
    let sentenceSplitIdx = (Math.min(Math.abs(sentenceHalfwayIdx - sentenceSplitIdxBeforeHalf))
                          > Math.min(Math.abs(sentenceHalfwayIdx - sentenceSplitIdxAfterHalf))) 
                          ? sentenceSplitIdxAfterHalf : sentenceSplitIdxBeforeHalf;
    // If we can't find a spot to split the sentence, just split it in half
    sentenceSplitIdx = sentenceSplitIdx == sentence.length ? sentenceHalfwayIdx : sentenceSplitIdx;

    tooltipHtml = sentence.substring(0, sentenceSplitIdx)
                + '<br>'
                + sentence.substring(sentenceSplitIdx, charactersToIncludeInTooltip)
                + '...';
    return tooltipHtml;
  }

  function transferEmbeddingPointHighlights(event, d) {
    d3.select('#circle-' + selectedInstanceId)
      .attr('r', circleRadius)
      .style('opacity', circleOpacity);
    currInstanceStore.set(d.id);
    d3.select(this)
      .attr('r', selectedCircleRadius)
      .style('opacity', selectedCircleOpacity)
      .raise();
  }

  function highlightCircleOnMouseover(d) {
    if (d.id != selectedInstanceId) {
      d3.select('#circle-' + d.id)
        .attr('r', hoveredCircleRadius)
        .style('opacity', hoveredCircleOpacity)
        .raise();
    }
  }

  function unhighlightCircleOnMouseout(d) {
    if (d.id != selectedInstanceId) {
      d3.select('#circle-' + d.id)
        .attr('r', circleRadius)
        .style('opacity', circleOpacity);
    }
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