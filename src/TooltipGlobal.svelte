<script>
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  import { tooltipConfigStore } from './store';

  let tooltipConfig = {
    show: false,
    html: 'null',
    left: 0,
    top: 0,
    width: 80,
    maxWidth: 80,
    fontSize: '1em'
  };

  let tooltip = null;

  $: style = `left: ${tooltipConfig.left}px; top: ${tooltipConfig.top}px;
    width: ${tooltipConfig.width}px; max-width: ${tooltipConfig.maxWidth}px;
    font-size: ${tooltipConfig.fontSize}`;

  tooltipConfigStore.subscribe(value => {

    let selection = d3.select(tooltip);
    if (value.show) {
      selection.style('visibility', 'visible');
      d3.select(tooltip)
        .transition()
        .duration(100)
        .ease(d3.easeQuadInOut)
        .style('opacity', 1);
    } else {
      d3.select(tooltip)
        .transition()
        .delay(100)
        .duration(200)
        .ease(d3.easeQuadInOut)
        .style('opacity', 0)
        .on('end', function() {
          d3.select(this)
            .style('visibility', 'hidden');
        });
    }

    tooltipConfig = value;
  });

  onMount(() => {
    d3.select(tooltip).style('visibility', 'hidden');
    tooltipConfigStore.set(tooltipConfig);
  });

</script>

<style>
  .tooltip {
    position: absolute;
    color: white;
    background-color: black;
    padding: 5px 5px;
    border-radius: 5px;
    opacity: 1;
    z-index: 20;
    visibility: visible;
    transition: opacity 150ms, visibility 150ms;
    display: flex;
    justify-content: center;
    box-sizing: border-box;
    pointer-events: none;
  }
</style>

<div class="tooltip" style={style} bind:this={tooltip}>
  {@html tooltipConfig.html}
</div>