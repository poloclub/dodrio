import * as d3 from 'd3';
import { tokenIDName, getTokenWidth } from './utils.js';

export const drawTree = (data, saliencies, svg, SVGWidth, SVGHeight, SVGPadding,
  tokenNodeMouseoverTree, tokenNodeMouseleave, textTokenPadding, wordToSubwordMap,
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

  // console.log(saliencies, tokens);

  if (wordToSubwordMap == null) {
    initWordToSubwordMap(tokens, saliencies);
  }

  // console.log(wordToSubwordMap);

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

  let textTokenSize = getTokenWidth(tokens.map(d => d.token), svg);
  let textTokenWidths = textTokenSize.textTokenWidths;
  let textTokenHeight = textTokenSize.textTokenHeight;

  // Convert flat data to hierarchy
  let root = d3.stratify()
    .id(d => d.child)
    .parentId(d => d.parent)(depList);

  // console.log(root);

  let treeRoot = d3.tree()
    .separation((a, b) => Math.max(textTokenWidths[a.id], textTokenWidths[b.id]))
    .size([
      SVGWidth - SVGPadding.left - SVGPadding.right,
      SVGHeight - SVGPadding.top - SVGPadding.bottom - 2 * textTokenHeight,
    ])(root);

  // console.log(treeRoot.descendants(), treeRoot.links());

  let treeGroup = svg.append('g')
    .attr('class', 'tree-group')
    .attr('transform', `translate(${SVGPadding.left}, ${SVGPadding.top + textTokenHeight})`);

  let rootLinks = treeRoot.links();

  for (let i = 0; i < rootLinks.length; i++) {
    rootLinks[i].left = +rootLinks[i].target.x > +rootLinks[i].source.x;
    rootLinks[i].vertical = Math.abs(+rootLinks[i].target.x - +rootLinks[i].source.x) < 5;
  }

  // console.log(rootLinks);

  treeGroup.append('g')
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

  linkTexts.append('textPath')
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

};