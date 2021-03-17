import { isSpecialToken, updateSVGWidth, round } from './utils.js';

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
  firstRow, existingLinkSet) => {
  Object.keys(rankedDepMap).forEach((k, i) => {

    attentionGroup.append('g')
      .attr('class', 'attention-group-path')
      .selectAll(`path.attention-path-${i}`)
      .data(rankedDepMap[k], d => `${d.parent}-${d.child}`)
      .join('path')
      .attr('class', `attention-path attention-path-${i}`)
      .classed('matched-attention-path', d => existingLinkSet.has(String([d.parent, d.child])))
      .attr('marker-end', 'url(#dep-attention-arrow)')
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

export const drawDependencyComparison = (topHeads, svg, SVGPadding, data, attentions,
  saliencies, SVGHeight, existingLinkSet, tokenXs, textTokenPadding, textTokenWidths) => {
  const attentionRowGap = 10;

  let oldTranslate = svg.select('.token-group')
    .attr('transform');
  let oldTranslateX = +oldTranslate.replace(/translate\((.*),\s.*\)/, '$1');
  let oldTranslateY = +oldTranslate.replace(/translate\(.*,\s(.*)\)/, '$1');

  // Update the svg width before moving
  let moveX = 100;
  updateSVGWidth(svg, +svg.attr('width') + moveX);

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

  let tokens = data.words.map(d => { return { 'token': d }; });

  let arcGroupHeight = svg.select('.arc-group')
    .node()
    .getBBox()
    .height;

  // Draw the first row
  let attentionGroupID = 0;

  // Get the dependency list
  let maxAttentionLinks = getDependencyListFromAttention(topHeads[0].id.layer,
    topHeads[0].id.head, attentions, data, saliencies);

  let rankedDepMap = createRankedDepMap(maxAttentionLinks, tokenXs,
    textTokenPadding, textTokenWidths);

  let attentionGroup = svg.select('.token-group')
    .append('g')
    .attr('class', 'attention-group')
    .attr('id', `attention-group-${attentionGroupID}`)
    .attr('transform', `translate(0, ${tokenHeight})`);

  drawBottomDependencyLine(rankedDepMap, attentionGroup, tokenHeight, true, existingLinkSet);

  headNameGroup.append('text')
    .attr('class', 'name')
    .attr('x', 0)
    .attr('y', 0)
    .text(`layer ${topHeads[0].id.layer} head ${topHeads[0].id.head}`);

  // Draw the second+ rows
  let newTranslateY = 0;
  attentionGroupID += 1;

  while (attentionGroupID < topHeads.length) {

    let preTranslateY = +svg.select(`#attention-group-${attentionGroupID - 1}`)
      .attr('transform')
      .replace(/translate\(.*,\s(.*)\)/, '$1');

    let preHeight = svg.select(`#attention-group-${attentionGroupID - 1}`)
      .node()
      .getBBox()
      .height;

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
      topHeads[attentionGroupID].id.head,
      attentions, data, saliencies
    );

    rankedDepMap = createRankedDepMap(maxAttentionLinks, tokenXs, textTokenPadding, textTokenWidths);

    drawBottomDependencyLine(rankedDepMap, attentionGroup, tokenHeight, false, existingLinkSet);

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