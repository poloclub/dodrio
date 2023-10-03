<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  export let curAttention = null;

  let matrixSVG = null;
  let matrixCanvas = null;

  const imageLength = 100;

  const drawMatrix = () => {
    let image = d3
      .select(matrixSVG)
      .append('image')
      .attr('class', 'matrix-image')
      .attr('width', imageLength)
      .attr('height', imageLength);

    // Find the min and max for the current attention matrix
    let attentionMin = Infinity;
    let attentionMax = -Infinity;
    for (let i = 0; i < curAttention.length; i++) {
      for (let j = 0; j < curAttention[0].length; j++) {
        attentionMin = Math.min(attentionMin, curAttention[i][j]);
        attentionMax = Math.max(attentionMax, curAttention[i][j]);
      }
    }

    const attentionLength = curAttention.length;
    let absMax = Math.max(Math.abs(attentionMin), Math.abs(attentionMax));

    // console.log(38, absMax, attentionMin, attentionMax);
    let colorScale = d3
      .scaleLinear()
      .domain([0, absMax])
      .range([d3.color('white'), d3.color('hsl(203, 70%, 52%)')]);

    let bufferCanvas = document.createElement('canvas');
    let bufferContext = bufferCanvas.getContext('2d');

    bufferCanvas.width = attentionLength;
    bufferCanvas.height = attentionLength;

    // Fill image pixel array
    let imageSingle = bufferContext.getImageData(
      0,
      0,
      attentionLength,
      attentionLength
    );
    let imageSingleArray = imageSingle.data;

    // console.log(curAttention);

    for (let i = 0; i < imageSingleArray.length; i += 4) {
      let pixelIndex = Math.floor(i / 4);
      let row = Math.floor(pixelIndex / attentionLength);
      let column = pixelIndex % attentionLength;
      let color = undefined;

      color = d3.rgb(colorScale(Math.abs(curAttention[row][column])));

      imageSingleArray[i] = color.r;
      imageSingleArray[i + 1] = color.g;
      imageSingleArray[i + 2] = color.b;
      imageSingleArray[i + 3] = 255;
    }

    bufferContext.putImageData(imageSingle, 0, 0);

    let matrixContext = matrixCanvas.getContext('2d');
    matrixContext.drawImage(
      bufferCanvas,
      0,
      0,
      attentionLength,
      attentionLength,
      0,
      0,
      imageLength,
      imageLength
    );

    // console.log(attentionLength, imageSingleArray, attentionMax, attentionMin);
  };

  onMount(async () => {
    drawMatrix();
  });
</script>

<style lang="scss">
  .matrix-canvas {
    border: 1px solid hsla(0, 0%, 0%, 0.1);
  }
</style>

<div class="small-matrix">
  <!-- <svg class='matrix-svg' bind:this={matrixSVG} width=150 height=150></svg> -->
  <canvas
    class="matrix-canvas"
    bind:this={matrixCanvas}
    width={imageLength}
    height={imageLength}
  />
</div>
