const STORAGE = Object.freeze({
  history: "lunch_category_history_v1",
  favs: "lunch_category_favs_v1",
});

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function nowText(d = new Date()) {
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

function showNotice(message, type = "ok") {
  const el = $("notice");
  el.textContent = message ?? "";
  el.classList.remove("ok", "err");
  if (message) el.classList.add(type === "err" ? "err" : "ok");
}

function parseKeywords(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return [];
  const parts = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  return uniq(parts.map((s) => s.toLowerCase()));
}

// “카테고리” 데이터 (다양하게)
const CATEGORIES = [
  {
    id: "korean_soup",
    name: "국밥/탕/찌개",
    desc: "뜨끈하게 든든. 혼밥도 쉬운 편.",
    tags: ["한식", "따뜻", "든든", "혼밥"],
    budget: ["low", "mid"],
    time: ["fast", "normal"],
    spice: ["any"],
    diet: ["any", "high_protein"],
    popularity: 0.9,
    avoid: ["내장", "곱창", "새우젓"],
    examples: [
      { name: "순댓국", hint: "내장 빼기/다대기 조절 가능" },
      { name: "김치찌개", hint: "돼지/참치 선택" },
      { name: "설렁탕", hint: "밥 말아서 빠르게" },
    ],
  },
  {
    id: "korean_bibimbap",
    name: "비빔밥/덮밥(한식)",
    desc: "한 그릇으로 깔끔. 야채/단백질 밸런스 조절.",
    tags: ["한식", "밸런스", "한그릇"],
    budget: ["low", "mid"],
    time: ["fast", "normal"],
    spice: ["any"],
    diet: ["any", "light", "high_protein", "vegetarian"],
    popularity: 0.8,
    avoid: ["고추장", "계란", "고기"],
    examples: [
      { name: "비빔밥", hint: "고추장 따로 가능" },
      { name: "제육덮밥", hint: "매운맛 조절" },
      { name: "두부덮밥", hint: "채식 옵션으로도 OK" },
    ],
  },
  {
    id: "korean_noodles",
    name: "면(한식/분식)",
    desc: "빠르고 만족감. 뜨/차 모두 가능.",
    tags: ["한식", "분식", "빠름", "면"],
    budget: ["low", "mid"],
    time: ["fast"],
    spice: ["any", "yes"],
    diet: ["any", "light", "vegetarian"],
    popularity: 0.85,
    avoid: ["어묵", "멸치", "튀김"],
    examples: [
      { name: "잔치국수", hint: "가볍게" },
      { name: "떡볶이+김밥", hint: "매운맛 가능하면 만족도↑" },
      { name: "냉면", hint: "더운 날/속 편하게" },
    ],
  },
  {
    id: "korean_bbq",
    name: "고기구이/쌈밥",
    desc: "단백질+포만감. 여유 있을 때.",
    tags: ["한식", "든든", "회식", "단백질"],
    budget: ["mid", "high"],
    time: ["normal", "slow"],
    spice: ["any"],
    diet: ["any", "high_protein"],
    popularity: 0.75,
    avoid: ["돼지", "소", "마늘"],
    examples: [
      { name: "삼겹살+쌈", hint: "야채로 밸런스" },
      { name: "불고기 쌈밥", hint: "달달한 맛" },
      { name: "닭갈비", hint: "볶음밥까지 가능" },
    ],
  },
  {
    id: "dakgalbi",
    name: "닭갈비",
    desc: "철판에 볶아 먹는 매콤달콤. 볶음밥으로 마무리까지.",
    tags: ["한식", "볶음", "단백질", "매콤"],
    budget: ["mid", "high"],
    time: ["normal", "slow"],
    spice: ["any", "yes"],
    diet: ["any", "high_protein"],
    popularity: 0.7,
    avoid: ["닭", "치즈", "고추장"],
    examples: [
      { name: "닭갈비(기본)", hint: "매운맛 단계 선택 가능" },
      { name: "치즈 닭갈비", hint: "치즈 OK면 만족도↑" },
      { name: "볶음밥", hint: "남은 양념에 필수 코스" },
    ],
  },
  {
    id: "japanese",
    name: "일식(돈카츠/초밥/덮밥)",
    desc: "깔끔하고 실패 확률 낮음.",
    tags: ["일식", "무난", "한그릇"],
    budget: ["mid", "high"],
    time: ["normal"],
    spice: ["no", "any"],
    diet: ["any", "high_protein"],
    popularity: 0.88,
    avoid: ["생선", "새우", "유제품"],
    examples: [
      { name: "돈카츠", hint: "바삭 든든" },
      { name: "가츠동/규동", hint: "빠르고 한 그릇" },
      { name: "초밥/사시미", hint: "해산물 OK일 때" },
    ],
  },
  {
    id: "chinese",
    name: "중식(짜장/짬뽕/볶음밥)",
    desc: "강한 만족감. 배고플 때.",
    tags: ["중식", "든든", "면/밥"],
    budget: ["low", "mid"],
    time: ["fast", "normal"],
    spice: ["any", "yes"],
    diet: ["any"],
    popularity: 0.82,
    avoid: ["해산물", "돼지", "땅콩"],
    examples: [
      { name: "짜장면", hint: "무난한 선택" },
      { name: "짬뽕", hint: "매운 거 OK면 굿" },
      { name: "마파두부덮밥", hint: "두부로 밸런스" },
    ],
  },
  {
    id: "thai_viet",
    name: "동남아(쌀국수/팟타이/커리)",
    desc: "향신료 좋아하면 최고. 색다름.",
    tags: ["동남아", "새로움", "향신료"],
    budget: ["mid", "high"],
    time: ["normal"],
    spice: ["any", "yes"],
    diet: ["any", "light"],
    popularity: 0.62,
    avoid: ["고수", "땅콩", "유제품"],
    examples: [
      { name: "쌀국수", hint: "고수 빼기 가능" },
      { name: "팟타이", hint: "달짝/새콤" },
      { name: "그린커리", hint: "매운맛 주의" },
    ],
  },
  {
    id: "mex",
    name: "멕시칸/텍스멕(부리또/타코)",
    desc: "한 손/한 그릇으로 간편. 단백질도 OK.",
    tags: ["멕시칸", "한그릇", "간편"],
    budget: ["mid"],
    time: ["fast", "normal"],
    spice: ["any", "yes"],
    diet: ["any", "high_protein"],
    popularity: 0.55,
    avoid: ["고수", "유제품", "콩"],
    examples: [
      { name: "부리또", hint: "속재료 커스텀 가능" },
      { name: "타코", hint: "가볍게 여러 개" },
      { name: "퀘사디아", hint: "치즈 OK면 만족도↑" },
    ],
  },
  {
    id: "indian",
    name: "인도/네팔(카레+난)",
    desc: "향신료와 커리. 든든하고 색다름.",
    tags: ["인도", "새로움", "커리"],
    budget: ["mid", "high"],
    time: ["normal", "slow"],
    spice: ["any", "yes"],
    diet: ["any", "vegetarian"],
    popularity: 0.48,
    avoid: ["유제품", "고수", "견과"],
    examples: [
      { name: "치킨커리", hint: "매운맛 단계 선택" },
      { name: "달(렌틸)커리", hint: "채식 옵션" },
      { name: "탄두리", hint: "단백질 위주" },
    ],
  },
  {
    id: "salad_bowl",
    name: "샐러드/포케/그레인볼",
    desc: "가볍게, 건강하게. 오후에 덜 졸림.",
    tags: ["가벼움", "건강", "차가움"],
    budget: ["mid", "high"],
    time: ["fast", "normal"],
    spice: ["no", "any"],
    diet: ["any", "light", "high_protein", "vegetarian"],
    popularity: 0.7,
    avoid: ["견과", "유제품", "생선"],
    examples: [
      { name: "치킨 샐러드", hint: "단백질" },
      { name: "연어 포케", hint: "해산물 OK일 때" },
      { name: "두부 그레인볼", hint: "채식 + 포만감" },
    ],
  },
  {
    id: "sandwich",
    name: "샌드위치/베이글/랩",
    desc: "회의/바쁜 날에 최적. 이동하면서도 OK.",
    tags: ["간편", "빠름", "가벼움"],
    budget: ["low", "mid"],
    time: ["fast"],
    spice: ["no", "any"],
    diet: ["any", "light"],
    popularity: 0.78,
    avoid: ["유제품", "밀", "햄"],
    examples: [
      { name: "클럽 샌드위치", hint: "무난" },
      { name: "연어 베이글", hint: "담백" },
      { name: "치킨랩", hint: "간편 든든" },
    ],
  },
  {
    id: "burger",
    name: "버거/치킨/프라이",
    desc: "가끔은 자극적으로. 빠르게 먹기.",
    tags: ["패스트푸드", "빠름", "자극"],
    budget: ["low", "mid"],
    time: ["fast"],
    spice: ["any"],
    diet: ["any", "high_protein"],
    popularity: 0.8,
    avoid: ["유제품", "밀", "땅콩"],
    examples: [
      { name: "버거 세트", hint: "빨리 해결" },
      { name: "치킨/텐더", hint: "단백질" },
      { name: "샐러드+치킨", hint: "덜 부담" },
    ],
  },
  {
    id: "pasta",
    name: "파스타/리조또",
    desc: "기분전환. 데이트/회식도 OK.",
    tags: ["양식", "여유", "무난"],
    budget: ["mid", "high"],
    time: ["normal", "slow"],
    spice: ["no", "any"],
    diet: ["any"],
    popularity: 0.66,
    avoid: ["유제품", "해산물", "마늘"],
    examples: [
      { name: "토마토 파스타", hint: "무난" },
      { name: "크림 파스타", hint: "유제품 OK면" },
      { name: "리조또", hint: "든든" },
    ],
  },
  {
    id: "ramen",
    name: "라멘/우동",
    desc: "면+국물. 비 오는 날 특히.",
    tags: ["일식", "따뜻", "면"],
    budget: ["mid"],
    time: ["normal"],
    spice: ["any", "yes"],
    diet: ["any"],
    popularity: 0.72,
    avoid: ["돼지", "해산물", "유제품"],
    examples: [
      { name: "돈코츠 라멘", hint: "진하고 든든" },
      { name: "쇼유 라멘", hint: "깔끔" },
      { name: "우동", hint: "부담 적게" },
    ],
  },
  {
    id: "kimbap",
    name: "김밥/분식(간단)",
    desc: "혼밥/급할 때 최강.",
    tags: ["분식", "빠름", "혼밥", "저렴"],
    budget: ["low"],
    time: ["fast"],
    spice: ["any", "yes", "no"],
    diet: ["any", "light", "vegetarian"],
    popularity: 0.83,
    avoid: ["어묵", "햄", "계란"],
    examples: [
      { name: "야채김밥", hint: "가볍게" },
      { name: "라볶이", hint: "자극 + 포만" },
      { name: "튀김+떡볶이", hint: "매운맛 OK면" },
    ],
  },
  {
    id: "ricebowl_global",
    name: "덮밥(글로벌)",
    desc: "한 그릇으로 빠르게. 실패 확률 낮음.",
    tags: ["한그릇", "무난", "빠름"],
    budget: ["low", "mid"],
    time: ["fast", "normal"],
    spice: ["any"],
    diet: ["any", "high_protein"],
    popularity: 0.86,
    avoid: ["계란", "돼지", "소"],
    examples: [
      { name: "치킨마요", hint: "무난" },
      { name: "규동", hint: "고기+밥" },
      { name: "텐동", hint: "바삭/튀김" },
    ],
  },
  {
    id: "seafood",
    name: "해산물/생선구이",
    desc: "담백하게. 속 편한 편.",
    tags: ["한식", "담백", "단백질"],
    budget: ["mid"],
    time: ["normal"],
    spice: ["no", "any"],
    diet: ["any", "high_protein", "light"],
    popularity: 0.58,
    avoid: ["생선", "새우", "조개"],
    examples: [
      { name: "생선구이 정식", hint: "담백" },
      { name: "회덮밥", hint: "차가운 메뉴" },
      { name: "해물순두부", hint: "따뜻 + 해산물" },
    ],
  },
  {
    id: "vegetarian",
    name: "채식(비건 옵션)",
    desc: "고기 없이도 든든하게. 선택 폭 넓어짐.",
    tags: ["채식", "건강", "가벼움"],
    budget: ["mid"],
    time: ["normal"],
    spice: ["any"],
    diet: ["vegetarian", "light"],
    popularity: 0.42,
    avoid: ["유제품", "계란", "견과"],
    examples: [
      { name: "비건 비빔밥", hint: "계란/고기 빼기" },
      { name: "두부 스테이크", hint: "단백질" },
      { name: "채식 커리", hint: "향신료 OK면" },
    ],
  },
];

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function scoreCategory(cat, mode) {
  // mode에 따라 “다양성(낮은 인기)” vs “무난(높은 인기)” 가중
  const p = clamp(cat.popularity ?? 0.5, 0, 1);
  if (mode === "safe") return 0.6 + 0.8 * p; // 무난 선호
  if (mode === "adventurous") return 0.6 + 0.8 * (1 - p); // 새로운 것 선호
  return 0.8 + 0.6 * (1 - Math.abs(p - 0.65)); // 가운데(밸런스)
}

function weightedPick(items, getW) {
  const weights = items.map((x) => Math.max(0, Number(getW(x) ?? 0)));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1] ?? null;
}

