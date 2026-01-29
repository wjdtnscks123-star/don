const LOTTO = Object.freeze({
  min: 1,
  max: 45,
  pick: 6,
});

const STORAGE_KEY = "lotto_recommender_history_v1";

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: #${id}`);
  return el;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

function parseNumbers(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return [];
  const parts = raw.split(/[\s,]+/).filter(Boolean);
  const nums = parts
    .map((p) => Number(p))
    .filter((n) => Number.isInteger(n))
    .map((n) => clamp(n, LOTTO.min, LOTTO.max));
  return uniq(nums);
}

function ballClass(n) {
  if (n <= 10) return "y";
  if (n <= 20) return "b";
  if (n <= 30) return "r";
  if (n <= 40) return "g";
  return "d";
}

function nowText(d = new Date()) {
  // e.g. 2026-01-29 14:03:12
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

function showNotice(message, type = "ok") {
  const notice = $("notice");
  notice.textContent = message ?? "";
  notice.classList.remove("ok", "err");
  if (message) notice.classList.add(type === "err" ? "err" : "ok");
}

function validateConstraints(include, exclude) {
  const includeSet = new Set(include);
  const excludeSet = new Set(exclude);

  for (const n of includeSet) {
    if (excludeSet.has(n)) {
      return { ok: false, message: `포함/제외 목록에 같은 번호가 있어요: ${n}` };
    }
  }

  if (include.length > LOTTO.pick) {
    return { ok: false, message: `포함할 번호는 최대 ${LOTTO.pick}개까지 가능해요.` };
  }

  const poolSize = LOTTO.max - LOTTO.min + 1 - exclude.length;
  if (poolSize < LOTTO.pick) {
    return { ok: false, message: "제외 번호가 너무 많아서 추천을 만들 수 없어요." };
  }

  if (exclude.length >= LOTTO.max - LOTTO.min + 1) {
    return { ok: false, message: "모든 번호를 제외해서 추천을 만들 수 없어요." };
  }

  return { ok: true };
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeOneSet({ include, exclude, sortMode }) {
  const chosen = new Set(include);
  const excluded = new Set(exclude);

  while (chosen.size < LOTTO.pick) {
    const n = randomInt(LOTTO.min, LOTTO.max);
    if (chosen.has(n)) continue;
    if (excluded.has(n)) continue;
    chosen.add(n);
  }

  const arr = Array.from(chosen);
  if (sortMode === "asc") arr.sort((a, b) => a - b);
  return arr;
}

function renderResults(sets) {
  const list = $("results");
  list.innerHTML = "";

  sets.forEach((nums, idx) => {
    const li = document.createElement("li");
    li.className = "resultRow";

    const label = document.createElement("div");
    label.className = "setLabel";
    label.textContent = `SET ${String(idx + 1).padStart(2, "0")}`;

    const balls = document.createElement("div");
    balls.className = "balls";
    nums.forEach((n) => {
      const s = document.createElement("span");
      s.className = `ball ${ballClass(n)}`;
      s.textContent = String(n);
      balls.appendChild(s);
    });

    li.appendChild(label);
    li.appendChild(balls);
    list.appendChild(li);
  });
}

function makeCopyText(sets) {
  return sets
    .map((nums, i) => `SET ${String(i + 1).padStart(2, "0")}: ${nums.join(", ")}`)
    .join("\n");
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x === "object" && Array.isArray(x.sets) && typeof x.time === "string")
      .slice(0, 20);
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 20)));
}

