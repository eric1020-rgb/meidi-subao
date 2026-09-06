"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { SectorPoint, TideState } from "@/lib/types";
import { TIDE_LABELS, formatFlow } from "@/lib/colors";

interface Props {
  sectors: SectorPoint[];
  onSelect?: (s: SectorPoint | null) => void;
  selected?: string | null;
}

const STATE_ORDER: TideState[] = ["high", "rotation", "wait", "low"];

export default function BubbleChart({ sectors, onSelect, selected }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 480 });
  const [showAll, setShowAll] = useState(true);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setSize({ w: Math.max(320, cr.width), h: Math.max(360, cr.height) });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    if (showAll) return sectors;
    // top by magnitude
    return [...sectors].sort((a, b) => b.magnitude20d - a.magnitude20d).slice(0, 12);
  }, [sectors, showAll]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const margin = { top: 28, right: 20, bottom: 44, left: 48 };
    const width = size.w;
    const height = size.h;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const gRoot = svg.append("g").attr("class", "zoom-layer");
    const g = gRoot
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xExtent = d3.extent(data, (d) => d.flow5d) as [number, number];
    const yExtent = d3.extent(data, (d) => d.acceleration) as [number, number];
    const padX = Math.max(8, (xExtent[1] - xExtent[0]) * 0.15 || 10);
    const padY = Math.max(4, (yExtent[1] - yExtent[0]) * 0.15 || 5);

    const x = d3
      .scaleLinear()
      .domain([xExtent[0] - padX, xExtent[1] + padX])
      .range([0, innerW]);
    const y = d3
      .scaleLinear()
      .domain([yExtent[0] - padY, yExtent[1] + padY])
      .range([innerH, 0]);
    const r = d3
      .scaleSqrt()
      .domain([0, d3.max(data, (d) => d.magnitude20d) || 1])
      .range([10, 42]);

    // quadrant fills
    const x0 = x(0);
    const y0 = y(0);
    const quads: { state: TideState; x: number; y: number; w: number; h: number }[] = [
      { state: "high", x: x0, y: 0, w: innerW - x0, h: y0 },
      { state: "rotation", x: x0, y: y0, w: innerW - x0, h: innerH - y0 },
      { state: "wait", x: 0, y: 0, w: x0, h: y0 },
      { state: "low", x: 0, y: y0, w: x0, h: innerH - y0 },
    ];

    g.selectAll(".quad")
      .data(quads)
      .join("rect")
      .attr("class", "quad")
      .attr("x", (d) => d.x)
      .attr("y", (d) => d.y)
      .attr("width", (d) => Math.max(0, d.w))
      .attr("height", (d) => Math.max(0, d.h))
      .attr("fill", (d) => `var(--tide-${d.state})`)
      .attr("opacity", 0.06);

    // axes
    const xAxis = d3.axisBottom(x).ticks(6).tickSize(-innerH).tickFormat((v) => `${v}`);
    const yAxis = d3.axisLeft(y).ticks(6).tickSize(-innerW);

    g.append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(xAxis)
      .call((sel) => sel.select(".domain").remove())
      .call((sel) => sel.selectAll("line").attr("stroke", "var(--grid)").attr("stroke-dasharray", "2,3"))
      .call((sel) => sel.selectAll("text").attr("fill", "var(--ink-muted)").attr("font-size", 10));

    g.append("g")
      .attr("class", "axis y-axis")
      .call(yAxis)
      .call((sel) => sel.select(".domain").remove())
      .call((sel) => sel.selectAll("line").attr("stroke", "var(--grid)").attr("stroke-dasharray", "2,3"))
      .call((sel) => sel.selectAll("text").attr("fill", "var(--ink-muted)").attr("font-size", 10));

    // zero lines
    g.append("line")
      .attr("x1", x0)
      .attr("x2", x0)
      .attr("y1", 0)
      .attr("y2", innerH)
      .attr("stroke", "var(--ink-faint)")
      .attr("stroke-width", 1.5);
    g.append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", y0)
      .attr("y2", y0)
      .attr("stroke", "var(--ink-faint)")
      .attr("stroke-width", 1.5);

    // axis labels
    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 36)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--ink-muted)")
      .attr("font-size", 11)
      .text("← Outflow  |  ~5d net flow proxy  |  Inflow →");

    g.append("text")
      .attr("transform", `translate(${-34},${innerH / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--ink-muted)")
      .attr("font-size", 11)
      .text("Accel ↑  /  Decel ↓");

    const tooltip = d3
      .select(wrapRef.current)
      .selectAll<HTMLDivElement, unknown>(".chart-tooltip")
      .data([1])
      .join("div")
      .attr("class", "chart-tooltip")
      .style("opacity", 0);

    const nodes = g
      .selectAll(".bubble")
      .data(data, (d) => (d as SectorPoint).symbol)
      .join("g")
      .attr("class", "bubble")
      .attr("transform", (d) => `translate(${x(d.flow5d)},${y(d.acceleration)})`)
      .style("cursor", "pointer")
      .on("click", (_, d) => onSelect?.(d))
      .on("mouseenter", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(
            `<strong>${d.symbol}</strong> ${d.nameZh}<br/>` +
              `Flow5d: ${formatFlow(d.flow5d)} · Accel: ${d.acceleration.toFixed(1)}<br/>` +
              `Mag20d: ${d.magnitude20d.toFixed(1)} · ${TIDE_LABELS[d.state].zh}<br/>` +
              `${formatFlow(d.instFlowM / 100, "億")} · Lead ${d.leadTicker}`
          )
          .style("left", `${event.offsetX + 12}px`)
          .style("top", `${event.offsetY + 12}px`);
      })
      .on("mousemove", (event) => {
        tooltip.style("left", `${event.offsetX + 12}px`).style("top", `${event.offsetY + 12}px`);
      })
      .on("mouseleave", () => tooltip.style("opacity", 0));

    nodes
      .append("circle")
      .attr("r", (d) => r(d.magnitude20d))
      .attr("fill", (d) => `var(--tide-${d.state})`)
      .attr("fill-opacity", (d) => (selected && selected !== d.symbol ? 0.35 : 0.75))
      .attr("stroke", (d) => (selected === d.symbol ? "var(--ink)" : "transparent"))
      .attr("stroke-width", 2);

    nodes
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "var(--bubble-label)")
      .attr("font-size", (d) => Math.max(9, Math.min(12, r(d.magnitude20d) / 2.2)))
      .attr("font-weight", 600)
      .attr("pointer-events", "none")
      .text((d) => d.symbol);

    nodes
      .filter((d) => r(d.magnitude20d) > 22)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.5em")
      .attr("fill", "var(--bubble-label)")
      .attr("font-size", 8)
      .attr("opacity", 0.85)
      .attr("pointer-events", "none")
      .text((d) => formatFlow(d.flow5d));

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.6, 6])
      .on("zoom", (event) => {
        gRoot.attr("transform", event.transform.toString());
      });
    zoomRef.current = zoom;
    svg.call(zoom);

    return () => {
      svg.on(".zoom", null);
    };
  }, [data, size, selected, onSelect]);

  const resetZoom = () => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity);
  };

  return (
    <div className="flex h-full min-h-[420px] flex-col rounded-card border border-white/5 bg-surface-2">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-3 py-2">
        <h2 className="text-sm font-semibold text-ink">板塊泡泡圖 · Sector Bubbles</h2>
        <span className="text-xs text-ink-muted">X≈5d flow · Y≈accel · size≈20d mag</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="rounded-lg bg-surface-3 px-2.5 py-1 text-xs text-ink-muted hover:text-ink"
          >
            {showAll ? `全部 ${sectors.length}` : "顯示前 12"}
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="rounded-lg bg-surface-3 px-2.5 py-1 text-xs text-ink-muted hover:text-ink"
          >
            重設縮放
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 px-3 py-2">
        {STATE_ORDER.map((s) => (
          <div key={s} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: `var(--tide-${s})` }} />
            {TIDE_LABELS[s].zh} {TIDE_LABELS[s].en}
          </div>
        ))}
      </div>
      <div ref={wrapRef} className="relative min-h-0 flex-1 px-1 pb-1">
        <svg ref={svgRef} className="h-full w-full touch-none" role="img" aria-label="Sector bubble chart" />
      </div>
    </div>
  );
}