function matchesFilters(cat, f) {
  if (f.budget !== "any" && !cat.budget.includes(f.budget)) return false;
  if (f.time !== "any" && !cat.time.includes(f.time)) return false;

  if (f.spice === "no") {
    // 매운 거 싫으면 yes-only 느낌의 카테고리 제외
    const spicyOk = cat.spice.includes("no") || cat.spice.includes("any");
    if (!spicyOk) return false;
  }

  if (f.diet !== "any") {
    if (!cat.diet.includes(f.diet)) return false;
  }

  if (f.avoidKeywords.length) {
    const hay = `${cat.name} ${cat.desc} ${cat.tags.join(" ")} ${(cat.avoid || []).join(" ")} ${cat.examples
      .map((e) => e.name + " " + e.hint)
      .join(" ")}`.toLowerCase();
    for (const k of f.avoidKeywords) {
      if (hay.includes(k)) return false;
    }
  }

  return true;
}

function currentFilters() {
  return {
    budget: $("budget").value,
    time: $("time").value,
    spice: $("spice").value,
    diet: $("diet").value,
    mode: $("mode").value,
    avoidKeywords: parseKeywords($("avoid").value),
  };
}

function setSearchLink(text) {
  const a = $("searchLink");
  const q = encodeURIComponent(`${text} 맛집`);
  a.href = `https://www.google.com/search?q=${q}`;
}

