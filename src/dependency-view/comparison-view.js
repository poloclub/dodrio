import * as d3 from 'd3';
import { tokenIDName, isSpecialToken, updateSVGWidth, round } from './utils.js';
import { modalStore, attentionHeadColorStore, hoverTokenStore } from '../store';

let isMoved = {};
let modalInfo = {};

modalStore.subscribe(value => { modalInfo = value; });

let attentionHeadColor = new Map();
attentionHeadColorStore.subscribe(value => { attentionHeadColor = value; });

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
const getDependencyListFromAttention = (layer, head, attentions, data,
  saliencies, threshold=0.02) => {
  let curAttention = attentions[layer][head];

  // Create a mapping between original words and sub-words
  let wordToSubwordIndexes = new Map();
  let attentionIndexToWord = new Map();
  let tokens = data.words.map(d => { return { 'token': d }; });

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
      maxAttentionMap.push({ parent: attentionIndexToWord.get(i), child: curMaxWord });
    }

  }

  return maxAttentionMap;
};

const createRankedDepMap = (maxAttentionLinks, tokenXs, textTokenPadding, textTokenWidths) => {
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

const drawBottomDependencyLine = (rankedDepMap, attentionGroup, tokenHeight,
  firstRow, existingLinkSet, wordToSubwordMap, tokens) => {

  Object.keys(rankedDepMap).forEach((k, i) => {

    attentionGroup.append('g')
      .attr('class', 'attention-group-path')
      .selectAll(`path.attention-path-${i}`)
      .data(rankedDepMap[k], d => `${d.parent}-${d.child}`)
      .join('path')
      .attr('class', d => {
        let cls = `attention-path attention-path-${i} attention-path-${tokens[d.parent].id}-${tokens[d.child].id}`;
        if (wordToSubwordMap[tokens[d.parent].token] !== undefined) {
          wordToSubwordMap[tokens[d.parent].token].forEach(n => {
            cls += ` attention-path-${n}-${tokens[d.child].id}`;
          });
        }
        if (wordToSubwordMap[tokens[d.child].token] !== undefined) {
          wordToSubwordMap[tokens[d.child].token].forEach(n => {
            cls += ` attention-path-${tokens[d.parent].id}-${n}`;
          });
        }
        if (existingLinkSet.has(String([d.parent, d.child]))) {
          cls += ` matched-attention-path
            matched-attention-path-${existingLinkSet.get(String([d.parent, d.child]))}`;
        }
        return cls;
      })
      .classed('attention-path--lr', d => d.parent < d.child)
      .classed('attention-path--rl', d => d.parent > d.child)
      // .attr('marker-end', 'url(#dep-attention-arrow)')
      .style('width', 0.5)
      .attr('d', d => {
        let sourceX = d.sourceX;
        let targetX = d.targetX;
        let baseY = firstRow ? 0 : tokenHeight;

        let pathHeight = 5 * (i + 1);
        let pathCurve = i === 0 ? 4 : 7;

        // Compute the control points and middle points
        let vertical1 = {
          x: sourceX,
          y: baseY + pathHeight - pathCurve
        };

        let control1 = {
          x: sourceX < targetX ? sourceX + 0 : sourceX - 0,
          y: baseY + pathHeight
        };

        let mid1 = {
          x: sourceX < targetX ? sourceX + pathCurve : sourceX - pathCurve,
          y: baseY + pathHeight
        };

        let mid2 = {
          x: sourceX < targetX ? targetX - pathCurve : targetX + pathCurve,
          y: baseY + pathHeight
        };

        let control2 = {
          x: sourceX < targetX ? targetX - 0 : targetX + 0,
          y: baseY + pathHeight
        };

        let vertical2 = {
          x: targetX,
          y: baseY + pathHeight - pathCurve
        };

        return `M${sourceX} ${baseY}
            L${vertical1.x} ${vertical1.y}
            Q${control1.x} ${control1.y}, ${mid1.x} ${mid1.y}
            L${mid2.x} ${mid2.y}
            Q${control2.x} ${control2.y}, ${vertical2.x} ${vertical2.y}
            L${targetX} ${baseY}`;
      });

  });
};


const getWordAttention = (layer, head, attentions, data, saliencies,
  threshold = 0.02) => {
  let curAttention = attentions[layer][head];

  // Create a mapping between original words and sub-words
  let wordToSubwordIndexes = new Map();
  let attentionIndexToWord = new Map();
  let tokens = data.words.map(d => { return { 'token': d }; });

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

  // Track the attentions
  let attentionMap = [];

  // Iterate through the attention matrix row
  for (let i = 0; i < saliencies.tokens.length; i++) {

    // Skip the special token
    if (isSpecialToken(saliencies.tokens[i].token)) continue;

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

      if (curWordAttention > threshold) {
        let curWord = attentionIndexToWord.get(j);
        attentionMap.push({
          parent: attentionIndexToWord.get(i),
          child: curWord,
          attention: curWordAttention
        });
      }
    }
  }

  return attentionMap;
};


