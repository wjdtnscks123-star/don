const DEFAULT_ASSETS = [
  // 값들은 “예시 시작점”입니다(교육용). 필요 시 수정하세요.
  { enabled: true, name: "미국 주식", ticker: "VTI/VOO", type: "stock", mu: 9.0, vol: 18.0 },
  { enabled: true, name: "선진국(미국 제외) 주식", ticker: "VEA", type: "stock", mu: 8.0, vol: 19.0 },
  { enabled: true, name: "신흥국 주식", ticker: "VWO", type: "stock", mu: 10.5, vol: 23.0 },
  { enabled: true, name: "국채(중장기)", ticker: "IEF/TLT", type: "bond", mu: 4.0, vol: 7.0 },
  { enabled: true, name: "금", ticker: "GLD/IAU", type: "gold", mu: 5.0, vol: 15.0 },
  { enabled: false, name: "현금/MMF", ticker: "BIL", type: "cash", mu: 3.0, vol: 1.0 },
];

const QUICK_ADD = [
  // 대표적인 ETF/지수 “예시” (교육용). 지역/거래소에 따라 접근 가능한 종목은 다를 수 있어요.
  { group: "주식(미국)", name: "S&P 500", ticker: "VOO / SPY", type: "stock", mu: 9.0, vol: 18.0 },
  { group: "주식(미국)", name: "미국 전체시장", ticker: "VTI", type: "stock", mu: 9.0, vol: 18.5 },
  { group: "주식(미국)", name: "나스닥 100", ticker: "QQQ", type: "stock", mu: 10.0, vol: 22.0 },
  { group: "주식(글로벌)", name: "전세계(주식)", ticker: "VT", type: "stock", mu: 8.5, vol: 17.0 },
  { group: "주식(글로벌)", name: "선진국(미국 제외)", ticker: "VEA", type: "stock", mu: 8.0, vol: 19.0 },
  { group: "주식(글로벌)", name: "신흥국", ticker: "VWO", type: "stock", mu: 10.5, vol: 23.0 },
  { group: "채권", name: "미국 종합채권", ticker: "BND / AGG", type: "bond", mu: 4.0, vol: 6.0 },
  { group: "채권", name: "미국 국채 7-10년", ticker: "IEF", type: "bond", mu: 4.0, vol: 7.0 },
  { group: "채권", name: "미국 장기국채 20년+", ticker: "TLT", type: "bond", mu: 4.5, vol: 14.0 },
  { group: "채권", name: "물가연동채(TIPS)", ticker: "TIP", type: "bond", mu: 4.0, vol: 7.0 },
  { group: "대안", name: "금", ticker: "GLD / IAU", type: "gold", mu: 5.0, vol: 15.0 },
  { group: "대안", name: "미국 리츠", ticker: "VNQ", type: "reit", mu: 7.0, vol: 18.0 },
  { group: "현금", name: "초단기 국채(현금 대체)", ticker: "BIL / SHV", type: "cash", mu: 3.0, vol: 1.0 },
];

const PRESETS = {
  balanced: (a) => a,
  bull: (a) =>
    a.map((x) => {
      if (x.type === "stock") return { ...x, mu: x.mu + 2.0, vol: x.vol + 1.0 };
      if (x.type === "bond") return { ...x, mu: x.mu - 0.5, vol: x.vol + 0.5 };
      return x;
    }),
  bear: (a) =>
    a.map((x) => {
      if (x.type === "stock") return { ...x, mu: Math.max(-2, x.mu - 3.0), vol: x.vol + 4.0 };
      if (x.type === "bond") return { ...x, mu: x.mu + 0.5, vol: x.vol + 1.0 };
      if (x.type === "gold") return { ...x, mu: x.mu + 1.0, vol: x.vol + 1.0 };
      return x;
    }),
};

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function fmtPct(n, d = 1) {
  const v = Number.isFinite(n) ? n : 0;
  return `${v.toFixed(d)}%`;
}

function showNotice(message, type = "ok") {
  const el = $("notice");
  el.textContent = message ?? "";
  el.classList.remove("ok", "err");
  if (message) el.classList.add(type === "err" ? "err" : "ok");
}

function typeLabel(t) {
  switch (t) {
    case "stock":
      return "주식";
    case "bond":
      return "채권";
    case "gold":
      return "금/원자재";
    case "reit":
      return "리츠";
    case "cash":
      return "현금";
    default:
      return "기타";
  }
}