function renderTags(tags) {
  const root = $("mainTags");
  root.innerHTML = "";
  tags.forEach((t) => {
    const s = document.createElement("span");
    s.className = "tag";
    s.textContent = t;
    root.appendChild(s);
  });
}

function renderExamples(examples) {
  const root = $("mainExamples");
  root.innerHTML = "";
  examples.slice(0, 4).forEach((e) => {
    const div = document.createElement("div");
    div.className = "exRow";
    const a = document.createElement("div");
    a.className = "exName";
    a.textContent = e.name;
    const b = document.createElement("div");
    b.className = "exHint";
    b.textContent = e.hint;
    div.appendChild(a);
    div.appendChild(b);
    root.appendChild(div);
  });
}

function setMain(cat) {
  const card = $("mainCard");
  card.classList.remove("spin");
  // reflow for animation restart
  void card.offsetWidth;
  card.classList.add("spin");

  $("mainChip").textContent = cat.tags[0] ?? "추천";
  $("mainTitle").textContent = cat.name;
  $("mainDesc").textContent = cat.desc;
  renderTags(cat.tags);
  renderExamples(cat.examples ?? []);
  setSearchLink(cat.name);
  $("favBtn").disabled = false;
  $("copyBtn").disabled = false;
  $("rerollBtn").disabled = false;
}

