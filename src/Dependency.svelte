<script>
  import { onMount } from 'svelte';
  import { instanceViewConfigStore, hoverTokenStore, wordToSubwordMapStore } from './store';
  import * as d3 from 'd3';

  let svg = null;
  let data = null;
  let saliencies = null;
  let wordToSubwordMap = null;

  let SVGWidth = 800;
  let SVGHeight = 800;

  let instanceViewConfig = undefined;
  let SVGInitialized = false;

  const SVGPadding = {top: 3, left: 3, right: 3, bottom: 3};
  const textTokenPadding = {top: 3, left: 3, right: 3, bottom: 3};

  // Global stores
  let curHoverToken = null;
  
  // Control panel variables
  const layoutOptions = {
    paragraph: {
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

  let currentLayout = layoutOptions.paragraph;
  let linkHoverColor = 'hsl(358, 94%, 73%)';


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
          console.log('change to saliency view');
          break;

        case 'dependency':
          console.log('change to dependency view');
          break;

        case 'tree':
          console.log('change to tree view');
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

    svg.append('defs')
      .append('marker')
      .attr('id', 'dep-arrow-hover')
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
      .attr('stroke', linkHoverColor)
      .attr('fill', linkHoverColor);

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

  const hightLightNode = () => {
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
      .attr('class', 'token-group')
      .attr('transform', `translate(${SVGPadding.left + SVGWidth * (1 - containerWidthFactor) / 2},
        ${SVGPadding.top + 50})`);
    
    let nodes = tokenGroup.append('g')
      .attr('class', 'node-group')
      .selectAll('g')
      .data(tokens, d => d.id)
      .join('g')
      .attr('class', 'node')
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
  };

  const initWordToSubwordMap = (tokens, saliencies) => {
    const isSpecialToken = (t) => {
      if (t === '[CLS]' || t === '[SEP]' || t === '[PAD]') {
        return true;
      } else {
        return false;
      }
    };

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
      // curX += textTokenWidths[i] + tokenGaps[i] + textTokenPadding.left + textTokenPadding.right;
      curX += textTokenWidths[i] + minTokenGap + textTokenPadding.left + textTokenPadding.right;
    });

    let fullWidth = curX + SVGPadding.left + SVGPadding.right - minTokenGap;

    // Change svg width to fit the single line
    svg.attr('width', fullWidth)
      .select('rect.border-rect')
      .attr('width', fullWidth);

    // Add tokens
    let tokenGroup = svg.append('g')
      .attr('class', 'token-group')
      .attr('transform', `translate(${SVGPadding.left}, ${SVGHeight * 2 / 3 + SVGPadding.top})`);
    
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
      .attr('rx', 5)
      .style('fill', 'hsl(210, 25%, 98%)')
      .style('stroke', 'hsl(180, 1%, 80%)');

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

    if (saliencies === null) {
      saliencies = await d3.json('/data/twitter-saliency-data/saliency-1718.json');
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

        if (data === null) {
          data = await d3.json('/data/twitter-dep-0877.json');
        }

        if (saliencies === null) {
          saliencies = await d3.json('/data/twitter-saliency-data/saliency-1718.json');
        }

        drawGraph();
        // drawTree();
        // drawParagraph();
      }
    }
  });
  
  hoverTokenStore.subscribe(value => {

    if (svg == null) {return;}

    if (value != null) {
      // Highlight the corresponding node
      curHoverToken = value;
      hightLightNode();
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

 .svg-container {
    position: relative;
  }

  .svg-control-panel {
    position: absolute;
    top: 0;
    left: 0;
    cursor: default;

    display: flex;
    flex-direction: column;
    align-items: center;;
    justify-content: flex-start;

    font-size: 0.9rem;
    border-radius: 5px;
    border: 1px solid hsl(0, 0%, 93.3%);
    box-shadow: 0 3px 3px hsla(0, 0%, 0%, 0.05);
    background: hsla(0, 0%, 100%, 0.65);

    .name {
      font-size: 1rem;
      padding: 5px 10px;
    }

    // .drop-down {
    //   font-size: 0.9rem;
    //   padding: 5px 10px;
    // }
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
    padding: 0 1em 0 0.4em;
  }

  .select select:not([multiple]) {
    padding-right: 1em;
  }

  .select:not(.is-multiple):not(.is-loading)::after{
    right: 0.4em;
    border-color: $blue-icon;
  }

  .select-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
  }

  .setting-icon {
    padding: 0.1em 0.4em;
    margin: 0 0.2em;
    font-size: 1.1em;
    color: $blue-icon;
    cursor: pointer;
    border-radius: 3px;

    transition: background 100ms ease-in-out;

    &:hover {
      background: change-color($blue-icon, $alpha: 0.1);
    }

    &.active {
      background: change-color($blue-icon, $alpha: 0.2);

      &:hover {
        background: change-color($blue-icon, $alpha: 0.2);
      }
    }
  }


</style>

<div class='graph-view'>

  <div class='svg-container' style={`width: ${instanceViewConfig === undefined ? 800 : instanceViewConfig.compWidth}px`}>
    <!-- Control panel on top of the SVG -->
    <div class='svg-control-panel'>

      <div class='select-row'>

        <div class='select'>
          <select name='instance-layout' id='instance-select'>
            {#each Object.values(layoutOptions) as opt}
              <option value={opt.value}>{opt.name}</option>
            {/each}
          </select>
        </div>

      </div>
    </div>

    <svg class='dependency-svg' bind:this={svg}></svg>
  </div>
  
</div>