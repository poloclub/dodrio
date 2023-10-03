<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  let graphSVG = null;
  let graphData = null;

  const SVGWidth = 800;
  const SVGHeight = 800;

  const SVGPadding = { top: 3, left: 3, right: 3, bottom: 3 };

  const minNodeRadius = 19;
  const maxNodeRadius = 40;

  const layoutOptions = {
    force: {
      value: 'force',
      name: 'Force Layout',
    },
    radial: {
      value: 'radial',
      name: 'Radial Layout',
    },
  };

  let config = {
    borderConstraint: true,
    showHiddenLink: false,
    showHiddenNode: false,
    autoAttention: true,
    defaultLayout: layoutOptions.force,
  };

  let forceStrength = { manyBody: 0, attention: 0, textOrder: 0 };

  const round = (num, decimal) => {
    return Math.round((num + Number.EPSILON) * 10 ** decimal) / 10 ** decimal;
  };

  const drag = (simulation) => {
    const dragstarted = (event) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    };

    const dragged = (event) => {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    };

    const dragended = (event) => {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    };

    return d3
      .drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  };

  const borderConstraint = (d, nodeRadiusScale) => {
    let curRadius = minNodeRadius;
    if (d.saliency !== undefined) {
      curRadius = nodeRadiusScale(+d.saliency);
    }

    let width = SVGWidth - SVGPadding.left - SVGPadding.right;
    let height = SVGWidth - SVGPadding.top - SVGPadding.bottom;

    const left = Math.max(
      SVGPadding.left + curRadius,
      Math.min(width - curRadius, d.x)
    );
    const top = Math.max(
      SVGPadding.top + curRadius,
      Math.min(height - curRadius, d.y)
    );

    if (config.borderConstraint) {
      return { top: top, left: left };
    } else {
      return { top: d.y, left: d.x };
    }
  };

  const bindCheckBox = (simulation, links) => {
    // Border checkbox
    let borderCheckBox = d3
      .select('#checkbox-border')
      .property('checked', config.borderConstraint);

    borderCheckBox.on('change', (event) => {
      config.borderConstraint = event.target.checked;
      simulation.alpha(0.2).restart();
    });

    // Hidden links
    let hiddenLinkCheckBox = d3
      .select('#checkbox-hidden-link')
      .property('checked', config.showHiddenLink);

    hiddenLinkCheckBox.on('change', (event) => {
      config.showHiddenLink = event.target.checked;
      d3.select(graphSVG)
        .select('g.text-link-group')
        .style('visibility', config.showHiddenLink ? 'visible' : 'hidden');

      d3.select(graphSVG)
        .select('g.text-hidden-link-group')
        .style('visibility', config.showHiddenLink ? 'visible' : 'hidden');
    });

    // Hidden nodes
    let hiddenNodeCheckBox = d3
      .select('#checkbox-hidden-node')
      .property('checked', config.showHiddenNode);

    hiddenNodeCheckBox.on('change', (event) => {
      config.showHiddenNode = event.target.checked;
      d3.select(graphSVG)
        .select('g.hidden-node-group')
        .style('visibility', config.showHiddenNode ? 'visible' : 'hidden');
      simulation.alpha(0.05).restart();
    });

    // Automatic attention link strength checkbox
    let autoCheckBox = d3
      .select('#checkbox-auto-attention')
      .property('checked', config.autoAttention);

    autoCheckBox.on('change', (event) => {
      config.autoAttention = event.target.checked;

      if (config.autoAttention) {
        simulation.force(
          'attentionLink',
          d3.forceLink(links).id((d) => d.id)
        );
        simulation.alpha(0.3).restart();
      } else {
        simulation.force('attentionLink').strength(forceStrength.attention);
        simulation.alpha(0.3).restart();
      }
    });
  };

  const bindSlider = (
    name,
    simulation,
    min,
    max,
    defaultValue,
    nodeRadiusScale = null
  ) => {
    let slider = d3
      .select(`#${name}`)
      .property('value', ((defaultValue - min) / (max - min)) * 1000);

    slider.on('input', () => {
      let sliderValue = +slider.property('value');
      let value = (sliderValue / 1000) * (max - min) + min;
      forceStrength[name] = value;

      switch (name) {
        case 'attention':
          simulation.force('attentionLink').strength(value);
          // Disable the auto attention
          d3.select('#checkbox-auto-attention').property('checked', false);
          config.autoAttention = false;
          break;
        case 'textOrder':
          simulation.force('textLink').strength(value);
          simulation.force('hiddenTextLink').strength(value);
          break;
        case 'manyBody':
          simulation.force('charge').strength(value);
          break;
        case 'collide':
          simulation.force('collide').radius((d) => minNodeRadius + value);
          break;
      }

      simulation.restart();
    });

    slider.on('mousedown', (event) => {
      if (!event.active) simulation.alphaTarget(0.2).restart();
    });

    slider.on('mouseup', (event) => {
      if (!event.active) simulation.alphaTarget(0);
    });
  };

  const bindSelect = () => {
    let selectOption = d3
      .select('#select-layout')
      .property('value', config.defaultLayout.value);

    selectOption.on('change', () => {
      let newLayout = selectOption.property('value');
    });
  };

  const drawGraph = () => {
    // Filter the links based on the weight
    const weightThreshold = 0.05;

    let svg = d3
      .select(graphSVG)
      .attr('width', SVGWidth)
      .attr('height', SVGHeight);

    // Add a border
    svg
      .append('rect')
      .attr('class', 'border-rect')
      .attr('width', SVGWidth)
      .attr('height', SVGHeight)
      .style('stroke', 'black')
      .style('fill', 'none');

    // Create the data lists
    let links = graphData.links.filter((d) => d.weight > weightThreshold);

    // Map nodes and links to arrays of objects
    let nodes = graphData.nodes.map((d) => Object.create(d));
    links = links.map((d) => Object.create(d));

    // Maintain a set of all existing node indices
    let nodeIndices = new Set();
    graphData.nodes.forEach((d) => nodeIndices.add(+d.id));

    // Add text order hidden links
    let hiddenLinks = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      let hiddenLink = {
        source: +nodes[i].id,
        target: +nodes[i + 1].id,
      };
      hiddenLinks.push(hiddenLink);
    }
    // hiddenLinks.push({
    //   source: +nodes[nodes.length - 1].id,
    //   target: nodes[0].id
    // });
    hiddenLinks = hiddenLinks.map((d) => Object.create(d));

    // console.log(nodes, links);

    // Add intermediate nodes to create bezier curves
    let nodeByID = new Map(nodes.map((d) => [d.id, d]));
    let bilinks = [];

    links.forEach((d) => {
      let source = nodeByID.get(d.source);
      let target = nodeByID.get(d.target);
      let intermediate = { hidden: true };

      let curBilink = [source, intermediate, target];
      curBilink.selfLoop = source === target;

      // nodes.push(intermediate);
      // links.push(
      //   {source: source, target: intermediate},
      //   {source: intermediate, target: target}
      // );

      bilinks.push(curBilink);
    });

    // Add grid links
    let gridLinks = [];
    let nodeIndexArray = Array.from(nodeIndices);
    const rowSize = 10;

    nodeIndexArray.sort((a, b) => +a - +b);
    for (let i = 0; i < nodes.length; i++) {
      if ((i % rowSize !== rowSize - 1) & nodeByID.has(i + 1)) {
        gridLinks.push({
          source: nodeByID.get(i),
          target: nodeByID.get(i + 1),
        });
      }
      if (nodeByID.has(i + rowSize)) {
        gridLinks.push({
          source: nodeByID.get(i),
          target: nodeByID.get(i + rowSize),
        });
      }
    }

    // console.log(gridLinks);

    // Create a scale for the node radius
    let allSaliencyScores = nodes.map((d) => +d.saliency);
    let nodeRadiusScale = d3
      .scaleLinear()
      .domain(d3.extent(allSaliencyScores))
      .range([minNodeRadius, maxNodeRadius])
      .nice();

    // Define the force
    let simulation = d3.forceSimulation(nodes);
    const initManyBodyStrength = -1400;
    const initAttentionStrength = 0.5;
    const initTextOrderStrength = 2;
    const initRadialStrength = 1;
    const initCollideRadius = 7;

    forceStrength.manyBody = initManyBodyStrength;
    forceStrength.attention = initAttentionStrength;
    forceStrength.textOrder = initTextOrderStrength;
    forceStrength.radial = initRadialStrength;
    forceStrength.collide = initCollideRadius;

    // Force 1 (ManyBody force)
    simulation.force(
      'charge',
      d3.forceManyBody().strength((d) => (d.selfLoop == undefined ? -200 : 0))
    );

    // Force 2 (Center force)
    simulation.force('center', d3.forceCenter(SVGWidth / 2, SVGHeight / 2));

    // Force 3 (Link force)
    // simulation.force('attentionLink', d3.forceLink(links)
    //   .id(d => d.id)
    //   //.strength(initAttentionStrength)
    // );

    // Force 4 (Text order link force)
    // simulation.force('textLink', d3.forceLink(hiddenLinks)
    //   .id(d => d.id)
    //   .strength(initTextOrderStrength)
    // );

    // Force 8 (Grid force)
    simulation.force(
      'grid',
      d3
        .forceLink(gridLinks)
        .iterations(80)
        .distance(50)
        .id((d) => d.id)
    );

    simulation.force(
      'posY',
      d3
        .forceY()
        .y((d) => (Math.floor(d.index / rowSize) * SVGHeight) / rowSize)
    );

    simulation.force(
      'posX',
      d3.forceX().x((d) => ((d.index % rowSize) * SVGWidth) / rowSize)
    );

    // Force 5 (Text order link force on hidden nodes)
    // simulation.force('hiddenTextLink', d3.forceLink(hiddenTextOrderLinks)
    //   .id(d => d.id)
    //   .strength(initTextOrderStrength)
    // );

    // Force 6 (Radial force)
    // simulation.force('charge', d3.forceCollide().radius(d => nodeRadiusScale(d.saliency) + 15))
    //   .force('radial', d3.forceRadial(300)
    //     .x(SVGWidth / 2)
    //     .y(SVGHeight / 2)
    //     .strength(initRadialStrength)
    //   );

    // Force 7 (Collide force)
    simulation.force(
      'collide',
      d3
        .forceCollide()
        .radius((d) => (d.saliency === undefined ? 0 : minNodeRadius + 10))
    );

    // Change the min alpha so that the nodes do not shake at the end (end earlier)
    // The default alphaMin is 0.0001
    simulation.alphaMin(0.001);

    // Add arrow markers
    const arrowBoxWidth = 20;
    const arrowBoxHeight = 20;
    svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', [0, 0, arrowBoxWidth, arrowBoxHeight])
      .attr('refX', arrowBoxWidth / 2)
      .attr('refY', arrowBoxHeight / 2)
      .attr('markerWidth', arrowBoxWidth)
      .attr('markerHeight', arrowBoxHeight)
      .attr('orient', 'auto-start-reverse')
      .append('path')
      .attr('d', 'M0,5 L0,15 L8,10')
      .attr('stroke', '#C2C2C2')
      .attr('fill', '#C2C2C2');

    // Add attention links
    let linkLines = svg
      .append('g')
      .attr('class', 'attention-link-group')
      .attr('stroke', '#C2C2C2')
      .selectAll('path')
      .data(bilinks)
      .join('path')
      .attr('marker-end', 'url(#arrow)')
      .attr('class', 'link');

    // Add hidden text order links
    let textLinkLines = svg
      .append('g')
      .attr('class', 'text-link-group')
      .style('visibility', config.showHiddenLink ? 'visible' : 'hidden')
      .style('stroke', 'red')
      .style('stroke-opacity', 1)
      .selectAll('line')
      .data(hiddenLinks)
      .join('line')
      .attr('class', 'link');

    // Add hidden text order links
    // let textHiddenLinkLines = svg.append('g')
    //   .attr('class', 'text-hidden-link-group')
    //   .style('visibility', config.showHiddenLink ? 'visible' : 'hidden')
    //   .style('stroke', 'blue')
    //   .style('stroke-opacity', 1)
    //   .selectAll('line')
    //   .data(hiddenTextOrderLinks)
    //   .join('line')
    //   .attr('class', 'link');

    // Add token nodes
    let nodeGroups = svg
      .append('g')
      .attr('class', 'node-group')
      .selectAll('g.node')
      // Need to filter out intermediate nodes
      .data(nodes.filter((d) => d.id !== undefined))
      .join('g')
      .attr('class', 'node')
      .attr('transform', `translate(${SVGWidth / 2}, ${SVGHeight / 2})`)
      .call(drag(simulation));

    // Add circle to each node
    // Create a color scale to represent the text order
    let colorScale = d3
      .scaleLinear()
      .domain(d3.extent(nodeIndices))
      .range([d3.rgb('#D4E5F4'), d3.rgb('#1E6CB0')]);

    nodeGroups
      .append('circle')
      .attr('class', 'node-circle')
      //.attr('r', d => nodeRadiusScale(+d.saliency))
      .attr('r', minNodeRadius)
      .style('fill', (d) => colorScale(d.id));

    // Add token text to each node
    nodeGroups
      .append('text')
      .attr('class', 'node-text')
      .text((d) => d.token);

    nodeGroups.append('title').text((d) => d.token);

    // Add hidden nodes
    let hiddenNodeGroups = svg
      .append('g')
      .attr('class', 'hidden-node-group')
      .style('visibility', config.showHiddenNode ? 'visible' : 'hidden')
      .selectAll('g.hidden-node')
      // Need to select intermediate nodes
      .data(nodes.filter((d) => d.id == undefined))
      .join('g')
      .attr('class', 'hidden-node');

    hiddenNodeGroups
      .append('circle')
      .attr('class', 'hidden-node-circle')
      .attr('r', 3)
      .style('fill', 'lightgreen');

    // Simulation tick updates
    simulation.on('tick', () => {
      // console.log('Tick');

      // Update the attention links
      linkLines.attr('d', (d) => {
        const sCoord = borderConstraint(d[0], nodeRadiusScale);
        const tCoord = borderConstraint(d[2], nodeRadiusScale);

        // We need to shorten the path to leave space for arrow
        let halfLen = Math.sqrt(
          (tCoord.left - sCoord.left) ** 2 + (tCoord.top - sCoord.top) ** 2
        );

        let theta = minNodeRadius / halfLen;
        let modTCoord = {
          left: tCoord.left + (sCoord.left - tCoord.left) * theta,
          top: tCoord.top + (sCoord.top - tCoord.top) * theta,
        };

        return (
          'M' +
          sCoord.left +
          ',' +
          sCoord.top +
          'L' +
          modTCoord.left +
          ',' +
          modTCoord.top
        );
      });

      // Update the nodes
      nodeGroups.attr('transform', (d) => {
        // Maker sure the nodes are inside the box
        const coord = borderConstraint(d, nodeRadiusScale);
        return `translate(${coord.left}, ${coord.top})`;
      });

      // Update the hidden nodes
      if (config.showHiddenNode) {
        hiddenNodeGroups.attr('transform', (d) => {
          // Maker sure the nodes are inside the box
          const coord = borderConstraint(d);
          return `translate(${coord.left}, ${coord.top})`;
        });
      }

      // Update the text links
      if (config.showHiddenLink) {
        textLinkLines
          .attr('x1', (d) => borderConstraint(d.source, nodeRadiusScale).left)
          .attr('y1', (d) => borderConstraint(d.source, nodeRadiusScale).top)
          .attr('x2', (d) => borderConstraint(d.target, nodeRadiusScale).left)
          .attr('y2', (d) => borderConstraint(d.target, nodeRadiusScale).top);

        textHiddenLinkLines
          .attr('x1', (d) => borderConstraint(d.source, nodeRadiusScale).left)
          .attr('y1', (d) => borderConstraint(d.source, nodeRadiusScale).top)
          .attr('x2', (d) => borderConstraint(d.target, nodeRadiusScale).left)
          .attr('y2', (d) => borderConstraint(d.target, nodeRadiusScale).top);
      }
    });

    // Register UI elements from the control panel
    bindSlider('attention', simulation, 0, 10, initAttentionStrength);
    bindSlider('textOrder', simulation, 0, 10, initTextOrderStrength);
    bindSlider('manyBody', simulation, -2000, 0, initManyBodyStrength);
    bindSlider(
      'collide',
      simulation,
      0,
      20,
      initCollideRadius,
      nodeRadiusScale
    );

    bindCheckBox(simulation, links);

    bindSelect();
  };

  onMount(async () => {
    console.log('loading matrix');
    graphData = await d3.json('PUBLIC_URL/data/twitter_graph_800_9_7.json');
    console.log('loaded matrix');

    drawGraph();
  });
