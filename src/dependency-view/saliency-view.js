import * as d3 from 'd3';
import { tokenIDName, getTokenWidth } from './utils.js';

export const drawParagraph = (saliencies, svg, SVGWidth,
  SVGPadding, textTokenPadding, wordToSubwordMap, tokenNodeMouseover,
  tokenNodeMouseleave) => {

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
    .domain([0, largestAbs])
    .range([d3.rgb('#ffffff'), d3.rgb('#E50035')]);

  // Before drawing the texts, pre-render all texts to figure out their widths
  let textTokenSize = getTokenWidth(tokens.map(d => d.token), svg);
  let textTokenWidths = textTokenSize.textTokenWidths;
  let textTokenHeight = textTokenSize.textTokenHeight;
  let containerWidthFactor = 4 / 5;
  let containerWidth = SVGWidth * containerWidthFactor;

  const tokenGap = 5;
  const rowGap = textTokenHeight + textTokenPadding.top + textTokenPadding.bottom + 10;

  // Add tokens
  let tokenGroup = svg.append('g')
    .attr('class', 'token-group-saliency')
    .attr('transform', `translate(${SVGPadding.left + SVGWidth * (1 - containerWidthFactor) / 2},
      ${SVGPadding.top + 70})`);
  
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
    .attr('stop-color', '#FFFFFF')
    .attr('offset', 0);

  legentGradientDef.append('stop')
    .attr('stop-color', '#E50035')
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
    .domain([0, largestAbs])
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