const createAttentionArcs = (attentionArcs, tokenXs, textTokenPadding, textTokenWidths) => {

  let arcs = [];

  attentionArcs.forEach(d => {
    let gap = Math.abs(d.child - d.parent);

    let sourceX = tokenXs[d.parent] + textTokenPadding.left + textTokenWidths[d.parent] / 2;
    let targetX = tokenXs[d.child] + textTokenPadding.left + textTokenWidths[d.child] / 2;

    d.sourceX = round(sourceX, 3);
    d.targetX = round(targetX, 3);
    d.gap = gap;

    arcs.push(d);
  });

  return arcs;
};

const drawAttentionArc = (attentionArcs, attentionGroup, attentionGroupID, wordToSubwordMap,
  tokens, minHeight=5, maxHeight=70) => {
  let arcYScale = d3.scaleLinear()
    .domain(d3.extent(attentionArcs.map(d => Math.abs(d.parent - d.child))))
    .range([minHeight, maxHeight]);

  let arcOpacityScale = d3.scaleLinear()
    .domain(d3.extent(attentionArcs.map(d => d.attention)))
    .range([0.1, 0.6]);

  let arcWidthScale = d3.scaleLinear()
    .domain(d3.extent(attentionArcs.map(d => d.attention)))
    .range([0.2, 2]);

  // Draw the arc diagram on top of the tokens
  attentionGroup.append('g')
    .attr('class', `attention-group-arc attention-group-arc-${attentionGroupID}`)
    .style('opacity', 0)
    .style('display', 'none')
    .style('pointer-events', 'none')
    .selectAll(`path.attention-arc-${attentionGroupID}`)
    .data(attentionArcs, d => `${d.parent}-${d.child}`)
    .join('path')
    .attr('class', `attention-arc attention-arc-${attentionGroupID}`)
    .attr('class', d => {
      let cls = `attention-arc attention-arc-${tokens[d.parent].id}-${tokens[d.child].id}`;
      if (wordToSubwordMap[tokens[d.parent].token] !== undefined) {
        wordToSubwordMap[tokens[d.parent].token].forEach(n => {
          cls += ` attention-arc-${n}-${tokens[d.child].id}`;
        });
      }
      if (wordToSubwordMap[tokens[d.child].token] !== undefined) {
        wordToSubwordMap[tokens[d.child].token].forEach(n => {
          cls += ` attention-arc-${tokens[d.parent].id}-${n}`;
        });
      }
      return cls;
    })
    .classed('attention-arc--lr', d => d.parent <= d.child)
    .classed('attention-arc--rl', d => d.parent > d.child)
    // .attr('marker-end', 'url(#dep-attention-arc-arrow)')
    .style('width', d => arcWidthScale(d.attention))
    // .style('opacity', d => arcOpacityScale(d.attention))
    .style('opacity', 0.5)
    .attr('d', d => {
      let sourceX = d.sourceX;
      let targetX = d.targetX;
      let xr = Math.abs((targetX - sourceX) / 2);
      let yr = arcYScale(Math.abs(d.parent - d.child));
      yr = Math.min(yr, xr);

      if (d.parent == d.child) {
        let curve = 5;
        let height = 10;
        // Draw the self-loop curve
        // Hack: add a super short line segment to force the slope of end-marker
        return `M ${sourceX} ${0}
            C ${sourceX} ${0}, ${sourceX - curve} ${-height}, ${sourceX} ${-height}
            C ${sourceX + curve} ${-height}, ${sourceX} ${0}, ${sourceX} ${-1}
            L ${sourceX} ${0}`;
      } else {
        return `M ${sourceX} ${0}
            A ${xr} ${yr}, 0, 0, ${sourceX < targetX ? 1 : 0} ${targetX}, ${0}`;
      }
    });
};

