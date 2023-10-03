<script>
  import { onMount } from 'svelte';
  import Tooltip from './Tooltip.svelte';
  import TextClassificationStats from './TextClassificationStats.svelte';
  import SmallMatrix from './SmallMatrix.svelte';
  import GraphView from './GraphView.svelte';
  import * as d3 from 'd3';

  export let width = 400;

  let saliencyDiv = null;
  let saliencySVG = null;
  let rightSVG = null;
  let saliencyComponent = null;
  let saliencyRow = null;
  let tooltip = null;

  let tooltipLeft = 0;
  let tooltipTop = 0;
  let tooltipHtml = 'tooltip';
  let tooltipWidth = 65;
  let tooltipShow = false;

  let svgWidth = 950;
  let svgHeight = 600;

  let heatmapMode = false;

  const rightSVGWidth = 100;
  const legendPos = {
    width: 20,
    height: 300,
    top: 5,
    left: 30,
  };

  let saliencySVGPadding = {
    top: 10,
    left: 10,
    right: 10,
    bottom: 20,
  };

  const tokenPadding = {
    left: 3,
    right: 2,
    top: 4,
    bottom: 0,
  };

  // HTML input
  let saliencyKey = 'negative';
  let saliencies = null;
  let filename = 'saliency_list.json';

  const newJSONUploaded = (evt) => {
    // Load the file
    let files = evt.target.files;
    let file = files[0];
    filename = file.name;

    // Read the file
    let reader = new FileReader();
    reader.onload = async (evt) => {
      // Renew the data and frame count
      saliencies = await d3.json(evt.target.result);
    };
    reader.readAsDataURL(file);
  };

  const submitClicked = (evt) => {
    // Remove the preivious views
    d3.select(saliencyDiv).selectAll('.token').remove();

    d3.select(saliencyRow).select('svg').remove();

    drawSaliencies(saliencies, saliencyKey);
  };

  const drawSaliencyLegend = (saliencyRow, largestAbs) => {
    // Add a svg element
    let rightSVGHeight = +d3.select(saliencySVG).attr('height');
    rightSVG = d3
      .select(saliencyRow)
      .append('svg')
      .attr('class', 'right-svg')
      .attr('height', rightSVGHeight)
      .attr('width', rightSVGWidth);

    // Define the gradient
    let legentGradientDef = rightSVG
      .append('defs')
      .append('linearGradient')
      .attr('x1', 0)
      .attr('y1', 1)
      .attr('x2', 0)
      .attr('y2', 0)
      .attr('id', 'legend-gradient');

    legentGradientDef
      .append('stop')
      .attr('stop-color', '#eb2f06')
      .attr('offset', 0);

    legentGradientDef
      .append('stop')
      .attr('stop-color', '#ffffff')
      .attr('offset', 0.5);

    legentGradientDef
      .append('stop')
      .attr('stop-color', '#4690C2')
      .attr('offset', 1);

    // Draw the legend
    let legendGroup = rightSVG
      .append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${legendPos.left}, ${legendPos.top})`);

    legendGroup
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', legendPos.width)
      .attr('height', legendPos.height)
      .style('fill', 'url(#legend-gradient)')
      .style('stroke', 'black');

    // Draw the legend axis
    let legendScale = d3
      .scaleLinear()
      .domain([-largestAbs, largestAbs])
      .range([legendPos.height, 0])
      .nice();

    legendGroup
      .append('g')
      .attr('transform', `translate(${legendPos.width}, ${0})`)
      .call(d3.axisRight(legendScale).ticks(10));
  };

  const enterHeatmap = () => {
    const buttonAnimationTime = 1000;
    const buttonAnimationEase = d3.easeCubicInOut;
    let tokens = d3
      .select(saliencySVG)
      .select('.text-group')
      .selectAll('.token');

    // Hide the texts
    tokens
      .select('.text-token')
      .transition('text-opacity')
      .duration(buttonAnimationTime / 2)
      .ease(buttonAnimationEase)
      .style('opacity', 0)
      .on('end', (d, i, g) => {
        d3.select(g[i]).style('visibility', 'hidden');
      });

    let tileHeight = +tokens.select('.text-background').attr('height');
    let containerWidth =
      svgWidth - saliencySVGPadding.left - saliencySVGPadding.right;
    let tileGap = 3;
    let tileColumnNum = Math.floor(containerWidth / (tileHeight + tileGap));
    let tileNumRow = Math.floor(tokens.nodes().length / tileColumnNum) + 1;

    // To center the heatmap, we need to re-calculate the starting gap
    let startSpace =
      (containerWidth - tileColumnNum * (tileHeight + tileGap) + tileGap) / 2;

    // Move the rect positions and change their width
    tokens
      .transition('button-animation')
      .duration(buttonAnimationTime)
      .ease(buttonAnimationEase)
      .attr('transform', (_, i) => {
        // Compute the current tile's location
        let cur_r = Math.floor(i / tileColumnNum);
        let cur_c = i % tileColumnNum;
        return `translate(${startSpace + cur_c * (tileHeight + tileGap)},
        ${cur_r * (tileHeight + tileGap)})`;
      });

    tokens
      .select('.text-background')
      .transition('button-animation')
      .duration(buttonAnimationTime)
      .ease(buttonAnimationEase)
      .attr('width', function () {
        return +d3.select(this).attr('height');
      });

    // Change the SVG height
    let tempSVGHeight =
      saliencySVGPadding.top +
      saliencySVGPadding.bottom / 2 +
      tileNumRow * (tileHeight + tileGap) -
      tileGap;

    d3.select(saliencySVG)
      .transition('button-animation')
      .duration(buttonAnimationTime)
      .ease(buttonAnimationEase)
      .attr('height', tempSVGHeight);

    d3.select(saliencySVG)
      .select('.svg-border-rect')
      .transition('button-animation')
      .duration(buttonAnimationTime)
      .ease(buttonAnimationEase)
      .attr('height', tempSVGHeight);

    rightSVG
      .transition('button-animation')
      .duration(buttonAnimationTime)
      .ease(buttonAnimationEase)
      .attr('height', tempSVGHeight);
  };

  const exitHeatmap = (textTokenPositions, textTokenWidths) => {
    const buttonAnimationTime = 1000;
    const buttonAnimationEase = d3.easeCubicInOut;
    let tokens = d3
      .select(saliencySVG)
      .select('.text-group')
      .selectAll('.token');

    // Show the texts
    tokens.select('.text-token').style('visibility', 'visible');

    // Restore the position of the text token
    tokens
      .transition('button-animation')
      .duration(buttonAnimationTime)
      .ease(buttonAnimationEase)
      .attr('transform', (_, i) => {
        let curPos = textTokenPositions[i];
        return `translate(${curPos.x}, ${curPos.y})`;
      });

    // Restore text token rect width
    tokens
      .select('.text-background')
      .transition('button-animation')
      .duration(buttonAnimationTime)
      .ease(buttonAnimationEase)
      .attr(
        'width',
        (_, i) => textTokenWidths[i] + tokenPadding.left + tokenPadding.right
      );

    // Change the SVG height
    d3.select(saliencySVG)
      .transition('button-animation')
      .duration(buttonAnimationTime)
      .ease(buttonAnimationEase)
      .attr('height', svgHeight);

    d3.select(saliencySVG)
      .select('.svg-border-rect')
      .transition('button-animation')
      .duration(buttonAnimationTime)
      .ease(buttonAnimationEase)
      .attr('height', svgHeight);

    rightSVG
      .transition('button-animation')
      .duration(buttonAnimationTime)
      .ease(buttonAnimationEase)
      .attr('height', svgHeight);

    // Show the texts
    tokens
      .select('.text-token')
      .transition('text-animation')
      .delay(buttonAnimationTime / 2)
      .duration(buttonAnimationTime / 2)
      .ease(buttonAnimationEase)
      .style('opacity', 1);
  };

  const drawSaliencyControl = (textTokenPositions, textTokenWidths) => {
    if (rightSVG === null) {
      return;
    }

    let rectY = legendPos.top + legendPos.height + 10;
    let heatmapButton = rightSVG
      .append('rect')
      .attr('x', legendPos.left)
      .attr('y', rectY)
      .attr('class', 'rect-button')
      .attr('width', 30)
      .attr('height', 30)
      .attr('rx', 5)
      .style('fill', '#F5F5F5')
      .style('stroke-width', 1)
      .style('stroke', '#DBDBDB');

    heatmapButton.on('mouseover', (event, d) => {
      let node = event.currentTarget;
      let button = d3.select(node);
      button.style('stroke', 'black');
    });

    heatmapButton.on('mouseleave', (event, d) => {
      let node = event.currentTarget;
      let button = d3.select(node);
      button.style('stroke', '#DBDBDB');
    });

    heatmapButton.on('click', () => {
      if (!heatmapMode) {
        enterHeatmap();
        heatmapMode = true;
      } else {
        exitHeatmap(textTokenPositions, textTokenWidths);
        heatmapMode = false;
      }
    });
  };

  const drawSaliencies = (saliencies, key) => {
    if (saliencySVG === null) {
      return;
    }

    let saliencyTokens = saliencies.tokens;
    // console.log(saliencyTokens);

    // Create a divering color scale from red to green
    let largestAbs = d3.max(saliencyTokens.map((d) => Math.abs(d[key])));
    const tokenGap = 4;
    const rowGap = 30;

    let colorScale = d3
      .scaleLinear()
      .domain([-largestAbs, 0, largestAbs])
      .range([d3.rgb('#eb2f06'), d3.rgb('#ffffff'), d3.rgb('#458FC1')]);

    let container = d3
      .select(saliencySVG)
      .attr('height', svgHeight)
      .attr('width', svgWidth)
      .append('g')
      .attr('class', 'main-svg')
      .attr(
        'transform',
        `translate(${saliencySVGPadding.left}, ${saliencySVGPadding.top})`
      );

    // Add svg border rect
    d3.select(saliencySVG)
      .append('rect')
      .attr('class', 'svg-border-rect')
      .attr('height', svgHeight)
      .attr('width', svgWidth)
      .style('stroke', 'black')
      .style('fill', 'none');

    // Add svg control buttons

    let containerWidth =
      svgWidth - saliencySVGPadding.left - saliencySVGPadding.right;

    let textGroup = container.append('g').attr('class', 'text-group');

    let tokenGroups = textGroup
      .selectAll('g.token')
      .data(saliencyTokens)
      .enter()
      .append('g')
      .attr('class', 'token')
      .attr('id', (_, i) => `token-${i}`);

    let tokenTexts = tokenGroups
      .append('text')
      .attr('class', 'text-token')
      .attr('x', tokenPadding.left)
      .attr('y', tokenPadding.top)
      .text((d) => d.token);

    // After the text elements are created, we need to query again to get the
    // length and width of these elements
    let textTokenWidths = {};
    let textTokenPositions = {};
    let textTokenHeight = null;

    tokenTexts.each(function (_, i) {
      let bbox = this.getBBox();
      textTokenWidths[i] = +Number(bbox.width).toFixed(2);

      if (textTokenHeight == null) {
        textTokenHeight = bbox.height;
      }
    });

    let tokenRects = tokenGroups
      .append('rect')
      .attr('class', 'text-background')
      .attr(
        'width',
        (_, i) => textTokenWidths[i] + tokenPadding.left + tokenPadding.right
      )
      .attr('height', textTokenHeight + tokenPadding.top + tokenPadding.bottom)
      .style('fill', (d) => colorScale(+d[key]))
      .lower();

    // Change the positions of tokens based on their width
    let curPos = { x: 0, y: 0 };
    let tokenNum = Object.keys(textTokenWidths).length;

    // Change the position of the text token
    tokenGroups.each(function (_, i) {
      d3.select(this).attr('transform', `translate(${curPos.x}, ${curPos.y})`);

      // Record the new position
      textTokenPositions[i] = { x: curPos.x, y: curPos.y };

      // Update the next position
      let curLineLength =
        curPos.x +
        textTokenWidths[i] +
        tokenPadding.left +
        tokenPadding.right +
        tokenGap;
      if (i + 1 < tokenNum) {
        curLineLength += textTokenWidths[i + 1];
      }

      // Shift to next row if needed
      if (curLineLength > containerWidth) {
        curPos.y += rowGap;
        curPos.x = 0;
      } else {
        curPos.x =
          curPos.x +
          textTokenWidths[i] +
          tokenPadding.left +
          tokenPadding.right +
          tokenGap;
      }
    });

    // Resize the SVG based on the content height
    svgHeight =
      curPos.y +
      textTokenHeight +
      tokenPadding.top +
      tokenPadding.bottom +
      saliencySVGPadding.bottom;
    d3.select(saliencySVG)
      .attr('height', svgHeight)
      .select('.svg-border-rect')
      .attr('height', svgHeight);

    // Mouseover function
    tokenGroups.on('mouseover', (event, d) => {
      let node = event.currentTarget;
      let curGroup = d3.select(node);
      let curI = d3
        .select(node.parentNode)
        .nodes()
        .indexOf(event.currentTarget);

      // Highlight the border
      curGroup.select('.text-background').style('stroke', 'rgba(0, 0, 0, 1)');

      // Show the tooltip
      tooltipShow = true;
      let position = node.getBoundingClientRect();

      let curWidth = position.right - position.left;
      let tooltipCenterX = position.x + curWidth / 2;
      let tooltipCenterY = position.y - 40 + window.scrollY;

      tooltipHtml = d3.format('.4f')(+d[key]);
      tooltipLeft = tooltipCenterX - tooltipWidth / 2;
      tooltipTop = tooltipCenterY;
    });

    // Mouseleave function
    tokenGroups.on('mouseleave', (event, d) => {
      let node = event.currentTarget;
      let curGroup = d3.select(node);
      let curI = d3
        .select(node.parentNode)
        .nodes()
        .indexOf(event.currentTarget);

      // Dehighlight the border
      curGroup.select('.text-background').style('stroke', 'none');

      // Hide the tooltip
      tooltipShow = false;
    });

    drawSaliencyLegend(saliencyRow, largestAbs);
    drawSaliencyControl(textTokenPositions, textTokenWidths);
  };

  onMount(async () => {
    console.log('loading');
    saliencies = await d3.json('PUBLIC_URL/data/saliency_list.json');
    console.log('loaded');

    drawSaliencies(saliencies, saliencyKey);
  });
</script>

<style lang="scss">
  $light-gray: gray;

  .saliency-component {
    display: flex;
    flex-direction: column;
  }

  .saliency-row {
    display: flex;
    flex-direction: row;
    justify-content: center;
  }

  :global(.saliency-svg .token) {
    cursor: pointer;
  }

  :global(.saliency-svg .text-token) {
    font-size: 1em;
    dominant-baseline: hanging;
  }

  :global(.saliency-svg .text-background) {
    shape-rendering: crispEdges;
    stroke-width: 1px;
  }

  :global(.right-svg .rect-button) {
    // shape-rendering: crispEdges;
    cursor: pointer;
  }

  .control-panel {
    display: flex;
    flex-direction: row-reverse;
    margin: 10px 0;
    padding: 0 100px 0 0;

    .input {
      margin: 0 10px;
      width: 120px;
    }
  }

  .large {
    font-size: 1em;
    padding-left: 1em;
    padding-right: 1em;
    padding-top: 1.2em;
    padding-bottom: 1.2em;
    margin-right: 10px;
  }
</style>

<div class="saliency-component" bind:this={saliencyComponent}>
  <Tooltip
    bind:this={tooltip}
    left={tooltipLeft}
    top={tooltipTop}
    {tooltipHtml}
    width={tooltipWidth}
    {tooltipShow}
  />

  <GraphView />
  <SmallMatrix />

  <div class="saliency-row" bind:this={saliencyRow}>
    <svg class="saliency-svg" bind:this={saliencySVG} />
  </div>

  <div class="control-panel">
    <button class="button" on:click={submitClicked}>Submit</button>

    <input
      class="input"
      type="text"
      placeholder="Saliency Key"
      bind:value={saliencyKey}
    />

    <div class="file is-normal-small">
      <label class="file-label">
        <input
          class="file-input is-normal-small"
          type="file"
          name="json"
          accept=".json"
          on:change={newJSONUploaded}
        />
        <span class="file-cta is-normal-small no-top-border-radius">
          <span class="file-icon">
            <i class="fas fa-upload" />
          </span>
          <span class="file-label"> JSON </span>
        </span>
      </label>
    </div>

    {#if filename !== null}
      <div class="tag is-light is-large large">
        {filename}
      </div>
    {/if}
    {#if saliencies != null}
      <TextClassificationStats
        trueLabel={saliencies.meta['true_label']}
        predictedLabel={saliencies.meta['predicted_label']}
        softmaxScores={saliencies.meta['softmax_scores']}
      />
    {/if}
  </div>
</div>
