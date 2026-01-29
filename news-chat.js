(function () {
  const messages = document.getElementById("messages");
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("sendBtn");

  const PORT_HINT = window.location.port || "3081";

  // 서버 연결 확인
  const serverStatus = document.getElementById("serverStatus");
  if (serverStatus) {
    if (window.location.protocol === "file:") {
      serverStatus.textContent = "❌ 파일로 열었어요. 주소창에 http://localhost:" + PORT_HINT + " 입력해서 열어 주세요.";
      serverStatus.className = "status err";
    } else {
      fetch("/api/health")
        .then(function (r) {
          if (r.ok) return r.json();
          throw new Error(r.status);
        })
        .then(function () {
          serverStatus.textContent = "✅ 서버 연결됨 (키워드 입력 후 Enter)";
          serverStatus.className = "status ok";
        })
        .catch(function () {
          serverStatus.textContent = "❌ 서버 연결 안 됨. 터미널에서 node news-server.js 실행 후 새로고침.";
          serverStatus.className = "status err";
        });
    }
  }

  // 파일로 열었으면 서버 주소로 열어야 한다고 안내
  var isFileOrWrongOrigin = window.location.protocol === "file:" ||
    (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1");
  if (isFileOrWrongOrigin) {
    var banner = document.createElement("div");
    banner.className = "warnBanner";
    banner.innerHTML =
      "⚠️ 이 페이지는 <strong>파일 더블클릭으로 열면 동작하지 않습니다.</strong><br>" +
      "1) 터미널에서 <code>news-server.js</code> 실행 → 2) 브라우저 주소창에 <strong>http://localhost:" +
      PORT_HINT +
      "</strong> 입력 후 접속해 주세요.";
    document.body.insertBefore(banner, document.body.firstChild);
  }

  const LS_KEYS = {
    sessions: "news_chat_sessions_v1",
  };

  function loadSessions() {
    try {
      const raw = localStorage.getItem(LS_KEYS.sessions);
      if (!raw) return [];
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  function saveSessions(sessions) {
    localStorage.setItem(LS_KEYS.sessions, JSON.stringify(sessions.slice(0, 50)));
  }

  let currentSession = {
    id: String(Date.now()),
    keyword: "",
    articles: [],
    summary: "",
    chat: [], // {role:'user'|'assistant', text, at}
    createdAt: new Date().toISOString(),
  };

  function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  function addMessage(role, content, isHtml) {
    const wrap = document.createElement("div");
    wrap.className = "msg " + role;
    wrap.setAttribute("role", "article");

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = role === "user" ? "나" : "봇";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    if (isHtml) bubble.innerHTML = content;
    else bubble.textContent = content;

    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    messages.appendChild(wrap);
    scrollToBottom();
  }

  function addNewsResponse(articles) {
    const wrap = document.createElement("div");
    wrap.className = "msg bot";
    wrap.setAttribute("role", "article");

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = "봇";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.innerHTML = '<p><strong>관련 뉴스 ' + articles.length + '건 요약</strong></p>';
    const list = document.createElement("ul");
    list.className = "newsList";
    articles.forEach(function (a) {
      const li = document.createElement("li");
      li.className = "newsItem";
      const link = document.createElement("a");
      link.href = a.url || "#";
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = a.title || "(제목 없음)";
      const desc = document.createElement("div");
      desc.className = "desc";
      desc.textContent = a.description || "";
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = (a.sourceName || "") + (a.publishedAt ? " · " + a.publishedAt : "");
      li.appendChild(link);
      li.appendChild(desc);
      li.appendChild(meta);
      list.appendChild(li);
    });
    bubble.appendChild(list);

    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    messages.appendChild(wrap);
    scrollToBottom();
  }

  function setLoading(on) {
    sendBtn.disabled = on;
    input.disabled = on;
  }

  function addDivider(title) {
    addMessage("bot", "<strong>" + title + "</strong>", true);
  }

  function upsertSessionToStorage(session) {
    const sessions = loadSessions();
    const idx = sessions.findIndex((s) => s && s.id === session.id);
    if (idx >= 0) sessions[idx] = session;
    else sessions.unshift(session);
    saveSessions(sessions);
  }

  function requestSummarize(keyword, articles) {
    addDivider("요약 생성 중…");
    return fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, articles, model: "gemini-2.5-flash" }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.message || "요약 실패");
        return data.text;
      });
  }

  function requestChat(session, userMessage) {
    return fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword: session.keyword,
        articles: session.articles,
        messages: session.chat,
        userMessage,
        model: "gemini-2.5-flash",
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.message || "대화 실패");
        return data.text;
      });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const keyword = (input.value || "").trim();
    if (!keyword) return;

    addMessage("user", keyword, false);
    input.value = "";

    setLoading(true);
    addMessage("bot", "뉴스 검색 중…", false);
    const loadingBubble = messages.querySelector(".msg.bot:last-child .bubble");

    fetch("/api/news?q=" + encodeURIComponent(keyword))
      .then(function (res) {
        const ct = res.headers.get("content-type") || "";
        if (!res.ok) {
          if (ct.indexOf("application/json") !== -1) return res.json().then(function (d) { throw new Error(d.message || "서버 오류 " + res.status); });
          throw new Error("서버 오류 " + res.status + ". 주소창에 http://localhost:" + PORT_HINT + " 로 열었는지 확인하세요.");
        }
        return res.json();
      })
      .then(function (data) {
        var lastBot = messages.querySelector(".msg.bot:last-child");
        if (lastBot && lastBot.contains(loadingBubble)) lastBot.remove();

        if (data.ok && data.articles && data.articles.length) {
          currentSession = {
            id: String(Date.now()),
            keyword,
            articles: data.articles,
            summary: "",
            chat: [],
            createdAt: new Date().toISOString(),
          };
          upsertSessionToStorage(currentSession);
          addNewsResponse(data.articles);

          // 자동 요약
          requestSummarize(keyword, data.articles)
            .then((summaryText) => {
              currentSession.summary = summaryText;
              upsertSessionToStorage(currentSession);
              addMessage("bot", "<pre style=\"white-space:pre-wrap;margin:0\">" + summaryText + "</pre>", true);
              addDivider("이제 기사 묶음으로 질문해 보세요 (대화 모드)");
              addMessage("bot", "예: '핵심 쟁점만 3줄로', '서로 다른 관점을 비교해줘', '투자자 관점 리스크는?'", false);
            })
            .catch((err) => {
              addMessage(
                "bot",
                '<span class="error">요약 실패: ' +
                  (err && err.message ? err.message : "Gemini 설정을 확인해 주세요.") +
                  "</span><br>Gemini 키는 <code>gemini-api-key.txt</code>에 넣어야 합니다.",
                true
              );
            });
        } else {
          addMessage("bot", '<span class="error">' + (data.message || "뉴스를 찾지 못했어요.") + "</span>", true);
        }
      })
      .catch(function (err) {
        var lastBot = messages.querySelector(".msg.bot:last-child");
        if (lastBot && lastBot.contains(loadingBubble)) lastBot.remove();
        addMessage(
          "bot",
          '<span class="error">서버 연결 실패.</span><br><br>' +
          '1) 터미널에서 <strong>node news-server.js</strong> 를 실행했나요?<br>' +
          '2) 브라우저 주소창에 <strong>http://localhost:' + PORT_HINT + '</strong> 을 입력해서 열었나요? (파일 더블클릭 ❌)',
          true
        );
      })
      .finally(function () {
        setLoading(false);
      });
  });

  // Shift+Enter = "대화 질문" (뉴스 검색과 구분)
  input.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    if (!e.shiftKey) return;
    e.preventDefault();
    const q = (input.value || "").trim();
    if (!q) return;
    if (!currentSession.articles || !currentSession.articles.length) {
      addMessage("bot", '<span class="error">먼저 키워드로 뉴스를 검색해 주세요.</span>', true);
      return;
    }
    input.value = "";
    addMessage("user", q, false);
    setLoading(true);
    addMessage("bot", "답변 생성 중…", false);
    const loadingBubble = messages.querySelector(".msg.bot:last-child .bubble");

    const userTurn = { role: "user", text: q, at: new Date().toISOString() };
    currentSession.chat.push(userTurn);
    upsertSessionToStorage(currentSession);

    requestChat(currentSession, q)
      .then((answer) => {
        var lastBot = messages.querySelector(".msg.bot:last-child");
        if (lastBot && lastBot.contains(loadingBubble)) lastBot.remove();
        const aTurn = { role: "assistant", text: answer, at: new Date().toISOString() };
        currentSession.chat.push(aTurn);
        upsertSessionToStorage(currentSession);
        addMessage("bot", "<pre style=\"white-space:pre-wrap;margin:0\">" + answer + "</pre>", true);
      })
      .catch((err) => {
        var lastBot = messages.querySelector(".msg.bot:last-child");
        if (lastBot && lastBot.contains(loadingBubble)) lastBot.remove();
        addMessage("bot", '<span class="error">대화 실패: ' + (err?.message || "Gemini 설정 확인") + "</span>", true);
      })
      .finally(() => setLoading(false));
  });
})();