const radialButtonClicked = (e, attentions, tokens, layer, head) => {

  if (!modalInfo.show) {
    modalInfo.show = true;
    modalInfo.attention = attentions[layer][head];
    modalInfo.tokens = tokens;
    modalInfo.layer = layer;
    modalInfo.head = head;
    modalStore.set(modalInfo);

    d3.selectAll('.radial-symbol')
      .select('rect')
      .classed('disabled', true);

    d3.select(e.target)
      .classed('disabled', false)
      .classed('symbol-highlight', true);
  }
};

export const resetRadialButtons = () => {
  d3.selectAll('.radial-symbol')
    .select('rect')
    .classed('disabled', false)
    .classed('symbol-highlight', false)
    .style('fill', 'white')
    .style('stroke', 'hsl(28, 7%, 60%)');
};

const arcButtonClicked = (e) => {
  let nameGroup = d3.select(e.target.parentNode.parentNode.parentNode);
  let rowNum = d3.selectAll('.attention-group').size();
  let curID = +nameGroup.attr('class').replace(/.*name-group-(\d*).*/, '$1');

  const moveY = (d, i, g, distance) => {
    let curItem = d3.select(g[i]);
    let oldTranslateX = +curItem.attr('transform')
      .replace(/translate\((.*),\s.*\)/, '$1');
    let oldTranslateY = +curItem.attr('transform')
      .replace(/translate\(.*,\s(.*)\)/, '$1');
    return `translate(${oldTranslateX}, ${oldTranslateY + distance})`;
  };

  d3.select('.blocker').raise();
  d3.select('.original-node-group').raise();
  d3.select('.arc-group').raise();

  d3.select(e.target).classed('symbol-highlight', isMoved[curID] == null);


  if (isMoved[curID] == null) {
    // Move the groups below if it is in the first half
    if (curID < Math.floor(rowNum / 2)) {
      d3.selectAll('.attention-group')
        .filter(d => d >= curID)
        .transition('moveY')
        .duration(500)
        .ease(d3.easeCubicInOut)
        .attr('transform', (d, i, g) => moveY(d, i, g, 70));

      d3.selectAll('.name-group')
        .filter(d => d >= curID)
        .transition('moveY')
        .duration(500)
        .ease(d3.easeCubicInOut)
        .attr('transform', (d, i, g) => moveY(d, i, g, 70));

      isMoved[curID] = 'down';
    } else {
      // Move the groups above if it is in the second half
      d3.selectAll('.attention-group')
        .filter(d => d < curID)
        .transition('moveY')
        .duration(500)
        .ease(d3.easeCubicInOut)
        .attr('transform', (d, i, g) => moveY(d, i, g, -70));

      d3.selectAll('.name-group')
        .filter(d => d < curID)
        .transition('moveY')
        .duration(500)
        .ease(d3.easeCubicInOut)
        .attr('transform', (d, i, g) => moveY(d, i, g, -70));

      isMoved[curID] = 'up';
    }

    // Add label
    nameGroup.append('text')
      .attr('class', 'arc-label name')
      .attr('x', -8)
      .attr('y', -15)
      .style('fill', 'hsl(0, 0%, 60%)')
      .text('Attention Weights');

    // Show the arc diagram
    d3.select(`.attention-group-arc-${curID}`)
      .style('display', null)
      .transition('opacity')
      .delay(200)
      .duration(300)
      .ease(d3.easeCubicInOut)
      .style('opacity', 1);

  } else {

    // Hide the arc diagram
    d3.select(`.attention-group-arc-${curID}`)
      .transition('opacity')
      .duration(500)
      .ease(d3.easeCubicInOut)
      .style('opacity', 0)
      .on('end', (d, i, g) => {
        d3.select(g[i]).style('display', 'none');
        // Remove label
        nameGroup.select('.arc-label').remove();
      });

    // Restore the movement
    if (isMoved[curID] === 'down') {
      d3.selectAll('.attention-group')
        .filter(d => d >= curID)
        .transition('moveY')
        .duration(500)
        .ease(d3.easeCubicInOut)
        .attr('transform', (d, i, g) => moveY(d, i, g, -70));

      d3.selectAll('.name-group')
        .filter(d => d >= curID)
        .transition('moveY')
        .duration(500)
        .ease(d3.easeCubicInOut)
        .attr('transform', (d, i, g) => moveY(d, i, g, -70));
      
      isMoved[curID] = null;

    } else if (isMoved[curID] === 'up') {
      d3.selectAll('.attention-group')
        .filter(d => d < curID)
        .transition('moveY')
        .duration(500)
        .ease(d3.easeCubicInOut)
        .attr('transform', (d, i, g) => moveY(d, i, g, 70));

      d3.selectAll('.name-group')
        .filter(d => d < curID)
        .transition('moveY')
        .duration(500)
        .ease(d3.easeCubicInOut)
        .attr('transform', (d, i, g) => moveY(d, i, g, 70));

      isMoved[curID] = null;
    } else {
      console.error('Unknown case!');
    }
  }

};

