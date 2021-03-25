<script>
  import { onMount } from 'svelte';
  let heatmapMode = false
  let matrixData = null;
  let matrixSVG = null;
  let matrixCanvas = null;
  
  const imageLength = 100;


/**
 * Hermite resize - fast image resize/resample using Hermite filter. 1 cpu version!
 * 
 * @param {HtmlElement} canvas
 * @param {int} width
 * @param {int} height
 * @param {boolean} resize_canvas if true, canvas will be resized. Optional.
 */
function resample_single(canvas, width, height, resize_canvas) {
    var width_source = canvas.width;
    var height_source = canvas.height;
    width = Math.round(width);
    height = Math.round(height);

    var ratio_w = width_source / width;
    var ratio_h = height_source / height;
    var ratio_w_half = Math.ceil(ratio_w / 2);
    var ratio_h_half = Math.ceil(ratio_h / 2);

    var ctx = canvas.getContext("2d");
    var img = ctx.getImageData(0, 0, width_source, height_source);
    var img2 = ctx.createImageData(width, height);
    var data = img.data;
    var data2 = img2.data;

    for (var j = 0; j < height; j++) {
        for (var i = 0; i < width; i++) {
            var x2 = (i + j * width) * 4;
            var weight = 0;
            var weights = 0;
            var weights_alpha = 0;
            var gx_r = 0;
            var gx_g = 0;
            var gx_b = 0;
            var gx_a = 0;
            var center_y = (j + 0.5) * ratio_h;
            var yy_start = Math.floor(j * ratio_h);
            var yy_stop = Math.ceil((j + 1) * ratio_h);
            for (var yy = yy_start; yy < yy_stop; yy++) {
                var dy = Math.abs(center_y - (yy + 0.5)) / ratio_h_half;
                var center_x = (i + 0.5) * ratio_w;
                var w0 = dy * dy; //pre-calc part of w
                var xx_start = Math.floor(i * ratio_w);
                var xx_stop = Math.ceil((i + 1) * ratio_w);
                for (var xx = xx_start; xx < xx_stop; xx++) {
                    var dx = Math.abs(center_x - (xx + 0.5)) / ratio_w_half;
                    var w = Math.sqrt(w0 + dx * dx);
                    if (w >= 1) {
                        //pixel too far
                        continue;
                    }
                    //hermite filter
                    weight = 2 * w * w * w - 3 * w * w + 1;
                    var pos_x = 4 * (xx + yy * width_source);
                    //alpha
                    gx_a += weight * data[pos_x + 3];
                    weights_alpha += weight;
                    //colors
                    if (data[pos_x + 3] < 255)
                        weight = weight * data[pos_x + 3] / 250;
                    gx_r += weight * data[pos_x];
                    gx_g += weight * data[pos_x + 1];
                    gx_b += weight * data[pos_x + 2];
                    weights += weight;
                }
            }
            data2[x2] = gx_r / weights;
            data2[x2 + 1] = gx_g / weights;
            data2[x2 + 2] = gx_b / weights;
            data2[x2 + 3] = gx_a / weights_alpha;
        }
    }
    //clear and resize canvas
    if (resize_canvas === true) {
        canvas.width = width;
        canvas.height = height;
    } else {
        ctx.clearRect(0, 0, width_source, height_source);
    }

    //draw
    ctx.putImageData(img2, 0, 0);
  }

  const drawMatrix = () => {
    let image = d3.select(matrixSVG)
      .append('image')
      .attr('class', 'matrix-image')
      .attr('width', imageLength)
      .attr('height', imageLength);

    let curAttention = matrixData.attentions[0].attention;
    const attentionLength = curAttention.length;
    let attentionMin = matrixData.attentions[0].min;
    let attentionMax = matrixData.attentions[0].max;
    let absMax = Math.max(Math.abs(attentionMin), Math.abs(attentionMax));
    let colorScale = d3.scaleDiverging(d3.interpolateBrBG).domain([
      absMax * Math.sign(absMax * attentionMin),
      matrixData.attentions[0]['common_val'],
      absMax * Math.sign(absMax * attentionMax),
    ]);
    
    colorScale = d3.scaleLinear()
      .domain([
        absMax * Math.sign(absMax * attentionMin),
        matrixData.attentions[0]['common_val'],
        absMax * Math.sign(absMax * attentionMax)
      ])
      //.range([d3.rgb('#553005'), d3.rgb('#ffffff'), d3.rgb('##003D31')])
      .range([d3.rgb('#F1F1E7'), d3.rgb('#000000'), d3.rgb('#C9E9E4')])

    let bufferCanvas = document.createElement("canvas");
    let bufferContext = bufferCanvas.getContext("2d");

    bufferCanvas.width = attentionLength;
    bufferCanvas.height = attentionLength;

    // Fill image pixel array
    let imageSingle = bufferContext.getImageData(0, 0, attentionLength, attentionLength);
    let imageSingleArray = imageSingle.data;

    console.log(curAttention)

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

    //resample_single(matrixCanvas, imageLength, imageLength, true);

    let matrixContext =  matrixCanvas.getContext("2d");
    matrixContext.drawImage(bufferCanvas, 0, 0, attentionLength, attentionLength,
      0, 0, imageLength, imageLength);

    console.log(attentionLength, imageSingleArray, attentionMax, attentionMin);
  }

  onMount(async () => {
    console.log('loading matrix');
    matrixData = await d3.json('PUBLIC_URL/data/sample_attention_top_10.json');
    console.log('loaded matrix');

    drawMatrix();
  })
</script>

<style>
</style>

<div class='small-mtrix'>
  <!-- <svg class='matrix-svg' bind:this={matrixSVG} width=150 height=150></svg> -->
  <canvas class='matrix-canvas' bind:this={matrixCanvas} width={imageLength} height={imageLength}></canvas>
</div>