function renderAlts(alts) {
  const root = $("alts");
  root.innerHTML = "";
  alts.forEach((cat) => {
    const div = document.createElement("div");
    div.className = "altCard";
    div.addEventListener("click", () => {
      setMain(cat);
      showNotice("대안으로 변경했어요.", "ok");
    });

    const t = document.createElement("div");
    t.className = "altTitle";
    t.textContent = cat.name;

    const m = document.createElement("div");
    m.className = "altMeta";
    m.textContent = (cat.tags || []).slice(0, 3).join(" · ");

    div.appendChild(t);
    div.appendChild(m);
    root.appendChild(div);
  });
}

function renderList(rootId, items, onLoad) {
  const root = $(rootId);
  root.innerHTML = "";

  items.forEach((it, idx) => {
    const li = document.createElement("li");
    li.className = "item";

    const top = document.createElement("div");
    top.className = "itemTop";

    const title = document.createElement("div");
    title.className = "itemTitle";
    title.textContent = it.name;

    const time = document.createElement("div");
    time.className = "itemTime";
    time.textContent = it.time ?? "";

    top.appendChild(title);
    top.appendChild(time);

    const meta = document.createElement("div");
    meta.className = "altMeta";
    meta.textContent = (it.tags || []).slice(0, 4).join(" · ");

    const btns = document.createElement("div");
    btns.className = "itemBtns";

    const useBtn = document.createElement("button");
    useBtn.className = "miniBtn";
    useBtn.type = "button";
    useBtn.textContent = "불러오기";
    useBtn.addEventListener("click", () => onLoad(it));

    const delBtn = document.createElement("button");
    delBtn.className = "miniBtn";
    delBtn.type = "button";
    delBtn.textContent = "삭제";
    delBtn.addEventListener("click", () => {
      items.splice(idx, 1);
      if (rootId === "history") saveJson(STORAGE.history, items);
      if (rootId === "favs") saveJson(STORAGE.favs, items);
      renderList(rootId, items, onLoad);
      showNotice("삭제했어요.", "ok");
    });

    btns.appendChild(useBtn);
    btns.appendChild(delBtn);

    li.appendChild(top);
    li.appendChild(meta);
    li.appendChild(btns);
    root.appendChild(li);
  });
}

