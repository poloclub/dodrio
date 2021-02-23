<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  export let curAttention = null;

  let heatmapMode = false;
  let matrixSVG = null;
  let matrixCanvas = null;
  
  const imageLength = 100;

  const drawMatrix = () => {
    let image = d3.select(matrixSVG)
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
    let colorScale = d3.scaleDiverging(d3.interpolateBrBG).domain([
      absMax * Math.sign(absMax * attentionMin),
      0,
      absMax * Math.sign(absMax * attentionMax),
    ]);
   
    console.log(38, absMax, attentionMin, attentionMax);

    colorScale = d3.scaleLinear()
      .domain([
        // absMax * Math.sign(absMax * attentionMin),
        0,
        absMax * Math.sign(absMax * attentionMax)
      ])
      .range([
        // d3.rgb('#553005'), 
        d3.rgb('#ffffff'), d3.rgb('red')])
      // .range([d3.rgb('#F1F1E7'), d3.rgb('#000000'), d3.rgb('#C9E9E4')]);

    let bufferCanvas = document.createElement('canvas');
    let bufferContext = bufferCanvas.getContext('2d');

    bufferCanvas.width = attentionLength;
    bufferCanvas.height = attentionLength;

    // Fill image pixel array
    let imageSingle = bufferContext.getImageData(0, 0, attentionLength, attentionLength);
    let imageSingleArray = imageSingle.data;

    console.log(curAttention);

    for (let i = 0; i < imageSingleArray.length; i+=4) {
      let pixeIndex = Math.floor(i / 4);
      let row = Math.floor(pixeIndex / attentionLength);
      let column = pixeIndex % attentionLength;
      let color = undefined;

      color = d3.rgb(colorScale(curAttention[row][column]));

      imageSingleArray[i] = color.r;
      imageSingleArray[i + 1] = color.g;
      imageSingleArray[i + 2] = color.b;
      imageSingleArray[i + 3] = 255;
    }

    bufferContext.putImageData(imageSingle, 0, 0);

    let matrixContext =  matrixCanvas.getContext('2d');
    matrixContext.drawImage(bufferCanvas, 0, 0, attentionLength, attentionLength,
      0, 0, imageLength, imageLength);

    console.log(attentionLength, imageSingleArray, attentionMax, attentionMin);
  };

  onMount(async () => {
    drawMatrix();
  });
</script>

<style>
</style>

<div class='small-mtrix'>
  <!-- <svg class='matrix-svg' bind:this={matrixSVG} width=150 height=150></svg> -->
  <canvas class='matrix-canvas' bind:this={matrixCanvas} width={imageLength} height={imageLength}></canvas>
</div>