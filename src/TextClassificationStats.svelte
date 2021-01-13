<script>
  import { onMount } from 'svelte';
  
  export let trueLabel;
  export let predictedLabel;
  // Dictionary of {label : score}
  export let softmaxScores;
  $: {
    d3.select(chart)
      .selectAll('*')
      .remove();
    drawSoftmaxChart(); 
  }

  let chart;
  let softmaxScoreDicts;
  let trueLabelTagStyle
    $: {
      switch(trueLabel) {
        case "positive":
          trueLabelTagStyle = "tag is-rounded is-success"
          break;
        case "negative":
          trueLabelTagStyle = "tag is-rounded is-danger"
          break;
        default:
          trueLabelTagStyle = "tag is-rounded is-light"
      }
    };
  let predictedLabelTagStyle
    $: {
      switch(predictedLabel) {
        case "positive":
          predictedLabelTagStyle = "tag is-rounded is-success"
          break;
        case "negative":
          predictedLabelTagStyle = "tag is-rounded is-danger"
          break;
        default:
          predictedLabelTagStyle = "tag is-rounded is-light"
      }
    };

  function preprocessSoftmaxScores() {
    let softmaxScoreDicts = [];
    let labels = Object.keys(softmaxScores);
    labels.forEach(function(label) {
      let softmaxScoreEntry = {}
      softmaxScoreEntry['label'] = label;
      softmaxScoreEntry['score'] = softmaxScores[label];
      softmaxScoreDicts.push(softmaxScoreEntry);
    })
    return softmaxScoreDicts;
  }

  const drawSoftmaxChart = () => {
    softmaxScoreDicts = preprocessSoftmaxScores();

    let margin = {top: 10, right: 10, bottom: 30, left: 40};
    let svgWidth = 180, svgHeight = 110;
    let height = svgHeight- margin.top- margin.bottom, width = svgWidth - margin.left - margin.right;

    let x = d3.scaleBand().rangeRound([0, width]).padding(0.1),
        y = d3.scaleLinear().rangeRound([height, 0]);

    x.domain(softmaxScoreDicts.map(function(d) { return d.label; }));
    y.domain([0, d3.max(softmaxScoreDicts, function(d) { return d.score; })]);

    let svg = d3.select(chart).append("svg");
    svg.attr('height', svgHeight)
        .attr('width', svgWidth);

    svg = svg.append("g")
             .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    svg.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x));

    svg.append("g")
        .attr("class", "axis axis--y")
        .call(d3.axisLeft(y).ticks(5));
            
    let bars = svg.selectAll('.bar')
        .data(softmaxScoreDicts)
        .enter()
        .append("g");

    bars.append('rect')
        .attr('class', 'bar')
        .attr("x", function(d) { return x(d.label); })
        .attr("y", function(d) { return y(d.score); })
        .attr("width", x.bandwidth())
        .attr("height", function(d) { return height - y(d.score); })
        .attr("fill", "#DCDCDC");
  }

  onMount(async () => {
    drawSoftmaxChart();
  })
</script>

<style>
  .text-classification-stats {
    display: flex;
    flex-basis: 0;
    flex-grow: 1;
    flex-shrink: 1;
  }

  .stats-1 {
    flex: 70%;
  }
  .stats-2 {
    flex: 30%;
    text-align: center;
  }

  .stats-1 span {
    font-size: 0.75em;
    font-weight: bold;
  }
  .stats-2 span {
    font-size: 0.75em;
    font-weight: bold;
  }

  .tag {
    vertical-align: middle;
  }
</style>

<div class='text-classification-stats'>
  <div class="stats-1">
    <span>
      Predicted Label:
      <span id="predictedLabel" class={predictedLabelTagStyle}>{predictedLabel}</span>&nbsp;
      True Label:
      <span id="trueLabel" class={trueLabelTagStyle}>{trueLabel}</span>
    </span>
  </div>

  <div class="stats-2">
    <span class="has-text-centered">
      Softmax Scores
    </span>
    <div bind:this={chart}></div>
  </div>
</div>