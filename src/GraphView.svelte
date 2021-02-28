<script>
  import { graphViewConfigStore } from './store';
  import GraphMatrix from './GraphMatrix.svelte';
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  import { Circle } from 'svelte-loading-spinners';
  
  // Shared states
  let graphViewCompConfig = undefined;
  let instanceID = 1718;

  let graphSVG = null;
  let graphData = null;

  let SVGWidth = undefined;
  let SVGHeight = undefined;
  
  // View configs
  const rightListWidth = 180;

  const SVGPadding = {top: 3, left: 3, right: 3, bottom: 3};

  const minNodeRadius = 19;
  const maxNodeRadius = 40;
  
  const radialRadius = 300;
  const radialCurveAlpha = 3 / 5;

  const gridRowSize = 10;
  const gridRowGap = 25;
  const gridColumnGap = 20;

  // Graph vis variables
  let tokenSize = null;
  let nodes = null;
  let links = null;
  let biLinks = null;
  let hiddenLinks = null;
  let gridLinks = null;

  // Control panel variables
  let curHeadMode = 'gradient';
  let relevantAttentions = [];
  const listKIncreasement = 10;
  const initListK = 20;
  let listK = initListK;
  
  let curLayer = 3;
  let curHead = 8;
  let attentionData = undefined;
  let gradSortedIndexes = undefined;
  let semanticSortedIndexes = undefined;
  let syntacticSortedIndexes = undefined;

  // Spinner options
  let showSpinner = false;
  let lastScrollBotTime = 0;

  const ease = d3.easeCubicInOut;
  const animationTime = 300;

  const layoutOptions = {
    force: {
      value: 'force',
      name: 'Force Layout'
    },
    radial: {
      value: 'radial',
      name: 'Radial Layout'
    },
    grid: {
      value: 'grid',
      name: 'Grid Layout'
    } 
  };

  let config = {
    borderConstraint: true,
    showHiddenLink: false,
    showHiddenNode: false,
    autoAttention: true,
    defaultLayout: layoutOptions.force
  };

  let forceStrength = {
    force: {
      manyBody: -1300,
      attention: 0.5,
      textOrder: 1.6,
      collideRadius: 10
    },
    radial: {
      textOrder: 0.5,
      radial: 1
    },
    grid: {
      collideRadius: 7
    }
  };

  let currentLayout = config.defaultLayout;

  const round = (num, decimal) => {
    return Math.round((num + Number.EPSILON) * (10 ** decimal)) / (10 ** decimal);
  };

  const padZero = (num, digit) => {
    return Array(Math.max(digit - String(num).length + 1, 0)).join(0) + num;
  }

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
    
    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  };

  const borderConstraint = (d, nodeRadiusScale) => {
    let curRadius = minNodeRadius;
    if (!d.hidden) {
      curRadius = nodeRadiusScale(+d.saliency);
    }

    let width = SVGWidth - SVGPadding.left - SVGPadding.right;
    let height = SVGHeight - SVGPadding.top - SVGPadding.bottom;

    const left = Math.max(SVGPadding.left + curRadius, Math.min(width - curRadius, d.x));
    const top = Math.max(SVGPadding.top + curRadius, Math.min(height - curRadius, d.y));

    if (config.borderConstraint) {
      return {top: top, left: left};
    } else {
      return {top: d.y, left: d.x};
    }
  };

  const bindCheckBox = (simulation, links) => {
    // Border checkbox
    let borderCheckBox = d3.select('#checkbox-border')
      .property('checked', config.borderConstraint);

    borderCheckBox.on('change', (event) => {
      config.borderConstraint = event.target.checked;
      simulation.alpha(0.2).restart();
    });

    // Hidden links
    let hiddenLinkCheckBox = d3.select('#checkbox-hidden-link')
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
    let hiddenNodeCheckBox = d3.select('#checkbox-hidden-node')
      .property('checked', config.showHiddenNode);
    
    hiddenNodeCheckBox.on('change', (event) => {
      config.showHiddenNode = event.target.checked;
      d3.select(graphSVG)
        .select('g.hidden-node-group')
        .style('visibility', config.showHiddenNode ? 'visible' : 'hidden');
      simulation.alpha(0.05).restart();
    });

    // Automatic attention link strength checkbox
    let autoCheckBox = d3.select('#checkbox-auto-attention')
      .property('checked', config.autoAttention);
    
    autoCheckBox.on('change', (event) => {
      config.autoAttention = event.target.checked;

      if (config.autoAttention) {
        simulation.force('attentionLink', d3.forceLink(links)
          .id(d => d.id));
        simulation.alpha(0.3).restart();
      } else {
        simulation.force('attentionLink')
          .strength(forceStrength.attention);
        simulation.alpha(0.3).restart();
      }
    });

  };

  const bindSlider = (name, simulation, min, max, defaultValue, nodeRadiusScale=null) => {
    let slider = d3.select(`#${name}`)
      .property('value', ((defaultValue - min) / (max - min)) * 1000);

    slider.on('input', () => {
      let sliderValue = +slider.property('value');
      let value = (sliderValue / 1000) * (max - min) + min;
      forceStrength.force[name] = value;

      switch (name) {
      case 'attention':
        simulation.force('attentionLink').strength(value);
        // Disable the auto attention
        d3.select('#checkbox-auto-attention')
          .property('checked', false);
        config.autoAttention = false;
        break;
      case 'textOrder':
        simulation.force('textLink').strength(d => d.target.index === 0 ? 0 : value);
        break;
      case 'manyBody':
        simulation.force('charge').strength(value);
        break;
      case 'collideRadius':
        simulation.force('collide').radius(d => nodeRadiusScale(d.saliency) + value);
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

  const resetSimulation = (simulation) => {
    simulation.force('collide', null);
    simulation.force('attentionLink', null);
    simulation.force('charge', null);
    simulation.force('center', null);
    simulation.force('textLink', null);
    simulation.force('hiddenTextLink', null);
    simulation.force('posX', null);
    simulation.force('posY', null);
    simulation.force('grid', null);
  };

  const bindSelect = (simulation, nodeRadiusScale, nodeGroups) => {

    currentLayout = config.defaultLayout;
    let selectOption = d3.select('#select-layout')
      .property('value', config.defaultLayout.value);

    selectOption.on('change', () => {
      let newLayoutValue = selectOption.property('value');

      // Need to switch layout
      if (newLayoutValue !== currentLayout.value) {
        resetSimulation(simulation);

        switch(newLayoutValue) {
        case 'force':
          currentLayout = layoutOptions.force;
          initForceSim(simulation, nodeRadiusScale);
          simulation.alpha(1).restart();
          break;

        case 'radial':
          currentLayout = layoutOptions.radial;
          initRadialSim(simulation);
          simulation.alpha(0.6).restart();
          break;

        case 'grid':
          currentLayout = layoutOptions.grid;
          initGridSim(simulation);
          simulation.alpha(1).restart();
          break;
        }

        updateNodeRadius(nodeGroups, nodeRadiusScale);
      }
    });
  };

  const updateNodeRadius = (nodeGroups, nodeRadiusScale) => {
    nodeGroups.selectAll('circle')
      .transition('node-radius')
      .duration(animationTime)
      .ease(ease)
      .attr('r', d => currentLayout.value === 'force' ?
        nodeRadiusScale(+d.saliency) : minNodeRadius);
  };

  const initForceSim = (simulation, nodeRadiusScale) => {
    // Force 1 (ManyBody force)
    simulation.force('charge', d3.forceManyBody()
      .strength(forceStrength.force.manyBody)
    );

    // Force 2 (Center force)
    simulation.force('center', d3.forceCenter(SVGWidth / 2, SVGHeight / 2));

    // Force 3 (Link force)
    simulation.force('attentionLink', d3.forceLink(links)
      .id(d => d.id)
    );
    
    // Force 4 (Text order link force)
    simulation.force('textLink', d3.forceLink(hiddenLinks)
      .id(d => d.id)
      .strength(d => d.target.index === 0 ? 0 : forceStrength.force.textOrder)
    );
    
    // Force 5 (Collide force)
    simulation.force('collide', d3.forceCollide()
      .radius(d => nodeRadiusScale(d.saliency) + forceStrength.force.collideRadius)
    );
  };

  const initRadialSim = (simulation) => {
    // Force 1 (Tex order link force)
    simulation.force('textLink', d3.forceLink(hiddenLinks)
      .id(d => d.id)
      .strength(forceStrength.radial.textOrder)
    );

    // Force 2 (Custom radial force)
    simulation.force('posY', d3.forceY()
      .y((d, i) => {
        let curLen = nodes.filter(d => !d.hidden).length;
        let curAngle = -Math.PI / 2 + i * (Math.PI * 2 / curLen);
        return SVGHeight / 2 + Math.sin(curAngle) * radialRadius;
      })
      .strength(forceStrength.radial.radial)
    );

    simulation.force('posX', d3.forceX()
      .x((d, i) => {
        let curLen = nodes.filter(d => !d.hidden).length;
        let curAngle = -Math.PI / 2 + i * (Math.PI * 2 / curLen);
        return SVGHeight / 2 + Math.cos(curAngle) * radialRadius;
      })
      .strength(forceStrength.radial.radial)
    );
  };

  const initGridSim = (simulation) => {
    const gridColumnSize = Math.ceil(tokenSize / gridRowSize);

    let rowLength = gridRowSize * 2 * minNodeRadius + (gridRowSize - 1) * gridColumnGap;
    let columnLength = gridColumnSize * 2 * minNodeRadius + (gridColumnSize - 1) * gridRowGap;

    let xs = Math.floor((SVGWidth - rowLength) / 2);
    let ys = Math.floor((SVGHeight - columnLength) / 2);

    // Force 3 (Grid force)
    simulation.force('grid', d3.forceLink(gridLinks)
      .iterations(80)
      .distance(50)
      .id(d => d.id)
    );

    // Force 4 (Orientation force)
    simulation.force('posX', d3.forceX()
      .x((d, i) => xs + (i % gridRowSize) * (2 * minNodeRadius + gridColumnGap) + minNodeRadius)
      .strength(d => d.id === undefined ? 0 : 1)
    );

    simulation.force('posY', d3.forceY()
      .y((d, i) => ys + Math.floor(i / gridRowSize) * (2 * minNodeRadius + gridRowGap) + minNodeRadius)
      .strength(d => d.id === undefined ? 0 : 1)
    );
  };

  const initCurrentSim = (simulation, nodeRadiusScale) => {
    switch(currentLayout.value) {
    case 'force':
      initForceSim(simulation, nodeRadiusScale);
      break;
    case 'radial':
      initRadialSim(simulation);
      break;
    case 'grid':
      initGridSim(simulation);
      break;
    }
  };
  
  const tickLinkForce = (d, nodeRadiusScale) => {
    const sCoord = borderConstraint(d[0], nodeRadiusScale);
    const tCoord = borderConstraint(d[1], nodeRadiusScale);

    if (d.selfLoop) {
      const iCoord = borderConstraint(d[2], nodeRadiusScale);

      // Shorten the distance from source to intermediate point
      let interLen = Math.sqrt((tCoord.left - iCoord.left) ** 2 +
        (tCoord.top - iCoord.top) ** 2) - nodeRadiusScale(d[0].saliency);

      iCoord.left = tCoord.left + (iCoord.left - tCoord.left) / interLen * 80;
      iCoord.top = tCoord.top + (iCoord.top - tCoord.top) / interLen * 80;

      // Need to handle the arc manually if there is a self loop
      const iVec = [iCoord.left - sCoord.left, iCoord.top - sCoord.top];
      const iVecNorm = Math.sqrt((iVec[0] ** 2 + iVec[1] ** 2));

      // Rotate 90 degree
      // Normalized the rotate direction, use alpha to control magnitude
      const alpha = 50;
      const iVecClock90 = [-iVec[1] / iVecNorm * alpha, iVec[0] / iVecNorm * alpha];
      const iVecCounterClock90 = [iVec[1] / iVecNorm * alpha, -iVec[0] / iVecNorm * alpha];

      const leftControl = [sCoord.left + iVec[0] + iVecClock90[0],
        sCoord.top + iVec[1] + iVecClock90[1]];
      const rightControl = [sCoord.left + iVec[0] + iVecCounterClock90[0],
        sCoord.top + iVec[1] + iVecCounterClock90[1]];

      // We need to shorten the path to leave space for arrow
      let halfLen = Math.sqrt((tCoord.left - rightControl[0]) ** 2 + (tCoord.top - rightControl[1]) ** 2);
      let theta = (nodeRadiusScale(d[0].saliency) + 10)/ halfLen;
      let modTCoord = {
        left: tCoord.left + (rightControl[0] - tCoord.left) * theta,
        top: tCoord.top + (rightControl[1] - tCoord.top) * theta,
      };

      // Draw a bezier curve with two control points (which are left and right
      // perpendicular to the self loop node -> intermediate node vector)
      return 'M' + sCoord.left + ',' + sCoord.top
        + 'C' + leftControl[0] + ',' + leftControl[1]
        + ' ' + rightControl[0] + ',' + rightControl[1]
        + ' ' + modTCoord.left + ',' + modTCoord.top;

    } else {
      // We need to shorten the path to leave space for arrow
      let vecLen = Math.sqrt((tCoord.left - sCoord.left) ** 2 + (tCoord.top - sCoord.top) ** 2);
      let theta = (nodeRadiusScale(d[1].saliency) + 10) / vecLen;
      let modTCoord = {
        left: tCoord.left + (sCoord.left  - tCoord.left) * theta,
        top: tCoord.top + (sCoord.top - tCoord.top) * theta,
      };
      return 'M' + sCoord.left + ',' + sCoord.top + 'L' + modTCoord.left + ',' + modTCoord.top;
    }
  };

  const tickNodeForce = (d, nodeRadiusScale) => {
    // Maker sure the nodes are inside the box
    const coord = borderConstraint(d, nodeRadiusScale);
    return `translate(${coord.left}, ${coord.top})`;
  };

  const tickLinkRadial = (d, nodeRadiusScale) => {
    const sCoord = borderConstraint(d[0], nodeRadiusScale);
    const tCoord = borderConstraint(d[1], nodeRadiusScale);

    let source = {x: sCoord.left, y: sCoord.top};
    let target = {x: tCoord.left, y: tCoord.top};
    let center = {x: SVGWidth / 2, y: SVGHeight / 2};

    // We need to shorten the path to leave space for arrow
    let theta = 1 - (minNodeRadius + 10) / radialRadius;
    let modTarget = {
      x: center.x + (target.x - center.x) * theta,
      y: center.y + (target.y - center.y) * theta,
    };

    let modSource = {
      x: center.x + (source.x - center.x) * theta,
      y: center.y + (source.y - center.y) * theta,
    };
    
    // Two control points symmetric regarding the center point
    let controlP1 = {
      x: center.x + (modSource.x - center.x) * radialCurveAlpha,
      y: center.y + (modSource.y - center.x) * radialCurveAlpha
    };

    let controlP2 = {
      x: center.x + (modTarget.x - center.x) * radialCurveAlpha,
      y: center.y + (modTarget.y - center.x) * radialCurveAlpha
    };

    return `M ${modSource.x},${modSource.y} C${controlP1.x}, ${controlP1.y},
      ${controlP2.x}, ${controlP2.y}, ${modTarget.x},${modTarget.y}`;
  };
  
  const tickLinkGrid = (d, nodeRadiusScale) => {
    const sCoord = borderConstraint(d[0], nodeRadiusScale);
    const tCoord = borderConstraint(d[1], nodeRadiusScale);

    // We need to shorten the path to leave space for arrow
    let halfLen = Math.sqrt((tCoord.left - sCoord.left) ** 2 + (tCoord.top - sCoord.top) ** 2);

    let theta = (minNodeRadius + 10) / halfLen;
    let modTCoord = {
      left: tCoord.left + (sCoord.left - tCoord.left) * theta,
      top: tCoord.top + (sCoord.top - tCoord.top) * theta,
    };

    return 'M' + sCoord.left + ',' + sCoord.top
      + 'L' + modTCoord.left + ',' + modTCoord.top;
  };

  const drawGraph = () => {
    // Filter the links based on the weight
    const weightThreshold = 0.05;

    let svg = d3.select(graphSVG)
      .attr('width', SVGWidth)
      .attr('height', SVGHeight);

    // Add a border
    svg.append('rect')
      .attr('class', 'border-rect')
      .attr('width', SVGWidth)
      .attr('height', SVGHeight)
      .style('stroke', 'black')
      .style('fill', 'none');

    // Create the data lists
    links = graphData.links.filter(d => d.weight > weightThreshold);
    links = links.map(d => Object.create(d));

    // Map nodes and links to arrays of objects
    nodes = graphData.nodes.map(d => Object.create(d));
    nodes.sort((a, b) => +a.id - +b.id);

    // Maintain a set of all existing node indices
    let nodeIndices = new Set();
    graphData.nodes.forEach(d => nodeIndices.add(+d.id));
    let nodeIndexArray = Array.from(nodeIndices);
    tokenSize = nodeIndexArray.length;

    // Add text order hidden links
    hiddenLinks = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      let hiddenLink = {
        source: +nodes[i].id,
        target: +nodes[i + 1].id
      };
      hiddenLinks.push(hiddenLink);
    }

    // Add a connection between the first and last token
    hiddenLinks.push({
      source: +nodes[nodes.length - 1].id,
      target: nodes[0].id
    });

    hiddenLinks = hiddenLinks.map(d => Object.create(d));
    
    console.log(nodes, links, hiddenLinks);

    // Add intermediate nodes to create bezier curves
    let nodeByID = new Map(nodes.map(d => [d.id, d]));
    biLinks = [];

    links.forEach(d => {
      let source = nodeByID.get(d.source);
      let target = nodeByID.get(d.target);
      let curBilink = [source, target];
      curBilink.selfLoop = false;
      curBilink.attention = +d.weight;

      // Add a hidden node if there is a self-loop
      if (source === target) {
        curBilink.selfLoop = true;
        let intermediate = {hidden: true};
        curBilink.push(intermediate);
        nodes.push(intermediate);
        links.push(
          {source: intermediate, target: source}
        );
      }

      biLinks.push(curBilink);
    });
    
    // Create grid links
    gridLinks = [];
    nodeIndexArray.sort((a, b) => +a - +b);
    for (let i = 0; i < nodes.length; i++) {
      if (i % gridRowSize !== gridRowSize - 1 & nodeByID.has(i + 1)) {
        gridLinks.push({source: nodeByID.get(i), target: nodeByID.get(i + 1)});
      }
      if (nodeByID.has(i + gridRowSize)) {
        gridLinks.push({source: nodeByID.get(i), target: nodeByID.get(i + gridRowSize)});
      }
    }

    console.log(gridLinks);

    // Create a scale for the node radius
    let allSaliencyScores = nodes.map(d => +d.saliency);
    let nodeRadiusScale = d3.scaleLinear()
      .domain(d3.extent(allSaliencyScores))
      .range([minNodeRadius, maxNodeRadius])
      .unknown(0)
      .nice();

    // Create a scale for link stroke width
    let attentionWeights = links.map(d => +d.weight);
    let linkWidth = d3.scaleLinear()
      .domain(d3.extent(attentionWeights))
      .range([0.5, 2.5])
      .nice();
    
    // Define the force
    let simulation = d3.forceSimulation(nodes);

    switch(currentLayout.value) {
    case 'force':
      initForceSim(simulation, nodeRadiusScale);
      break;
    case 'radial':
      initRadialSim(simulation);
      break;
    case 'grid':
      initGridSim(simulation);
      break;
    }

    // Change the min alpha so that the nodes do not shake at the end (end earlier)
    // The default alphaMin is 0.0001
    simulation.alphaMin(0.001);

    // Add arrow markers
    svg.append('defs')
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', [0, 0, 10, 10])
      .attr('refX', 0)
      .attr('refY', 5)
      .attr('markerWidth', 12)
      .attr('markerHeight', 9)
      .attr('orient', 'auto')
      .attr('stroke-width', 1)
      .attr('markerUnits', 'userSpaceOnUse')
      .append('path')
      //.attr('d', 'M0,5 L0,15 L8,10')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('stroke', '#C2C2C2')
      .attr('fill', '#C2C2C2');

    // Add attention links
    let linkLineGroup = svg.append('g')
      .attr('class', 'attention-link-group')
      .attr('stroke', '#C2C2C2');

    let linkLines = linkLineGroup.selectAll('path')
      .data(biLinks, d => `${d[0].id}-${d[1].id}`)
      .join('path')
      .attr('marker-end', 'url(#arrow)')
      .attr('class', 'link')
      .attr('data-name', d => `${d[0].id}-${d[1].id}`)
      .style('stroke-width', d => linkWidth(d.attention));

    // Add hidden text order links
    let textLinkLines = svg.append('g')
      .attr('class', 'text-link-group')
      .style('visibility', config.showHiddenLink ? 'visible' : 'hidden')
      .style('stroke', 'red')
      .style('stroke-opacity', 1)
      .selectAll('line')
      .data(hiddenLinks)
      .join('line')
      .attr('class', 'link');

    // Add token nodes
    let nodeGroup = svg.append('g')
      .attr('class', 'node-group');

    let nodeGroups = nodeGroup.selectAll('g.node')
      // Need to filter out intermediate nodes
      .data(nodes.filter(d => d.id !== undefined), d => d.id)
      .join('g')
      .attr('class', 'node')
      .attr('transform', `translate(${SVGWidth / 2}, ${SVGHeight / 2})`)
      .call(drag(simulation))
      .on('dblclick', e => {
        let curNode = d3.select(e.target);
        let curID = curNode.data()[0].id;

        // Delete the node from the nodes array
        for (let i = nodes.length - 1; i >= 0; i--) {
          if (nodes[i].id === curID) {
            nodes.splice(i, 1);
          }
        }

        // Remove the node element on screen
        nodeGroup.selectAll('g.node')
          .data(nodes.filter(d => d.id !== undefined), d => d.id)
          .exit()
          .remove();

        // Delete all links connecting to this node
        for (let i = biLinks.length - 1; i >= 0; i--) {
          if (biLinks[i][0].id === curID | biLinks[i][1].id === curID) {
            biLinks.splice(i, 1);
          }
        }

        // Delete all attention links connecting to this node
        for (let i = links.length - 1; i >= 0; i--) {
          if (links[i].source.id === curID | links[i].target.id === curID) {
            links.splice(i, 1);
          }
        }

        // Rewire the text order link array
        for (let i = hiddenLinks.length - 1; i >= 0; i--) {
          if (hiddenLinks[i].source.id === curID) {
            hiddenLinks.splice(i, 1);
          } else if (hiddenLinks[i].target.id === curID) {
            if (i + 1 < hiddenLinks.length) {
              hiddenLinks[i].target = hiddenLinks[i + 1].source;
            } else {
              hiddenLinks[i].target = hiddenLinks[0].source;
            }
          }
        }

        // Need to reconstruct the grid links
        gridLinks = [];
        nodeIndices = new Set();
        nodes.forEach(d => {if (d.id !== undefined) nodeIndices.add(+d.id);});
        nodeIndexArray = Array.from(nodeIndices);
        nodeIndexArray.sort((a, b) => +a - +b);

        for (let i = 0; i < nodeIndexArray.length - 1; i++) {
          let curI = nodeIndexArray[i];
          if (i % gridRowSize !== gridRowSize - 1 & nodeByID.has(nodeIndexArray[i + 1])) {
            gridLinks.push({source: nodeByID.get(curI),
              target: nodeByID.get(nodeIndexArray[i + 1])});
          }
          if (nodeByID.has(nodeIndexArray[i + gridRowSize])) {
            gridLinks.push({source: nodeByID.get(curI),
              target: nodeByID.get(nodeIndexArray[i + gridRowSize])});
          }
        }

        linkLineGroup.selectAll('path.link')
          .data(biLinks, d => `${d[0].id}-${d[1].id}`)
          .exit()
          .remove();

        initCurrentSim(simulation, nodeRadiusScale);
        simulation.alpha(0.3).restart();
      });

    // Add circle to each node
    // Create a color scale to represent the text order
    let colorScale = d3.scaleLinear()
      .domain(d3.extent(nodeIndices))
      .range([d3.rgb('#D4E5F4'), d3.rgb('#1E6CB0')]);
    
    nodeGroups.append('circle')
      .attr('class', 'node-circle')
      .attr('r', d => currentLayout.value === 'force' ?
        nodeRadiusScale(+d.saliency) : minNodeRadius)
      .style('fill', d => colorScale(d.id))
      .style('opacity', 1);
    
    // Add token text to each node
    nodeGroups.append('text')
      .attr('class', 'node-text')
      .text(d => d.token);

    nodeGroups.append('title')
      .text(d => d.token);

    // Add hidden nodes
    let hiddenNodeGroups = svg.append('g')
      .attr('class', 'hidden-node-group')
      .style('visibility', config.showHiddenNode ? 'visible' : 'hidden')
      .selectAll('g.hidden-node')
      // Need to select intermediate nodes
      .data(nodes.filter(d => d.id == undefined))
      .join('g')
      .attr('class', 'hidden-node');

    hiddenNodeGroups.append('circle')
      .attr('class', 'hidden-node-circle')
      .attr('r', 3)
      .style('fill', 'lightgreen');

    // Simulation tick updates
    simulation.on('tick', () => {
      console.log('Tick');

      // Update the attention links
      switch (currentLayout.value) {
      case 'force':
        linkLines.attr('d', d => tickLinkForce(d, nodeRadiusScale));
        break;
      case 'radial':
        linkLines.attr('d', d => tickLinkRadial(d, nodeRadiusScale));
        break;
      case 'grid':
        linkLines.attr('d', d => tickLinkGrid(d, nodeRadiusScale));
        break;
      default:
        console.log('Unexpected case.');
      }

      // Update the nodes
      nodeGroups.attr('transform', d => tickNodeForce(d, nodeRadiusScale));

      // Update the hidden nodes
      if (config.showHiddenNode) {
        hiddenNodeGroups.attr('transform', d => tickNodeForce(d, nodeRadiusScale));
      }

      // Update the text links
      if (config.showHiddenLink) {
        textLinkLines
          .attr('x1', d => borderConstraint(d.source, nodeRadiusScale).left)
          .attr('y1', d => borderConstraint(d.source, nodeRadiusScale).top)
          .attr('x2', d => borderConstraint(d.target, nodeRadiusScale).left)
          .attr('y2', d => borderConstraint(d.target, nodeRadiusScale).top);
      }
    });

    // Register UI elements from the control panel
    bindSlider('attention', simulation, 0, 10, forceStrength.force.attention);
    bindSlider('textOrder', simulation, 0, 10, forceStrength.force.textOrder);
    bindSlider('manyBody', simulation, -2000, 0, forceStrength.force.manyBody);
    bindSlider('collideRadius', simulation, 0, 20, forceStrength.force.collideRadius, nodeRadiusScale);

    bindCheckBox(simulation, links);

    bindSelect(simulation, nodeRadiusScale, nodeGroups);
  };

  const renderGraph = async () => {
    console.log('loading matrix');
    graphData = await d3.json('/data/twitter_graph_800_9_7.json');
    console.log('loaded matrix');

    drawGraph();
  };

  graphViewConfigStore.subscribe(value => {
    if (value.compHeight !== undefined && value.compWidth !== undefined){
      if (graphViewCompConfig === undefined ||
        (graphViewCompConfig.compHeight !== value.compHeight &&
        graphViewCompConfig.compWidth !== value.compWidth)
      ){
        // Update the height and width
        graphViewCompConfig = value;
        SVGHeight = graphViewCompConfig.compHeight;
        SVGWidth = graphViewCompConfig.compWidth - rightListWidth;
        renderGraph();
      }
    }
  });

  const headModeClicked = (e) => {
    let newMode = e.target.dataset.mode;
    if (newMode !== curHeadMode) {
      curHeadMode = newMode;
    }
  };

  /**
   * Load attention matrices from files.
   */
  const loadAttentionMatrix = () => {
    // Compute the current indexes based on the current mode
    let indexes = [];
    switch (curHeadMode) {
    case 'gradient':
      for (let i = 0; i < Math.min(listK, gradSortedIndexes.length); i++) {
        indexes.push(gradSortedIndexes[i][1]);
      }
      break;
    case 'semantic':
      break;
    case 'syntactic':
      break;
    }

    // Collect attention matrices based on the sorted index
    let relevantAttentions = [];
    indexes.forEach(d => {
      let curLayer = d[0];
      let curHead = d[1];
      relevantAttentions.push({
        attention: attentionData[curLayer][curHead].slice(0, tokenSize).map(
          d => d.slice(0, tokenSize)
        ),
        layer: curLayer,
        head: curHead
      });
    });

    return relevantAttentions;
  };

  const listItemClicked = (layer, head) => {
    curLayer = layer;
    curHead = head;
    console.log(curLayer, curHead);
  };

  const listScrolled = (e) => {
    let listElem = e.target;

    // Check if users have reached the bottom of the list
    // Check the time of last scrolling to bottom to avoid double counting
    if (listElem.scrollTop + listElem.offsetHeight === listElem.scrollHeight){
      
      let curTime = new Date().getTime();
      if (curTime - lastScrollBotTime > 800) {
        lastScrollBotTime = curTime;
        
        console.log(listK);
        if (listK < gradSortedIndexes.length) {
          // Load more heads to the list
          listK += listKIncreasement;
          showSpinner = true;
          d3.timeout(() => {
            relevantAttentions = loadAttentionMatrix();
            showSpinner = false;
          }, 500);
        }
      }
    }
  };

  onMount(async() => {
    attentionData = await d3.json(`/data/twitter-attention-data/attention-${padZero(instanceID, 4)}.json`);
    gradSortedIndexes = await d3.json('/data/twitter-sorted-grad-heads.json');
    gradSortedIndexes = gradSortedIndexes[instanceID];
    relevantAttentions = loadAttentionMatrix();
  });


</script>

<style type="text/scss">
  @import 'define';

  .graph-view {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100%;
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

  :global(.border-rect) {
    display: none;
  }

  .list {
    background: hsl(0, 0%, 98%);
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 0 0 0 0;
    overflow-y: hidden;
    overflow-x: hidden;
    border-left: 1px solid $gray-border;
  }

  .list-title {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px 5px 10px 5px;
    position: sticky;
    top: 0px;
    width: 100%;
    background: hsl(0, 0%, 98%);
    border-bottom: 1px solid $gray-border;
    font-size: 0.93rem;
    cursor: default;
  }

  .list-title-text {
    font-size: 1.1rem;
    margin-bottom: 5px;
  }

  .list-title-icons {
    display: flex;
    flex-direction: row;

    :not(:last-child) {
      margin-right: 10px;
    }
  }

  .icon-wrapper {
    width: 20px;
    height: 20px;
    border-radius: 20%;
    display: flex;
    justify-content: center;
    align-items: center;
    border: 2px solid hsla(0, 0%, 60%, 50%);
    font-size: 12px;
    cursor: pointer;
    color: hsl(0, 0%, 60%, 80%);

    &.active {
      color: $blue-icon;
      border: 2px solid $blue-icon;
    }

    :global(svg) {
      pointer-events: none;
    }
  }

  .list-items {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    overflow-y: scroll;
    overflow-x: hidden;
    padding-bottom: 10px;
  }

  .list-item {
    padding: 14px 0 6px 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    width: 100%;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 80ms ease-in-out;

    &:hover {
      background: hsla(0, 0%, 0%, 0.05);
    }

    &.selected {
      background: hsla(0, 0%, 0%, 0.1);
    }
  }

  .spinner-container {
    padding: 10px 0 10px 0;
    position: relative;
  }

  .paused {
    visibility: hidden;
    
    :global(.circle) {
      animation-play-state: paused;
    }
  }
  
  .svg-container {
    position: relative;
  }

  .svg-control-panel {
    position: absolute;
    top: 0;
    left: 0;
    // width: 100px;
    // height: 40px;

    display: flex;
    flex-direction: column;
    align-items: center;;
    justify-content: flex-start;

    font-size: 0.9rem;
    border-radius: 5px;
    border: 1px solid hsl(0, 0%, 93.3%);
    box-shadow: 0 3px 3px hsla(0, 0%, 0%, 0.05);
    background: hsla(0, 0%, 100%, 0.85);

    .name {
      font-size: 0.9rem;
      padding: 5px 10px;
    }

    .drop-down {
      font-size: 0.9rem;
      padding: 5px 10px;
    }
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
    margin-left: 0.5em;
  }

  select {
    background: inherit;
    border-color: hsla(0, 0%, 0%, 0);
    padding: 0 1em 0 0.4em;
  }

  .select:not(.is-multiple):not(.is-loading)::after{
    right: 0.2em;
    border-color: $blue-icon;
  }

  .select-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
  }

  .setting-icon {
    padding: 0.1em 0.3em;
    margin: 0 0.2em;
    font-size: 1.1em;
    color: $blue-icon;
    cursor: pointer;
    //margin-left: -0.5em;

    &:hover {
      background: change-color($blue-icon, $alpha: 0.1);
    }
  }

  .slider-container {
    font-size: 0.9em;
    padding: 5px 15px 0 15px;

    input {
      width: 130px;
    }

    .sep-line-horizontal {
      width: 70%;
      margin: 3px 0 10px 0;
    }
  }

  .slider-title {
    color: change-color(black, $alpha: 0.5);
  }

  .slider-text {
    display: flex;
    flex-direction: row;

    label {
      margin-right: 5px;
    }
  }

  .slider-value {
    border-radius: 3px;
    padding: 0 3px;
    background: change-color($blue-icon, $alpha: 0.2);
    color: change-color($blue-icon, $lightness: 40%);
  }

</style>


<div class='graph-view'>

  <div class='svg-container'>
    <!-- Control panel on top of the SVG -->
    <div class='svg-control-panel'>
      <div class='name'>
        Layer {2} Head {2}
      </div>

      <div class='sep-line-horizontal'></div>

      <div class='select-row'>
        <div class='select'>
          <select name='layout' id='select-layout'>
            {#each Object.values(layoutOptions) as opt}
              <option value={opt.value}>{opt.name}</option>
            {/each}
          </select>
        </div>

        <div class='sep-line-vertical'></div>

        <div class='setting-icon'><i class="fas fa-sliders-h"></i></div>
      </div>

      <div class='sep-line-horizontal'></div>

      <div class='slider-container'>

        <div class='slider'>
          <div class='slider-title'>Edge Force</div>

          <div class='sep-line-horizontal'></div>

          <div class='slider-text'>
            <label for='attention'>Attention</label>
            <div class='slider-value'>
              {config.autoAttention ? 'auto' : round(forceStrength.force.attention, 2)}
            </div>
          </div>

          <input type="range" min="0" max="1000" value="500" class="slider" id="attention">
        </div>

        <div class='slider'>

          <div class='slider-text'>
            <label for='textOrder'>Text Order</label>
            <div class='slider-value'>
              {round(forceStrength.force.textOrder, 2)}
            </div>
          </div>

          <input type="range" min="0" max="1000" value="500" class="slider" id="textOrder">
        </div>

        <div class='slider'>

          <div class='slider-text'>
            <label for='manyBody'>ManyBody</label>
            <div class='slider-value'>
              {round(forceStrength.force.manyBody, 2)}
            </div>
          </div>

          <input type="range" min="0" max="1000" value="500" class="slider" id="manyBody">
        </div>

        <div class='slider'>

          <div class='slider-text'>
            <label for='collide'>Node Distance</label>
            <div class='slider-value'>
              {round(forceStrength.force.collideRadius, 2)}
            </div>
          </div>

          <input type="range" min="0" max="1000" value="500" class="slider" id="collideRadius">
        </div>
      </div>


    </div>


    <svg class='graph-svg' bind:this={graphSVG}></svg>
  </div>

  <div class='list' style='width: {rightListWidth + 'px'};'>

    <div class='list-title'>
      <div class='list-title-text'>
        Relevant Heads
      </div>

      <div class='list-title-icons'>
        <div class='icon-wrapper active' title='Sorted by semantics'
          data-mode='semantic'
          on:click={headModeClicked}
        >
          <i class="fas fa-lightbulb"></i> 
        </div>

        <div class='icon-wrapper' title='Sorted by syntactic'
          data-mode='syntactic'
          on:click={headModeClicked}
        >
          <i class="fas fa-font"></i> 
        </div>

        <div class='icon-wrapper' title='Sorted by gradients'
          on:click={headModeClicked}
          data-mode='gradient'
        >
          <i class="fas fa-adjust"></i> 
        </div>
      </div>

    </div>

    <div class='list-items' on:scroll={listScrolled}>

      {#each relevantAttentions as item}
        <div class='list-item'
          class:selected={item.layer === curLayer && item.head === curHead}
          on:click={() => listItemClicked(item.layer, item.head)}
        >
          <GraphMatrix curAttention={item.attention}/>
          <div class='list-item-text'>
            Layer {item.layer} Head {item.head}
          </div>
        </div>
      {/each}

      <div class='spinner-container' class:paused={!showSpinner}>
        <Circle size="25" color="hsl(205, 87%, 61%)" unit="px" duration="1s" />
      </div>

    </div>
  </div>

</div>

  <!-- <div class='control-panel'>
    <!- - Sliders - ->
    <div class='slider'>
      <label for='attention'>Attention Strength
        [{config.autoAttention ? 'auto' : round(forceStrength.force.attention, 2)}]
      </label>
      <input type="range" min="0" max="1000" value="500" class="slider" id="attention">
    </div>

    <div class='slider'>
      <label for='textOrder'>Text Order Strength [{round(forceStrength.force.textOrder, 2)}]</label>
      <input type="range" min="0" max="1000" value="500" class="slider" id="textOrder">
    </div>

    <div class='slider'>
      <label for='manyBody'>ManyBody Strength [{round(forceStrength.force.manyBody, 2)}]</label>
      <input type="range" min="0" max="1000" value="500" class="slider" id="manyBody">
    </div>

    <div class='slider'>
      <label for='collide'>Node Distance [{round(forceStrength.force.collideRadius, 2)}]</label>
      <input type="range" min="0" max="1000" value="500" class="slider" id="collideRadius">
    </div>

    <!- - Checkboxes - ->
    <div class='checkbox'>
      <input type="checkbox" id="checkbox-auto-attention">
      <label for="checkbox-auto-attention">Auto attention strength </label>
    </div>

    <div class='checkbox'>
      <input type="checkbox" id="checkbox-hidden-link">
      <label for="checkbox-hidden-link">Show hidden link</label>
    </div>

    <div class='checkbox'>
      <input type="checkbox" id="checkbox-hidden-node">
      <label for="checkbox-hidden-node">Show hidden node</label>
    </div>

    <div class='checkbox'>
      <input type="checkbox" id="checkbox-border">
      <label for="checkbox-border">Border Constraint</label>
    </div>
    
    <!- - Selection - ->
    <div class='select'>
      <select name='layout' id='select-layout'>
        {#each Object.values(layoutOptions) as opt}
          <option value={opt.value}>{opt.name}</option>
        {/each}
      </select>
    </div>
    
  </div> -->