const addButtons = (nameGroup, attentions, tokens, layer, head) => {
  const rectX = 16;
  const rectY = 19;

  const symbolMouseover = (e) => {
    let button = d3.select(e.target);

    if (!button.classed('disabled')) {
      d3.select(e.target)
        .style('fill', 'hsla(0, 0%, 0%, 0.2)')
        .style('stroke', 'hsl(28, 7%, 20%)');
    }
  };

  const symbolMouseleave = (e) => {
    let button = d3.select(e.target);

    if (!button.classed('symbol-highlight')) {
      d3.select(e.target)
        .style('fill', 'white')
        .style('stroke', 'hsl(28, 7%, 60%)');
    }
  };

  let symbolGroup = nameGroup.append('g')
    .attr('class', 'symbol-group')
    .attr('transform', `translate(${rectX}, ${rectY})`);

  let radialSymbol = symbolGroup.append('g')
    .attr('class', 'radial-symbol')
    .attr('transform', `translate(${0}, ${0})`);

  radialSymbol.append('rect')
    .attr('class', 'comparison-svg-button')
    .attr('width', 20)
    .attr('height', 20)
    .attr('rx', 3)
    .style('fill', 'white')
    .style('stroke', 'hsl(28, 7%, 60%)')
    .style('stroke-width', 1)
    .on('mouseover', symbolMouseover)
    .on('mouseleave', symbolMouseleave)
    .on('click', e => radialButtonClicked(e, attentions, tokens, layer, head));

  radialSymbol.append('image')
    .attr('href', 'PUBLIC_URL/figures/radial-symbol.svg')
    .attr('x', 2)
    .attr('y', 2)
    .attr('height', 16)
    .attr('width', 16)
    .style('pointer-events', 'none');

  let arcSymbol = radialSymbol.clone(true)
    .attr('class', 'arc-symbol')
    .attr('transform', `translate(${30}, ${0})`);

  arcSymbol.select('rect')
    .on('mouseover', symbolMouseover)
    .on('mouseleave', symbolMouseleave)
    .on('click', arcButtonClicked);

  arcSymbol.select('image')
    .attr('href', 'PUBLIC_URL/figures/arc-symbol.svg');

};

