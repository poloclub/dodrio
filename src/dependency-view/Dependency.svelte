<script>
  import { onMount } from 'svelte';
  import { instanceViewConfigStore, hoverTokenStore,
    wordToSubwordMapStore } from '../store';
  import { isSpecialToken, padZeroLeft } from './utils';
  import { drawParagraph } from './saliency-view';
  import { drawGraph } from './dependency-view';
  import RadialModal from './RadialModal.svelte';
  import { drawDependencyComparison, removeDependencyComparison } from './comparison-view';
  import { drawTree } from './tree-view';
  import * as d3 from 'd3';

  let svg = null;
  let data = null;
  let existingLinkSet = null;
  let saliencies = null;
  let attentions = null;
  let headOrder = null;

  let wordToSubwordMap = null;
  let relations = [];
  let selectedRelations = {};
  let instanceID = 1562;

  let textTokenWidths = {};
  let tokenXs = [];

  let SVGWidth = 800;
  let SVGHeight = 800;

  let instanceViewConfig = undefined;
  let SVGInitialized = false;
  let inComparisonView = false;

  const SVGPadding = {top: 10, left: 15, right: 15, bottom: 10};
  const textTokenPadding = {top: 3, left: 3, right: 3, bottom: 3};

  // Global stores
  let curHoverToken = null;
  
  // Control panel variables
  const layoutOptions = {
    saliency: {
      value: 'saliency',
      name: 'Saliency View'
    },
    dependency: {
      value: 'dependency',
      name: 'Dependency List'
    },
    tree: {
      value: 'tree',
      name: 'Dependency Tree'
    } 
  };

  const headListOptions = {
    syntactic: {
      value: 'syntactic',
      name: 'syntactic correlations'
    },
    semantic: {
      value: 'semantic',
      name: 'semantic correlations '
    },
    importance: {
      value: 'importance',
      name: 'importance scores'
    } 
  };

  let dependencyViewInitialized = false;
  let saliencyViewInitialized = false;
  let treeViewInitialized = false;

  let currentLayout = layoutOptions.dependency;
  let linkColor = 'hsl(0, 0%, 80%)';
  let linkHoverColor = 'hsl(358, 94%, 73%)';
  let linkAttentionColor = 'hsla(0, 0%, 0%, 0.5)';
  let showRelationCheckboxes = false;

  const ease = d3.easeCubicInOut;
  const animationTime = 300;
  
  const bindSelect = () => {
    let selectOption = d3.select('#instance-select')
      .property('value', currentLayout.value);

    selectOption.on('change', () => {
      let newLayoutValue = selectOption.property('value');

      // Need to switch layout
      if (newLayoutValue !== currentLayout.value) {

        switch(newLayoutValue) {
        case 'saliency':
          // Hide the old view
          if (currentLayout.value === 'dependency' && dependencyViewInitialized) {
            svg.select('g.token-group')
              .style('display', 'none');
          }

          if (currentLayout.value === 'tree' && treeViewInitialized) {
            svg.select('g.tree-group')
              .style('display', 'none');
          }

          // Draw the new view
          if (saliencyViewInitialized) {
            svg.select('g.token-group-saliency')
              .style('display', null);
            svg.select('g.legend-group')
              .style('display', null);
          } else {
            if (!SVGInitialized) {
              initSVG();
            }
            drawParagraph(saliencies, svg, SVGWidth, SVGPadding, textTokenPadding,
              wordToSubwordMap, tokenNodeMouseover, tokenNodeMouseleave);
            saliencyViewInitialized = true;
          }
          currentLayout = layoutOptions[newLayoutValue];
          break;

        case 'dependency':
          console.log('change to dependency view');

          // Hide the old view
          if (currentLayout.value === 'tree' && treeViewInitialized) {
            svg.select('g.tree-group')
              .style('display', 'none');
          }

          if (currentLayout.value === 'saliency' && saliencyViewInitialized) {
            svg.select('g.token-group-saliency')
              .style('display', 'none');
            svg.select('g.legend-group')
              .style('display', 'none');
          }

          // Draw the new view
          if (dependencyViewInitialized) {
            svg.select('g.token-group')
              .style('display', null);
          } else {
            if (!SVGInitialized) {
              initSVG();
            }
            let results = drawGraph(data, saliencies, wordToSubwordMap, svg, tokenXs,
              textTokenPadding, SVGPadding, SVGHeight, tokenNodeMouseover,
              tokenNodeMouseleave,initWordToSubwordMap);

            tokenXs = results.tokenXs;
            textTokenWidths = results.textTokenWidths;
            dependencyViewInitialized = true;
          }

          currentLayout = layoutOptions[newLayoutValue];
          break;

        case 'tree':
          console.log('change to tree view');

          // Hide the old view
          if (currentLayout.value === 'dependency' && dependencyViewInitialized) {
            svg.select('g.token-group')
              .style('display', 'none');
          }

          if (currentLayout.value === 'saliency' && saliencyViewInitialized) {
            svg.select('g.token-group-saliency')
              .style('display', 'none');
            svg.select('g.legend-group')
              .style('display', 'none');
          }

          // Draw the new view
          if (treeViewInitialized) {
            svg.select('g.tree-group')
              .style('display', null);
          } else {
            if (!SVGInitialized) {
              initSVG();
            }
            drawTree(data, saliencies, svg, SVGWidth, SVGHeight, SVGPadding,
              tokenNodeMouseoverTree, tokenNodeMouseleave, textTokenPadding,
              wordToSubwordMap, initWordToSubwordMap);
            treeViewInitialized = true;
          }

          currentLayout = layoutOptions[newLayoutValue];
          break;
        }

      }
    });
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
    let arrowMarker = svg.append('defs');

    arrowMarker.append('marker')
      .attr('id', 'dep-arrow')
      .attr('viewBox', [0, 0, 10, 10])
      .attr('refX', 0)
      .attr('refY', 5)
      .attr('markerWidth', 10)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .attr('stroke-width', 1)
      .attr('markerUnits', 'userSpaceOnUse')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('stroke', linkColor)
      .attr('fill', linkColor);
    
    arrowMarker.clone(true)
      .select('marker')
      .attr('id', 'dep-arrow-hover')
      .select('path')
      .attr('stroke', linkHoverColor)
      .attr('fill', linkHoverColor);

    arrowMarker.clone(true)
      .select('marker')
      .attr('id', 'dep-attention-arc-arrow')
      .select('path')
      .attr('stroke', 'none')
      .attr('refX', 2)
      .attr('fill', 'hsl(0, 0%, 10%)');

    arrowMarker.clone(true)
      .select('marker')
      .attr('id', 'dep-attention-arrow')
      .select('path')
      .attr('stroke', 'none')
      .attr('refX', 2)
      .attr('fill', 'hsl(0, 0%, 80%)');

    // Create opacity gradient
    let gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'top-opacity-gradient')
      .attr('x2', '0%')
      .attr('y2', '100%');

    gradient.append('stop')
      .style('stop-opacity', 1)
      .style('stop-color', 'white')
      .attr('offset', '0');

    gradient.append('stop')
      .style('stop-opacity', 1)
      .style('stop-color', 'white')
      .attr('offset', '0.9');

    gradient.append('stop')
      .style('stop-opacity', 0)
      .style('stop-color', 'white')
      .attr('offset', '1');

    gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'bottom-opacity-gradient')
      .attr('x2', '0%')
      .attr('y2', '100%');

    gradient.append('stop')
      .style('stop-opacity', 0)
      .style('stop-color', 'white')
      .attr('offset', '0');

    gradient.append('stop')
      .style('stop-opacity', 1)
      .style('stop-color', 'white')
      .attr('offset', '0.5');

    gradient.append('stop')
      .style('stop-opacity', 1)
      .style('stop-color', 'white')
      .attr('offset', '1');

    // Line gradient right to left
    gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'link-opacity-gradient-rl');

    gradient.append('stop')
      .style('stop-opacity', 1)
      .style('stop-color', 'hsl(0, 0%, 20%)')
      .attr('offset', '0');

    gradient.append('stop')
      .style('stop-opacity', 1)
      .style('stop-color', 'hsl(0, 0%, 70%)')
      .attr('offset', '0.3');

    gradient.append('stop')
      .style('stop-opacity', 1)
      .style('stop-color', 'hsl(0, 0%, 90%)')
      .attr('offset', '1');

    // Line gradient left to right
    gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'link-opacity-gradient-lr');

    gradient.append('stop')
      .style('stop-opacity', 1)
      .style('stop-color', 'hsl(0, 0%, 90%)')
      .attr('offset', '0');

    gradient.append('stop')
      .style('stop-opacity', 1)
      .style('stop-color', 'hsl(0, 0%, 70%)')
      .attr('offset', '0.7');

    gradient.append('stop')
      .style('stop-opacity', 1)
      .style('stop-color', 'hsl(0, 0%, 20%)')
      .attr('offset', '1');
    
    // Matched line gradient right to left
    gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'matched-link-opacity-gradient-rl');

    gradient.append('stop')
      .style('stop-opacity', 1)
      .style('stop-color', 'hsl(205, 100%, 35%)')
      .attr('offset', '0');

    gradient.append('stop')
      .style('stop-opacity', 1)
      .style('stop-color', 'hsl(205, 100%, 70%)')
      .attr('offset', '0.3');

    gradient.append('stop')
      .style('stop-opacity', 1)
      .style('stop-color', 'hsl(205, 100%, 90%)')
      .attr('offset', '1');

    // Matched line gradient left to right
    gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'matched-link-opacity-gradient-lr');

    gradient.append('stop')
      .style('stop-opacity', 1)
      .style('stop-color', 'hsl(205, 100%, 90%)')
      .attr('offset', '0');

    gradient.append('stop')
      .style('stop-opacity', 1)
      .style('stop-color', 'hsl(205, 100%, 70%)')
      .attr('offset', '0.7');

    gradient.append('stop')
      .style('stop-opacity', 1)
      .style('stop-color', 'hsl(205, 100%, 35%)')
      .attr('offset', '1');

    SVGInitialized = true;
  };

  const tokenNodeMouseover = e => {
    let curNode = d3.select(e.target);
    let nodeID = curNode.data()[0].id;
    hoverTokenStore.set(nodeID);
  };

  const tokenNodeMouseleave = () => {
    hoverTokenStore.set(null);
  };

  const tokenNodeMouseoverTree = (tokens, e) => {
    let curNode = d3.select(e.target);
    let nodeID = tokens[curNode.data()[0].id].id;
    hoverTokenStore.set(nodeID);
  };

  const highLightNode = () => {
    // Cannot directly select class because some weird special character selector bug on firefox
    svg.selectAll('.node')
      .filter((d, i, g) => d3.select(g[i]).attr('class').includes(`-${curHoverToken}`))
      .select('rect')
      .style('stroke', linkHoverColor)
      .style('stroke-width', 2);
    
    svg.selectAll('.arc-path')
      .filter((d, i, g) => d3.select(g[i]).attr('class').includes(`-${curHoverToken}`))
      .style('stroke', linkHoverColor)
      .style('stroke-width', 2)
      .attr('marker-end', 'url(#dep-arrow-hover)')
      .raise();
  };

  const deHighLightNode = () => {
    svg.selectAll('.node')
      .filter((d, i, g) => d3.select(g[i]).attr('class').includes(`-${curHoverToken}`))
      .select('rect')
      .style('stroke', 'hsl(180, 1%, 80%)')
      .style('stroke-width', 1);
    svg.selectAll('.arc-path')
      .filter((d, i, g) => d3.select(g[i]).attr('class').includes(`-${curHoverToken}`))
      .style('stroke', null)
      .style('stroke-width', 1)
      .attr('marker-end', 'url(#dep-arrow)');
  };

  const initWordToSubwordMap = (tokens, saliencies) => {
    console.log(tokens, saliencies);

    wordToSubwordMap = {};
    let j = 0;
    while (isSpecialToken(saliencies.tokens[j].token)) {
      j += 1;
    }

    for (let i = 0; i < tokens.length; i++) {
      let curWord = tokens[i].token;
      let curToken = saliencies.tokens[j].token;

      if (curWord !== curToken) {
        let nextWord = i + 1 < tokens.length ? tokens[i + 1].token : null;
        wordToSubwordMap[curWord] = [];

        while (saliencies.tokens[j].token !== nextWord) {
          wordToSubwordMap[curWord].push(saliencies.tokens[j].id);
          j += 1;
        }
      } else {
        j += 1;
      }
    }
    
    // Update the store
    wordToSubwordMapStore.set(wordToSubwordMap);

    return wordToSubwordMap;
  };

  const comparisonButtonClicked = (e) => {
    let topHeads = getInterestingHeads();

    if (inComparisonView) {
      inComparisonView = false;
      removeDependencyComparison(svg);
    } else {
      inComparisonView = true;
      if (attentions == null) {
        initAttentionData(
          `/data/sst2-attention-data/attention-${padZeroLeft(instanceID, 4)}.json`
        ).then(() => drawDependencyComparison(topHeads, svg, SVGPadding, data,
          attentions, saliencies, SVGHeight, existingLinkSet, tokenXs,
          textTokenPadding, textTokenWidths));
      } else {
        drawDependencyComparison(topHeads, svg, SVGPadding, data, attentions,
          saliencies, SVGHeight, existingLinkSet, tokenXs, textTokenPadding,
          textTokenWidths);
      }
    }
  };

  const checkboxChanged = (e) => {
    // Need to change the selectedRelations again because there is a race between
    // svelte's bind:checked call back and this function (on:change)
    let curRel = e.target.dataset.rel;
    selectedRelations[curRel] = e.target.checked;
  };

  /**
   * Create a list of interesting heads based on their max accuracy on the selected
   * syntactic dependencies.
  */
  const getInterestingHeads = () => {
    let potentialHeads = new Map();

    for (let key in selectedRelations) {
      if (!selectedRelations[key] || headOrder[key] === undefined) {
        continue;
      }

      let topHeads = headOrder[key]['top_heads'];

      // Track the max accuracy
      topHeads.forEach(d => {
        if (potentialHeads.has(d.head)) {
          potentialHeads.set(d.head,
            Math.max(d.acc, potentialHeads.get(d.head)));
        } else {
          potentialHeads.set(d.head, d.acc);
        }
      });
    }

    // Sort the heads
    let sortedHeads = [...potentialHeads.entries()].sort((a, b) => b[1] - a[1]);
    let sortedObjHeads = sortedHeads.map(d => ({
      id: {
        layer: d[0][0],
        head: d[0][1]
      },
      acc: d[1]
    }));

    return sortedObjHeads;
  };

  const initData = async (dependencyFile, saliencyFile, orderFile) => {
    // Init dependency data
    data = await d3.json(dependencyFile);
    data = data[instanceID];

    let relationCounter = new Map();
    selectedRelations = {};

    // Create a set of existing [parent, child] pairs
    existingLinkSet = new Set();

    data.list.forEach(d => {
      existingLinkSet.add(String([d.parent, d.child]));
      if (relationCounter.has(d.relation)) {
        relationCounter.set(d.relation, relationCounter.get(d.relation) + 1);
      } else {
        relationCounter.set(d.relation, 1);
        // Select all relations in initialization
        selectedRelations[d.relation] = true;
      }
    });
    relationCounter = new Map([...relationCounter.entries()].sort((a, b) => b[1] - a[1]));
    relations = [...relationCounter.entries()];

    // Init saliency data
    saliencies = await d3.json(saliencyFile);
    saliencies = saliencies[instanceID];

    // Init the dependency layer/head accuracy list
    headOrder = await d3.json(orderFile);
  };

  const initAttentionData = async (attentionFile) => {
    attentions = await d3.json(attentionFile);
  };

  onMount(async () => {
    // Load the dependency and saliency data
    if (data == null || saliencies == null) {
      initData('/data/sst2-dependencies.json',
        '/data/sst2-saliency-list-grad-l1.json',
        '/data/sst2-sorted-syntactic-heads.json');
    }

    bindSelect();
  });

  instanceViewConfigStore.subscribe(async value => {
    if (value.compHeight !== undefined && value.compWidth !== undefined){
      if (instanceViewConfig === undefined ||
        (instanceViewConfig.compHeight !== value.compHeight &&
        instanceViewConfig.compWidth !== value.compWidth)
      ){
        instanceViewConfig = value;
        
        SVGWidth = instanceViewConfig.compWidth;
        SVGHeight = instanceViewConfig.compHeight - 41;

        const createGraph = () => {
          let results = null;
          switch(currentLayout.value) {
          case 'saliency':
            if (!SVGInitialized) {
              initSVG();
            }
            drawParagraph(saliencies, svg, SVGWidth, SVGPadding, textTokenPadding,
              wordToSubwordMap, tokenNodeMouseover, tokenNodeMouseleave);
            saliencyViewInitialized = true;
            break;
          
          case 'dependency':
            if (!SVGInitialized) {
              initSVG();
            }
            results = drawGraph(data, saliencies, wordToSubwordMap, svg, tokenXs,
              textTokenPadding, SVGPadding, SVGHeight, tokenNodeMouseover,
              tokenNodeMouseleave, initWordToSubwordMap);
            tokenXs = results.tokenXs;
            textTokenWidths = results.textTokenWidths;

            getInterestingHeads();

            dependencyViewInitialized = true;
            break;

          case 'tree':
            if (!SVGInitialized) {
              initSVG();
            }
            drawTree(data, saliencies, svg, SVGWidth, SVGHeight, SVGPadding,
              tokenNodeMouseoverTree, tokenNodeMouseleave, textTokenPadding, wordToSubwordMap,
              initWordToSubwordMap);
            treeViewInitialized = true;
            break; 
          }
        };

        // Load the dependency and saliency data
        if (data == null || saliencies == null) {
          initData('/data/sst2-dependencies.json',
            '/data/sst2-saliency-list-grad-l1.json',
            '/data/sst2-sorted-syntactic-heads.json')
            .then(createGraph);
        } else {
          console.log('wow');
          createGraph();
        }

      }
    }
  });
  
  hoverTokenStore.subscribe(value => {

    if (svg == null) {return;}

    if (value != null) {
      // Highlight the corresponding node
      curHoverToken = value;
      highLightNode();
    } else {
      // Dehighlight the old node
      deHighLightNode();
      curHoverToken = value;
    }

  });