function baseCorr(typeA, typeB) {
  // 유형 기반 “대략적” 상관관계(교육용)
  if (typeA === typeB) {
    if (typeA === "cash") return 1.0;
    if (typeA === "bond") return 0.6;
    if (typeA === "gold") return 0.5;
    if (typeA === "reit") return 0.75;
    return 0.85; // stock/other
  }

  const key = [typeA, typeB].sort().join("|");
  const map = {
    "bond|cash": 0.05,
    "cash|gold": 0.0,
    "cash|reit": 0.05,
    "cash|stock": 0.05,
    "bond|gold": 0.05,
    "bond|reit": 0.2,
    "bond|stock": 0.15,
    "gold|reit": 0.15,
    "gold|stock": 0.1,
    "reit|stock": 0.65,
  };
  return map[key] ?? 0.2;
}

function buildCovMatrix(assets, corrScale) {
  const n = assets.length;
  const cov = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const vi = assets[i].vol / 100;
      const vj = assets[j].vol / 100;
      if (i === j) {
        cov[i][j] = vi * vi;
      } else {
        const rho0 = baseCorr(assets[i].type, assets[j].type);
        const rho = clamp(rho0 * corrScale, -0.95, 0.95);
        cov[i][j] = rho * vi * vj;
      }
    }
  }
  return cov;
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function matVec(m, v) {
  const out = new Array(m.length).fill(0);
  for (let i = 0; i < m.length; i++) {
    let s = 0;
    for (let j = 0; j < v.length; j++) s += m[i][j] * v[j];
    out[i] = s;
  }
  return out;
}

function portfolioStats(w, muVec, cov, rf) {
  const expRet = dot(w, muVec); // in %
  const v = matVec(cov, w);
  const varP = dot(w, v); // in (decimal^2)
  const vol = Math.sqrt(Math.max(0, varP)) * 100; // %
  const sharpe = vol > 0 ? (expRet - rf) / vol : 0;
  return { expRet, vol, sharpe };
}

function dirichletWeights(n) {
  // 간단한 Dirichlet(1) 샘플: -ln(U) 정규화
  const x = new Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const u = Math.max(1e-12, Math.random());
    const v = -Math.log(u);
    x[i] = v;
    sum += v;
  }
  return x.map((v) => v / sum);
}

function applyCap(w, cap) {
  // cap 초과분을 비례 재분배(단순 휴리스틱)
  const n = w.length;
  let changed = true;
  let iter = 0;
  const out = w.slice();
  while (changed && iter++ < 50) {
    changed = false;
    let excess = 0;
    let freeSum = 0;
    for (let i = 0; i < n; i++) {
      if (out[i] > cap) {
        excess += out[i] - cap;
        out[i] = cap;
        changed = true;
      } else {
        freeSum += out[i];
      }
    }
    if (!changed) break;
    if (freeSum <= 1e-12) break;
    for (let i = 0; i < n; i++) {
      if (out[i] < cap) out[i] += (out[i] / freeSum) * excess;
    }
  }

  // 마지막 정규화
  const s = out.reduce((a, b) => a + b, 0);
  if (s > 0) for (let i = 0; i < n; i++) out[i] /= s;
  return out;
}

function runSearch({ assets, targetReturn, rfRate, trials, corrScale, constraintMode }) {
  const n = assets.length;
  const muVec = assets.map((a) => a.mu);
  const cov = buildCovMatrix(assets, corrScale);

  const cap = constraintMode === "capped" ? 0.6 : 1.0;

  let bestMeet = null; // {w, stats}
  let bestSharpe = null;
  let bestClosest = null; // return closest above? or max return if none meets

  const points = [];

  for (let t = 0; t < trials; t++) {
    let w = dirichletWeights(n);
    if (cap < 1.0) w = applyCap(w, cap);

    const stats = portfolioStats(w, muVec, cov, rfRate);
    points.push({ r: stats.expRet, v: stats.vol });

    if (!bestClosest) bestClosest = { w, stats };
    // Closest to target in absolute terms (prefer higher return if tie)
    const d0 = Math.abs(bestClosest.stats.expRet - targetReturn);
    const d1 = Math.abs(stats.expRet - targetReturn);
    if (d1 < d0 || (Math.abs(d1 - d0) < 1e-9 && stats.expRet > bestClosest.stats.expRet)) {
      bestClosest = { w, stats };
    }

    if (stats.expRet >= targetReturn) {
      if (!bestMeet || stats.vol < bestMeet.stats.vol) bestMeet = { w, stats };
      if (!bestSharpe || stats.sharpe > bestSharpe.stats.sharpe) bestSharpe = { w, stats };
    } else {
      // If none meets, track max return (with lower vol as tie-break)
      if (stats.expRet > bestClosest.stats.expRet + 1e-9) {
        // handled by closest, but keep anyway
      }
    }
  }

  const chosen = bestMeet ?? bestClosest;
  return { chosen, bestMeet, bestSharpe, points };
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, String(v));
  }
  for (const ch of children) node.appendChild(ch);
  return node;
}

