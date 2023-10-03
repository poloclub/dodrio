<script>
  import { onMount } from 'svelte';
  import { sideStore, attentionHeadColorStore } from './store';
  import { getTokenWidth } from './dependency-view/utils';
  import * as d3 from 'd3';

  let modalComponent = null;
  let svg = null;
  let donut = null;
  let svgVirtualLength = 500;
  let svgLength = 480;
  let markerDef = null;

  let attentionHeadColor = new Map();
  attentionHeadColorStore.subscribe((value) => {
    attentionHeadColor = value;
  });

  let modalInfo = {};

  sideStore.subscribe((value) => {
    modalInfo = value;

    if (modalInfo.attention != null) {
      donut.selectAll('*').remove();
      drawDonut(donut);
    }
  });

  const drawDonut = (donut) => {
    let color = attentionHeadColor.get(
      [modalInfo.layer, modalInfo.head].toString()
    );

    svg
      .select('#atlas-side-arrow')
      .select('path')
      .attr('fill', color)
      .attr('stroke', color);

    // Pre-draw the text
    let tempSVG = d3
      .select(document.body)
      .append('svg')
      .attr('height', 200)
      .attr('width', 200)
      .style('visibility', 'hidden');

    const result = getTokenWidth(
      modalInfo.tokens.map((d) => d.token),
      tempSVG,
      '0.9em'
    );
    const maxTextWidth = d3.max(
      Object.entries(result.textTokenWidths).map((d) => d[1])
    );
    let inRadius = svgVirtualLength / 2 - maxTextWidth;

    tempSVG.remove();

    // Figure out the token positions
    let tokenPos = [];
    for (let i = 0; i < modalInfo.tokens.length; i++) {
      let curAngle =
        -Math.PI / 2 + i * ((Math.PI * 2) / modalInfo.tokens.length);
      tokenPos.push({
        x: Math.cos(curAngle) * inRadius,
        y: Math.sin(curAngle) * inRadius,
        angle: curAngle,
        token: modalInfo.tokens[i].token,
        id: i,
      });
    }

    // Create the links
    let links = [];
    let threshold = 0;

    for (let i = 0; i < modalInfo.tokens.length; i++) {
      for (let j = 0; j < modalInfo.tokens.length; j++) {
        let curAttention = modalInfo.attention[i][j];
        if (curAttention > threshold) {
          links.push({
            source: i,
            target: j,
            attention: curAttention,
            id: `${i}-${j}`,
          });
        }
      }
    }

    links = links.sort((a, b) => b.attention - a.attention).slice(0, 150);

    // Define link width scale
    let linkWidthScale = d3
      .scaleLinear()
      .domain(d3.extent(links.map((d) => d.attention)))
      .range([0.5, 2]);

    let linkOpacityScale = d3
      .scaleLinear()
      // .domain(d3.extent(links.map(d => d.attention)))
      .domain([0, 1])
      .range([0.1, 1]);

    // Draw the texts (will re-draw again later after getting the optimal circle size)
    let textTokenGroup = donut
      .append('g')
      .attr('class', 'token-text-group')
      .style('font-size', '0.9em')
      .style('cursor', 'default');

    textTokenGroup
      .selectAll('text')
      .data(tokenPos, (d) => d.id)
      .join('text')
      .attr('data-angle', (d) => d.angle)
      .attr('transform', (d) => {
        let degree = (d.angle * 180) / Math.PI;
        return `rotate(${degree})
          translate(${inRadius}, 0)
          rotate(${d.angle >= Math.PI / 2 ? 180 : 0})
        `;
      })
      .attr('dominant-baseline', 'middle')
      .attr('x', (d) => (d.angle < Math.PI / 2 ? 6 : -6))
      .attr('text-anchor', (d) => (d.angle < Math.PI / 2 ? 'start' : 'end'))
      .text((d) => d.token);

    // Optimize the circle size (maximize the inner bbox)
    // Need to create a temp svg to work around the drawing delay
    let textClone = donut.select('.token-text-group').clone(true).remove();

    tempSVG = d3
      .select(document.body)
      .append('svg')
      .attr('viewBox', `0 0 ${svgVirtualLength} ${svgVirtualLength}`)
      .attr('width', svgLength)
      .attr('height', svgLength)
      .style('visibility', 'hidden');

    tempSVG.append(() => textClone.node());
    let innerBox = tempSVG.select('.token-text-group').node().getBBox();
    tempSVG.remove();

    let top = svgVirtualLength / 2 + innerBox.y;
    let bottom = svgVirtualLength - top - innerBox.height;
    let left = svgVirtualLength / 2 + innerBox.x;
    let right = svgVirtualLength - left - innerBox.width;

    let radiusGrow = Math.min(top, bottom, left, right);

    // Grow the radius and redraw text, circles and paths
    inRadius += Math.floor(radiusGrow);

    // Figure out the token positions
    tokenPos = [];
    for (let i = 0; i < modalInfo.tokens.length; i++) {
      let curAngle =
        -Math.PI / 2 + i * ((Math.PI * 2) / modalInfo.tokens.length);
      tokenPos.push({
        x: Math.cos(curAngle) * inRadius,
        y: Math.sin(curAngle) * inRadius,
        angle: curAngle,
        token: modalInfo.tokens[i].token,
        id: i,
      });
    }

    // Draw invisible background for interaction
    textTokenGroup
      .selectAll('rect')
      .data(tokenPos, (d) => d.id)
      .join('rect')
      .attr('transform', (d) => {
        let degree = (d.angle * 180) / Math.PI;
        return `rotate(${degree})
          translate(${inRadius}, 0)
        `;
      })
      .attr('x', 0)
      .attr('y', -5)
      .attr('width', 50)
      .attr('height', 15)
      .style('fill', 'white')
      .style('opacity', 0)
      .on('mouseover', (e, d) => {
        svg.select('#atlas-side-arrow').select('path').attr('opacity', 0.1);

        donut
          .select('.path-group')
          .selectAll('path.donut-link')
          .style('opacity', 0.1);

        donut
          .select('.path-group')
          .selectAll('path.donut-link')
          .filter((dd) => {
            return dd.source === d.id || dd.target === d.id;
          })
          .attr('marker-end', 'url(#atlas-side-arrow-hover)')
          .style('stroke', 'hsl(36, 100%, 55%)')
          .style('stroke-width', 3)
          .style('opacity', 1)
          .raise();
      })
      .on('mouseleave', () => {
        svg.select('#atlas-side-arrow').select('path').attr('opacity', null);

        donut
          .select('.path-group')
          .selectAll('path.donut-link')
          .attr('marker-end', 'url(#atlas-side-arrow)')
          .style('stroke', color)
          .style('stroke-width', (d) => linkWidthScale(d.attention))
          .style('opacity', 1);
      });

    // Update text position
    textTokenGroup
      .selectAll('text')
      .data(tokenPos, (d) => d.id)
      .join('text')
      .attr('data-angle', (d) => d.angle)
      .attr('transform', (d) => {
        let degree = (d.angle * 180) / Math.PI;
        return `rotate(${degree})
          translate(${inRadius}, 0)
          rotate(${d.angle >= Math.PI / 2 ? 180 : 0})
        `;
      })
      .attr('dominant-baseline', 'middle')
      .attr('x', (d) => (d.angle < Math.PI / 2 ? 6 : -6))
      .attr('text-anchor', (d) => (d.angle < Math.PI / 2 ? 'start' : 'end'))
      .text((d) => d.token)
      .on('mouseover', (e, d) => {
        svg.select('#atlas-side-arrow').select('path').attr('opacity', 0.1);

        donut
          .select('.path-group')
          .selectAll('path.donut-link')
          .style('opacity', 0.1);

        donut
          .select('.path-group')
          .selectAll('path.donut-link')
          .filter((dd) => {
            return dd.source === d.id || dd.target === d.id;
          })
          .attr('marker-end', 'url(#atlas-side-arrow-hover)')
          .style('stroke', 'hsl(36, 100%, 55%)')
          .style('stroke-width', 3)
          .style('opacity', 1)
          .raise();
      })
      .on('mouseleave', () => {
        svg.select('#atlas-side-arrow').select('path').attr('opacity', null);

        donut
          .select('.path-group')
          .selectAll('path.donut-link')
          .attr('marker-end', 'url(#atlas-side-arrow)')
          .style('stroke', color)
          .style('stroke-width', (d) => linkWidthScale(d.attention))
          .style('opacity', 1);
      });

    // Draw the links as bezier curves
    donut
      .append('g')
      .attr('class', 'path-group')
      .selectAll('path.donut-link')
      .data(links, (d) => d.id)
      .join('path')
      .attr('class', 'donut-link')
      .attr('marker-end', 'url(#atlas-side-arrow)')
      .attr('d', (d) => {
        let source = tokenPos[d.source];
        let target = tokenPos[d.target];
        const center = { x: 0, y: 0 };
        const radialCurveAlpha = 2 / 5;

        // Two control points symmetric regarding the center point
        let controlP1 = {
          x: center.x + (source.x - center.x) * radialCurveAlpha,
          y: center.y + (source.y - center.x) * radialCurveAlpha,
        };

        let controlP2 = {
          x: center.x + (target.x - center.x) * radialCurveAlpha,
          y: center.y + (target.y - center.x) * radialCurveAlpha,
        };

        return `M ${source.x},${source.y} C${controlP1.x}, ${controlP1.y},
          ${controlP2.x}, ${controlP2.y}, ${target.x},${target.y}`;
      })
      .style('fill', 'none')
      .style('stroke', color)
      .style('stroke-width', (d) => linkWidthScale(d.attention))
      .style('opacity', (d) => linkOpacityScale(d.attention));

    // Draw the circles
    donut
      .append('g')
      .attr('class', 'token-dot-group')
      .selectAll('circle.token-dot')
      .data(tokenPos, (d) => d.id)
      .join('circle')
      .attr('class', 'token-dot')
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y)
      .attr('r', 1);
  };

  const drawRadial = () => {
    svg
      .append('rect')
      .attr('width', svgVirtualLength)
      .attr('height', svgVirtualLength)
      .style('fill', 'hsla(0, 0%, 100%, 0)');

    donut = svg
      .append('g')
      .attr('class', 'donut')
      .attr('transform', 'translate(250, 250)');

    markerDef = svg
      .append('defs')
      .attr('id', 'atlas-side-arrow-def')
      .append('marker')
      .attr('id', 'atlas-side-arrow')
      .attr('viewBox', [0, 0, 10, 10])
      .attr('refX', 10)
      .attr('refY', 5)
      .attr('markerWidth', 12)
      .attr('markerHeight', 9)
      .attr('orient', 'auto')
      .attr('stroke-width', 1)
      .attr('markerUnits', 'userSpaceOnUse')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('stroke', 'gray')
      .attr('fill', 'gray');

    markerDef = svg
      .append('defs')
      .attr('id', 'atlas-side-arrow-def-hover')
      .append('marker')
      .attr('id', 'atlas-side-arrow-hover')
      .attr('viewBox', [0, 0, 10, 10])
      .attr('refX', 10)
      .attr('refY', 5)
      .attr('markerWidth', 12)
      .attr('markerHeight', 9)
      .attr('orient', 'auto')
      .attr('stroke-width', 1)
      .attr('markerUnits', 'userSpaceOnUse')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('stroke', 'hsl(24, 95%, 59%)')
      .attr('fill', 'hsl(24, 95%, 59%)');

    // drawDonut(donut);
  };

  onMount(() => {
    // Bind drag event
    let container = d3.select(modalComponent).select('.svg-container');

    svg = container
      .select('svg.side-svg')
      .attr('viewBox', `0 0 ${svgVirtualLength} ${svgVirtualLength}`)
      .attr('width', '100%')
      .attr('height', '100%');

    drawRadial();
  });

  const getColor = (layer, head) => {
    if (
      attentionHeadColor == null ||
      attentionHeadColor.has === undefined ||
      !attentionHeadColor.has([layer, head].toString())
    ) {
      return 'black';
    } else {
      return attentionHeadColor.get([layer, head].toString());
    }
  };
</script>

<style lang="scss">
  .atlas-side {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .side-svg {
    width: 100%;
    height: 100%;
  }

  .side-title {
    font-size: 1.3em;
    cursor: default;
    pointer-events: none;
  }
</style>

<div class="atlas-side" bind:this={modalComponent}>
  <div
    class="side-title"
    style={`color: ${getColor(modalInfo.layer, modalInfo.head)}`}
  >
    Layer {modalInfo.layer + 1} Head {modalInfo.head + 1}
  </div>

  <div class="svg-container">
    <svg class="side-svg" />
  </div>
</div>
