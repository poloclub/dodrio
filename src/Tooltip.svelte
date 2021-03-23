<script>
  import * as d3 from 'd3';

  export let tooltipShow = false;
  export let tooltipHtml = "1.23";
  export let left = 0;
  export let top = 0;
  export let width = 80;
  export let maxWidth = 80;
  export let fontSize = '1em';

  let tooltip = null;

  $: style = `left: ${left}px; top: ${top}px; width: ${width}px; max-width: 
              ${maxWidth}px; font-size: ${fontSize}`;
  $: tooltipShow, function() {
    if (tooltip === null) return;
    let selection = d3.select(tooltip);

    if (tooltipShow) {
      selection.style('visibility', 'visible');

      d3.select(tooltip)
        .transition()
        .duration(200)
        .ease(d3.easeQuadInOut)
        .style('opacity', 1);
    } else {
      d3.select(tooltip)
        .transition()
        .duration(200)
        .ease(d3.easeQuadInOut)
        .style('opacity', 0)
        .on('end', function() {
          d3.select(this)
            .style('visibility', 'hidden');
        });
    }
  }();

</script>

<style>
  .tooltip {
    position: absolute;
    color: white;
    background-color: black;
    padding: 5px 5px;
    border-radius: 5px;
    opacity: 1;
    z-index: 10;
    visibility: visible;
    transition: opacity 150ms, visibility 150ms;
    display: flex;
    justify-content: center;
    box-sizing: border-box;
  }
</style>

<div class="tooltip" style={style} bind:this={tooltip}>
  {@html tooltipHtml}
</div>