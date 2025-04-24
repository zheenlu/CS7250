// Sankey Chart with Forced Sorting - Improved Label Placement
const svg = d3.select("#sankey");
const width = +svg.attr("width");
const height = +svg.attr("height");

// Increase left and right margins to make room for labels
const margin = { top: 10, right: 150, bottom: 10, left: 150 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

d3.csv("data/estat.csv").then((data) => {
  // Define the set of European countries
  const europeanCountries = new Set([
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

  // Step 1: Collect migration data
  const migrationData = {};

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
    const key = `${source}|${target}`;
    if (!migrationData[key]) {
      migrationData[key] = { source, target, value: 0 };
    }
    migrationData[key].value += value;
  });

  // Step 2: Calculate total emigration/immigration volumes per country
  const sourceTotal = {};
  const targetTotal = {};

  Object.values(migrationData).forEach((d) => {
    // Total emigration from source countries (European)
    if (!sourceTotal[d.source]) sourceTotal[d.source] = 0;
    sourceTotal[d.source] += d.value;

    // Total immigration to target countries (non-European)
    if (!targetTotal[d.target]) targetTotal[d.target] = 0;
    targetTotal[d.target] += d.value;
  });

  // Step 3: Sort countries
  // Sort European countries by emigration volume (highest to lowest)
  const sortedSources = Object.entries(sourceTotal)
    .sort((a, b) => b[1] - a[1])
    .map((d) => d[0]);

  // Sort non-European countries by immigration volume (highest to lowest), keep top 20
  const sortedTargets = Object.entries(targetTotal)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map((d) => d[0]);

  // Step 4: Manually create positions
  // Calculate node width and height
  const nodeWidth = 15;
  const sourcePadding = Math.min(10, innerHeight / sortedSources.length);
  const targetPadding = Math.min(10, innerHeight / sortedTargets.length);

  const sourceHeight =
    (innerHeight - (sortedSources.length - 1) * sourcePadding) /
    sortedSources.length;
  const targetHeight =
    (innerHeight - (sortedTargets.length - 1) * targetPadding) /
    sortedTargets.length;

  // Create nodes with explicit positions
  const nodes = [];

  // Add source nodes (left side)
  let yOffset = margin.top;
  sortedSources.forEach((name, i) => {
    nodes.push({
      name,
      isSource: true,
      x0: margin.left,
      x1: margin.left + nodeWidth,
      y0: yOffset,
      y1: yOffset + sourceHeight,
      value: sourceTotal[name], // For link width calculation
    });
    yOffset += sourceHeight + sourcePadding;
  });

  // Add target nodes (right side)
  yOffset = margin.top;
  sortedTargets.forEach((name, i) => {
    nodes.push({
      name,
      isSource: false,
      x0: width - margin.right - nodeWidth,
      x1: width - margin.right,
      y0: yOffset,
      y1: yOffset + targetHeight,
      value: targetTotal[name], // For link width calculation
    });
    yOffset += targetHeight + targetPadding;
  });

  // Create a mapping from node name to index
  const nodeMap = {};
  nodes.forEach((node, i) => {
    nodeMap[node.name] = i;
  });

  // Step 5: Create links
  const links = [];

  Object.values(migrationData).forEach((d) => {
    if (sortedSources.includes(d.source) && sortedTargets.includes(d.target)) {
      const sourceIndex = nodeMap[d.source];
      const targetIndex = nodeMap[d.target];

      if (sourceIndex !== undefined && targetIndex !== undefined) {
        // Set basic properties for the link
        links.push({
          source: sourceIndex,
          target: targetIndex,
          value: d.value,
          sourceNode: nodes[sourceIndex],
          targetNode: nodes[targetIndex],
        });
      }
    }
  });

  // Step 6: Calculate link widths and positions
  const sankeyLinks = calculateLinkPositions(nodes, links);

  // Create a container group for transformation
  const g = svg.append("g");

  // Render links (below the nodes)
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

  // Render nodes (rectangles)
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

  // Render labels - placed outside the nodes
  g.append("g")
    .attr("font-family", "sans-serif")
    .attr("font-size", 10)
    .selectAll("text")
    .data(nodes)
    .join("text")
    .attr("x", (d) => (d.isSource ? d.x0 - 8 : d.x1 + 8)) // Left side labels to the left of nodes, right side labels to the right
    .attr("y", (d) => (d.y0 + d.y1) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", (d) => (d.isSource ? "end" : "start")) // Left text right-aligned, right text left-aligned
    .text((d) => d.name)
    .style("fill", "#333")
    .style("font-weight", "bold"); // Bold labels for better readability

  // Optional: Add white backgrounds to labels for better readability
  g.selectAll("text").each(function () {
    const text = d3.select(this);
    const bbox = this.getBBox();

    const rect = g
      .insert("rect", "text")
      .attr("x", bbox.x - 2)
      .attr("y", bbox.y - 2)
      .attr("width", bbox.width + 4)
      .attr("height", bbox.height + 4)
      .attr("fill", "white")
      .attr("fill-opacity", 0.7);

    text.raise(); // Ensure text is above the background rectangle
  });
});

// Helper function: Calculate link positions and widths
function calculateLinkPositions(nodes, links) {
  // Create collections of incoming and outgoing links for each node
  const nodeSourceLinks = nodes.map(() => []);
  const nodeTargetLinks = nodes.map(() => []);

  links.forEach((link) => {
    nodeSourceLinks[link.source].push(link);
    nodeTargetLinks[link.target].push(link);
  });

  // Calculate link heights for each node
  nodes.forEach((node, i) => {
    let y0 = node.y0;
    let y1 = node.y0;

    // Position source links
    nodeSourceLinks[i].sort((a, b) => nodes[a.target].y0 - nodes[b.target].y0);
    nodeSourceLinks[i].forEach((link) => {
      link.sourceY0 = y0;
      link.width = Math.max(1, (link.value / node.value) * (node.y1 - node.y0));
      y0 += link.width;
      link.sourceY1 = y0;
    });

    // Position target links
    nodeTargetLinks[i].sort((a, b) => nodes[a.source].y0 - nodes[b.source].y0);
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
