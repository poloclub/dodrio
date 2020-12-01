<script>
  import { onMount } from 'svelte';
  import Tooltip from './Tooltip.svelte';
  export let width = 400;

  let saliencyDiv = null;
  let saliencyComponent = null;
  let saliencyRow = null;
  let tooltip = null;

  let tooltipLeft = 0;
  let tooltipTop = 0;
  let tooltipHtml = 'tooltip';
  let tooltipWidth = 65;
  let tooltipShow = false;

  // HTML input
  let saliencyKey = 'grad_0'
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
    }
    reader.readAsDataURL(file);
  }

  const submitClicked = (evt) => {
    // Remove the preivious views
    d3.select(saliencyDiv)
      .selectAll('*')
      .remove();

    d3.select(saliencyRow)
      .select('svg')
      .remove();

    drawSaliencies(saliencies, saliencyKey);
  }

  const drawSaliencies = (saliencies, key) => {
    if (saliencyDiv === null) {
      return;
    }

    console.log(saliencies);

    // Create a divering color scale from red to green
    let largestAbs = d3.max(saliencies.map(d => Math.abs(d[key])));

    let colorScale = d3.scaleLinear()
      .domain([-largestAbs, 0, largestAbs])
      .range([d3.rgb('#eb2f06'), d3.rgb('#ffffff'), d3.rgb('#458FC1')]);
    
    let container = d3.select(saliencyDiv);

    // Add tokens
    let divs = container.selectAll('div.token')
      .data(saliencies)
      .enter()
      .append('div')
      .attr('class', 'token')
      .style('background', d => colorScale(+d[key]))
      .text(d => d.token);
    
    // Mouseover function
    divs.on('mouseover', (event, d) => {
      let node = event.currentTarget;
      let curDiv = d3.select(node);
      let curI = divs.nodes().indexOf(event.currentTarget);
      tooltipShow = true;

      // container.selectAll('div.token')
      //   .filter((d, i) => i !== curI)
      //   .transition()
      //   .duration(300)
      //   .ease(d3.easeQuadInOut)
      //   .style('opacity', 0.3);
      
      // Highlight the hovered over div
      curDiv.style('border', '1px solid rgba(0, 0, 0, 1)');
      
      // Toggle the tooltip
      let position = node.getBoundingClientRect();
      let tooltipCenterX = node.offsetLeft + position.width / 2;
      let tooltipCenterY = node.offsetTop - 40;

      tooltipHtml = d3.format('.4f')(+d[key]);
      tooltipLeft = tooltipCenterX - tooltipWidth / 2;
      tooltipTop = tooltipCenterY;
    });

    // Mouseleave function
    divs.on('mouseleave', (event, d) => {
        let node = event.currentTarget;
        let curDiv = d3.select(node);
        tooltipShow = false;

        // container.selectAll('div.token')
        //   .transition()
        //   .duration(300)
        //   .ease(d3.easeQuadInOut)
        //   .style('opacity', 1);
        
        curDiv.style('border', '1px solid rgba(0, 0, 0, 0)');
      })
    
    // Add a svg element
    let rightSVG = d3.select(saliencyRow)
      .append('svg')
      .attr('height', 400)
      .attr('width', 100);
    
    // Define the gradient
    let legentGradientDef = rightSVG.append('defs')
      .append('linearGradient')
      .attr('x1', 0)
      .attr('y1', 1)
      .attr('x2', 0)
      .attr('y2', 0)
      .attr('id', 'legend-gradient');
    
    legentGradientDef.append('stop')
      .attr('stop-color', '#eb2f06')
      .attr('offset', 0);

    legentGradientDef.append('stop')
      .attr('stop-color', '#ffffff')
      .attr('offset', 0.5);
    
    legentGradientDef.append('stop')
      .attr('stop-color', '#4690C2')
      .attr('offset', 1);
    
    // Draw the legend
    let legendWidth = 20;
    let legendHeight = 300;
    let legendGroup = rightSVG.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${30}, ${5})`)

    legendGroup.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', 'url(#legend-gradient)')
      .style('stroke', 'black');
    
    // Draw the legend axis
    let legendScale = d3.scaleLinear()
      .domain([-largestAbs, largestAbs])
      .range([legendHeight, 0])
      .nice();
    
    legendGroup.append("g")
      .attr('transform', `translate(${legendWidth}, ${0})`)
      .call(d3.axisRight(legendScale).ticks(10));

  }

  onMount(async () => {
    console.log('loading');
    saliencies = await d3.json('/data/saliency_list.json');
    console.log('loaded');

    drawSaliencies(saliencies, saliencyKey);
  })

</script>

<style type="text/scss">
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
  
  .saliency {
    border: 1px solid $light-gray;
    padding: 5px;
    display: flex;
    flex: row;
    flex-wrap: wrap;
    position: relative;
  }

  :global(.token) {
    padding: 0 3px;
    border: 1px solid rgba(0, 0, 0, 0);
    cursor: pointer;

    &:not(:last-of-type) {
      margin: 2px 4px 2px 0;
    }
  }

  .control-panel {
    display: flex;
    flex-direction: row-reverse;
    margin: 10px 0;
    padding: 0 100px 0 0;

    .input {
      margin: 0 10px;
      width: 170px;
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

<div class='saliency-component' bind:this={saliencyComponent}>

  <div class='saliency-row' bind:this={saliencyRow}>
    <div class='saliency' style='width: {width}px' bind:this={saliencyDiv}>
      <Tooltip bind:this={tooltip}
        left={tooltipLeft}
        top={tooltipTop}
        tooltipHtml={tooltipHtml}
        width={tooltipWidth}
        tooltipShow={tooltipShow}
        />
    </div>
  </div>

  <div class='control-panel'>
    <button class="button" on:click={submitClicked}>Submit</button>

    <input class="input" type="text" placeholder="JSON Saliency Key"
      bind:value={saliencyKey}>

    <div class="file is-normal-small">
      <label class="file-label">
        <input class="file-input is-normal-small" type="file" name="json"
          accept='.json'
          on:change={newJSONUploaded}>
        <span class="file-cta is-normal-small no-top-border-radius">
          <span class="file-icon">
            <i class="fas fa-upload"></i>
          </span>
          <span class="file-label">
            JSON
          </span>
        </span>
      </label>
    </div>

    {#if filename !== null}
      <div class="tag is-light is-large large">
        {filename}
      </div>
    {/if}

  </div>
  

</div>