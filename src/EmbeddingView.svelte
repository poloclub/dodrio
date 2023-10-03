<script>
  import { onMount, afterUpdate } from 'svelte';
  import { embeddingViewConfigStore, currInstanceStore } from './store';
  import Tooltip from './Tooltip.svelte';
  import * as d3 from 'd3';

  export let embeddingDataFilepath;

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
  let tooltipMaxWidth = 200;
  let tooltipShow = false;
  let toolTipFontSize = '0.65em';
  let charactersToIncludeInTooltip = 40;

  let selectedCircleStrokeColor = 'rgb(100, 149, 237)';
  let circleRadius = 5;
  let selectedCircleRadius = 7;
  let hoveredCircleRadius = 7;
  let circleOpacity = 0.3;
  let selectedCircleOpacity = 1;
  let hoveredCircleOpacity = 1;
  let nonHoveredCircleOpacity = 0.2;
  let twitterLabelColorMap = {
    0: 'red',
    1: 'grey',
    2: 'skyblue',
  };
  let sst2LabelColorMap = {
    0: 'red',
    1: 'skyblue',
  };
  let twitterLabels = ['negative', 'neutral', 'positive'];
  let sst2Labels = ['negative', 'positive'];

  $: selectedInstanceId,
    (function () {
      // When selectedInstanceId store value changes, update
      // embedding highlight.
      d3.select(embeddingSVG)
        .select('#circle-' + previousSelectedInstanceId)
        .attr('r', circleRadius)
        .style('opacity', circleOpacity)
        .style('stroke', 'white');
      d3.select(embeddingSVG)
        .select('#circle-' + selectedInstanceId)
        .attr('r', selectedCircleRadius)
        .style('opacity', selectedCircleOpacity)
        .style('stroke', selectedCircleStrokeColor)
        .raise();
      previousSelectedInstanceId = selectedInstanceId;
    })();

  const drawEmbeddingsPlot = () => {
    const zoom = d3
      .zoom()
      .on('zoom', (event) => {
        svg.select('g').attr('transform', event.transform);
      })
      .scaleExtent([0.5, 10]);

    let svg = d3
      .select(embeddingSVG)
      .attr('width', SVGWidth)
      .attr('height', SVGHeight)
      .attr('viewBox', [0, 0, SVGWidth, SVGHeight])
      .style('fill', '#eee')
      .call(zoom);

    let x = d3
      .scaleLinear()
      .domain([
        Math.min(...embeddingData.map(({ coords }) => coords[0])),
        Math.max(...embeddingData.map(({ coords }) => coords[0])),
      ])
      .range([0, SVGWidth]);

    let y = d3
      .scaleLinear()
      .domain([
        Math.min(...embeddingData.map(({ coords }) => coords[1])),
        Math.max(...embeddingData.map(({ coords }) => coords[1])),
      ])
      .range([SVGHeight, 0]);

    // Add dots
    svg
      .append('g')
      .selectAll('dot')
      .data(embeddingData)
      .enter()
      .append('circle')
      .attr('id', function (d) {
        return 'circle-' + d.id;
      })
      .attr('cx', function (d) {
        return x(d.coords[0]);
      })
      .attr('cy', function (d) {
        return y(d.coords[1]);
      })
      .attr('r', function (d) {
        return d.id == selectedInstanceId ? selectedCircleRadius : circleRadius;
      })
      .style('fill', function (d) {
        return sst2LabelColorMap[d.label];
      })
      .style('opacity', function (d) {
        return d.id == selectedInstanceId
          ? selectedCircleOpacity
          : circleOpacity;
      })
      .style('stroke', function (d) {
        return d.id == selectedInstanceId ? selectedCircleStrokeColor : 'white';
      })
      .style('stroke-width', '2px')
      .on('click', transferEmbeddingPointHighlights)
      .on('mouseover', function (event, d) {
        showTooltip(event, d);
        highlightCircleOnMouseover(d);
      })
      .on('mouseleave', function (event, d) {
        tooltipShow = false;
        unhighlightCircleOnMouseout(d);
      });
    // Raise selected embedding point
    svg.select('#circle-' + selectedInstanceId).raise();

    // Draw legend
    let labels = [...embeddingData.map(({ label }) => label)];
    let uniqueLabels = labels.filter((x, i, a) => a.indexOf(x) === i);
    let rectangleWidth = 12;
    let rectanglePadding = 2;
    // console.log(uniqueLabels.length);

    let legend = svg
      .selectAll('.legend')
      .data(uniqueLabels)
      .enter()
      .append('g')
      .attr('class', 'legend')
      .attr('transform', function (d, i) {
        return 'translate(0,' + i * (rectangleWidth + rectanglePadding) + ')';
      });

    legend
      .append('rect')
      .attr('x', SVGWidth - 100)
      .attr('y', SVGHeight - rectangleWidth * (uniqueLabels.length + 1))
      .attr('width', rectangleWidth)
      .attr('height', rectangleWidth)
      .style('fill', function (d) {
        return sst2LabelColorMap[d];
      });

    legend
      .append('text')
      .attr('x', SVGWidth - 95 + rectangleWidth)
      .attr('y', SVGHeight - rectangleWidth * uniqueLabels.length)
      .style('text-anchor', 'start')
      .style('dominant-baseline', 'text-after-edge')
      .style('fill', 'black')
      .style('font-size', '0.7em')
      .text(function (d) {
        return d + ' (' + sst2Labels[d] + ')';
      });
  };

  function showTooltip(event, d) {
    let node = event.currentTarget;
    let position = node.getBoundingClientRect();
    let curWidth = position.right - position.left;
    let tooltipCenterX = position.x + curWidth / 2;
    let tooltipCenterY = position.y - 40 + window.scrollY;
    tooltipShow = true;

    tooltipHtml = d.sentence.substring(0, charactersToIncludeInTooltip) + '...';
    tooltipLeft = tooltipCenterX - tooltipWidth / 2;
    tooltipTop = tooltipCenterY;
  }

  function transferEmbeddingPointHighlights(event, d) {
    d3.select(embeddingSVG)
      .select('#circle-' + selectedInstanceId)
      .attr('r', circleRadius)
      .style('opacity', circleOpacity)
      .style('stroke', 'white');
    currInstanceStore.set(d.id);
    d3.select(this)
      .attr('r', selectedCircleRadius)
      .style('opacity', selectedCircleOpacity)
      .style('stroke', selectedCircleStrokeColor)
      .raise();
  }

  function highlightCircleOnMouseover(d) {
    d3.select(embeddingSVG)
      .selectAll('circle')
      .filter(function () {
        return (
          this.id != 'circle-' + selectedInstanceId &&
          this.id != 'circle-' + d.id
        );
      })
      .style('opacity', nonHoveredCircleOpacity);
    if (d.id != selectedInstanceId) {
      d3.select(embeddingSVG)
        .select('#circle-' + d.id)
        .attr('r', hoveredCircleRadius)
        .style('opacity', hoveredCircleOpacity);
      d3.select(embeddingSVG)
        .select('#circle-' + d.id)
        .raise();
    }
  }

  function unhighlightCircleOnMouseout(d) {
    d3.select(embeddingSVG)
      .selectAll('circle')
      .filter(function () {
        return (
          this.id != 'circle-' + selectedInstanceId &&
          this.id != 'circle-' + d.id
        );
      })
      .style('opacity', circleOpacity);
    if (d.id != selectedInstanceId) {
      d3.select(embeddingSVG)
        .select('#circle-' + d.id)
        .attr('r', circleRadius)
        .style('opacity', circleOpacity);
    }
  }

  const renderEmbeddings = async () => {
    // console.log('loading embeddings');
    embeddingData = await d3.json(embeddingDataFilepath);
    // console.log('loaded embeddings');

    drawEmbeddingsPlot();
  };

  embeddingViewConfigStore.subscribe((value) => {
    if (value.compHeight !== undefined && value.compWidth !== undefined) {
      if (
        embeddingViewConfig === undefined ||
        (embeddingViewConfig.compHeight !== value.compHeight &&
          embeddingViewConfig.compWidth !== value.compWidth)
      ) {
        embeddingViewConfig = value;
        SVGWidth = embeddingViewConfig.compWidth;
        SVGHeight = embeddingViewConfig.compHeight;

        SVGWidth = 300;
        SVGHeight = 300;
        renderEmbeddings();
      }
    }
  });

  onMount(() => {
    SVGWidth = 350;
    SVGHeight = 300;
    renderEmbeddings();
  });

  currInstanceStore.subscribe((value) => {
    selectedInstanceId = value;
  });
</script>

<style lang="scss">
</style>

<div class="embedding-view">
  <div class="svg-container">
    <Tooltip
      bind:this={tooltip}
      left={tooltipLeft}
      top={tooltipTop}
      {tooltipHtml}
      width={tooltipWidth}
      {tooltipShow}
      fontSize={toolTipFontSize}
      maxWidth={tooltipMaxWidth}
    />
    <svg class="embedding-svg" bind:this={embeddingSVG} />
  </div>
</div>