function readAssetsFromTable() {
  const rows = Array.from(document.querySelectorAll("[data-asset-row]"));
  const assets = rows
    .map((row) => {
      const enabled = row.querySelector('[name="enabled"]').checked;
      const name = row.querySelector('[name="name"]').value.trim() || "자산";
      const ticker = row.querySelector('[name="ticker"]').value.trim();
      const type = row.querySelector('[name="type"]').value;
      const mu = Number(row.querySelector('[name="mu"]').value);
      const vol = Number(row.querySelector('[name="vol"]').value);
      return {
        enabled,
        name,
        ticker,
        type,
        mu: clamp(Number.isFinite(mu) ? mu : 0, -99, 99),
        vol: clamp(Number.isFinite(vol) ? vol : 0, 0.1, 99),
      };
    })
    .filter((a) => a.enabled);

  return assets;
}

function renderAssetTable(assets) {
  const body = $("assetBody");
  body.innerHTML = "";

  assets.forEach((a, idx) => {
    const row = el("tr", { "data-asset-row": "1" }, [
      el("td", {}, [
        (() => {
          const cb = el("input", { type: "checkbox", name: "enabled" });
          cb.checked = !!a.enabled;
          return cb;
        })(),
      ]),
      el("td", {}, [el("input", { class: "input", name: "name", value: a.name })]),
      el("td", {}, [el("input", { class: "input", name: "ticker", value: a.ticker ?? "" })]),
      el("td", {}, [
        (() => {
          const sel = el("select", { class: "select", name: "type" });
          const options = [
            ["stock", "주식"],
            ["bond", "채권"],
            ["reit", "리츠"],
            ["gold", "금/원자재"],
            ["cash", "현금"],
            ["other", "기타"],
          ];
          for (const [v, label] of options) {
            const opt = el("option", { value: v, text: label });
            if (a.type === v) opt.selected = true;
            sel.appendChild(opt);
          }
          return sel;
        })(),
      ]),
      el("td", {}, [el("input", { class: "input", name: "mu", type: "number", step: "0.1", value: a.mu })]),
      el("td", {}, [
        el("input", { class: "input", name: "vol", type: "number", step: "0.1", value: a.vol }),
      ]),
      el("td", {}, [
        el("button", {
          class: "miniBtn",
          type: "button",
          text: "삭제",
          onclick: () => {
            const next = getTableAssetsAll();
            next.splice(idx, 1);
            renderAssetTable(next);
          },
        }),
      ]),
    ]);
    body.appendChild(row);
  });
}

function getTableAssetsAll() {
  // enabled 포함 전체를 유지하려면, 현재 테이블을 전체 읽고 enabled 필터링 없이 반환
  const rows = Array.from(document.querySelectorAll("[data-asset-row]"));
  return rows.map((row) => {
    const enabled = row.querySelector('[name="enabled"]').checked;
    const name = row.querySelector('[name="name"]').value.trim() || "자산";
    const ticker = row.querySelector('[name="ticker"]').value.trim();
    const type = row.querySelector('[name="type"]').value;
    const mu = Number(row.querySelector('[name="mu"]').value);
    const vol = Number(row.querySelector('[name="vol"]').value);
    return {
      enabled,
      name,
      ticker,
      type,
      mu: clamp(Number.isFinite(mu) ? mu : 0, -99, 99),
      vol: clamp(Number.isFinite(vol) ? vol : 0, 0.1, 99),
    };
  });
}

function renderAlloc(assets, w) {
  const root = $("alloc");
  root.innerHTML = "";

  assets.forEach((a, i) => {
    const pct = w[i] * 100;
    const t = (a.ticker ?? "").trim();
    const extra = t ? ` · ${t}` : "";
    root.appendChild(
      el("div", { class: "allocRow" }, [
        el("div", { class: "allocName", text: `${a.name}${extra} · ${typeLabel(a.type)}` }),
        el("div", { class: "allocPct", text: pct.toFixed(1) + "%" }),
        el("div", { class: "bar" }, [el("div", { class: "barFill", style: `width:${pct}%` })]),
      ])
    );
  });
}