export const removeDependencyComparison = (svg) => {

  let oldTranslate = svg.select('.token-group')
    .attr('transform');
  let oldTranslateX = +oldTranslate.replace(/translate\((.*),\s.*\)/, '$1');
  let oldTranslateY = +oldTranslate.replace(/translate\(.*,\s(.*)\)/, '$1');

  // Update the svg width before moving
  let moveX = 100;
  updateSVGWidth(svg, +svg.attr('width') - moveX);

  svg.selectAll('.blocker').remove();

  svg.select('.token-group')
    .transition('move-x')
    .duration(500)
    .ease(d3.easeCubicInOut)
    .attr('transform', `translate(${oldTranslateX - moveX}, ${oldTranslateY})`);

  // Remove the added elements
  svg.select('.comparison-head-name-group').remove();
  svg.selectAll('.attention-group').remove();

  // Hide the text label
  d3.select('.comparison-panel-container')
    .classed('hide', true);
};

export const drawDependencyComparison = (topHeadMap, svg, SVGPadding, data, attentions,
  saliencies, SVGHeight, existingLinkSet, tokenXs, textTokenPadding, textTokenWidths,
  wordToSubwordMap, initWordToSubwordMap) => {

  const attentionRowGap = 10;
  let tokens = saliencies.tokens.map(d => { return { 'token': d.token }; });

  // Need to split the original words into sub-words if applicable
  let depTokens = data.words.map(d => { return { 'token': d }; });

  // Use currently selected head list as default
  let selectOption = d3.select('#head-select');
  let topHeads = topHeadMap[selectOption.property('value')];

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

  if (wordToSubwordMap == null) {
    wordToSubwordMap = initWordToSubwordMap(depTokens, saliencies);
  }
  // console.log(wordToSubwordMap);

  // Give each saliency token a unique name
  let tokenCount = {};
  depTokens.forEach(d => {
    let curCount = 0;
    if (tokenCount[d.token] === undefined) {
      tokenCount[d.token] = curCount + 1;
    } else {
      curCount = tokenCount[d.token];
      tokenCount[d.token] += 1;
    }
    d.id = `${tokenIDName(d.token)}-${curCount}`;
  });

  let oldTranslate = svg.select('.token-group')
    .attr('transform');
  let oldTranslateX = +oldTranslate.replace(/translate\((.*),\s.*\)/, '$1');
  let oldTranslateY = +oldTranslate.replace(/translate\(.*,\s(.*)\)/, '$1');

  // Update the svg width before moving
  let moveX = 100;
  updateSVGWidth(svg, +svg.attr('width') + moveX);

  let headNameGroup = svg.append('g')
    .attr('class', 'comparison-head-name-group')
    .attr('transform', `translate(${SVGPadding.left},
      ${SVGPadding.top + textTokenPadding.top + 4})`)
    .style('opacity', 0);
  
  headNameGroup.transition('')
    .duration(500)
    .ease(d3.easeCubicInOut)
    .style('opacity', 1);

  let tokenGroup = svg.select('.token-group')
    .transition('move-x')
    .duration(500)
    .ease(d3.easeCubicInOut)
    .attr('transform', `translate(${oldTranslateX + moveX}, ${oldTranslateY})`)
    .on('end', () => {
      // Draw top gradient overlay
      tokenGroup = svg.select('.token-group');

      tokenGroup.append('rect')
        .attr('class', 'blocker')
        .attr('id', 'top-blocker')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', +svg.attr('width'))
        .attr('height', controlPanelY - 5)
        .style('fill', 'url(#top-opacity-gradient)');

      svg.append('rect')
        .attr('class', 'blocker')
        .attr('id', 'top-left-blocker')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', moveX)
        .attr('height', controlPanelY + 5)
        .style('fill', 'url(#top-opacity-gradient)');

      tokenGroup.append('rect')
        .attr('class', 'blocker')
        .attr('id', 'bottom-blocker')
        .attr('x', 0)
        .attr('y', SVGHeight - 10)
        .attr('width', +svg.attr('width'))
        .attr('height', 10)
        .style('fill', 'url(#bottom-opacity-gradient)');

      svg.append('rect')
        .attr('class', 'blocker')
        .attr('id', 'bottom-left-blocker')
        .attr('x', 0)
        .attr('y', SVGHeight - 10)
        .attr('width', moveX)
        .attr('height', 10)
        .style('fill', 'url(#bottom-opacity-gradient)');

      tokenGroup.select('.node-group').raise();
      tokenGroup.select('.arc-group').raise();
    });

  let tokenHeight = tokenGroup.select('.node')
    .node()
    .getBBox()
    .height;

  let oldNodeGroupHeight = svg.select('.node-group')
    .node()
    .getBBox()
    .height;

  let arcGroupHeight = svg.select('.arc-group')
    .node()
    .getBBox()
    .height;

  // Make the control panel for comparison view visible
  let controlPanelY = +d3.select('.graph-view .svg-container')
    .style('top')
    .replace(/(.*)px/, '$1');
  controlPanelY += arcGroupHeight + oldNodeGroupHeight + SVGPadding.top + 10;

  d3.select('.comparison-panel-container')
    .style('top', `${controlPanelY}px`)
    .classed('hide', false);

  // Bind the sort list select so users can change the sorting order
  selectOption.on('change', () => {
    let newHeadListValue = selectOption.property('value');

    switch (newHeadListValue) {
    case 'semantic':
      svg.select('.token-group')
        .selectAll('.attention-group')
        .remove();

      svg.select('.comparison-head-name-group')
        .selectAll('.name-group')
        .remove();

      drawBottomRows(topHeadMap.semantic, attentions, data, saliencies, arcGroupHeight,
        oldNodeGroupHeight, svg, tokenHeight, attentionRowGap, tokenXs, textTokenPadding,
        textTokenWidths, existingLinkSet, wordToSubwordMap, depTokens, headNameGroup,
        tokens, SVGPadding, SVGHeight);

      break;
    case 'syntactic':
      svg.select('.token-group')
        .selectAll('.attention-group')
        .remove();

      svg.select('.comparison-head-name-group')
        .selectAll('.name-group')
        .remove();

      drawBottomRows(topHeadMap.syntactic, attentions, data, saliencies, arcGroupHeight,
        oldNodeGroupHeight, svg, tokenHeight, attentionRowGap, tokenXs, textTokenPadding,
        textTokenWidths, existingLinkSet, wordToSubwordMap, depTokens, headNameGroup,
        tokens, SVGPadding, SVGHeight);

      break;
    case 'important':
      console.log('wow');
      svg.select('.token-group')
        .selectAll('.attention-group')
        .remove();

      svg.select('.comparison-head-name-group')
        .selectAll('.name-group')
        .remove();

      drawBottomRows(topHeadMap.important, attentions, data, saliencies, arcGroupHeight,
        oldNodeGroupHeight, svg, tokenHeight, attentionRowGap, tokenXs, textTokenPadding,
        textTokenWidths, existingLinkSet, wordToSubwordMap, depTokens, headNameGroup,
        tokens, SVGPadding, SVGHeight);

      break;
    }
  });

  drawBottomRows(topHeads, attentions, data, saliencies, arcGroupHeight,
    oldNodeGroupHeight, svg, tokenHeight, attentionRowGap, tokenXs, textTokenPadding,
    textTokenWidths, existingLinkSet, wordToSubwordMap, depTokens, headNameGroup,
    tokens, SVGPadding, SVGHeight);
};