function makeCopyText(cat) {
  const lines = [];
  lines.push(`오늘 점심 카테고리: ${cat.name}`);
  lines.push(`설명: ${cat.desc}`);
  lines.push(`태그: ${(cat.tags || []).join(", ")}`);
  lines.push(`예시: ${(cat.examples || []).map((e) => e.name).join(", ")}`);
  return lines.join("\n");
}

function pickRecommendation({ prevId } = {}) {
  const f = currentFilters();
  const eligible = CATEGORIES.filter((c) => matchesFilters(c, f));

  if (!eligible.length) return { ok: false, message: "조건에 맞는 카테고리가 없어요. 필터를 조금 풀어보세요." };

  const pool = prevId ? eligible.filter((c) => c.id !== prevId) : eligible;
  const pickFrom = pool.length ? pool : eligible;

  const main = weightedPick(pickFrom, (c) => scoreCategory(c, f.mode)) ?? pickFrom[0];

  // Alternatives: simple shuffle from eligible excluding main
  const rest = eligible.filter((c) => c.id !== main.id);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const alts = rest.slice(0, 3);

  const meta = `${eligible.length}개 후보 · ${nowText()}`;
  return { ok: true, main, alts, meta, filters: f };
}

function main() {
  let current = null;

  const history = loadJson(STORAGE.history, []);
  const favs = loadJson(STORAGE.favs, []);

  const loadItem = (it) => {
    current = it;
    setMain(it);
    $("meta").textContent = it.meta ?? "불러옴";
    showNotice("불러왔어요.", "ok");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  renderList("history", history, loadItem);
  renderList("favs", favs, loadItem);

  $("pickBtn").addEventListener("click", () => {
    showNotice("");
    const res = pickRecommendation();
    if (!res.ok) {
      showNotice(res.message, "err");
      return;
    }
    current = { ...res.main, time: nowText(), meta: res.meta };
    setMain(res.main);
    renderAlts(res.alts);
    $("meta").textContent = res.meta;

    history.unshift(current);
    history.splice(20);
    saveJson(STORAGE.history, history);
    renderList("history", history, loadItem);
    showNotice("추천 완료!", "ok");
  });

  $("rerollBtn").addEventListener("click", () => {
    if (!current) return;
    showNotice("");
    const res = pickRecommendation({ prevId: current.id });
    if (!res.ok) {
      showNotice(res.message, "err");
      return;
    }
    current = { ...res.main, time: nowText(), meta: res.meta };
    setMain(res.main);
    renderAlts(res.alts);
    $("meta").textContent = res.meta;

    history.unshift(current);
    history.splice(20);
    saveJson(STORAGE.history, history);
    renderList("history", history, loadItem);
    showNotice("다시 추천했어요!", "ok");
  });

  $("favBtn").addEventListener("click", () => {
    if (!current) return;
    const exists = favs.some((x) => x.id === current.id);
    if (!exists) {
      favs.unshift({ ...current });
      favs.splice(50);
      saveJson(STORAGE.favs, favs);
      renderList("favs", favs, loadItem);
      showNotice("즐겨찾기에 추가했어요.", "ok");
    } else {
      showNotice("이미 즐겨찾기에 있어요.", "ok");
    }
  });

  $("copyBtn").addEventListener("click", async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(makeCopyText(current));
      showNotice("복사했어요.", "ok");
    } catch {
      showNotice("복사 권한이 없어요. (HTTP 환경/권한 설정 확인)", "err");
    }
  });

  $("clearBtn").addEventListener("click", () => {
    localStorage.removeItem(STORAGE.history);
    history.length = 0;
    renderList("history", history, loadItem);
    showNotice("최근 기록을 비웠어요.", "ok");
  });

  // Disable search link until we have a pick
  $("searchLink").addEventListener("click", (e) => {
    if (!current) e.preventDefault();
  });
}

document.addEventListener("DOMContentLoaded", main);

