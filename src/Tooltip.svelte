
<script>
  export let tipHTML = "1.23";
  export let left = 0;
  export let top = 0;

  export let color = "#757575";
  let style = `left: ${left}px; top: ${top}px`;
</script>

<style>
  .tooltip {
    position: absolute;
    font-family: inherit;
    display: inline-block;
    white-space: nowrap;
    color: white;
    background-color: black;
    padding: 5px 10px;
    border-radius: 15%;
    opacity: 1;
    z-index: 10;
    visibility: visible;
    transition: opacity 150ms, visibility 150ms;
  }
</style>


<div class="tooltip" style={style}>
  {@html tipHTML}
</div>