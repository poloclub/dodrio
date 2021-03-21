import * as d3 from 'd3';

export const getTokenWidth = (tokens, svg, fontSize='1em') => {
  let textTokenWidths = {};
  let textTokenHeight = null;

  let hiddenTextGroup = svg.append('g')
    .attr('class', 'hidden-text')
    .style('opacity', 0);

  let hiddenTexts = hiddenTextGroup.selectAll('.text-token')
    .data(tokens)
    .join('text')
    .attr('class', 'text-token')
    .style('font-size', fontSize)
    .text(d => d);

  // After the text elements are created, we need to query again to get the
  // length and width of these elements
  hiddenTexts.each(function (_, i) {
    let bbox = this.getBBox();
    textTokenWidths[i] = +Number(bbox.width).toFixed(2);
    if (textTokenHeight == null) {
      textTokenHeight = bbox.height;
    }
  });

  hiddenTextGroup.remove();
  hiddenTexts.remove();

  return { textTokenWidths: textTokenWidths, textTokenHeight: textTokenHeight };
};

/** Create CSS selector compatible name */
export const tokenIDName = (tokenID) => {
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

export const isSpecialToken = (t) => {
  if (t === '[CLS]' || t === '[SEP]' || t === '[PAD]') {
    return true;
  } else {
    return false;
  }
};

export const updateSVGWidth = (svg, width) => {
  // Change svg width to fit the single line
  svg.attr('width', width)
    .select('rect.border-rect')
    .attr('width', width);

  // Also need to change the svg-container's width to make sticky DIV work
  d3.select('.instance-container')
    .select('.panel-container')
    .style('width', `${width}px`);
};

export const round = (num, decimal) => {
  return Math.round((num + Number.EPSILON) * (10 ** decimal)) / (10 ** decimal);
};

export const padZeroLeft = (num, digit) => {
  return Array(Math.max(digit - String(num).length + 1, 0)).join(0) + num;
};