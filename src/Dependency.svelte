<script>
  import { onMount } from 'svelte';
  import { instanceViewConfigStore } from './store';
  import * as d3 from 'd3';

  let svg = null;
  let data = null;

  let SVGWidth = 800;
  let SVGHeight = 800;

  let instanceViewConfig = undefined;
  let SVGInitialized = false;

  const SVGPadding = {top: 3, left: 3, right: 3, bottom: 3};
  const textTokenPadding = {top: 3, left: 3, right: 3, bottom: 3};


  const ease = d3.easeCubicInOut;
  const animationTime = 300;

  const round = (num, decimal) => {
    return Math.round((num + Number.EPSILON) * (10 ** decimal)) / (10 ** decimal);
  };

  const getTokenWidth = (tokens) => {
    let textTokenWidths = {};
    let textTokenHeight = null;

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

    return {textTokenWidths: textTokenWidths, textTokenHeight: textTokenHeight};
  };

  const initSVG = () => {
    svg = d3.select(svg)
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
      .attr('id', 'dep-arrow')
      .attr('viewBox', [0, 0, 10, 10])
      .attr('refX', 0)
      .attr('refY', 5)
      .attr('markerWidth', 10)
      .attr('markerHeight', 7)
      .attr('orient', 'auto')
      .attr('stroke-width', 1)
      .attr('markerUnits', 'userSpaceOnUse')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('stroke', 'black')
      .attr('fill', 'black');

    SVGInitialized = true;
  };

  const drawGraph = () => {
    if (!SVGInitialized) {
      initSVG();
    }

    const depList = data.list;
    let tokens = data.words;

    // Before drawing the tree, pre-render all texts to figure out their widths
    console.log(svg);
    let textTokenSize = getTokenWidth(tokens);
    let textTokenWidths = textTokenSize.textTokenWidths;
    let textTokenHeight = textTokenSize.textTokenHeight;

    console.log(textTokenWidths, textTokenHeight);

    const minTokenGap = 10;
    const letterWidth = 9;

    // Compute the gap between different tokens to fit the relationship text
    let tokenGaps = Array(tokens.length).fill(minTokenGap);

    depList.forEach(d => {
      if (Math.abs(d.child - d.parent) === 1) {
        tokenGaps[Math.min(d.child, d.parent)] = d.relation.length * letterWidth + 14;
      }
    });

    // Compute the x positions for all tokens
    let tokenXs = {};
    let curX = 0;
    tokens.forEach((d, i) => {
      tokenXs[i] = curX;
      curX += textTokenWidths[i] + tokenGaps[i] + textTokenPadding.left + textTokenPadding.right;
    });

    let fullWidth = curX + SVGPadding.left + SVGPadding.right - minTokenGap;

    // Change svg width to fit the single line
    svg.attr('width', fullWidth)
      .select('rect.border-rect')
      .attr('width', fullWidth);

    // Add tokens
    let tokenGroup = svg.append('g')
      .attr('class', 'token-group')
      .attr('transform', `translate(${SVGPadding.left}, ${SVGHeight / 2 + SVGPadding.top})`);
    
    let nodes = tokenGroup.append('g')
      .attr('class', 'node-group')
      .selectAll('g')
      .data(tokens)
      .join('g')
      .attr('class', 'node')
      .attr('transform', (d, i) => `translate(${tokenXs[i]}, ${0})`);

    nodes.append('rect')
      .attr('width', (d, i) => textTokenWidths[i] + textTokenPadding.left + textTokenPadding.right)
      .attr('height', textTokenHeight + textTokenPadding.top + textTokenPadding.bottom)
      .attr('rx', 5)
      .style('fill', 'hsl(210, 25%, 98%)')
      .style('stroke', 'hsl(180, 1%, 80%)');

    nodes.append('text')
      .attr('class', 'text-token-arc')
      .attr('x', textTokenPadding.left)
      .attr('y', textTokenPadding.top + 2)
      .text(d => d);

    // Compute dependency link hierarchy based on the gaps between two tokens
    let rankedDepList = [];

    depList.forEach(d => {
      let gap = Math.abs(d.child - d.parent);

      // Compute the middle point of the link for adding the text later
      let middleX = undefined;
      let sourceX = undefined;
      let targetX = undefined;

      if (d.parent < d.child) {
        sourceX = tokenXs[d.parent] + textTokenPadding.left + textTokenPadding.right
          + textTokenWidths[d.parent] - 5;
        targetX = tokenXs[d.child] + 5;

        if (Math.abs(d.parent - d.child) === 1) {
          targetX -= 10;
        }
        middleX = sourceX + (targetX - sourceX) / 2;
      } else {
        sourceX = tokenXs[d.parent] + 5;
        targetX = tokenXs[d.child] + textTokenPadding.left + textTokenPadding.right
          + textTokenWidths[d.child] - 5;
        
        if (Math.abs(d.parent - d.child) === 1) {
          targetX += 10;
        }

        middleX = targetX + (sourceX - targetX) / 2;
      }

      d.sourceX = sourceX;
      d.targetX = targetX;
      d.middleX = Number.isNaN(middleX) ? 0 : middleX;
      d.gap = gap;

      rankedDepList.push(d);
    });

    rankedDepList.sort((a, b) => a.gap - b.gap);

    // Need to pre-fill 1 because the first level (line) is reserved for
    // consecutive tokens only
    let tokenRelCount = Array(tokens.length).fill(1);
    let rankedDepMap = {};

    // Rank the dependency based on token's dependency count
    rankedDepList.forEach(d => {
      if (d.relation !== 'root') {
        let iLow = Math.min(d.child, d.parent);
        let iHigh = Math.max(d.child, d.parent);
        let curRank = tokenRelCount.slice(iLow, iHigh + 1).reduce((a, b) => Math.max(a, b));

        if (d.gap === 1) {
          curRank = 0;
        } else {
          tokenRelCount[Math.min(d.child, d.parent)] = curRank + 1;
        }

        if (rankedDepMap[curRank] === undefined) {
          rankedDepMap[curRank] = [];
        }
        
        rankedDepMap[curRank].push(d);
      }
    });

    let arcGroup = tokenGroup.append('g')
      .attr('class', 'arc-group');

    Object.keys(rankedDepMap).forEach((k, i) => {

      arcGroup.selectAll(`path.arc-path-${i}`)
        .data(rankedDepMap[k], d => `${d.parent}-${d.child}`)
        .join('path')
        .attr('class', `arc-path arc-path-${i}`)
        .attr('marker-end', 'url(#dep-arrow)')
        .attr('d', d => {          
          let sourceX = d.sourceX;
          let targetX = d.targetX;
          
          let pathHeight = 20 * (i);
          let pathCurve = 15;

          // Compute the control points and middle points
          let control1 = {
            x: sourceX < targetX ? sourceX + 2 : sourceX - 2,
            y: -pathHeight
          };

          let mid1 = {
            x: sourceX < targetX ? sourceX + pathCurve : sourceX - pathCurve,
            y: -pathHeight
          };

          let mid2 = {
            x: sourceX < targetX ? targetX - pathCurve: targetX + pathCurve,
            y: -pathHeight
          };

          let control2 = {
            x: sourceX < targetX ? targetX - 2 : targetX + 2,
            y: -pathHeight
          };

          return `M${sourceX} ${0}
            Q${control1.x} ${control1.y}, ${mid1.x} ${mid1.y}
            L${mid2.x} ${mid2.y}
            Q${control2.x} ${control2.y}, ${targetX} ${i === 0 ? 0 : -5}`;
        });

      arcGroup.selectAll(`rect.arc-path-rect-${i}`)
        .data(rankedDepMap[k], d => `${d.parent}-${d.child}`)
        .join('rect')
        .attr('class', `arc-rect arc-path-rect-${i}`)
        .attr('x', d => d.middleX - d.relation.length * letterWidth / 2)
        .attr('y', -20 * i - 5)
        .attr('width', d => d.relation === 'root' ? 0 : d.relation.length * letterWidth - 0)
        .attr('height', 10)
        .attr('rx', 5)
        .style('fill', 'white');

      arcGroup.selectAll(`text.arc-path-text-${i}`)
        .data(rankedDepMap[k], d => `${d.parent}-${d.child}`)
        .join('text')
        .attr('class', `arc-text arc-path-text-${i}`)
        .attr('x', d => d.middleX)
        .attr('y', -20 * i)
        .text(d => d.relation === 'root' ? '' : d.relation);

    });
  };

  const drawTree = () => {
    if (!SVGInitialized) {
      initSVG();
    }

    const depList = data.list;
    let tokens = data.words;

    let textTokenSize = getTokenWidth(tokens);
    let textTokenWidths = textTokenSize.textTokenWidths;
    let textTokenHeight = textTokenSize.textTokenHeight;

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
      rootLinks[i].vertical = Math.abs(+rootLinks[i].target.x - +rootLinks[i].source.x) < 5;
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
    // Load the dependency data
    if (data === null) {
      data = await d3.json('/data/twitter-dep-0877.json');
    }
  });

  instanceViewConfigStore.subscribe(async value => {
    if (value.compHeight !== undefined && value.compWidth !== undefined){
      if (instanceViewConfig === undefined ||
        (instanceViewConfig.compHeight !== value.compHeight &&
        instanceViewConfig.compWidth !== value.compWidth)
      ){
        instanceViewConfig = value;
        
        SVGWidth = instanceViewConfig.compWidth;
        SVGHeight = instanceViewConfig.compHeight;

        if (data === null) {
          data = await d3.json('/data/twitter-dep-0877.json');
        }

        drawGraph();
        // drawTree();
      }
    }
  });

</script>

<style type='text/scss'>

  .svg-container {
    overflow: scroll;
    cursor: default;
  }

  .graph-view {
    display: flex;
    flex-direction: row;
  }

  :global(.arc-text) {
    dominant-baseline: middle;
    font-family: 'Roboto Mono', monospace;
    font-size: 0.8em;
    text-anchor: middle;
    fill: hsl(207, 48%, 44%);
  }

  :global(.arc-path) {
    stroke: black;
    stroke-width: 1.5;
    fill: none;
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

  :global(.text-token-arc) {
    @extend :global(.text-token);
    dominant-baseline: hanging;
    text-anchor: start;
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

  <div class='svg-container' style={`width: ${instanceViewConfig === undefined ? 800 : instanceViewConfig.compWidth}px`}>
    <svg class='dependency-svg' bind:this={svg}></svg>
  </div>
  
</div>