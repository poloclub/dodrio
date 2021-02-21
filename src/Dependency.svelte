<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
import { text } from 'svelte/internal';

  let graphSVG = null;
  let data = null;

  const SVGWidth = 800;
  const SVGHeight = 800;

  const SVGPadding = {top: 3, left: 3, right: 3, bottom: 3};
  const textTokenPadding = {top: 3, left: 3, right: 3, bottom: 3};

  let nodes = null;
  let links = null;

  const ease = d3.easeCubicInOut;
  const animationTime = 300;

  let config = {
    borderConstraint: true,
  }

  const round = (num, decimal) => {
    return Math.round((num + Number.EPSILON) * (10 ** decimal)) / (10 ** decimal);
  };

  const drawGraph = () => {

    let svg = d3.select(graphSVG)
      .attr('width', SVGWidth)
      .attr('height', SVGHeight);

    // Add a border
    svg.append('rect')
      .attr('class', 'border-rect')
      .attr('width', SVGWidth)
      .attr('height', SVGHeight)
      .style('stroke', 'black')
      .style('fill', 'none');

    // Add arrow markers
    svg.append('defs')
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', [0, 0, 10, 10])
      .attr('refX', 0)
      .attr('refY', 5)
      .attr('markerWidth', 12)
      .attr('markerHeight', 9)
      .attr('orient', 'auto')
      .attr('stroke-width', 1)
      .attr('markerUnits', 'userSpaceOnUse')
      .append('path')
      //.attr('d', 'M0,5 L0,15 L8,10')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('stroke', '#C2C2C2')
      .attr('fill', '#C2C2C2');

    const depList = data.list;
    let tokens = data.words;

    let textTokenWidths = {};
    let textTokenHeight = null;

    // Before drawing the tree, pre-render all texts to figure out thier widths
    let hiddenTextGroup = svg.append('g')
      .attr('class', 'hidden-text')
      .style('opacity', 0);

    let hiddenTexts = hiddenTextGroup.selectAll('.text-token')
      .data(tokens)
      .join('text')
      .attr('class', 'text-token')
      .text(d => d);
    
    // After the text elements are created, we need to query again to get the
    // length and width of these elements
    hiddenTexts.each(function(_, i) {
      let bbox = this.getBBox();
      textTokenWidths[i] = +Number(bbox.width).toFixed(2);
      if (textTokenHeight == null) {
        textTokenHeight = bbox.height;
      }
    });

    hiddenTextGroup.remove();
    hiddenTexts.remove();

    console.log(textTokenWidths, textTokenHeight);

    // Convert flat data to hierarchy
    let root = d3.stratify()
      .id(d => d.child)
      .parentId(d => d.parent)(depList);
    
    console.log(root);

    let treeRoot = d3.tree()
      .separation((a, b) => Math.max(textTokenWidths[a.id], textTokenWidths[b.id]))
      .size([
        SVGWidth - SVGPadding.left - SVGPadding.right,
        SVGHeight - SVGPadding.top - SVGPadding.bottom - 2 * textTokenHeight,
      ])(root);

    console.log(treeRoot.descendants(), treeRoot.links());

    let treeGroup = svg.append('g')
      .attr('class', 'tree-group')
      .attr('transform', `translate(${SVGPadding.left}, ${SVGPadding.top + textTokenHeight})`);

    let rootLinks = treeRoot.links();

    for (let i = 0; i < rootLinks.length; i++) {
      rootLinks[i].left = +rootLinks[i].target.x > +rootLinks[i].source.x;
    }

    console.log(rootLinks);

    let links = treeGroup.append('g')
      .attr('class', 'link-group')
      .selectAll('path')
      .data(rootLinks, d => `${d.source.id}-${d.target.id}`)
      .join('path')
      .attr('id', d => `link-${d.source.id}-${d.target.id}`)
      .attr('data-left', d => `${d.left} ${d.source.x} ${d.target.x}`)
      .attr('d', d3.linkVertical()
        .x(d => d.x)
        .y(d => d.y)
      );
    
    // Append relationship text on the path
    let linkTexts = treeGroup.append('g')
      .attr('class', 'link-text-group')
      .selectAll('text.text-link')
      .data(rootLinks, d => `${d.source.id}-${d.target.id}`)
      .join('text')
      .attr('class', 'text-link');
    
    let linkPathTexts = linkTexts.append('textPath')
      .attr('href', d => `#link-${d.source.id}-${d.target.id}`)
      .attr('startOffset', '50%')
      .attr('side', d => d.left ? 'left' : 'right')
      .style('text-anchor', 'middle')
      .style('dominant-baseline', 'end')
      .text(d => d.target.data.relation);
    
    linkTexts.clone(true)
      .lower()
      .attr('stroke-width', 2)
      .attr('stroke', 'white');
    
    let nodes = treeGroup.append('g')
      .attr('class', 'node-group')
      .selectAll('g')
      .data(root.descendants())
      .join('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x}, ${d.y})`);

    nodes.append('rect')
      .attr('x', d => -(textTokenWidths[d.id] + textTokenPadding.left + textTokenPadding.right) / 2)
      .attr('y', - (textTokenHeight + textTokenPadding.top + textTokenPadding.bottom) / 2)
      .attr('width', d => textTokenWidths[d.id] + textTokenPadding.left + textTokenPadding.right)
      .attr('height', textTokenHeight + textTokenPadding.top + textTokenPadding.bottom)
      .attr('rx', 5)
      .style('fill', 'hsl(210, 25%, 98%)')
      .style('stroke', 'hsl(180, 1%, 80%)');

    nodes.append('text')
      .attr('class', 'text-token')
      .attr('y', 1)
      .text(d => tokens[d.id]);
  };

  onMount(async () => {
    console.log('loading data');
    data = await d3.json('/data/twitter-dep-0877.json');
    console.log('loaded data');

    drawGraph();
  });
</script>

<style type='text/scss'>

  .graph-view {
    display: flex;
    flex-direction: row;
  }

  :global(.node-circle) {
    stroke: #fff;
    stroke-width: 1.5; 
  }
  
  :global(.text-token) {
    dominant-baseline: middle;
    text-anchor: middle;
    cursor: default;
    fill: black;
  }

  :global(.text-link) {
    cursor: default;
    fill: hsl(207, 48%, 44%);
  }

  :global(.node-group) {
    stroke-linejoin: round;
  }

  :global(.link-group) {
    fill: none;
    stroke-opacity: 0.5;
    stroke-width: 1.5;
    stroke: #555;
  }



</style>

<div class='graph-view'>

  <div class='svg-container'>
    <svg class='graph-svg' bind:this={graphSVG}></svg>
  </div>
  
</div>