function renderMetrics({ expRet, vol, sharpe }, target, rf) {
  const root = $("metrics");
  root.innerHTML = "";
  const diff = expRet - target;

  const items = [
    ["기대수익률(연)", fmtPct(expRet, 2)],
    ["목표 대비", `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}%p`],
    ["변동성(연)", fmtPct(vol, 2)],
    ["샤프(대략)", (Number.isFinite(sharpe) ? sharpe : 0).toFixed(2)],
    ["무위험 수익률", fmtPct(rf, 1)],
  ];

  for (const [label, value] of items) {
    root.appendChild(
      el("div", { class: "metric" }, [el("div", { class: "metricLabel", text: label }), el("div", { class: "metricValue", text: value })])
    );
  }
}

function drawChart(canvas, points, chosenPoint) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Handle high-DPI
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const W = cssW;
  const H = cssH;
  ctx.clearRect(0, 0, W, H);

  const pad = 38;
  const xs = points.map((p) => p.v);
  const ys = points.map((p) => p.r);
  const minX = Math.max(0, Math.min(...xs) - 1);
  const maxX = Math.max(...xs, (chosenPoint?.v ?? 0) + 1);
  const minY = Math.min(...ys, (chosenPoint?.r ?? 0)) - 1;
  const maxY = Math.max(...ys, (chosenPoint?.r ?? 0)) + 1;

  const x0 = pad;
  const y0 = H - pad;
  const x1 = W - pad;
  const y1 = pad;

  const xScale = (x) => x0 + ((x - minX) / Math.max(1e-9, maxX - minX)) * (x1 - x0);
  const yScale = (y) => y0 - ((y - minY) / Math.max(1e-9, maxY - minY)) * (y0 - y1);

  // Axes
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y1);
  ctx.lineTo(x0, y0);
  ctx.lineTo(x1, y0);
  ctx.stroke();

  // Labels
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
  ctx.fillText("vol(%)", x1 - 56, y0 + 24);
  ctx.fillText("ret(%)", x0 - 34, y1 - 10);

  // Points
  ctx.fillStyle = "rgba(124,92,255,0.22)";
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const x = xScale(p.v);
    const y = yScale(p.r);
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }

  if (chosenPoint) {
    const x = xScale(chosenPoint.v);
    const y = yScale(chosenPoint.r);
    ctx.fillStyle = "rgba(33,192,122,0.95)";
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(33,192,122,0.35)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function makeCopyText(assets, w, stats, target) {
  const lines = [];
  lines.push(`목표 기대수익률: ${target.toFixed(1)}%`);
  lines.push(`추천 기대수익률: ${stats.expRet.toFixed(2)}% / 변동성: ${stats.vol.toFixed(2)}% / 샤프(대략): ${stats.sharpe.toFixed(2)}`);
  lines.push("");
  for (let i = 0; i < assets.length; i++) {
    const t = (assets[i].ticker ?? "").trim();
    const extra = t ? ` · ${t}` : "";
    lines.push(`${(w[i] * 100).toFixed(1)}%  ${assets[i].name}${extra} (${typeLabel(assets[i].type)})`);
  }
  return lines.join("\n");
}

function applyPresetToTable(presetKey) {
  const currentAll = getTableAssetsAll();
  const applied = (PRESETS[presetKey] ?? PRESETS.balanced)(currentAll);
  renderAssetTable(applied);
  showNotice("프리셋을 적용했어요. 표에서 값은 언제든 수정할 수 있어요.", "ok");
}

function resetAll() {
  $("targetReturn").value = "15";
  $("rfRate").value = "3";
  $("corrScale").value = "1";
  $("preset").value = "balanced";
  $("trials").value = "50000";
  $("constraints").value = "long_only";
  renderAssetTable(DEFAULT_ASSETS.map((x) => ({ ...x })));
  $("alloc").innerHTML = "";
  $("metrics").innerHTML = "";
  $("resultMeta").textContent = "";
  $("copyBtn").disabled = true;
  const canvas = $("chart");
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  showNotice("기본값으로 초기화했어요.", "ok");
}

function main() {
  renderAssetTable(DEFAULT_ASSETS.map((x) => ({ ...x })));

  // Quick add dropdown
  const sel = $("quickAddSelect");
  sel.innerHTML = "";
  sel.appendChild(el("option", { value: "", text: "선택하세요…" }));
  QUICK_ADD.forEach((q, i) => {
    sel.appendChild(el("option", { value: String(i), text: `[${q.group}] ${q.name} · ${q.ticker}` }));
  });

  $("quickAddBtn").addEventListener("click", () => {
    const v = String(sel.value || "");
    if (!v) {
      showNotice("추가할 대표 종목/ETF를 먼저 선택해 주세요.", "err");
      return;
    }
    const q = QUICK_ADD[Number(v)];
    if (!q) {
      showNotice("선택한 항목을 찾을 수 없어요.", "err");
      return;
    }
    const next = getTableAssetsAll();
    next.push({ enabled: true, name: q.name, ticker: q.ticker, type: q.type, mu: q.mu, vol: q.vol });
    renderAssetTable(next);
    sel.value = "";
    showNotice("대표 종목/ETF를 표에 추가했어요. (값은 필요에 맞게 수정)", "ok");
  });

  $("preset").addEventListener("change", (e) => {
    applyPresetToTable(e.target.value);
  });

  $("addAssetBtn").addEventListener("click", () => {
    const next = getTableAssetsAll();
    next.push({ enabled: true, name: "새 자산", ticker: "", type: "other", mu: 8.0, vol: 15.0 });
    renderAssetTable(next);
  });

  $("resetBtn").addEventListener("click", resetAll);

  let lastResult = null;

  $("runBtn").addEventListener("click", () => {
    showNotice("");

    const target = Number($("targetReturn").value);
    const rf = Number($("rfRate").value);
    const corrScale = Number($("corrScale").value);
    const trials = Number($("trials").value);
    const constraintMode = $("constraints").value;

    const assets = readAssetsFromTable();
    if (assets.length < 2) {
      showNotice("자산을 최소 2개 이상 선택(사용 체크)해 주세요.", "err");
      return;
    }

    if (!Number.isFinite(target)) {
      showNotice("목표 연수익률 값을 확인해 주세요.", "err");
      return;
    }

    const t0 = performance.now();
    const { chosen, bestMeet, bestSharpe, points } = runSearch({
      assets,
      targetReturn: target,
      rfRate: Number.isFinite(rf) ? rf : 0,
      trials: Number.isFinite(trials) ? trials : 50000,
      corrScale: Number.isFinite(corrScale) ? corrScale : 1,
      constraintMode,
    });
    const t1 = performance.now();

    const chosenPoint = { r: chosen.stats.expRet, v: chosen.stats.vol };
    renderAlloc(assets, chosen.w);
    renderMetrics(chosen.stats, target, Number.isFinite(rf) ? rf : 0);
    drawChart($("chart"), points, chosenPoint);

    const met = bestMeet ? "목표 달성 후보 중 ‘변동성 최소’" : "목표 미달(가정상 도달 어려움) · 목표 근접안";
    const extra =
      bestSharpe && bestMeet
        ? ` / (참고) 목표달성 후보 중 최고 샤프: ${bestSharpe.stats.sharpe.toFixed(2)}`
        : "";

    $("resultMeta").textContent = `${met} · ${assets.length}자산 · ${trials.toLocaleString()}회 탐색 · ${Math.round(
      t1 - t0
    )}ms${extra}`;

    if (!bestMeet) {
      showNotice(
        "현재 가정값(기대수익률/변동성/상관관계)에서는 15% 목표가 잘 안 나와요. 주식 기대수익률을 올리거나 자산 구성을 바꿔 다시 실행해 보세요.",
        "err"
      );
    } else {
      showNotice("추천 비중을 찾았어요. (가정 기반)", "ok");
    }

    lastResult = { assets, w: chosen.w, stats: chosen.stats, target };
    $("copyBtn").disabled = false;
  });

  $("copyBtn").addEventListener("click", async () => {
    if (!lastResult) return;
    try {
      await navigator.clipboard.writeText(makeCopyText(lastResult.assets, lastResult.w, lastResult.stats, lastResult.target));
      showNotice("추천 비중을 복사했어요.", "ok");
    } catch {
      showNotice("복사 권한이 없어요. (HTTP 환경/권한 설정 확인)", "err");
    }
  });
}

document.addEventListener("DOMContentLoaded", main);

