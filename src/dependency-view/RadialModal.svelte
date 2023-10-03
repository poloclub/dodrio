<script>
  import { onMount } from 'svelte';
  import { modalStore, attentionHeadColorStore } from '../store';
  import { getTokenWidth } from './utils';
  import { resetRadialButtons } from './comparison-view';
  import * as d3 from 'd3';

  let modalComponent = null;
  let svg = null;
  let donut = null;
  let svgVirtualLength = 500;
  let svgLength = 480;

  let modalInfo = {};
  let markerDef = null;

  let attentionHeadColor = new Map();
  attentionHeadColorStore.subscribe((value) => {
    attentionHeadColor = value;
  });

  modalStore.set(modalInfo);
  modalStore.subscribe((value) => {
    modalInfo = value;
    if (modalInfo.attention != null) {
      drawDonut(donut);
    }
  });

  const crossClicked = () => {
    modalInfo.show = false;
    modalStore.set(modalInfo);

    // Clean up the view
    svg.select('.donut').selectAll('*').remove();

    // Reset buttons
    resetRadialButtons();
  };

  const dragElement = (element) => {
    let pos1 = 0,
      pos2 = 0,
      pos3 = 0,
      pos4 = 0;

    const dragMouseDown = (e) => {
      pos3 = e.clientX;
      pos4 = e.clientY;

      // Register events for mouse up and mouse move
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    };

    const elementDrag = (e) => {
      // calculate the new cursor position:
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;

      // set the element's new position:
      element.style.top = element.offsetTop - pos2 + 'px';
      element.style.left = element.offsetLeft - pos1 + 'px';
    };

    const closeDragElement = () => {
      // Restore the original mouse up and mouse move
      document.onmouseup = null;
      document.onmousemove = null;

      // Remember the size and position
      modalInfo.top = element.style.top;
      modalInfo.left = element.style.left;
      modalInfo.width = element.style.width;
      modalInfo.height = element.style.height;
    };

    document.querySelector('.modal-card-head').onmousedown = dragMouseDown;
  };

  const drawDonut = (donut) => {
    // Restore the size and pos of the modal window if possible
    if (modalInfo.top !== undefined) {
      d3.select(modalComponent)
        .select('.modal-card')
        .style('top', `${modalInfo.top}px`)
        .style('left', `${modalInfo.top}px`)
        .style('width', `${modalInfo.width}px`)
        .style('height', `${modalInfo.height}px`);
    } else {
      let SVGHeight = +d3.select('.dependency-svg').attr('height');
      let SVGWidth = window.innerWidth;

      d3.select(modalComponent)
        .select('.modal-card')
        .style('top', `${(SVGHeight - 420) / 2}px`)
        .style('left', `${(SVGWidth - 380) / 2}px`);
    }

    let color = attentionHeadColor.get(
      [modalInfo.layer, modalInfo.head].toString()
    );

    svg
      .select('#atlas-arrow')
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
      .range([0.2, 0.7]);

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
        svg.select('#atlas-arrow').select('path').attr('opacity', 0.1);

        donut
          .select('.path-group')
          .selectAll('path.donut-link')
          .style('opacity', 0.5);

        donut
          .select('.path-group')
          .selectAll('path.donut-link')
          .filter((dd) => {
            return dd.source === d.id || dd.target === d.id;
          })
          .attr('marker-end', 'url(#atlas-arrow-hover)')
          .style('stroke', 'hsl(36, 100%, 55%)')
          .style('stroke-width', 3)
          .style('opacity', 1)
          .raise();
      })
      .on('mouseleave', () => {
        svg.select('#atlas-arrow').select('path').attr('opacity', null);

        donut
          .select('.path-group')
          .selectAll('path.donut-link')
          .attr('marker-end', 'url(#atlas-arrow)')
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
        svg.select('#atlas-arrow').select('path').style('opacity', 0.5);

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
          .attr('marker-end', 'url(#atlas-arrow-hover)')
          .style('stroke', 'hsl(24, 95%, 59%)')
          .style('opacity', 1)
          .style('stroke-width', 3)
          .raise();
      })
      .on('mouseleave', () => {
        svg.select('#atlas-arrow').select('path').attr('opacity', null);

        donut
          .select('.path-group')
          .selectAll('path.donut-link')
          .attr('marker-end', 'url(#atlas-arrow)')
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
      .attr('marker-end', 'url(#atlas-arrow)')
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

    // drawDonut(donut);
    markerDef = svg
      .append('defs')
      .attr('id', 'atlas-arrow-def')
      .append('marker')
      .attr('id', 'atlas-arrow')
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
      .attr('id', 'atlas-arrow-def-hover')
      .append('marker')
      .attr('id', 'atlas-arrow-hover')
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
  };

  onMount(() => {
    // Bind drag event
    let modalCard = d3.select(modalComponent).select('.modal-card');

    dragElement(modalCard.node());

    svg = modalCard
      .select('svg.modal-svg')
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
  .modal {
    pointer-events: none;
  }

  .modal-card {
    width: 380px;
    height: 420px;

    max-width: 800px;
    min-width: 340px;
    min-height: 380px;

    // width: 500px;
    resize: both;

    border: 1px solid hsla(0, 0%, 0%, 0.2);
    border-radius: 8px;
    box-shadow: 0 2px 10px hsla(0, 0%, 0%, 0.2);
    animation: modal-card-appear 200ms;

    /* Make it draggable */
    position: absolute;
    pointer-events: all;

    &-title {
      font-size: 1em;
      cursor: default;
      pointer-events: none;
    }

    &-head {
      padding: 10px 15px;
      cursor: move;
    }

    &-body {
      padding: 5px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
  }

  @keyframes modal-card-appear {
    0% {
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
  }
</style>

<div class="modal-component" bind:this={modalComponent}>
  <div class="modal" class:is-active={modalInfo.show}>
    <div class="modal-card">
      <header class="modal-card-head">
        <div
          class="modal-card-title"
          style={`color: ${getColor(modalInfo.layer, modalInfo.head)}`}
        >
          Layer {modalInfo.layer} Head {modalInfo.head} Attention Wights
        </div>
        <button class="delete" aria-label="close" on:click={crossClicked} />
      </header>

      <section class="modal-card-body">
        <svg class="modal-svg" />
      </section>
    </div>
  </div>
</div>
