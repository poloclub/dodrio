import { tokenIDName, getTokenWidth, updateSVGWidth } from './utils.js';

export const drawGraph = (data, saliencies, wordToSubwordMap, svg, tokenXs,
  textTokenPadding, SVGPadding, SVGHeight, tokenNodeMouseover, tokenNodeMouseleave,
  initWordToSubwordMap) => {

  const depList = data.list;

  // Need to split the original words into sub-words if applicable
  let tokens = data.words.map(d => { return { 'token': d }; });

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
    wordToSubwordMap = initWordToSubwordMap(tokens, saliencies);
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
  let textTokenSize = getTokenWidth(tokens.map(d => d.token), svg);
  let textTokenWidths = textTokenSize.textTokenWidths;
  let textTokenHeight = textTokenSize.textTokenHeight;

  // console.log(textTokenWidths, textTokenHeight);

  const minTokenGap = 5;

  // Compute the x positions for all tokens
  tokenXs = {};
  let curX = 0;
  tokens.forEach((d, i) => {
    tokenXs[i] = curX;
    curX += textTokenWidths[i] + minTokenGap + textTokenPadding.left + textTokenPadding.right;
  });

  let fullWidth = curX + SVGPadding.left + SVGPadding.right - minTokenGap;

  // Change svg width to fit the single line
  updateSVGWidth(svg, fullWidth);

  // Add tokens
  let tokenGroup = svg.append('g')
    .attr('class', 'token-group')
    .attr('transform', `translate(${SVGPadding.left}, ${SVGPadding.top})`);

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
    .attr('data-id', d => d.id)
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
    .attr('class', 'arc-group')
    .attr('transform', `translate(0, ${textTokenHeight + textTokenPadding.top + textTokenPadding.bottom})`);

  console.log(rankedDepMap);

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
      .classed('arc-path--lr', d => d.parent < d.child)
      .classed('arc-path--rl', d => d.parent > d.child)
      .attr('id', d => `arc-path-${tokens[d.parent].id}-${tokens[d.child].id}`)
      // .attr('marker-end', 'url(#dep-arrow)')
      .attr('d', d => {
        let sourceX = d.sourceX;
        let targetX = d.targetX;

        let pathHeight = 15 * (i + 1);
        // Special case for tokens that are next to each other
        let pathCurve = i === 0 ? 5 : 15;

        // Compute the control points and middle points
        let vertical1 = {
          x: sourceX,
          y: pathHeight - pathCurve
        };

        let control1 = {
          x: sourceX < targetX ? sourceX + 0 : sourceX - 0,
          y: pathHeight
        };

        let mid1 = {
          x: sourceX < targetX ? sourceX + pathCurve : sourceX - pathCurve,
          y: pathHeight
        };

        let mid2 = {
          x: sourceX < targetX ? targetX - pathCurve : targetX + pathCurve,
          y: pathHeight
        };

        let control2 = {
          x: sourceX < targetX ? targetX - 0 : targetX + 0,
          y: pathHeight
        };

        let vertical2 = {
          x: targetX,
          y: pathHeight - pathCurve
        };

        return `M${sourceX} ${0}
            L${vertical1.x} ${vertical1.y}
            Q${control1.x} ${control1.y}, ${mid1.x} ${mid1.y}
            L${mid2.x} ${mid2.y}
            Q${control2.x} ${control2.y}, ${vertical2.x} ${vertical2.y}
            L${targetX} ${3}`;
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
      .attr('y', 15 * (i + 1) - 1)
      .text(d => d.relation === 'root' ? '' : d.relation)
      .clone(true)
      .lower()
      .attr('class', `arc-text arc-path-text-${i} shadow`)
      .attr('stroke-width', 5)
      .attr('stroke', 'white');

    arcGroup.selectAll('.arc-group-path').lower();

  });

  return { tokenXs: tokenXs, textTokenWidths: textTokenWidths};
};