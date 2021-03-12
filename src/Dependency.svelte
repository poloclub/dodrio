<script>
  import { onMount } from 'svelte';
  import { instanceViewConfigStore, hoverTokenStore, wordToSubwordMapStore } from './store';
  import * as d3 from 'd3';

  let svg = null;
  let data = null;
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

  const SVGPadding = {top: 3, left: 15, right: 15, bottom: 3};
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
  let dependencyViewInitialized = false;
  let saliencyViewInitialized = false;
  let treeViewInitialized = false;

  let currentLayout = layoutOptions.dependency;
  let linkHoverColor = 'hsl(358, 94%, 73%)';
  let linkAttentionColor = 'hsla(0, 0%, 0%, 0.5)';
  let showRelationCheckboxes = false;

  const ease = d3.easeCubicInOut;
  const animationTime = 300;

  const round = (num, decimal) => {
    return Math.round((num + Number.EPSILON) * (10 ** decimal)) / (10 ** decimal);
  };
  
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
            drawParagraph();
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
            drawGraph();
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
            drawTree();
          }

          currentLayout = layoutOptions[newLayoutValue];
          break;
        }

      }
    });
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
    let arrowMarker = svg.append('defs');

    arrowMarker.append('marker')
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
    
    arrowMarker.clone(true)
      .select('marker')
      .attr('id', 'dep-arrow-hover')
      .select('path')
      .attr('stroke', linkHoverColor)
      .attr('fill', linkHoverColor);

    arrowMarker.clone(true)
      .select('marker')
      .attr('id', 'dep-attention-arrow')
      .select('path')
      .attr('stroke', 'none')
      .attr('refX', 2)
      .attr('fill', linkAttentionColor);

    SVGInitialized = true;
  };
  
  const drawSaliencyLegend = (legendGroup, legendPos, largestAbs) => {    
    // Define the gradient
    let legentGradientDef = legendGroup.append('defs')
      .append('linearGradient')
      .attr('x1', 0)
      .attr('y1', 1)
      .attr('x2', 0)
      .attr('y2', 0)
      .attr('id', 'legend-gradient');
    
    legentGradientDef.append('stop')
      .attr('stop-color', '#eb2f06')
      .attr('offset', 0);

    legentGradientDef.append('stop')
      .attr('stop-color', '#ffffff')
      .attr('offset', 0.5);
    
    legentGradientDef.append('stop')
      .attr('stop-color', '#4690C2')
      .attr('offset', 1);

    legendGroup.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', legendPos.width)
      .attr('height', legendPos.height)
      .style('fill', 'url(#legend-gradient)')
      .style('stroke', 'black');
    
    // Draw the legend axis
    let legendScale = d3.scaleLinear()
      .domain([-largestAbs, largestAbs])
      .range([legendPos.height, 0])
      .nice();
    
    legendGroup.append('g')
      .attr('transform', `translate(${legendPos.width}, ${0})`)
      .call(d3.axisRight(legendScale).ticks(10));
    
    legendGroup.append('text')
      .attr('x', 5)
      .attr('y', -15)
      .style('font-size', '12px')
      .style('dominant-baseline', 'end')
      .style('text-anchor', 'middle')
      .text('Saliency Score');
  };
  
  /** Create CSS selector compatible name */
  const tokenIDName = (tokenID) => {
    if (tokenID == null) {
      return null;
    } else {
      return tokenID.replace(/\./g, '\\.')
        .replace(/,/g, '\\,')
        .replace(/#/g, '')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]');
    }
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
  
  const drawParagraph = () => {
    if (!SVGInitialized) {
      initSVG();
    }

    console.log(saliencies);

    // Give each saliency token a unique name
    if (saliencies.tokens[0].id !== undefined) {
      let tokenCount = {};
      saliencies.tokens.forEach(d => {
        let curCount = 0;
        if (tokenCount[d.token] === undefined) {
          tokenCount[d.token] = curCount + 1;
        } else {
          curCount = tokenCount[d.token];
          tokenCount[d.token] += 1;
        }
        d.id = `${tokenIDName(d.token)}-${curCount}`;
      });
    }
    let tokens = saliencies.tokens;
    
    let key = saliencies.meta['predicted_label'];
    let largestAbs = d3.max(saliencies.tokens.map(d => Math.abs(d[key])));

    let tokenColorScale = d3.scaleLinear()
      .domain([-largestAbs, 0, largestAbs])
      .range([d3.rgb('#eb2f06'), d3.rgb('#ffffff'), d3.rgb('#458FC1')]);

    console.log(saliencies);

    // Before drawing the texts, pre-render all texts to figure out their widths
    let textTokenSize = getTokenWidth(tokens.map(d => d.token));
    let textTokenWidths = textTokenSize.textTokenWidths;
    let textTokenHeight = textTokenSize.textTokenHeight;
    let containerWidthFactor = 4 / 5;
    let containerWidth = SVGWidth * containerWidthFactor;

    const tokenGap = 10;
    const rowGap = textTokenHeight + textTokenPadding.top + textTokenPadding.bottom + 10;

    // Add tokens
    let tokenGroup = svg.append('g')
      .attr('class', 'token-group-saliency')
      .attr('transform', `translate(${SVGPadding.left + SVGWidth * (1 - containerWidthFactor) / 2},
        ${SVGPadding.top + 50})`);
    
    let nodes = tokenGroup.append('g')
      .attr('class', 'node-group')
      .selectAll('g')
      .data(tokens, d => d.id)
      .join('g')
      .attr('class', d => {
        let cls = `node node-${d.id}`;
        if (wordToSubwordMap[d.token] !== undefined) {
          wordToSubwordMap[d.token].forEach(n => {
            cls += ` node-${n}`;
          });
        }
        return cls;
      })
      .attr('id', d => `node-${d.id}`)
      .on('mouseover', tokenNodeMouseover)
      .on('mouseleave', tokenNodeMouseleave);

    // Dynamically change the position of each token node
    // Change the positions of tokens based on their width
    let curPos = {x: 0, y: 0};
    let tokenNum = Object.keys(textTokenWidths).length;
    let textTokenPositions = {};

    // Change the position of the text token
    nodes.each(function(_, i) {
      d3.select(this)
        .attr('transform', `translate(${curPos.x}, ${curPos.y})`);
      
      // Record the new position
      textTokenPositions[i] = {x: curPos.x, y: curPos.y};

      // Update the next position
      let curLineLength = curPos.x + textTokenWidths[i] + textTokenPadding.left +
                          textTokenPadding.right + tokenGap;
      if (i + 1 < tokenNum) {
        curLineLength += textTokenWidths[i + 1];
      }

      // Shift to next row if needed
      if (curLineLength > containerWidth) {
        curPos.y += rowGap;
        curPos.x = 0;
      } else {
        curPos.x = curPos.x + textTokenWidths[i] + textTokenPadding.left + textTokenPadding.right + tokenGap;
      }
    });

    nodes.append('rect')
      .attr('width', (d, i) => textTokenWidths[i] + textTokenPadding.left + textTokenPadding.right)
      .attr('height', textTokenHeight + textTokenPadding.top + textTokenPadding.bottom)
      .attr('rx', 5)
      .style('fill', d => tokenColorScale(+d[key]))
      .style('stroke', 'hsl(180, 1%, 80%)');

    nodes.append('text')
      .attr('class', 'text-token-arc')
      .attr('x', textTokenPadding.left)
      .attr('y', textTokenPadding.top + 2)
      .style('pointer-events', 'none')
      .text(d => d.token);
    
    // Create legend for the saliency map view
    let legendGroup = svg.append('g')
      .attr('class', 'legend-group')
      .attr('transform', `translate(${SVGPadding.left + 10 + SVGWidth * (1/2 * containerWidthFactor + 1/2)},
        ${SVGPadding.top + 50})`);

    let legendPos = {width: 10, height: 150};

    drawSaliencyLegend(legendGroup, legendPos, largestAbs);

    saliencyViewInitialized = true;
  };

  const isSpecialToken = (t) => {
    if (t === '[CLS]' || t === '[SEP]' || t === '[PAD]') {
      return true;
    } else {
      return false;
    }
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
  };

  const drawGraph = () => {
    if (!SVGInitialized) {
      initSVG();
    }

    const depList = data.list;

    // Need to split the original words into sub-words if applicable
    let tokens = data.words.map(d => {return {'token': d};});

    // Give each saliency token a unique name
    if (saliencies.tokens[0].id === undefined) {
      let tokenCount = {};
      saliencies.tokens.forEach(d => {
        let curCount = 0;
        if (tokenCount[d.token] === undefined) {
          tokenCount[d.token] = curCount + 1;
        } else {
          curCount = tokenCount[d.token];
          tokenCount[d.token] += 1;
        }
        d.id = `${tokenIDName(d.token)}-${curCount}`;
      });
    }

    console.log(saliencies, tokens);

    if (wordToSubwordMap == null) {
      initWordToSubwordMap(tokens, saliencies);
    }

    console.log(wordToSubwordMap);

    // Give each saliency token a unique name
    let tokenCount = {};
    tokens.forEach(d => {
      let curCount = 0;
      if (tokenCount[d.token] === undefined) {
        tokenCount[d.token] = curCount + 1;
      } else {
        curCount = tokenCount[d.token];
        tokenCount[d.token] += 1;
      }
      d.id = `${tokenIDName(d.token)}-${curCount}`;
    });

    // Before drawing the tree, pre-render all texts to figure out their widths
    let textTokenSize = getTokenWidth(tokens.map(d => d.token));
    textTokenWidths = textTokenSize.textTokenWidths;
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
    tokenXs = {};
    let curX = 0;
    tokens.forEach((d, i) => {
      tokenXs[i] = curX;
      // curX += textTokenWidths[i] + tokenGaps[i] + textTokenPadding.left + textTokenPadding.right;
      curX += textTokenWidths[i] + minTokenGap + textTokenPadding.left + textTokenPadding.right;
    });

    let fullWidth = curX + SVGPadding.left + SVGPadding.right - minTokenGap;

    // Change svg width to fit the single line
    updateSVGWidth(fullWidth);

    // Add tokens
    let tokenGroup = svg.append('g')
      .attr('class', 'token-group')
      .attr('transform', `translate(${SVGPadding.left},
        ${Math.min(250, SVGHeight * 2 / 3 + SVGPadding.top)})`);
    
    let nodes = tokenGroup.append('g')
      .attr('class', 'node-group')
      .selectAll('g')
      .data(tokens)
      .join('g')
      .attr('class', d => {
        let cls = `node node-${d.id}`;
        if (wordToSubwordMap[d.token] !== undefined) {
          wordToSubwordMap[d.token].forEach(n => {
            cls += ` node-${n}`;
          });
        }
        return cls;
      })
      .attr('id', d => `node-${d.id}`)
      .attr('transform', (d, i) => `translate(${tokenXs[i]}, ${0})`)
      .on('mouseover', tokenNodeMouseover)
      .on('mouseleave', tokenNodeMouseleave);

    nodes.append('rect')
      .attr('width', (d, i) => textTokenWidths[i] + textTokenPadding.left + textTokenPadding.right)
      .attr('height', textTokenHeight + textTokenPadding.top + textTokenPadding.bottom)
      .attr('rx', 5);

    nodes.append('text')
      .attr('class', 'text-token-arc')
      .attr('x', textTokenPadding.left)
      .attr('y', textTokenPadding.top + 2)
      .style('pointer-events', 'none')
      .text(d => d.token);

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

        middleX = sourceX + (targetX - sourceX) / 2;
      } else {
        sourceX = tokenXs[d.parent] + 5;
        targetX = tokenXs[d.child] + textTokenPadding.left + textTokenPadding.right
          + textTokenWidths[d.child] - 5;

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

        tokenRelCount[Math.min(d.child, d.parent)] = curRank + 1;

        if (rankedDepMap[curRank] === undefined) {
          rankedDepMap[curRank] = [];
        }
        
        rankedDepMap[curRank].push(d);
      }
    });

    let arcGroup = tokenGroup.append('g')
      .attr('class', 'arc-group');

    Object.keys(rankedDepMap).forEach((k, i) => {

      arcGroup.append('g')
        .attr('class', 'arc-group-path')
        .selectAll(`path.arc-path-${i}`)
        .data(rankedDepMap[k], d => `${d.parent}-${d.child}`)
        .join('path')
        .attr('class', d => {
          let cls = `arc-path arc-path-${i} arc-path-${tokens[d.parent].id}-${tokens[d.child].id}`;
          if (wordToSubwordMap[tokens[d.parent].token] !== undefined) {
            wordToSubwordMap[tokens[d.parent].token].forEach(n => {
              cls += ` arc-path-${n}-${tokens[d.child].id}`;
            });
          }
          if (wordToSubwordMap[tokens[d.child].token] !== undefined) {
            wordToSubwordMap[tokens[d.child].token].forEach(n => {
              cls += ` arc-path-${tokens[d.parent].id}-${n}`;
            });
          }
          return cls;
        })
        .attr('id', d => `arc-path-${tokens[d.parent].id}-${tokens[d.child].id}`)
        .attr('marker-end', 'url(#dep-arrow)')
        .attr('d', d => {          
          let sourceX = d.sourceX;
          let targetX = d.targetX;

          let pathHeight = 20 * (i + 1);
          let pathCurve = i === 0 ? 20 : 15;

          // Special case for tokens that are next to each other
          if (d.gap === 1) {
            let curve = d3.line()
              .x(d => d.x)
              .y(d => d.y)
              .curve(d3.curveMonotoneX);

            let source = {x: sourceX, y: 0};
            let target = {x: targetX, y: -5};
            let alpha = 6;

            let mid1 = {
              x: sourceX < targetX ?
                sourceX + (targetX - sourceX) / alpha :
                sourceX - (sourceX - targetX) / alpha,
              y: -pathHeight
            };

            let mid2 = {
              x: sourceX < targetX ?
                sourceX + (targetX - sourceX) / alpha * (alpha - 1) :
                sourceX - (sourceX - targetX) / alpha * (alpha - 1),
              y: -pathHeight
            };

            return curve([source, mid1, mid2, target]);
          }
          
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
            Q${control2.x} ${control2.y}, ${targetX} ${-5}`;
        });

      arcGroup.append('g')
        .attr('class', 'arc-group-text')
        .selectAll(`text.arc-path-text-${i}`)
        .data(rankedDepMap[k], d => `${d.parent}-${d.child}`)
        .join('text')
        .attr('class', d => {
          let cls = `arc-text arc-path-text-${i} arc-path-text-${tokens[d.parent].id}-${tokens[d.child].id}`;
          if (wordToSubwordMap[tokens[d.parent].token] !== undefined) {
            wordToSubwordMap[tokens[d.parent].token].forEach(n => {
              cls += ` arc-path-text-${n}-${tokens[d.child].id}`;
            });
          }
          if (wordToSubwordMap[tokens[d.child].token] !== undefined) {
            wordToSubwordMap[tokens[d.child].token].forEach(n => {
              cls += ` arc-path-text-${tokens[d.parent].id}-${n}`;
            });
          }
          return cls;
        })
        .attr('x', d => d.middleX)
        .attr('y', -20 * (i + 1))
        .text(d => d.relation === 'root' ? '' : d.relation)
        .clone(true)
        .lower()
        .attr('class', `arc-text arc-path-text-${i} shadow`)
        .attr('stroke-width', 7)
        .attr('stroke', 'white');

      arcGroup.selectAll('.arc-group-path').lower();

    });

    dependencyViewInitialized = true;
  };

  const drawTree = () => {
    if (!SVGInitialized) {
      initSVG();
    }

    const depList = data.list;

    // Need to split the original words into sub-words if applicable
    let tokens = data.words.map(d => {return {'token': d};});

    // Give each saliency token a unique name
    if (saliencies.tokens[0].id === undefined) {
      let tokenCount = {};
      saliencies.tokens.forEach(d => {
        let curCount = 0;
        if (tokenCount[d.token] === undefined) {
          tokenCount[d.token] = curCount + 1;
        } else {
          curCount = tokenCount[d.token];
          tokenCount[d.token] += 1;
        }
        d.id = `${tokenIDName(d.token)}-${curCount}`;
      });
    }

    console.log(saliencies, tokens);

    if (wordToSubwordMap == null) {
      initWordToSubwordMap(tokens, saliencies);
    }

    console.log(wordToSubwordMap);

    // Give each saliency token a unique name
    let tokenCount = {};
    tokens.forEach(d => {
      let curCount = 0;
      if (tokenCount[d.token] === undefined) {
        tokenCount[d.token] = curCount + 1;
      } else {
        curCount = tokenCount[d.token];
        tokenCount[d.token] += 1;
      }
      d.id = `${tokenIDName(d.token)}-${curCount}`;
    });

    let textTokenSize = getTokenWidth(tokens.map(d => d.token));
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
      .attr('class', d => {
        let curNode = tokens[Number(d.id)];
        let cls = `node node-${curNode.id}`;
        if (wordToSubwordMap[curNode.token] !== undefined) {
          wordToSubwordMap[curNode.token].forEach(n => {
            cls += ` node-${n}`;
          });
        }
        return cls;
      })
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .on('mouseover', e => tokenNodeMouseoverTree(tokens, e))
      .on('mouseleave', tokenNodeMouseleave);

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
      .text(d => tokens[d.id].token);
    
    treeViewInitialized = true;
  };

  /**
   * Create a dependency graph list using the attention data. For each token,
   * we uses the token it most attends to as the dependency target. Since some
   * tokens are split into sub-words, we need to carefully handle this case. We
   * take sum of their out-attentions, and mean of their in-attentions.
   * @param {number} layer
   * @param {number} head 
   * @param {number} threshold Only count attention's predicted dependency if the
   *  attention is above this threshold
   */
  const getDependencyListFromAttention = (layer, head, threshold=0.02) => {
    let curAttention = attentions[layer][head];

    // Create a mapping between original words and sub-words
    let wordToSubwordIndexes = new Map();
    let attentionIndexToWord = new Map();
    let tokens = data.words.map(d => {return {'token': d};});

    let j = 0;
    while (isSpecialToken(saliencies.tokens[j].token)) {
      j += 1;
    }

    for (let i = 0; i < tokens.length; i++) {
      let curWord = tokens[i].token;
      
      let curToken = saliencies.tokens[j].token;

      if (curWord !== curToken) {
        let curIndexes = [];
        let nextWord = i + 1 < tokens.length ? tokens[i + 1].token : null;

        while (saliencies.tokens[j].token !== nextWord) {
          curIndexes.push(j);
          attentionIndexToWord.set(j, i);
          j += 1;
        }
        wordToSubwordIndexes.set(curIndexes[0], curIndexes);
      } else {
        attentionIndexToWord.set(j, i);
        j += 1;
      }
    }

    // Track the max attention
    let maxAttentionMap = [];
    
    // Iterate through the attention matrix row
    for (let i = 0; i < saliencies.tokens.length; i++) {

      // Skip the special token
      if (isSpecialToken(saliencies.tokens[i].token)) continue;

      let curMaxWord = null;
      let curMaxAttention = -1;

      // Iterate through the columns in this row
      let curRow = curAttention[i];

      // Check if the current row is a sub-word; if so we need to take mean of
      // all associated sub-words
      if (wordToSubwordIndexes.has(i)) {
        let subWordIndexes = wordToSubwordIndexes.get(i);
        for (let w = 0; w < curRow.length; w++) {
          let curSum = 0;
          for (let ws = 0; ws < subWordIndexes.length; ws++) {
            curSum += curAttention[ws][w];
          }
          curRow[w] = curSum / subWordIndexes.length;
        }

        // Skip the following sub-words for the iteration on i
        i = subWordIndexes[subWordIndexes.length - 1];
      }

      for (let j = 0; j < saliencies.tokens.length; j++) {
        // Skip the special token
        if (isSpecialToken(saliencies.tokens[j].token)) continue;

        let curWordAttention = 0;

        // Check if the current column is a sub-word
        if (wordToSubwordIndexes.has(j)) {
          // Take sum of all sub-words
          wordToSubwordIndexes.get(j).forEach(s => {
            j = s;
            curWordAttention += curRow[j];
          });
        } else {
          curWordAttention = curRow[j];
        }

        if (curWordAttention > curMaxAttention) {
          curMaxWord = attentionIndexToWord.get(j);
          curMaxAttention = curWordAttention;
        }

      }

      if (curMaxAttention > threshold) {
        maxAttentionMap.push({parent: attentionIndexToWord.get(i), child: curMaxWord});
      }
      
    }

    return maxAttentionMap;
  };

  const updateSVGWidth = (width) => {
    // Change svg width to fit the single line
    svg.attr('width', width)
      .select('rect.border-rect')
      .attr('width', width);
    
    // Also need to change the svg-container's width to make sticky DIV work
    d3.select('.instance-container')
      .select('.panel-container')
      .style('width', `${width}px`);
  };

  const createRankedDepMap = (maxAttentionLinks) => {
    // Compute dependency link hierarchy based on the gaps between two tokens
    let rankedDepList = [];

    maxAttentionLinks.forEach(d => {
      let gap = Math.abs(d.child - d.parent);

      // Compute the middle point of the link for adding the text later
      let middleX = undefined;
      let sourceX = undefined;
      let targetX = undefined;

      if (d.parent < d.child) {
        sourceX = tokenXs[d.parent] + textTokenPadding.left + textTokenPadding.right
          + textTokenWidths[d.parent] - 5;
        targetX = tokenXs[d.child] + 5;

        middleX = sourceX + (targetX - sourceX) / 2;
      } else {
        sourceX = tokenXs[d.parent] + 5;
        targetX = tokenXs[d.child] + textTokenPadding.left + textTokenPadding.right
          + textTokenWidths[d.child] - 5;

        middleX = targetX + (sourceX - targetX) / 2;
      }

      d.sourceX = round(sourceX, 3);
      d.targetX = round(targetX, 3);
      d.middleX = Number.isNaN(middleX) ? 0 : middleX;
      d.gap = gap;

      rankedDepList.push(d);
    });

    rankedDepList.sort((a, b) => a.gap - b.gap);

    // Need to pre-fill 1 because the first level (line) is reserved for
    // consecutive tokens only
    let tokenRelCount = Array(Object.keys(tokenXs).length).fill(1);
    let rankedDepMap = {};

    // Rank the dependency based on token's dependency count
    rankedDepList.forEach(d => {

      let iLow = Math.min(d.child, d.parent);
      let iHigh = Math.max(d.child, d.parent);

      if (iLow !== iHigh) {
        let curRank = tokenRelCount.slice(iLow, iHigh).reduce((a, b) => Math.max(a, b));

        for (let i = iLow; i < iHigh; i++) {
          tokenRelCount[i] = curRank + 1;
        }
        //tokenRelCount[Math.min(d.child, d.parent)] = curRank + 1;

        if (rankedDepMap[curRank] === undefined) {
          rankedDepMap[curRank] = [];
        }
        
        rankedDepMap[curRank].push(d);
      }
    });

    return rankedDepMap;
  };

  const drawBottomDependencyLine = (rankedDepMap, attentionGroup, tokenHeight, firstRow) => {
    Object.keys(rankedDepMap).forEach((k, i) => {

      attentionGroup.append('g')
        .attr('class', 'attention-group-path')
        .selectAll(`path.attention-path-${i}`)
        .data(rankedDepMap[k], d => `${d.parent}-${d.child}`)
        .join('path')
        .attr('class', `attention-path attention-path-${i}`)
        .attr('marker-end', 'url(#dep-attention-arrow)')
        .style('stroke', 'hsla(0, 0%, 0%, 0.3)')
        .style('fill', 'none')
        .style('width', 0.5)
        .attr('d', d => {          
          let sourceX = d.sourceX;
          let targetX = d.targetX;
          let baseY = firstRow ? 0 : tokenHeight;

          let pathHeight = 5 * (i + 1);
          let pathCurve = i === 0 ? 10 : 15;

          if (d.gap === 1) {
            let control1 = {
              x: sourceX,
              y: baseY + pathHeight + 2
            };

            let control2 = {
              x: targetX,
              y: baseY + pathHeight + 2
            };
            return `M${sourceX} ${baseY} C${control1.x} ${control1.y}
              ${control2.x} ${control2.y} ${targetX} ${baseY}`;
          }
          
          // Compute the control points and middle points
          let control1 = {
            x: sourceX < targetX ? sourceX + 2 : sourceX - 2,
            y: baseY + pathHeight
          };

          let mid1 = {
            x: sourceX < targetX ? sourceX + pathCurve : sourceX - pathCurve,
            y: baseY + pathHeight
          };

          let mid2 = {
            x: sourceX < targetX ? targetX - pathCurve: targetX + pathCurve,
            y: baseY + pathHeight
          };

          let control2 = {
            x: sourceX < targetX ? targetX - 2 : targetX + 2,
            y: baseY + pathHeight
          };

          return `M${sourceX} ${baseY}
            Q${control1.x} ${control1.y}, ${mid1.x} ${mid1.y}
            L${mid2.x} ${mid2.y}
            Q${control2.x} ${control2.y}, ${targetX} ${baseY}`;
        });

    });
  };

  const drawDependencyComparison = (topHeads) => {
    const attentionRowGap = 10;

    let oldTranslate = svg.select('.token-group')
      .attr('transform');
    let oldTranslateX = +oldTranslate.replace(/translate\((.*),\s.*\)/, '$1');
    let oldTranslateY = +oldTranslate.replace(/translate\(.*,\s(.*)\)/, '$1');

    // Update the svg width before moving
    let moveX = 100;
    updateSVGWidth(+svg.attr('width') + moveX);

    let tokenGroup = svg.select('.token-group')
      .transition('move-x')
      .duration(500)
      .attr('transform', `translate(${oldTranslateX + moveX}, ${oldTranslateY})`);
    
    let tokenHeight = tokenGroup.select('.node')
      .node()
      .getBBox()
      .height;
    
    let headNameGroup = svg.append('g')
      .attr('class', 'head-name-group')
      .attr('transform', `translate(${SVGPadding.left}, ${oldTranslateY + tokenHeight})`);
    
    let tokens = data.words.map(d => {return {'token': d};});

    let arcGroupHeight = svg.select('.arc-group')
      .node()
      .getBBox()
      .height;

    // Draw the first row
    let attentionGroupID = 0;

    // Get the dependency list
    let maxAttentionLinks = getDependencyListFromAttention(topHeads[0].id.layer,
      topHeads[0].id.head);
    
    let rankedDepMap = createRankedDepMap(maxAttentionLinks);

    let attentionGroup = svg.select('.token-group')
      .append('g')
      .attr('class', 'attention-group')
      .attr('id', `attention-group-${attentionGroupID}`)
      .attr('transform', `translate(0, ${tokenHeight})`);

    drawBottomDependencyLine(rankedDepMap, attentionGroup, tokenHeight, true);
    
    headNameGroup.append('text')
      .attr('class', 'name')
      .attr('x', 0)
      .attr('y', 0)
      .text(`layer ${topHeads[0].id.layer} head ${topHeads[0].id.head}`);

    // Draw the second+ rows
    let newTranslateY = 0;
    attentionGroupID += 1;

    while (attentionGroupID < topHeads.length) {

      let preTranslateY = +svg.select(`#attention-group-${attentionGroupID-1}`)
        .attr('transform')
        .replace(/translate\(.*,\s(.*)\)/, '$1');
      
      let preHeight = svg.select(`#attention-group-${attentionGroupID-1}`)
        .node()
        .getBBox()
        .height;
      
      console.log(preTranslateY, preHeight, tokenHeight, attentionRowGap);
      
      newTranslateY = preTranslateY + preHeight + tokenHeight + attentionRowGap;

      attentionGroup = svg.select('.token-group')
        .append('g')
        .attr('class', 'attention-group')
        .attr('id', `attention-group-${attentionGroupID}`)
        .attr('transform', `translate(0, ${newTranslateY})`)
        .style('opacity', '0');
      
      // Copy the node group
      attentionGroup.append(
        () => svg.select('.token-group')
          .select('.node-group')
          .clone(true)
          .classed('node-group-attention', true)
          .node()
      );

      // Draw the dependencies
      maxAttentionLinks = getDependencyListFromAttention(
        topHeads[attentionGroupID].id.layer,
        topHeads[attentionGroupID].id.head
      );
      
      rankedDepMap = createRankedDepMap(maxAttentionLinks);

      drawBottomDependencyLine(rankedDepMap, attentionGroup, tokenHeight, false);

      headNameGroup.append('text')
        .attr('class', 'name')
        .attr('x', 0)
        .attr('y', preTranslateY + preHeight + tokenHeight + attentionRowGap)
        .text(`layer ${topHeads[attentionGroupID].id.layer}
          head ${topHeads[attentionGroupID].id.head}`);
      
      let curHeight = newTranslateY + arcGroupHeight + tokenHeight +
        svg.select(`#attention-group-${attentionGroupID}`)
          .node()
          .getBBox()
          .height;
      
      if (curHeight > SVGHeight) {
        console.log(curHeight, attentionGroupID);
        break;
      } else {
        attentionGroup.style('opacity', 1);
        attentionGroupID += 1;
      }
    }

  };
  
  const padZeroLeft = (num, digit) => {
    return Array(Math.max(digit - String(num).length + 1, 0)).join(0) + num;
  };

  const checkboxChanged = (e) => {
    // Need to change the selectedRelations again because there is a race between
    // svelte's bind:checked call back and this function (on:change)
    let curRel = e.target.dataset.rel;
    selectedRelations[curRel] = e.target.checked;
    let topHeads = getInterestingHeads();

    if (attentions == null) {
      initAttentionData(
        `/data/sst2-attention-data/attention-${padZeroLeft(instanceID, 4)}.json`
      ).then(() => drawDependencyComparison(topHeads));
    } else {
      drawDependencyComparison(topHeads);
    }
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
    data.list.forEach(d => {
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
        SVGHeight = instanceViewConfig.compHeight;

        const createGraph = () => {
          switch(currentLayout.value) {
          case 'saliency':
            drawParagraph();
            break;
          
          case 'dependency':
            drawGraph();
            getInterestingHeads();
            break;

          case 'tree':
            drawTree();
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

  @import 'define';

  .svg-container {
    width: 100%;
    height: 100%;
    overflow-x: scroll;
    position: relative;
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
      fill: none;
    }
  }

  :global(.head-name-group) {
    :global(.name) {
      font-size: 12px;
      dominant-baseline: hanging;
    }
  }

 .svg-container {
    position: relative;
  }

  .panel-container {
    position: absolute;
    display: flex;
    flex-direction: row;
  }

  .svg-control-panel {
    position: sticky;
    top: 0;
    left: 0;
    cursor: default;
    width: 165px;
    max-height: 76px;
    overflow: visible;

    display: flex;
    flex-direction: column;
    align-items: center;;
    justify-content: flex-start;

    font-size: 0.9rem;
    border-radius: 5px;
    border: 1px solid hsl(0, 0%, 93.3%);
    box-shadow: 0 3px 5px hsla(0, 0%, 0%, 0.05);
    background: hsla(0, 0%, 100%, 0.9);
    user-select: none;
  }

  .relation-checkboxes {
    position: absolute;
    top: 0;
    left: 162px;
    width: 600px;
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
  }

  .sep-line-horizontal {
    height: 0;
    width: 95%;
    border: 1px solid $gray-sep;
  }

  .sep-line-vertical {
    height: 20px;
    width: 0;
    border: 1px solid $gray-sep;
  }

  select {
    background: inherit;
    border-color: hsla(0, 0%, 0%, 0);
    padding: 0 1.6em 0 0.4em;
  }

  .select select:not([multiple]) {
    padding-right: 1.6em;
  }

  .select:not(.is-multiple):not(.is-loading)::after{
    right: 0.8em;
    border-color: $blue-icon;
  }

  .select-row {
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
    width: 100%;
  }

  .relation-container {
    position: relative;
  }

  .relation {
    padding: 0 2em 0 0.4em;
    height: 2.5em;
    font-size: 1em;
    display: flex;
    align-items: center;
    cursor: pointer;

    &::after {
      z-index: 4;
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

      border-color: $blue-icon;
      right: 0.9em;
    }
  }

  .hide {
    display: none;
  }

  .light-gray {
    color: $gray-light;
  }


</style>

<div class='graph-view'>

  <div class='svg-container'>
    <div class='panel-container'>

      <!-- Control panel on top of the SVG -->
      <div class='svg-control-panel'>

        <div class='select-row'>
          <div class='relation-container' on:click={() => {showRelationCheckboxes = !showRelationCheckboxes;}}>
            <div class='relation'>
              Syntactic Relations
            </div>
          </div>
        </div>

        <div class='sep-line-horizontal'></div>

        <div class='select-row'>
          <div class='select'>
            <select name='instance-layout' id='instance-select'>
              {#each Object.values(layoutOptions) as opt}
                <option value={opt.value}>{opt.name}</option>
              {/each}
            </select>
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

    <svg class='dependency-svg' bind:this={svg}></svg>
  </div>
  
</div>