const drawBottomRows = (topHeads, attentions, data, saliencies, arcGroupHeight,
  oldNodeGroupHeight, svg, tokenHeight, attentionRowGap, tokenXs, textTokenPadding,
  textTokenWidths, existingLinkSet, wordToSubwordMap, depTokens, headNameGroup,
  tokens, SVGPadding, SVGHeight) => {
  // Draw the first row
  let attentionGroupID = 0;

  // Get the dependency list
  let maxAttentionLinks = getDependencyListFromAttention(topHeads[0].id.layer,
    topHeads[0].id.head, attentions, data, saliencies);

  // Draw the second+ rows
  let newTranslateY = 0;
  let attentionGroup = null;

  while (attentionGroupID < topHeads.length) {
    let preTranslateY = 0;
    let preHeight = 0;

    if (attentionGroupID === 0) {
      newTranslateY = arcGroupHeight + oldNodeGroupHeight + 50;
      // newTranslateY = arcGroupHeight + oldNodeGroupHeight + 200;
    } else {
      preTranslateY = +svg.select(`#attention-group-${attentionGroupID - 1}`)
        .attr('transform')
        .replace(/translate\(.*,\s(.*)\)/, '$1');

      preHeight = svg.select(`#attention-group-${attentionGroupID - 1}`)
        .node().getBBox().height;

      newTranslateY = preTranslateY + preHeight + tokenHeight + attentionRowGap;
    }

    attentionGroup = svg.select('.token-group')
      .append('g')
      .datum(attentionGroupID)
      .attr('class', 'attention-group')
      .attr('id', `attention-group-${attentionGroupID}`)
      .attr('transform', `translate(0, ${newTranslateY})`)
      .style('visibility', 'hidden');

    isMoved[attentionGroupID] = null;

    // Copy the node group
    let newGroup = svg.select('.token-group')
      .select('.node-group')
      .classed('original-node-group', true)
      .clone(true)
      .classed('original-node-group', false)
      .classed('node-group-attention', true);

    newGroup.selectAll('g.node')
      .classed('node', false)
      .classed('node-clone', true)
      .on('mouseover', (e) => {
        let nodeID = e.target.parentNode.dataset.id;
        hoverTokenStore.set(nodeID);
      })
      .on('mouseleave', () => {
        hoverTokenStore.set(null);
      });

    newGroup.selectAll('rect')
      .style('stroke', 'none');

    attentionGroup.append(() => newGroup.node());

    // Draw the dependencies
    maxAttentionLinks = getDependencyListFromAttention(
      topHeads[attentionGroupID].id.layer,
      topHeads[attentionGroupID].id.head,
      attentions, data, saliencies
    );

    let rankedDepMap = createRankedDepMap(maxAttentionLinks, tokenXs, textTokenPadding, textTokenWidths);

    drawBottomDependencyLine(rankedDepMap, attentionGroup, tokenHeight, false,
      existingLinkSet, wordToSubwordMap, depTokens);

    let nameGroup = headNameGroup.append('g')
      .datum(attentionGroupID)
      .attr('class', `name-group name-group-${attentionGroupID}`)
      .attr('transform', `translate(${0}, ${newTranslateY})`)
      .style('visibility', 'hidden');

    let color = attentionHeadColor.get([topHeads[attentionGroupID].id.layer,
      topHeads[attentionGroupID].id.head].toString());
    nameGroup.append('text')
      .attr('class', 'name')
      .style('fill', color)
      .text(`layer ${topHeads[attentionGroupID].id.layer}
          head ${topHeads[attentionGroupID].id.head}`);

    addButtons(nameGroup, attentions, tokens, topHeads[attentionGroupID].id.layer,
      topHeads[attentionGroupID].id.head);

    let curHeight = newTranslateY + svg.select(`#attention-group-${attentionGroupID}`)
      .node().getBBox().height;

    // Generate arcs based on attention scores
    let HighAttention = getWordAttention(topHeads[0].id.layer,
      topHeads[0].id.head, attentions, data, saliencies);
    let attentionArcs = createAttentionArcs(HighAttention, tokenXs,
      textTokenPadding, textTokenWidths);

    drawAttentionArc(attentionArcs, attentionGroup, attentionGroupID,
      wordToSubwordMap, depTokens);

    if (curHeight + SVGPadding.bottom > SVGHeight) {
      attentionGroup.remove();
      nameGroup.remove();
      
      // Update the number in the title label
      d3.select('#comparison-label-top')
        .text(`Dependencies predicted by top-${attentionGroupID} attention heads with the highest `);

      break;

    } else {
      attentionGroup.style('visibility', 'visible');
      nameGroup.style('visibility', 'visible');
      attentionGroupID += 1;
    }
  }
};
