<script>
  import { onMount } from 'svelte';
  import Tooltip from './Tooltip.svelte';
  export let width = 300;

  let saliencyDiv = null;
  let saliencyComponent = null;

  const drawSaliencies = (saliencies, key) => {
    if (saliencyDiv === null) {
      return;
    }

    console.log(saliencies);

    // Create a divering color scale from red to green
    let largestAbs = d3.max(saliencies.map(d => Math.abs(d[key])));
    console.log(largestAbs);

    let colorScale = d3.scaleLinear()
      .domain([-largestAbs, 0, largestAbs])
      .range([d3.rgb('#eb2f06'), d3.rgb('#ffffff'), d3.rgb('#78e08f')]);

    let container = d3.select(saliencyDiv);

    // Add tokens
    let divs = container.selectAll('div.token')
      .data(saliencies)
      .enter()
      .append('div')
      .attr('class', 'token')
      .style('background', d => colorScale(+d[key]))
      .text(d => d.token);
    
    divs.on('mouseover', (event, d) => {
        let curDiv = d3.select(event.currentTarget);
        let curI = divs.nodes().indexOf(event.currentTarget);
        container.selectAll('div.token')
          .filter((d, i) => i !== curI)
          .transition()
          .duration(300)
          .ease(d3.easeQuadInOut)
          .style('opacity', 0.3);
      });

    divs.on('mouseleave', (event, d) => {
        container.selectAll('div.token')
          .transition()
          .duration(300)
          .ease(d3.easeQuadInOut)
          .style('opacity', 1);
      })
    
    // Add a svg element
    let rightSVG = d3.select(saliencyComponent)
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
      .attr('stop-color', '#78e08f')
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
    let saliencies = await d3.json('/data/saliency_list.json');
    console.log('loaded');

    drawSaliencies(saliencies, 'grad_1');
  })

</script>

<style type="text/scss">
  $light-gray: gray;

  .saliency-component {
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
    cursor: pointer;

    &:not(:last-of-type) {
      margin: 2px 5px 2px 0;
    }
  }

</style>

<div class='saliency-component' bind:this={saliencyComponent}>

  <div class='saliency' style='width: {width}px' bind:this={saliencyDiv}>
    <Tooltip left=20 right=20/>
  </div>

</div>