</script>

<style lang="scss">
  .graph-view {
    display: flex;
    flex-direction: row;
  }

  .control-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-right: 50px;
  }

  .slider {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .checkbox {
    display: flex;
    flex-direction: row;
    align-items: baseline;
    margin-bottom: 5px;

    input {
      margin-right: 7px;
    }
  }

  :global(.node-circle) {
    stroke: #fff;
    stroke-width: 1.5;
  }

  :global(.node-text) {
    dominant-baseline: middle;
    text-anchor: middle;
    font-size: 10px;
    cursor: default;
  }

  :global(.link) {
    fill: none;
  }
</style>

<div class="graph-view">
  <div class="control-panel">
    <!-- Sliders -->
    <div class="slider">
      <label for="attention"
        >Attention Strength [{config.autoAttention
          ? 'auto'
          : round(forceStrength.attention, 2)}]
      </label>
      <input
        type="range"
        min="0"
        max="1000"
        value="500"
        class="slider"
        id="attention"
      />
    </div>

    <div class="slider">
      <label for="textOrder"
        >Text Order Strength [{round(forceStrength.textOrder, 2)}]</label
      >
      <input
        type="range"
        min="0"
        max="1000"
        value="500"
        class="slider"
        id="textOrder"
      />
    </div>

    <div class="slider">
      <label for="manyBody"
        >ManyBody Strength [{round(forceStrength.manyBody, 2)}]</label
      >
      <input
        type="range"
        min="0"
        max="1000"
        value="500"
        class="slider"
        id="manyBody"
      />
    </div>

    <div class="slider">
      <label for="collide"
        >Node Distance [{round(forceStrength.collide, 2)}]</label
      >
      <input
        type="range"
        min="0"
        max="1000"
        value="500"
        class="slider"
        id="collide"
      />
    </div>

    <!-- Checkboxes -->
    <div class="checkbox">
      <input type="checkbox" id="checkbox-auto-attention" />
      <label for="checkbox-auto-attention">Auto attention strength </label>
    </div>

    <div class="checkbox">
      <input type="checkbox" id="checkbox-hidden-link" />
      <label for="checkbox-hidden-link">Show hidden link</label>
    </div>

    <div class="checkbox">
      <input type="checkbox" id="checkbox-hidden-node" />
      <label for="checkbox-hidden-node">Show hidden node</label>
    </div>

    <div class="checkbox">
      <input type="checkbox" id="checkbox-border" />
      <label for="checkbox-border">Border Constraint</label>
    </div>

    <!-- Selection -->
    <div class="select">
      <select name="layout" id="select-layout">
        <option value="force">Force Layout</option>
        <option value="radial">Radial Layout</option>
      </select>
    </div>
  </div>

  <div class="svg-container">
    <svg class="graph-svg" bind:this={graphSVG} />
  </div>
</div>