</script>

<style type='text/scss'>

  @import '../define';

  .svg-container {
    width: 100%;
    overflow-x: scroll;
    position: absolute;
    top: 41px;
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
    stroke-linejoin: round;
    fill: hsl(207, 48%, 44%);
  }

  :global(.arc-path) {
    stroke: hsl(0, 0%, 80%);
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

    :global(rect) {
      fill: hsl(210, 25%, 98%);
      stroke: hsl(180, 1%, 80%);
    }
  }

  :global(.link-group) {
    fill: none;
    stroke-opacity: 0.5;
    stroke-width: 1.5;
    stroke: #555;
  }

  :global(.node-group-attention) {
    :global(text) {
      opacity: 0.3;
    }

    :global(rect) {
      opacity: 0.4;
      // fill: none;
      stroke: none;
    }
  }

  :global(.head-name-group) {
    :global(.name) {
      font-size: 12px;
      dominant-baseline: hanging;
    }
  }

  :global(.attention-path) {
    stroke: hsla(0, 0%, 0%, 0.3);
    fill: none;
  }

  :global(.attention-path--lr) {
    stroke: url(#link-opacity-gradient-lr);
  }

  :global(.attention-path--rl) {
    stroke: url(#link-opacity-gradient-rl);
  }

  :global(.attention-arc) {
    stroke: hsla(0, 0%, 10%);
    fill: none;
  }

  :global(.matched-attention-path) {
    stroke: $orange-reg;
    stroke-width: 2;
  }

  :global(.matched-attention-path.attention-path--lr) {
    stroke: url(#matched-link-opacity-gradient-lr);
  }

  :global(.matched-attention-path.attention-path--rl) {
    stroke: url(#matched-link-opacity-gradient-rl);
  }

  :global(.comparison-svg-button) {
    cursor: pointer;
  }

  :global(.disabled) {
    cursor: not-allowed;
  }

  .panel-container {
    position: absolute;
    display: flex;
    flex-direction: row;
  }

  .dependency-label {
    color: hsl(0, 0%, 50%);
    font-size: 1.3rem;
    margin: 0 20px 0 20px;
  }

  .svg-control-panel {
    position: sticky;
    top: 0;
    left: 0;
    z-index: 5;
    cursor: default;

    padding-top: 5px;
    max-height: 76px;
    overflow: visible;

    display: flex;
    flex-direction: row;
    align-items: center;;
    justify-content: flex-start;

    font-size: 0.9rem;
    background: hsla(0, 0%, 100%, 0.9);
    user-select: none;
  }

  select {
    background: inherit;
    border-color: hsla(0, 0%, 0%, 0);
    padding: 0 1.6em 0 0.4em;
    height: 1.8em;
  }

  .select select:not([multiple]) {
    padding-right: 1.6em;
  }

  .select:not(.is-multiple) {
    height: 1.8em;
  }

  .select:not(.is-multiple):not(.is-loading)::after{
    right: 0.8em;
    border-color: $brown-icon;
  }

  .comparison-panel-container {
    @extend .panel-container;
    top: 200px;
  }

  .comparison-control-panel {
    @extend .svg-control-panel;
  }

  .comparison-label {
    @extend .dependency-label;
    margin: 0 4px 0 20px;
  }

  .comparison-select {
    font-size: 1.2em;
    height: 2em;
    border-bottom: 1px solid change-color($brown-dark, $alpha: 0.2);

    &:hover {
      background: change-color($brown-dark, $alpha: 0.05);
    }

    select {
      margin: 0;
      padding: 0 1em 0 0;

      &::after {
        margin-top: -5px
      }
    }

    select:not([multiple]) {
      padding-right: 1em;
    }

   &:not(.is-multiple):not(.is-loading)::after{
    right: 0.3em;
    border-color: $brown-icon;
    margin-top: -0.3em;
  }
  }

  .relation-checkboxes {
    position: absolute;
    top: -40px;
    left: 655px;
    width: 700px;
    padding: 5px 10px;
    cursor: default;
    
    display: flex;
    flex-direction: row;
    align-items: center;;
    justify-content: flex-start;
    flex-wrap: wrap;

    font-size: 0.9rem;
    border-radius: 5px;
    border: 1px solid hsl(0, 0%, 93.3%);
    box-shadow: 0 3px 3px hsla(0, 0%, 0%, 0.05);    
    background: hsla(0, 0%, 100%, 0.95);
  }

  .check-box-wrapper {
    padding: 0 5px;

    input[type='checkbox'] {
      filter: hue-rotate(195deg) saturate(30%);
    }
  }

  .select-row {
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;

    border-radius: 5px;
    border: 1px solid change-color($brown-dark, $lightness: 90%);
    margin-right: 5px;

    &:hover {
      background: change-color($brown-dark, $alpha: 0.05);
    }

    &--highlight {
      border: 1px solid change-color($brown-dark, $lightness: 70%);
      background: change-color($brown-dark, $alpha: 0.1);

      &:hover {
        background: change-color($brown-dark, $alpha: 0.1);
      }
    }
  }

  .relation-container {
    position: relative;
  }

  .relation {
    padding: 0 2em 0 0.4em;
    height: 1.8em;
    font-size: 1em;
    display: flex;
    align-items: center;
    cursor: pointer;

    &::after {
      z-index: 0;
      border: 3px solid transparent;
      border-radius: 2px;
      border-right: 0;
      border-top: 0;
      content: " ";
      display: block;
      height: .625em;
      margin-top: -0.3em;
      pointer-events: none;
      position: absolute;
      top: 50%;
      transform: rotate(225deg);
      transform-origin: center;
      width: .625em;

      border-color: $brown-icon;
      right: 0.9em;
    }
  }

  .comparison-button {
    padding: 0 0.4em;
    height: 1.8em;
    font-size: 1em;
    display: flex;
    align-items: center;
    cursor: pointer;
  }


  .hide {
    display: none;
  }

  .light-gray {
    color: $gray-light;
  }


</style>

<div class='graph-view'>

  <div class='panel-container'>

    <!-- Control panel on top of the SVG -->
    <div class='svg-control-panel'>

      <div class='dependency-label'>
        Current Sentence
      </div>

      <div class='select-row'>
        <div class='select'>
          <select name='instance-layout' id='instance-select'>
            {#each Object.values(layoutOptions) as opt}
              <option value={opt.value}>{opt.name}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class='select-row' class:select-row--highlight={inComparisonView}>
        <div class='relation-container' on:click={comparisonButtonClicked}>
          <div class='comparison-button'>
            Show Comparison
          </div>
        </div>
      </div>

      <div class='select-row' class:select-row--highlight={showRelationCheckboxes}>
        <div class='relation-container'
          on:click={() => {showRelationCheckboxes = !showRelationCheckboxes;}}>
          <div class='relation'>
            Syntactic Relations
          </div>
        </div>
      </div>

      <!-- Control panel after syntactic relation item is selected -->
      <div class='relation-checkboxes' class:hide={!showRelationCheckboxes}>
        {#each relations as entry}

          <label class="checkbox check-box-wrapper">
            <input type="checkbox" on:change={checkboxChanged}
              bind:checked={selectedRelations[entry[0]]}
              data-rel={entry[0]}
            >
            {entry[0]}
            <span class='light-gray'>({entry[1]})</span>
          </label>
            
        {/each}
      </div>

    </div>

  </div>

  <div class='comparison-panel-container hide'>
    <div class='comparison-control-panel'>
      <!-- <div class='comparison-name'>
        Dependency predicted by 5 attentions heads having the highest score.
      </div> -->

      <div class='comparison-label'>
        Dependencies predicted by attention heads with top 
      </div>

      <div class='select comparison-select'>
        <select name='head-list' id='head-select'>
          {#each Object.values(headListOptions) as opt}
            <option value={opt.value}>{opt.name}</option>
          {/each}
        </select>
      </div>


    </div>
  </div>

  <div class='svg-container'>
    <svg class='dependency-svg' bind:this={svg}></svg>
  </div>
  
</div>

<RadialModal on:xClicked={console.log('x crossed')}/>