function renderHistory(history) {
  const list = $("history");
  list.innerHTML = "";

  history.forEach((item, idx) => {
    const li = document.createElement("li");
    li.className = "historyItem";

    const top = document.createElement("div");
    top.className = "historyTop";

    const time = document.createElement("div");
    time.className = "historyTime";
    time.textContent = item.time;

    const actions = document.createElement("div");
    actions.className = "historyActions";

    const useBtn = document.createElement("button");
    useBtn.className = "miniBtn";
    useBtn.type = "button";
    useBtn.textContent = "불러오기";
    useBtn.addEventListener("click", () => {
      renderResults(item.sets);
      $("metaText").textContent = `기록 불러옴 · ${item.sets.length}세트`;
      $("copyBtn").disabled = item.sets.length === 0;
      showNotice("기록을 불러왔어요.", "ok");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    const copyBtn = document.createElement("button");
    copyBtn.className = "miniBtn";
    copyBtn.type = "button";
    copyBtn.textContent = "복사";
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(makeCopyText(item.sets));
        showNotice("복사했어요.", "ok");
      } catch {
        showNotice("복사 권한이 없어요. (HTTP 환경/권한 설정 확인)", "err");
      }
    });

    const delBtn = document.createElement("button");
    delBtn.className = "miniBtn";
    delBtn.type = "button";
    delBtn.textContent = "삭제";
    delBtn.addEventListener("click", () => {
      const next = history.slice();
      next.splice(idx, 1);
      saveHistory(next);
      renderHistory(next);
      showNotice("기록을 삭제했어요.", "ok");
    });

    actions.appendChild(useBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(delBtn);

    top.appendChild(time);
    top.appendChild(actions);

    const pre = document.createElement("pre");
    pre.style.margin = "0";
    pre.style.whiteSpace = "pre-wrap";
    pre.style.fontFamily = "var(--mono)";
    pre.style.fontSize = "12px";
    pre.style.color = "var(--muted)";
    pre.textContent = makeCopyText(item.sets);

    li.appendChild(top);
    li.appendChild(pre);
    list.appendChild(li);
  });
}

async function copyCurrent() {
  const results = $("results");
  const rows = results.querySelectorAll(".resultRow .balls");
  if (!rows.length) return;

  // Rebuild from DOM to avoid global state mismatch
  const sets = Array.from(rows).map((ballsEl) =>
    Array.from(ballsEl.querySelectorAll(".ball")).map((b) => Number(b.textContent))
  );
  try {
    await navigator.clipboard.writeText(makeCopyText(sets));
    showNotice("추천 번호를 모두 복사했어요.", "ok");
  } catch {
    showNotice("복사 권한이 없어요. (HTTP 환경/권한 설정 확인)", "err");
  }
}

function setupSetCountStepper() {
  const input = $("setCount");
  const minus = $("minusSets");
  const plus = $("plusSets");

  function normalize() {
    const v = clamp(Number(input.value || 1), 1, 10);
    input.value = String(v);
  }

  input.addEventListener("change", normalize);
  input.addEventListener("blur", normalize);

  minus.addEventListener("click", () => {
    input.value = String(clamp(Number(input.value || 1) - 1, 1, 10));
  });
  plus.addEventListener("click", () => {
    input.value = String(clamp(Number(input.value || 1) + 1, 1, 10));
  });
}

function main() {
  setupSetCountStepper();

  const history = loadHistory();
  renderHistory(history);

  $("generateBtn").addEventListener("click", () => {
    showNotice("");

    const setCount = clamp(Number($("setCount").value || 1), 1, 10);
    const sortMode = $("sortMode").value;

    const include = parseNumbers($("includeNumbers").value);
    const exclude = parseNumbers($("excludeNumbers").value);

    const v = validateConstraints(include, exclude);
    if (!v.ok) {
      $("copyBtn").disabled = true;
      showNotice(v.message, "err");
      return;
    }

    const sets = Array.from({ length: setCount }, () => makeOneSet({ include, exclude, sortMode }));
    renderResults(sets);
    $("metaText").textContent = `생성됨 · ${setCount}세트 · ${nowText()}`;
    $("copyBtn").disabled = sets.length === 0;

    const nextHistory = [{ time: nowText(), sets }, ...loadHistory()].slice(0, 20);
    saveHistory(nextHistory);
    renderHistory(nextHistory);
    showNotice("추천 번호를 만들었어요.", "ok");
  });

  $("copyBtn").addEventListener("click", copyCurrent);

  $("clearBtn").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    renderHistory([]);
    showNotice("기록을 비웠어요.", "ok");
  });
}

document.addEventListener("DOMContentLoaded", main);
