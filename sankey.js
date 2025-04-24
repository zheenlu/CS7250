const svg = d3.select("#sankey");
const width = +svg.attr("width");
const height = +svg.attr("height");

const sankey = d3
  .sankey()
  .nodeWidth(15)
  .nodePadding(10)
  .extent([
    [1, 1],
    [width - 1, height - 6],
  ])
  .nodeId((d) => d.name);

d3.csv("data/estat.csv").then((data) => {
  const migration = {};

  data.forEach((d) => {
    const source = d.geo?.trim();
    const target = d.partner?.trim();
    const value = +d.OBS_VALUE;

    if (
      !source ||
      !target ||
      source === target ||
      isNaN(value) ||
      value === 0
    ) {
      if (source === target) {
        console.warn("⛔ Skipped self-loop:", source, target, value);
      }
      return;
    }

    const key = `${source}->${target}`;
    if (!migration[key]) {
      migration[key] = { source, target, value: 0 };
    }
    migration[key].value += value;
  });

  const links = Object.values(migration);
  const nodesSet = new Set();
  links.forEach((d) => {
    nodesSet.add(d.source);
    nodesSet.add(d.target);
  });
  const nodes = Array.from(nodesSet).map((name) => ({ name: String(name) }));

  const filteredLinks = links.filter(
    (link) =>
      !links.some(
        (other) => other.source === link.target && other.target === link.source
      )
  );

  const graph = {
    nodes,
    links: filteredLinks.map((d) => ({
      source: d.source,
      target: d.target,
      value: d.value,
    })),
  };

  console.log(
    "🌍 All node names:",
    nodes.map((d) => d.name)
  );
  console.log("🧩 Total links:", graph.links.length);

  let sankeyNodes, sankeyLinks;
  try {
    ({ nodes: sankeyNodes, links: sankeyLinks } = sankey(graph));
  } catch (err) {
    console.error("🚨 Sankey rendering error:", err);
    return;
  }

  svg
    .append("g")
    .selectAll("rect")
    .data(sankeyNodes)
    .join("rect")
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("height", (d) => d.y1 - d.y0)
    .attr("width", (d) => d.x1 - d.x0)
    .attr("fill", "#4f46e5")
    .append("title")
    .text((d) => d.name);

  svg
    .append("g")
    .attr("fill", "none")
    .selectAll("path")
    .data(sankeyLinks)
    .join("path")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke", "#aaa")
    .attr("stroke-width", (d) => Math.max(1, d.width))
    .attr("opacity", 0.5)
    .append("title")
    .text((d) => `${d.source.name} → ${d.target.name}\n${d.value}`);
});
