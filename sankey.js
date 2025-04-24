// Global variables
let europeanCountries = new Set([
  "Belgium",
  "Bulgaria",
  "Switzerland",
  "Germany",
  "Denmark",
  "Estonia",
  "Finland",
  "Croatia",
  "Iceland",
  "Italy",
  "Liechtenstein",
  "Lithuania",
  "North Macedonia",
  "Netherlands",
  "Norway",
  "Sweden",
  "Slovakia",
  "Czechia",
  "Luxembourg",
  "Hungary",
  "Latvia",
  "Austria",
  "Spain",
  "France",
  "Poland",
  "Greece",
  "Romania",
]);

// Function to switch between views
function showView(viewId) {
  // Hide all views
  document.getElementById("view-question1").style.display = "none";
  document.getElementById("view-question2").style.display = "none";

  // Show the selected view
  document.getElementById("view-" + viewId).style.display = "block";

  // Update button styles
  if (viewId === "question1") {
    document.getElementById("q1-button").className = "active";
    document.getElementById("q2-button").className = "inactive";
  } else {
    document.getElementById("q1-button").className = "inactive";
    document.getElementById("q2-button").className = "active";
  }
}

// Load data and initialize
document.addEventListener("DOMContentLoaded", function () {
  d3.csv("data/estat.csv").then((data) => {
    // Prepare data for Question 1
    const q1Data = prepareQ1Data(data, europeanCountries);

    // Prepare data for Question 2
    const q2Data = prepareQ2Data(data, europeanCountries);

    // Draw both charts
    drawQuestion1Chart(q1Data);
    drawQuestion2Chart(q2Data);

    // Start with Question 1 visible
    showView("question1");
  });
});

