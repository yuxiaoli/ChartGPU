import { ChartGPU } from "chartgpu";
import type {
  ChartGPUInstance,
  ChartGPUOptions,
  TooltipParams,
} from "chartgpu";
import { loadHoldings, type Holding } from "./utils/holdings";

type Mode = "weight" | "market" | "shares";
type Sort = "desc" | "asc";

const PALETTE = [
  "#6ee7ff",
  "#ff4ab0",
  "#ffd166",
  "#9b87ff",
  "#7af5b3",
  "#ff8a5c",
  "#5cb8ff",
  "#f06292",
  "#c5e063",
  "#ffb86b",
];

const state = {
  mode: "weight" as Mode,
  sort: "desc" as Sort,
  filter: "",
  selected: null as string | null,
  raw: [] as Holding[],
  view: [] as Holding[],
};

let chart: ChartGPUInstance | null = null;

function getValue(h: Holding, mode: Mode): number {
  switch (mode) {
    case "weight":
      return h.weight;
    case "market":
      return h.marketValue;
    case "shares":
      return h.shares;
  }
}

function formatValue(v: number, mode: Mode): string {
  if (mode === "weight") return `${v.toFixed(2)}%`;
  if (mode === "market") {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(2)}K`;
    return `$${v.toFixed(0)}`;
  }
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return v.toLocaleString();
}

function colorForIndex(i: number): string {
  return PALETTE[i % PALETTE.length] ?? "#6ee7ff";
}

function applyView() {
  const f = state.filter.trim().toLowerCase();
  let list = state.raw.filter((h) => {
    if (!f) return true;
    return (
      h.ticker.toLowerCase().includes(f) ||
      h.company.toLowerCase().includes(f)
    );
  });
  list = list.slice().sort((a, b) => {
    const va = getValue(a, state.mode);
    const vb = getValue(b, state.mode);
    return state.sort === "desc" ? vb - va : va - vb;
  });
  state.view = list;
}

const TOP_SLICES = 12;

function buildPieData() {
  const sorted = state.view
    .slice()
    .sort((a, b) => getValue(b, state.mode) - getValue(a, state.mode));
  const top = sorted.slice(0, TOP_SLICES);
  const rest = sorted.slice(TOP_SLICES);
  const restValue = rest.reduce((acc, h) => acc + getValue(h, state.mode), 0);

  const items = top.map((h, i) => {
    const isSelected = state.selected === h.ticker;
    return {
      name: `${h.ticker}`,
      value: getValue(h, state.mode),
      color: isSelected ? "#ffffff" : colorForIndex(i),
      _holding: h,
    };
  });
  if (restValue > 0) {
    items.push({
      name: "Other",
      value: restValue,
      color: "rgba(255,255,255,0.18)",
      _holding: undefined as unknown as Holding,
    });
  }
  return items;
}

function buildOptions(): ChartGPUOptions {
  const items = buildPieData();
  const modeName =
    state.mode === "weight"
      ? "Weight"
      : state.mode === "market"
        ? "Market Value"
        : "Shares";

  return {
    theme: "dark",
    palette: PALETTE,
    animation: { duration: 480, easing: "cubicOut" },
    legend: { show: true, position: "right" },
    tooltip: {
      show: true,
      trigger: "item",
      formatter: (params: TooltipParams | ReadonlyArray<TooltipParams>) => {
        const p = Array.isArray(params)
          ? (params as ReadonlyArray<TooltipParams>)[0]
          : (params as TooltipParams);
        if (!p) return "";
        const item = items[p.dataIndex];
        if (!item) return "";
        const h = item._holding;
        const heading = h
          ? `${h.ticker} · ${h.company}`
          : "Other holdings (aggregated)";
        const lines = [
          `<div style="font-weight:700;color:${p.color};font-size:13px">${heading}</div>`,
          `<div style="margin-top:4px;font-size:11px;color:#9aa3b8">${modeName}</div>`,
          `<div style="font-family:ui-monospace,monospace">${formatValue(item.value, state.mode)}</div>`,
        ];
        if (h) {
          lines.push(
            `<div style="margin-top:4px;font-size:11px;color:#9aa3b8">Weight</div>`,
            `<div style="font-family:ui-monospace,monospace">${h.weight.toFixed(2)}%</div>`,
            `<div style="margin-top:4px;font-size:11px;color:#9aa3b8">Market Value</div>`,
            `<div style="font-family:ui-monospace,monospace">${formatValue(h.marketValue, "market")}</div>`,
            `<div style="margin-top:4px;font-size:11px;color:#9aa3b8">Shares</div>`,
            `<div style="font-family:ui-monospace,monospace">${h.shares.toLocaleString()}</div>`,
          );
        }
        return lines.join("");
      },
    },
    series: [
      {
        type: "pie",
        name: modeName,
        radius: ["52%", "82%"],
        center: ["50%", "52%"],
        startAngle: 90,
        itemStyle: { borderRadius: 4, borderWidth: 2 },
        data: items.map((it) => ({
          name: it.name,
          value: it.value,
          color: it.color,
        })),
      },
    ],
  };
}

function renderHoldings() {
  const root = document.getElementById("holdings")!;
  root.innerHTML = "";
  state.view.forEach((h, i) => {
    const row = document.createElement("div");
    row.className = "row" + (state.selected === h.ticker ? " active" : "");
    row.dataset.ticker = h.ticker;
    const dot = document.createElement("span");
    dot.className = "ticker";
    dot.style.color = colorForIndex(i);
    dot.style.borderColor = colorForIndex(i) + "55";
    dot.textContent = h.ticker;
    const name = document.createElement("div");
    name.className = "company";
    name.innerHTML = `${h.company}<small>${formatValue(
      h.marketValue,
      "market",
    )} · ${h.shares.toLocaleString()} sh</small>`;
    const w = document.createElement("div");
    w.className = "weight";
    w.textContent = formatValue(getValue(h, state.mode), state.mode);
    row.append(dot, name, w);
    row.addEventListener("click", () => {
      state.selected = state.selected === h.ticker ? null : h.ticker;
      renderHoldings();
      void refreshChart();
    });
    root.appendChild(row);
  });
}

function renderMeta() {
  const date = state.raw[0]?.date ?? "—";
  document.getElementById("meta-date")!.textContent = date;
  document.getElementById("meta-count")!.textContent = String(state.raw.length);
  const top10 = state.raw
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10)
    .reduce((acc, h) => acc + h.weight, 0);
  document.getElementById("meta-top")!.textContent = `${top10.toFixed(1)}%`;
}

function renderDonutCenter() {
  const items = buildPieData();
  const total = items.reduce((acc, it) => acc + it.value, 0);
  const labelEl = document.getElementById("donut-label");
  const valueEl = document.getElementById("donut-value");
  const subEl = document.getElementById("donut-sub");
  if (!labelEl || !valueEl || !subEl) return;
  const modeLabel =
    state.mode === "weight"
      ? "Total Weight"
      : state.mode === "market"
        ? "Total Market Value"
        : "Total Shares";
  if (state.selected) {
    const h = state.raw.find((x) => x.ticker === state.selected);
    if (h) {
      labelEl.textContent = h.ticker;
      valueEl.textContent = formatValue(getValue(h, state.mode), state.mode);
      subEl.textContent = h.company;
      return;
    }
  }
  labelEl.textContent = modeLabel;
  valueEl.textContent = formatValue(total, state.mode);
  subEl.textContent = `Top ${TOP_SLICES} + Other`;
}

async function refreshChart() {
  applyView();
  renderDonutCenter();
  if (!chart) return;
  chart.setOption(buildOptions());
}

function bindToolbar() {
  const chips = document.querySelectorAll<HTMLElement>(".chip[data-mode]");
  chips.forEach((el) => {
    el.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("active"));
      el.classList.add("active");
      state.mode = el.dataset.mode as Mode;
      void refreshChart();
      renderHoldings();
    });
  });
  const sortChips = document.querySelectorAll<HTMLElement>(".chip[data-sort]");
  sortChips.forEach((el) => {
    el.addEventListener("click", () => {
      sortChips.forEach((c) => c.classList.remove("active"));
      el.classList.add("active");
      state.sort = el.dataset.sort as Sort;
      void refreshChart();
      renderHoldings();
    });
  });
  const search = document.getElementById("search") as HTMLInputElement;
  search.addEventListener("input", () => {
    state.filter = search.value;
    void refreshChart();
    renderHoldings();
  });
}

function showFallback(msg: string) {
  const fb = document.getElementById("fallback")!;
  fb.style.display = "flex";
  fb.textContent = msg;
}

function renderSourceBadge(
  source: "network" | "cache" | "stale-cache" | "bundled",
  fetchedAt?: number,
) {
  const el = document.getElementById("source-badge");
  if (!el) return;
  const labels: Record<typeof source, string> = {
    network: "Live",
    cache: "Cached",
    "stale-cache": "Cached (offline)",
    bundled: "Bundled snapshot",
  } as const;
  const colors: Record<typeof source, string> = {
    network: "#7af5b3",
    cache: "#6ee7ff",
    "stale-cache": "#ffd166",
    bundled: "#ff8a5c",
  } as const;
  const ageMin = fetchedAt
    ? Math.max(0, Math.round((Date.now() - fetchedAt) / 60000))
    : null;
  const ageStr =
    ageMin === null
      ? ""
      : ageMin < 1
        ? " · just now"
        : ageMin < 60
          ? ` · ${ageMin}m ago`
          : ` · ${Math.round(ageMin / 60)}h ago`;
  el.textContent = `${labels[source]}${ageStr}`;
  el.style.color = colors[source];
  el.style.borderColor = colors[source] + "55";
}

async function main() {
  bindToolbar();
  let result: Awaited<ReturnType<typeof loadHoldings>>;
  try {
    result = await loadHoldings();
    state.raw = result.holdings;
  } catch (e) {
    showFallback(`Failed to load holdings: ${(e as Error).message}`);
    return;
  }
  renderSourceBadge(result.source, result.fetchedAt);
  renderMeta();
  applyView();
  renderHoldings();
  renderDonutCenter();

  const container = document.getElementById("chart") as HTMLElement;
  if (!("gpu" in navigator)) {
    showFallback(
      "WebGPU is not available in this browser. Try the latest Chrome, Edge, or any Chromium-based browser with WebGPU enabled.",
    );
    return;
  }
  try {
    chart = await ChartGPU.create(container, buildOptions());
    window.addEventListener("resize", () => chart?.resize());
  } catch (e) {
    showFallback(`Could not initialize ChartGPU: ${(e as Error).message}`);
  }
}

void main();
