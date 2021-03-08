<script>
  import { graphViewConfigStore, hoverTokenStore, wordToSubwordMapStore } from './store';
  import GraphMatrix from './GraphMatrix.svelte';
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  import { Circle } from 'svelte-loading-spinners';
  
  // Shared states
  let graphViewCompConfig = undefined;
  let instanceID = 1718;

  let graphSVG = null;
  let graphData = null;
  let saliencyData = null;
  let wordToSubwordMap = null;

  let SVGWidth = undefined;
  let SVGHeight = undefined;

  let curHoverToken = null;
  
  // View configs
  const rightListWidth = 150;

  const SVGPadding = {top: 3, left: 3, right: 3, bottom: 3};

  const minNodeRadius = 19;
  const maxNodeRadius = 40;

  // const minNodeRadius = 10;
  // const maxNodeRadius = 20;
  
  const radialRadius = 225;
  const radialCurveAlpha = 0.3;

  const gridRowSize = 10;
  const gridRowGap = 25;
  const gridColumnGap = 20;

  // Graph vis variables
  let tokenSize = null;
  let originalNodes = null;

  let weightThreshold = 0.02;
  let weightThresholdMin = 0.02;
  let weightThresholdMax = 0.2;
  let weightThresholdSteps = 6;
  let weightThresholdGap = (weightThresholdMax - weightThresholdMin) / (weightThresholdSteps - 1);

  let linkArrays = {};
  let intermediateNodes = {};
  let curLinkI = 0;
  let linkWidth = null;

  let linkColor = 'hsl(0, 0%, 76%)';
  let linkHoverColor = 'hsl(358, 94%, 73%)';

  // Head panel variables
  let curHeadMode = 'gradient';
  let relevantAttentions = [];
  const listKIncreasement = 10;
  const initListK = 20;
  let listK = initListK;

  // Control panel variables
  let settingIconActive = false;
  
  let curLayer = 3;
  let curHead = 8;

  // Data
  let mounted = false;
  let attentionData = null;
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
      manyBody: -840,
      attention: 0.5,
      textOrder: 1.6,
      collideRadius: 1
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

  const padZeroLeft = (num, digit) => {
    return Array(Math.max(digit - String(num).length + 1, 0)).join(0) + num;
  };

  const padZeroRight = (num, digit) => {
    return num + Array(Math.max(digit - String(num).length + 1, 0)).join(0);
  };

  const drag = (simulation) => {
  
    const dragstarted = (event) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;

      // Add a marker to indicate that the node is fixed
      d3.select(event.sourceEvent.originalTarget.parentNode)
        .append('rect')
        .attr('class', 'fixed-marker')
        .attr('x', -3)
        .attr('y', 6)
        .attr('width', 6)
        .attr('height', 5)
        .style('fill', 'white');
    };
    
    const dragged = (event) => {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    };
    
    const dragended = (event) => {
      if (!event.active) simulation.alphaTarget(0);
      // event.subject.fx = null;
      // event.subject.fy = null;
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
      let step = sliderValue / 200;
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
      case 'threshold':
        weightThreshold = weightThresholdMin + step * weightThresholdGap;
        weightThresholdUpdated(step, simulation, nodeRadiusScale);
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
    simulation.force('attentionLink', d3.forceLink(linkArrays[curLinkI].links)
      .id(d => d.id)
    );
    
    // Force 4 (Text order link force)
    simulation.force('textLink', d3.forceLink(linkArrays[curLinkI].hiddenLinks)
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
    simulation.force('textLink', d3.forceLink(linkArrays[curLinkI].hiddenLinks)
      .id(d => d.id)
      .strength(forceStrength.radial.textOrder)
    );

    // Force 2 (Custom radial force)
    simulation.force('posY', d3.forceY()
      .y((d, i) => {
        let curLen = originalNodes.filter(d => !d.hidden).length;
        let curAngle = -Math.PI / 2 + i * (Math.PI * 2 / curLen);
        return SVGHeight / 2 + Math.sin(curAngle) * radialRadius;
      })
      .strength(forceStrength.radial.radial)
    );

    simulation.force('posX', d3.forceX()
      .x((d, i) => {
        let curLen = originalNodes.filter(d => !d.hidden).length;
        let curAngle = -Math.PI / 2 + i * (Math.PI * 2 / curLen);
        return SVGWidth / 2 + Math.cos(curAngle) * radialRadius;
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
    simulation.force('grid', d3.forceLink(linkArrays[curLinkI].gridLinks)
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

  const weightThresholdUpdated = (step, simulation, nodeRadiusScale) => {
    curLinkI = step;

    // Update the svg
    let linkLines = d3.select(graphSVG)
      .select('g.attention-link-group')
      .selectAll('path.link')
      .data(linkArrays[curLinkI].biLinks, d => `${d[0].id}-${d[1].id}`);

    // Enter
    linkLines.enter()
      .append('path')
      .attr('marker-end', 'url(#arrow)')
      .attr('class', 'link')
      .attr('id', d => `link-${d[0].id}-${d[1].id}`)
      .style('stroke', 'hsl(150, 74%, 51%)')
      .style('stroke-width', d => linkWidth(d.attention))
      .transition()
      .duration(animationTime * 3)
      .ease(ease)
      .style('stroke', linkColor);
    
    // Exit
    linkLines.exit()
      .style('stroke', 'hsl(349, 81%, 57%)')
      .transition()
      .duration(animationTime * 3)
      .ease(ease)
      .style('opacity', 0)
      .on('end', (d, i, g) => {
        d3.select(g[i]).remove();
      });
    
    // Update the simulation
    initForceSim(simulation, nodeRadiusScale);
  };

  // Create related link arrays (hiddenLinks, biLinks, and gridLinks)
  const createGraphLinks = (curLinks, nodeByID, nodeIndexArray) => {
    curLinks = curLinks.map(d => Object.create(d));
    let curNodes = originalNodes.slice();

    // Add text order hidden links
    let curHiddenLinks = [];
    for (let i = 0; i < curNodes.length - 1; i++) {
      let hiddenLink = {
        source: +curNodes[i].id,
        target: +curNodes[i + 1].id
      };
      curHiddenLinks.push(hiddenLink);
    }

    // Add a connection between the first and last token
    curHiddenLinks.push({
      source: +curNodes[curNodes.length - 1].id,
      target: curNodes[0].id
    });

    curHiddenLinks = curHiddenLinks.map(d => Object.create(d));

    // Add intermediate nodes to create bezier curves
    let curBiLinks = [];

    curLinks.forEach(d => {
      let source = nodeByID.get(d.source);
      let target = nodeByID.get(d.target);
      let curBilink = [source, target];
      curBilink.selfLoop = false;
      curBilink.attention = +d.weight;

      // Add a hidden node if there is a self-loop
      if (source === target) {
        curBilink.selfLoop = true;

        // We cannot keep creating new intermediate nodes (need to be the same
        // object across different threshold)
        let intermediate = {hidden: true};
        if (intermediateNodes.source !== undefined) {
          intermediate = intermediateNodes.source;
        } else {
          intermediateNodes.source = intermediate;
        }

        curBilink.push(intermediate);
        curNodes.push(intermediate);
        curLinks.push(
          {source: intermediate, target: source}
        );
      }

      curBiLinks.push(curBilink);
    });

    // Create grid links
    let curGridLinks = [];
    nodeIndexArray.sort((a, b) => +a - +b);
    for (let i = 0; i < curNodes.length; i++) {
      if (i % gridRowSize !== gridRowSize - 1 & nodeByID.has(i + 1)) {
        curGridLinks.push({source: nodeByID.get(i), target: nodeByID.get(i + 1)});
      }
      if (nodeByID.has(i + gridRowSize)) {
        curGridLinks.push({source: nodeByID.get(i), target: nodeByID.get(i + gridRowSize)});
      }
    }

    return {
      links: curLinks,
      hiddenLinks: curHiddenLinks,
      biLinks: curBiLinks,
      gridLinks: curGridLinks,
      nodes: curNodes
    };
  };

  const drawGraph = () => {
    // Filter the links based on the weight
    // weightThreshold = 0.05;

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

    // Map nodes and links to arrays of objects
    let nodes = graphData.nodes.map(d => Object.create(d));
    nodes.sort((a, b) => +a.id - +b.id);
    
    // Give each saliency token a unique name
    let tokenCount = {};
    nodes.forEach(d => {
      let curCount = 0;
      if (tokenCount[d.token] === undefined) {
        tokenCount[d.token] = curCount + 1;
      } else {
        curCount = tokenCount[d.token];
        tokenCount[d.token] += 1;
      }
      d.name = `${tokenIDName(d.token)}-${curCount}`;
    });

    originalNodes = nodes.slice();

    // Maintain a set of all existing node indices
    let nodeIndices = new Set();
    graphData.nodes.forEach(d => nodeIndices.add(+d.id));
    let nodeIndexArray = Array.from(nodeIndices);
    tokenSize = nodeIndexArray.length;

    let nodeByID = new Map(nodes.map(d => [d.id, d]));

    // Create link arrays at different range steps
    for (let i  = 0; i < weightThresholdSteps; i++) {
      let curWeightThreshold = round(weightThresholdMin + i * weightThresholdGap, 2);
      let links = graphData.links.filter(d => d.weight > curWeightThreshold);
      let linkResult = createGraphLinks(links, nodeByID, nodeIndexArray);

      linkArrays[i] = {
        links: linkResult.links.slice(),
        hiddenLinks: linkResult.hiddenLinks.slice(),
        biLinks: linkResult.biLinks.slice(),
        gridLinks: linkResult.gridLinks.slice(),
        nodes: linkResult.nodes.slice()
      };
    }

    // Create a scale for the node radius
    let allSaliencyScores = nodes.map(d => +d.saliency);
    let nodeRadiusScale = d3.scaleLinear()
      .domain(d3.extent(allSaliencyScores))
      .range([minNodeRadius, maxNodeRadius])
      .unknown(0)
      .nice();

    // Create a scale for link stroke width
    let attentionWeights = linkArrays[0].links.map(d => +d.weight);
    linkWidth = d3.scaleLinear()
      .domain(d3.extent(attentionWeights))
      .range([0.5, 2.5])
      .nice();
    
    // Define the force
    // Use the min threshold to init the simulation (it includes the most hidden nodes)
    let simulation = d3.forceSimulation(linkArrays[0].nodes);

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
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('stroke', linkColor)
      .attr('fill', linkColor);
    
    // Create a different arrow marked used when user hovers over a node
    svg.append('defs')
      .append('marker')
      .attr('id', 'arrow-hover')
      .attr('viewBox', [0, 0, 10, 10])
      .attr('refX', 0)
      .attr('refY', 5)
      .attr('markerWidth', 12)
      .attr('markerHeight', 9)
      .attr('orient', 'auto')
      .attr('stroke-width', 1)
      .attr('markerUnits', 'userSpaceOnUse')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('stroke', linkHoverColor)
      .attr('fill', linkHoverColor);

    // Add attention links
    let linkLineGroup = svg.append('g')
      .attr('class', 'attention-link-group')
      .attr('stroke', linkColor);

    linkLineGroup.selectAll('path.link')
      .data(linkArrays[curLinkI].biLinks, d => `${d[0].id}-${d[1].id}`)
      .join('path')
      .attr('class', 'link')
      .attr('id', d => `link-${d[0].name}-${d[1].name}`)
      .attr('marker-end', 'url(#arrow)')
      .style('stroke-width', d => linkWidth(d.attention));

    // Add token nodes
    let nodeGroup = svg.append('g')
      .attr('class', 'node-group');

    let nodeGroups = nodeGroup.selectAll('g.node')
      // Need to filter out intermediate nodes
      .data(linkArrays[curLinkI].nodes.filter(d => d.id !== undefined), d => d.id)
      .join('g')
      .attr('class', 'node')
      .attr('id', d => `node-${d.name}`)
      .attr('transform', `translate(${SVGWidth / 2}, ${SVGHeight / 2})`)
      .call(drag(simulation))
      // Hover over effect
      .on('mouseover', (e, d) => {
        curHoverToken = d.name;
        hoverTokenStore.set(curHoverToken);
        highLightLink(curHoverToken);
      })
      .on('mouseleave', () => {
        dehighlightLink(curHoverToken);
        curHoverToken = null;
        hoverTokenStore.set(curHoverToken);
      })
      // Single click to remove fixing
      .on('click', (e, d) => {
        if (d.fx !== null && d.fy !== null) {
          // Unfix the node
          delete d.fx;
          delete d.fy;

          // Remove the fixing marker
          d3.select(e.target.parentNode)
            .selectAll('rect.fixed-marker')
            .remove();
          
          simulation.alpha(0.2).restart();
        }
      })
      // Double click to remove the node
      .on('dblclick', e => {
        let curNode = d3.select(e.target);
        let curID = curNode.data()[0].id;

        // Delete the node from the nodes array
        for (let i = linkArrays[curLinkI].nodes.length - 1; i >= 0; i--) {
          if (linkArrays[curLinkI].nodes[i].id === curID) {
            linkArrays[curLinkI].nodes.splice(i, 1);
          }
        }

        // Remove the node element on screen
        nodeGroup.selectAll('g.node')
          .data(linkArrays[curLinkI].nodes.filter(d => d.id !== undefined), d => d.id)
          .exit()
          .remove();

        // Delete all links connecting to this node
        for (let i = linkArrays[curLinkI].biLinks.length - 1; i >= 0; i--) {
          if (linkArrays[curLinkI].biLinks[i][0].id === curID |
            linkArrays[curLinkI].biLinks[i][1].id === curID) {
            linkArrays[curLinkI].biLinks.splice(i, 1);
          }
        }

        // Delete all attention links connecting to this node
        for (let i = linkArrays[curLinkI].links.length - 1; i >= 0; i--) {
          if (linkArrays[curLinkI].links[i].source.id === curID |
            linkArrays[curLinkI].links[i].target.id === curID) {
            linkArrays[curLinkI].links.splice(i, 1);
          }
        }

        // Rewire the text order link array
        for (let i = linkArrays[curLinkI].hiddenLinks.length - 1; i >= 0; i--) {
          if (linkArrays[curLinkI].hiddenLinks[i].source.id === curID) {
            linkArrays[curLinkI].hiddenLinks.splice(i, 1);
          } else if (linkArrays[curLinkI].hiddenLinks[i].target.id === curID) {
            if (i + 1 < linkArrays[curLinkI].hiddenLinks.length) {
              linkArrays[curLinkI].hiddenLinks[i].target = linkArrays[curLinkI].hiddenLinks[i + 1].source;
            } else {
              linkArrays[curLinkI].hiddenLinks[i].target = linkArrays[curLinkI].hiddenLinks[0].source;
            }
          }
        }

        // Need to reconstruct the grid links
        linkArrays[curLinkI].gridLinks = [];
        nodeIndices = new Set();
        linkArrays[curLinkI].nodes.forEach(d => {if (d.id !== undefined) nodeIndices.add(+d.id);});
        nodeIndexArray = Array.from(nodeIndices);
        nodeIndexArray.sort((a, b) => +a - +b);

        for (let i = 0; i < nodeIndexArray.length - 1; i++) {
          let curI = nodeIndexArray[i];
          if (i % gridRowSize !== gridRowSize - 1 & nodeByID.has(nodeIndexArray[i + 1])) {
            linkArrays[curLinkI].gridLinks.push({source: nodeByID.get(curI),
              target: nodeByID.get(nodeIndexArray[i + 1])});
          }
          if (nodeByID.has(nodeIndexArray[i + gridRowSize])) {
            linkArrays[curLinkI].gridLinks.push({source: nodeByID.get(curI),
              target: nodeByID.get(nodeIndexArray[i + gridRowSize])});
          }
        }

        linkLineGroup.selectAll('path.link')
          .data(linkArrays[curLinkI].biLinks, d => `${d[0].id}-${d[1].id}`)
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

    // Simulation tick updates
    simulation.on('tick', () => {
      console.log('Tick');

      let linkLines = d3.select(graphSVG)
        .select('g.attention-link-group')
        .selectAll('path.link');

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
    });

    // Register UI elements from the control panel
    bindSlider('attention', simulation, 0, 10, forceStrength.force.attention);
    bindSlider('textOrder', simulation, 0, 10, forceStrength.force.textOrder);
    bindSlider('manyBody', simulation, -2000, 0, forceStrength.force.manyBody);
    bindSlider('collideRadius', simulation, 0, 20, forceStrength.force.collideRadius, nodeRadiusScale);
    bindSlider('threshold', simulation, 0.05, 0.9, weightThreshold, nodeRadiusScale);

    bindCheckBox(simulation, linkArrays[curLinkI].links);

    bindSelect(simulation, nodeRadiusScale, nodeGroups);
  };

  /** Create CSS selector compatible name */
  const tokenIDName = (tokenID) => {
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

  const highLightLink = (hoverToken) => {
    d3.select(graphSVG)
      .select('.attention-link-group')
      .selectAll('path.link')
      .filter((d, i, g) => d3.select(g[i]).attr('id').includes(`-${hoverToken}`))
      .attr('marker-end', 'url(#arrow-hover)')
      .style('stroke', linkHoverColor)
      .style('opacity', 1)
      .raise();

    d3.select(graphSVG)
      .select('.node-group')
      .selectAll('.node')
      .filter((d, i, g) => d3.select(g[i]).attr('id').includes(`-${hoverToken}`))
      .raise()
      .select('circle')
      .style('stroke', linkHoverColor)
      .style('stroke-width', 4);
  };

  const dehighlightLink = (hoverToken) => {
    d3.select(graphSVG)
      .select('.attention-link-group')
      .selectAll('path.link')
      .filter((d, i, g) => d3.select(g[i]).attr('id').includes(`-${hoverToken}`))
      .attr('marker-end', 'url(#arrow)')
      .style('stroke', linkColor)
      .style('opacity', null);

    d3.select(graphSVG)
      .select('.node-group')
      .selectAll('.node')
      .filter((d, i, g) => d3.select(g[i]).attr('id').includes(`-${hoverToken}`))
      .select('circle')
      .style('stroke', 'white')
      .style('stroke-width', 1.5);
  };

  const createGraphData = (layer, head) => {
    let curAttention = attentionData[layer][head];
    let curAttentionData = {'nodes': [], 'links': []};
    let curInstance = 106;
    let curPredictedLabel = saliencyData[String(curInstance)]['meta']['predicted_label'];

    // Add nodes
    saliencyData[String(curInstance)]['tokens'].forEach((d, i) => {
      curAttentionData.nodes.push({
        token: d.token,
        saliency: d[curPredictedLabel],
        id: i
      });
    });

    // Add links
    for (let i = 0; i < curAttentionData.nodes.length; i++) {
      for (let j = 0; j < curAttentionData.nodes.length; j++) {
        curAttentionData.links.push({
          source: i,
          target: j,
          weight: curAttention[i][j]
        });
      }
    }

    return curAttentionData;
  };

  const renderGraph = async () => {
    console.log('loading matrix');

    // Load data from files if they have not been loaded
    if (attentionData == null) {
      attentionData = await d3.json(`/data/twitter-attention-data/attention-${padZeroLeft(instanceID, 4)}.json`);
    }
    if (saliencyData == null) {
      saliencyData = await d3.json('/data/sst2-saliency-list-grad-l1.json');
    }

    // Create graph data
    let curLayer = 9;
    let curHead = 8;
    // graphData = createGraphData(curLayer, curHead);

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

  wordToSubwordMapStore.subscribe(value => {
    wordToSubwordMap = value;
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

  const settingIconClicked = () => {
    if (settingIconActive) {
      settingIconActive = false;
    } else {
      settingIconActive = true;
    }
  };

  hoverTokenStore.subscribe(value => {

    if (value != null) {
      curHoverToken = value;

      // Check if the coming word has split subwords in graph vis
      if (wordToSubwordMap[curHoverToken.replace(/(.*)-\d*/, '$1')] !== undefined) {
        wordToSubwordMap[curHoverToken.replace(/(.*)-\d*/, '$1')].forEach(t => {
          highLightLink(t);
        });
      } else {
        highLightLink(curHoverToken);
      }
      
    } else {

      if (curHoverToken != null) {
        // Check if the coming word has split subwords in graph vis
        if (wordToSubwordMap[curHoverToken.replace(/(.*)-\d*/, '$1')] !== undefined) {
          wordToSubwordMap[curHoverToken.replace(/(.*)-\d*/, '$1')].forEach(t => {
            dehighlightLink(t);
          });
        } else {
          dehighlightLink(curHoverToken);
        }
      }

      curHoverToken = value;
    }

  });

  onMount(async() => {
    if (attentionData == null) {
      attentionData = await d3.json(`/data/twitter-attention-data/attention-${padZeroLeft(instanceID, 4)}.json`);
    }

    if (saliencyData == null) {
      saliencyData = await d3.json('/data/sst2-saliency-list-grad-l1.json');
    }

    // TODO: change the hard code number
    tokenSize = 40;
    gradSortedIndexes = await d3.json('/data/twitter-sorted-grad-heads.json');
    gradSortedIndexes = gradSortedIndexes[instanceID];
    relevantAttentions = loadAttentionMatrix();
    console.log(relevantAttentions);

    
    mounted = true;
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
    cursor: default;

    display: flex;
    flex-direction: column;
    align-items: center;;
    justify-content: flex-start;

    font-size: 0.9rem;
    border-radius: 5px;
    border: 1px solid hsl(0, 0%, 93.3%);
    box-shadow: 0 3px 3px hsla(0, 0%, 0%, 0.05);
    background: hsla(0, 0%, 100%, 0.65);

    .name {
      font-size: 1rem;
      padding: 5px 10px;
    }

    // .drop-down {
    //   font-size: 0.9rem;
    //   padding: 5px 10px;
    // }
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
    padding: 0.1em 0.4em;
    margin: 0 0.2em;
    font-size: 1.1em;
    color: $blue-icon;
    cursor: pointer;
    border-radius: 3px;

    transition: background 100ms ease-in-out;

    &:hover {
      background: change-color($blue-icon, $alpha: 0.1);
    }

    &.active {
      background: change-color($blue-icon, $alpha: 0.2);

      &:hover {
        background: change-color($blue-icon, $alpha: 0.2);
      }
    }
  }

  .slider-container {
    font-size: 0.9em;
    padding: 0 15px 0 15px;

    display: flex;
    flex-direction: column;
    align-items: center;

    max-height: 0;
    overflow: hidden;
    transition: max-height 150ms ease-in-out;

    input {
      width: 130px;
    }

    .sep-line-horizontal {
      width: 70%;
      margin: 3px 0 10px 0;

      &.longer-line {
        width: 115%;
        margin: 0 0 10px 0;
      }
    }

    &.active {
      max-height: 500px;
      transition: max-height 300ms ease-in-out;
    }
  }

  .slider {
    display: flex;
    flex-direction: column;
    align-items: center;
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

        <div class='setting-icon'
          on:click={settingIconClicked}
          class:active={settingIconActive}
        >
          <i class="fas fa-sliders-h"></i>
        </div>

        <div class='sep-line-vertical'></div>

        <div class='select'>
          <select name='layout' id='select-layout'>
            {#each Object.values(layoutOptions) as opt}
              <option value={opt.value}>{opt.name}</option>
            {/each}
          </select>
        </div>

      </div>

      <!-- Slider panel -->
      <div class='slider-container'
        class:active={settingIconActive}
      >
        <div class='sep-line-horizontal longer-line'></div>

        <div class='slider-title'>Edge Force</div>

        <div class='sep-line-horizontal'></div>

        <div class='slider'>

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

        <div class='slider-title'>Edge Threshold</div>

        <div class='sep-line-horizontal'></div>

        <div class='slider'>

          <div class='slider-text'>
            <label for='threshold'>Attention > </label>
            <div class='slider-value'>
              {round(weightThreshold, 2)}
            </div>
          </div>

          <input type="range" min="0" max="1000" value="500" step="200" class="slider" id="threshold">
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