// Function to draw Question 1 chart
function drawQuestion1Chart(migrationData) {
  const svg = d3.select("#sankey1");
  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = { top: 30, right: 150, bottom: 10, left: 150 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  renderQ1View(
    migrationData,
    svg,
    width,
    height,
    margin,
    innerWidth,
    innerHeight
  );
}

// Function to draw Question 2 chart
function drawQuestion2Chart(migrationData) {
  const svg = d3.select("#sankey2");
  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = { top: 30, right: 150, bottom: 10, left: 150 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  renderQ2View(
    migrationData,
    svg,
    width,
    height,
    margin,
    innerWidth,
    innerHeight
  );
}

// Prepare data for Question 1
function prepareQ1Data(data, europeanCountries) {
  const migration = {};

  data.forEach((d) => {
    const source = d.geo?.trim();
    const target = d.partner?.trim();
    const value = +d.OBS_VALUE;

    // Filter invalid data
    if (!source || !target || isNaN(value) || value === 0) return;
    if (source === target) return;
    if (!europeanCountries.has(source)) return;
    if (europeanCountries.has(target)) return;
    if (
      target.includes("EU28") ||
      target.includes("reporting") ||
      target === "Unknown" ||
      target === "Total"
    )
      return;

    // Accumulate migration values
    const key = `${source}->${target}`;
    if (!migration[key]) migration[key] = { source, target, value: 0 };
    migration[key].value += value;
  });

  return migration;
}

// Prepare data for Question 2
function prepareQ2Data(data, europeanCountries) {
  const migration = {};

  data.forEach((d) => {
    const source = d.geo?.trim();
    const target = d.partner?.trim();
    const gender = d.sex?.trim();
    const value = +d.OBS_VALUE;

    // Filter invalid data
    if (!source || !target || !gender || isNaN(value) || value === 0) return;
    if (source === target) return;
    if (!europeanCountries.has(source)) return;
    if (europeanCountries.has(target)) return;
    if (
      target.includes("EU28") ||
      target.includes("reporting") ||
      target === "Unknown" ||
      target === "Total"
    )
      return;

    // Create unique key
    const key = `${source}|${gender}|${target}`;
    if (!migration[key]) {
      migration[key] = { source, gender, target, value: 0 };
    }
    migration[key].value += value;
  });

  return migration;
}

// Render Question 1 view: European countries -> Destination countries
function renderQ1View(
  migrationData,
  svg,
  width,
  height,
  margin,
  innerWidth,
  innerHeight
) {
  const allLinks = Object.values(migrationData);

  // Calculate total emigration volume per European country
  const sourceSumMap = d3.rollup(
    allLinks,
    (v) => d3.sum(v, (d) => d.value),
    (d) => d.source
  );
  const topSourcesSorted = Array.from(sourceSumMap.entries()).sort((a, b) =>
    d3.descending(a[1], b[1])
  );
  const topSources = new Set(topSourcesSorted.map((d) => d[0]));

  // Calculate total immigration volume per non-European country
  const targetSumMap = d3.rollup(
    allLinks,
    (v) => d3.sum(v, (d) => d.value),
    (d) => d.target
  );
  const topTargetsSorted = Array.from(targetSumMap.entries())
    .sort((a, b) => d3.descending(a[1], b[1]))
    .slice(0, 20);
  const topTargets = new Set(topTargetsSorted.map((d) => d[0]));

  // Filter links
  const links = allLinks.filter(
    (d) => topTargets.has(d.target) && topSources.has(d.source)
  );

  // Create nodes
  const nodes = [];

  // Calculate node width and height
  const nodeWidth = 15;
  const sourcePadding = Math.min(10, innerHeight / topSourcesSorted.length);
  const targetPadding = Math.min(10, innerHeight / topTargetsSorted.length);

  const sourceHeight =
    (innerHeight - (topSourcesSorted.length - 1) * sourcePadding) /
    topSourcesSorted.length;
  const targetHeight =
    (innerHeight - (topTargetsSorted.length - 1) * targetPadding) /
    topTargetsSorted.length;

  // Add source nodes (left side)
  let yOffset = margin.top;
  topSourcesSorted.forEach(([name]) => {
    nodes.push({
      name,
      isSource: true,
      x0: margin.left,
      x1: margin.left + nodeWidth,
      y0: yOffset,
      y1: yOffset + sourceHeight,
      value: sourceSumMap.get(name),
    });
    yOffset += sourceHeight + sourcePadding;
  });

  // Add target nodes (right side)
  yOffset = margin.top;
  topTargetsSorted.forEach(([name]) => {
    nodes.push({
      name,
      isSource: false,
      x0: width - margin.right - nodeWidth,
      x1: width - margin.right,
      y0: yOffset,
      y1: yOffset + targetHeight,
      value: targetSumMap.get(name),
    });
    yOffset += targetHeight + targetPadding;
  });

  // Create node name to index mapping
  const nodeMap = {};
  nodes.forEach((node, i) => {
    nodeMap[node.name] = i;
  });

  // Create links array
  const sankeyLinks = [];
  links.forEach((d) => {
    const sourceIndex = nodeMap[d.source];
    const targetIndex = nodeMap[d.target];

    if (sourceIndex !== undefined && targetIndex !== undefined) {
      sankeyLinks.push({
        source: sourceIndex,
        target: targetIndex,
        value: d.value,
        sourceNode: nodes[sourceIndex],
        targetNode: nodes[targetIndex],
      });
    }
  });

  // Calculate link positions
  calculateLinkPositions(nodes, sankeyLinks);

  // Create container group
  const g = svg.append("g");

  // Render links
  g.append("g")
    .attr("fill", "none")
    .attr("stroke-opacity", 0.5)
    .selectAll("path")
    .data(sankeyLinks)
    .join("path")
    .attr("d", (d) => generateLinkPath(d))
    .attr("stroke", "#aaa")
    .attr("stroke-width", (d) => Math.max(1, d.width))
    .append("title")
    .text(
      (d) => `${nodes[d.source].name} → ${nodes[d.target].name}\n${d.value}`
    );

  // Render nodes
  g.append("g")
    .selectAll("rect")
    .data(nodes)
    .join("rect")
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("height", (d) => Math.max(1, d.y1 - d.y0))
    .attr("width", (d) => d.x1 - d.x0)
    .attr("fill", (d) => (d.isSource ? "#4f46e5" : "#e5464f"))
    .append("title")
    .text((d) => d.name);

  const labelGroups = g.append("g").selectAll("g").data(nodes).join("g");

  labelGroups
    .append("rect")
    .attr("x", (d) => {
      const x = d.isSource ? d.x0 - 8 : d.x1 + 8;
      const textAnchor = d.isSource ? "end" : "start";
      const textWidth = d.name.length * 6;
      return textAnchor === "end" ? x - textWidth - 4 : x - 2;
    })
    .attr("y", (d) => (d.y0 + d.y1) / 2 - 10)
    .attr("width", (d) => d.name.length * 6 + 4)
    .attr("height", 20)
    .attr("fill", "white")
    .attr("fill-opacity", 0.7);

  labelGroups
    .append("text")
    .attr("x", (d) => (d.isSource ? d.x0 - 8 : d.x1 + 8))
    .attr("y", (d) => (d.y0 + d.y1) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", (d) => (d.isSource ? "end" : "start"))
    .text((d) => d.name)
    .style("fill", "#333")
    .style("font-weight", "bold");

  // Add title
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .text("Where Do Young Europeans Go?");
}

// Render Question 2 view: European countries -> Gender -> Destination countries
function renderQ2View(
  migrationData,
  svg,
  width,
  height,
  margin,
  innerWidth,
  innerHeight
) {
  const allLinks = Object.values(migrationData);

  // Calculate totals for each dimension
  const sourceTotal = {};
  const genderTotal = {};
  const targetTotal = {};
  const sourceGenderTotal = {};
  const genderTargetTotal = {};

  allLinks.forEach((d) => {
    // Source country total
    if (!sourceTotal[d.source]) sourceTotal[d.source] = 0;
    sourceTotal[d.source] += d.value;

    // Gender total
    if (!genderTotal[d.gender]) genderTotal[d.gender] = 0;
    genderTotal[d.gender] += d.value;

    // Target country total
    if (!targetTotal[d.target]) targetTotal[d.target] = 0;
    targetTotal[d.target] += d.value;

    // Source country to gender total
    const sgKey = `${d.source}|${d.gender}`;
    if (!sourceGenderTotal[sgKey]) sourceGenderTotal[sgKey] = 0;
    sourceGenderTotal[sgKey] += d.value;

    // Gender to target country total
    const gtKey = `${d.gender}|${d.target}`;
    if (!genderTargetTotal[gtKey]) genderTargetTotal[gtKey] = 0;
    genderTargetTotal[gtKey] += d.value;
  });

  // Sort each dimension
  const sortedSources = Object.entries(sourceTotal)
    .sort((a, b) => b[1] - a[1])
    .map((d) => d[0]);

  const sortedGenders = Object.entries(genderTotal)
    .sort((a, b) => b[1] - a[1])
    .map((d) => d[0]);

  const sortedTargets = Object.entries(targetTotal)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map((d) => d[0]);

  // Calculate node dimensions
  const nodeWidth = 15;
  const sourcePadding = Math.min(8, innerHeight / sortedSources.length);
  const genderPadding = Math.min(8, innerHeight / sortedGenders.length);
  const targetPadding = Math.min(8, innerHeight / sortedTargets.length);

  const sourceHeight =
    (innerHeight - (sortedSources.length - 1) * sourcePadding) /
    sortedSources.length;
  const genderHeight =
    (innerHeight - (sortedGenders.length - 1) * genderPadding) /
    sortedGenders.length;
  const targetHeight =
    (innerHeight - (sortedTargets.length - 1) * targetPadding) /
    sortedTargets.length;

  // Calculate horizontal positions
  const sourceX = margin.left;
  const genderX = margin.left + innerWidth / 2 - nodeWidth / 2;
  const targetX = width - margin.right - nodeWidth;

  // Create nodes
  const nodes = [];

  // Add source country nodes (left)
  let yOffset = margin.top;
  sortedSources.forEach((name) => {
    nodes.push({
      name,
      type: "source",
      x0: sourceX,
      x1: sourceX + nodeWidth,
      y0: yOffset,
      y1: yOffset + sourceHeight,
      value: sourceTotal[name],
    });
    yOffset += sourceHeight + sourcePadding;
  });

  // Add gender nodes (middle)
  yOffset = margin.top;
  sortedGenders.forEach((name) => {
    nodes.push({
      name,
      type: "gender",
      x0: genderX,
      x1: genderX + nodeWidth,
      y0: yOffset,
      y1: yOffset + innerHeight / sortedGenders.length,
      value: genderTotal[name],
    });
    yOffset += innerHeight / sortedGenders.length + genderPadding;
  });

  // Add target country nodes (right)
  yOffset = margin.top;
  sortedTargets.forEach((name) => {
    nodes.push({
      name,
      type: "target",
      x0: targetX,
      x1: targetX + nodeWidth,
      y0: yOffset,
      y1: yOffset + targetHeight,
      value: targetTotal[name],
    });
    yOffset += targetHeight + targetPadding;
  });

  // Create node name to index mapping
  const nodeMap = {};
  nodes.forEach((node, i) => {
    nodeMap[node.name + ":" + node.type] = i;
  });

  // Create links
  const links = [];

  // First level: Source country -> Gender
  Object.entries(sourceGenderTotal).forEach(([key, value]) => {
    const [source, gender] = key.split("|");
    if (sortedSources.includes(source) && sortedGenders.includes(gender)) {
      const sourceIndex = nodeMap[source + ":source"];
      const genderIndex = nodeMap[gender + ":gender"];

      if (sourceIndex !== undefined && genderIndex !== undefined) {
        links.push({
          source: sourceIndex,
          target: genderIndex,
          value,
          sourceNode: nodes[sourceIndex],
          targetNode: nodes[genderIndex],
          level: 1,
        });
      }
    }
  });

  // Second level: Gender -> Target country
  Object.entries(genderTargetTotal).forEach(([key, value]) => {
    const [gender, target] = key.split("|");
    if (sortedGenders.includes(gender) && sortedTargets.includes(target)) {
      const genderIndex = nodeMap[gender + ":gender"];
      const targetIndex = nodeMap[target + ":target"];

      if (genderIndex !== undefined && targetIndex !== undefined) {
        links.push({
          source: genderIndex,
          target: targetIndex,
          value,
          sourceNode: nodes[genderIndex],
          targetNode: nodes[targetIndex],
          level: 2,
        });
      }
    }
  });

  // Calculate link positions
  calculateLinkPositions(nodes, links);

  // Create container
  const g = svg.append("g");

  // Draw links
  g.append("g")
    .attr("fill", "none")
    .attr("stroke-opacity", 0.5)
    .selectAll("path")
    .data(links)
    .join("path")
    .attr("d", (d) => generateLinkPath(d))
    .attr("stroke", (d) => {
      if (d.level === 1) {
        // Source country -> Gender links
        const genderNode = nodes[d.target];
        if (genderNode.name === "Males") {
          return d3.interpolateBlues(
            0.5 + (nodes[d.source].y0 / innerHeight) * 0.5
          );
        } else {
          return "#f768a1";
        }
      } else {
        // Gender -> Target country links
        const gender = nodes[d.source].name;
        return gender === "Males" ? "#2171b5" : "#f768a1";
      }
    })
    .attr("stroke-width", (d) => Math.max(1, d.width))
    .append("title")
    .text((d) => {
      if (d.level === 1) {
        return `${nodes[d.source].name} → ${nodes[d.target].name}\n${d.value}`;
      } else {
        return `${nodes[d.source].name} → ${nodes[d.target].name}\n${d.value}`;
      }
    });

  // Draw nodes
  g.append("g")
    .selectAll("rect")
    .data(nodes)
    .join("rect")
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("height", (d) => Math.max(1, d.y1 - d.y0))
    .attr("width", (d) => d.x1 - d.x0)
    .attr("fill", (d) => {
      if (d.type === "source") {
        return "#4a89dc";
      } else if (d.type === "gender") {
        return d.name === "Males" ? "#2171b5" : "#f768a1";
      } else {
        return "#e74c3c";
      }
    })
    .append("title")
    .text((d) => `${d.name}\n${d.value}`);

  const labelGroups = g.append("g").selectAll("g").data(nodes).join("g");

  labelGroups
    .append("rect")
    .attr("x", (d) => {
      if (d.type === "source") {
        const x = d.x0 - 8;
        const textWidth = d.name.length * 6;
        return x - textWidth - 4;
      } else if (d.type === "gender") {
        const x = d.x0 + nodeWidth / 2;
        const textWidth = d.name.length * 6;
        return x - textWidth / 2 - 2;
      } else {
        const x = d.x1 + 8;
        return x - 2;
      }
    })
    .attr("y", (d) => (d.y0 + d.y1) / 2 - 10)
    .attr("width", (d) => d.name.length * 6 + 4)
    .attr("height", 20)
    .attr("fill", "white")
    .attr("fill-opacity", 0.7);

  labelGroups
    .append("text")
    .attr("x", (d) => {
      if (d.type === "source") return d.x0 - 8;
      if (d.type === "gender") return d.x0 + nodeWidth / 2;
      return d.x1 + 8;
    })
    .attr("y", (d) => (d.y0 + d.y1) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", (d) => {
      if (d.type === "source") return "end";
      if (d.type === "gender") return "middle";
      return "start";
    })
    .text((d) => d.name)
    .style("fill", "#333")
    .style("font-weight", (d) => (d.type === "gender" ? "bold" : "normal"));

  // Add title
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .text("Gender-based Migration Patterns from Europe");
}

// Helper function: Calculate link positions
function calculateLinkPositions(nodes, links) {
  // Create outgoing and incoming link collections for each node
  const nodeSourceLinks = Array(nodes.length)
    .fill()
    .map(() => []);
  const nodeTargetLinks = Array(nodes.length)
    .fill()
    .map(() => []);

  links.forEach((link) => {
    nodeSourceLinks[link.source].push(link);
    nodeTargetLinks[link.target].push(link);
  });

  // Calculate link positions for each node
  nodes.forEach((node, i) => {
    let y0 = node.y0;
    let y1 = node.y0;

    // Position outgoing links
    nodeSourceLinks[i].sort((a, b) => {
      const aTarget = nodes[a.target];
      const bTarget = nodes[b.target];
      return aTarget.y0 - bTarget.y0;
    });

    nodeSourceLinks[i].forEach((link) => {
      link.sourceY0 = y0;
      link.width = Math.max(1, (link.value / node.value) * (node.y1 - node.y0));
      y0 += link.width;
      link.sourceY1 = y0;
    });

    // Position incoming links
    nodeTargetLinks[i].sort((a, b) => {
      const aSource = nodes[a.source];
      const bSource = nodes[b.source];
      return aSource.y0 - bSource.y0;
    });

    nodeTargetLinks[i].forEach((link) => {
      link.targetY0 = y1;
      if (!link.width) {
        link.width = Math.max(
          1,
          (link.value / node.value) * (node.y1 - node.y0)
        );
      }
      y1 += link.width;
      link.targetY1 = y1;
    });
  });

  return links;
}

// Helper function: Generate link path
function generateLinkPath(d) {
  const sourceX = d.sourceNode.x1;
  const targetX = d.targetNode.x0;
  const sourceY0 = d.sourceY0;
  const sourceY1 = d.sourceY1;
  const targetY0 = d.targetY0;
  const targetY1 = d.targetY1;

  const curvature = 0.5;
  const x2 = sourceX + (targetX - sourceX) * curvature;
  const x3 = targetX - (targetX - sourceX) * curvature;

  return `
      M ${sourceX},${sourceY0}
      C ${x2},${sourceY0} ${x3},${targetY0} ${targetX},${targetY0}
      L ${targetX},${targetY1}
      C ${x3},${targetY1} ${x2},${sourceY1} ${sourceX},${sourceY1}
      Z
    `;
}
