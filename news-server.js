const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3084;

// API 키: 1) 환경변수 NEWS_API_KEY, 2) 같은 폴더의 news-api-key.txt 파일
let NEWS_API_KEY = process.env.NEWS_API_KEY || "";
if (!NEWS_API_KEY) {
  try {
    const keyPath = path.join(__dirname, "news-api-key.txt");
    if (fs.existsSync(keyPath)) {
      NEWS_API_KEY = (fs.readFileSync(keyPath, "utf8") || "").trim();
    }
  } catch (_) {}
}

// Gemini API 키: 1) 환경변수 GEMINI_API_KEY, 2) 같은 폴더의 gemini-api-key.txt 파일
let GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
if (!GEMINI_API_KEY) {
  try {
    const keyPath = path.join(__dirname, "gemini-api-key.txt");
    if (fs.existsSync(keyPath)) {
      GEMINI_API_KEY = (fs.readFileSync(keyPath, "utf8") || "").trim();
    }
  } catch (_) {}
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function readJsonBody(req, callback) {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    if (!body) return callback(null, {});
    try {
      callback(null, JSON.parse(body));
    } catch (e) {
      callback(new Error("INVALID_JSON"), null);
    }
  });
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath);
  const mime = MIME[ext] || "application/octet-stream";
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
}

function safeText(x) {
  return String(x || "").replace(/\s+/g, " ").trim();
}

function fetchNews(keyword, callback) {
  if (!NEWS_API_KEY) {
    callback({ ok: false, message: "NEWS_API_KEY가 설정되지 않았어요. 서버 실행 시 환경변수로 넣어 주세요." });
    return;
  }
  const q = encodeURIComponent(keyword);
  const reqUrl =
    "https://newsapi.org/v2/everything?q=" +
    q +
    "&pageSize=10&language=ko&sortBy=publishedAt&apiKey=" +
    NEWS_API_KEY;

  const options = {
    headers: {
      "User-Agent": "NewsChatBot/1.0 (https://github.com/local; contact@example.com)",
    },
  };

  const req = require("https").get(reqUrl, options, (res) => {
    let body = "";
    res.on("data", (chunk) => (body += chunk));
    res.on("end", () => {
      try {
        const data = JSON.parse(body);
        if (data.status === "error") {
          callback({ ok: false, message: data.message || "뉴스 API 오류" });
          return;
        }
        const articles = (data.articles || []).slice(0, 10).map((a) => ({
          title: a.title || "",
          description: a.description || "",
          url: a.url || "",
          publishedAt: a.publishedAt ? a.publishedAt.slice(0, 10) : "",
          sourceName: (a.source && a.source.name) || "",
        }));
        callback({ ok: true, articles });
      } catch (e) {
        callback({ ok: false, message: "응답 파싱 오류" });
      }
    });
  });
  req.on("error", () => callback({ ok: false, message: "뉴스 서버 연결 실패" }));
  req.setTimeout(15000, () => {
    req.destroy();
    callback({ ok: false, message: "요청 시간 초과" });
  });
}

function fetchUrlText(targetUrl, callback) {
  // 간단 본문 추출(완벽하지 않음). 사이트 정책/차단/유료벽에 따라 실패할 수 있음.
  try {
    const u = new URL(targetUrl);
    const mod = u.protocol === "https:" ? require("https") : require("http");
    const req = mod.get(
      u,
      {
        headers: {
          "User-Agent": "NewsChatBot/1.0 (local dev)",
          Accept: "text/html,application/xhtml+xml",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          // 매우 단순한 HTML -> 텍스트
          const noScript = body.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
          const text = safeText(noScript.replace(/<[^>]+>/g, " "));
          callback(null, text.slice(0, 20000)); // 토큰/비용 보호
        });
      }
    );
    req.on("error", (e) => callback(e, ""));
    req.setTimeout(12000, () => {
      req.destroy();
      callback(new Error("TIMEOUT"), "");
    });
  } catch (e) {
    callback(e, "");
  }
}

function geminiGenerate({ system, user, model }, callback) {
  if (!GEMINI_API_KEY) {
    callback({ ok: false, message: "GEMINI_API_KEY가 설정되지 않았어요. gemini-api-key.txt 또는 환경변수로 넣어 주세요." });
    return;
  }
  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model || "gemini-2.5-flash") +
    ":generateContent?key=" +
    encodeURIComponent(GEMINI_API_KEY);

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: [system ? `SYSTEM:\n${system}\n\n` : "", user].join("") }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  };

  const https = require("https");
  const geminiReq = https.request(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "NewsChatBot/1.0 (local dev)",
      },
    },
    (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          if (res.statusCode !== 200) {
            const errMsg = data?.error?.message || data?.error?.status || "HTTP " + res.statusCode;
            console.error("[Gemini API 오류]", res.statusCode, errMsg);
            callback({ ok: false, message: "Gemini: " + errMsg });
            return;
          }
          const text =
            data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
            data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "";
          if (!text) {
            const errMsg = data?.error?.message || "Gemini 응답이 비어 있어요.";
            if (data?.candidates?.[0]?.finishReason) {
              console.error("[Gemini finishReason]", data.candidates[0].finishReason);
            }
            callback({ ok: false, message: errMsg });
            return;
          }
          callback({ ok: true, text });
        } catch (e) {
          console.error("[Gemini 파싱 오류]", body.slice(0, 200));
          callback({ ok: false, message: "Gemini 응답 파싱 실패: " + (e.message || "") });
        }
      });
    }
  );
  geminiReq.on("error", (e) => {
    console.error("[Gemini 연결 오류]", e.message);
    callback({ ok: false, message: "Gemini 연결 실패: " + e.message });
  });
  geminiReq.write(JSON.stringify(payload));
  geminiReq.end();
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (pathname === "/api/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, port: PORT }));
    return;
  }

  if (pathname === "/api/test-gemini" && req.method === "GET") {
    if (!GEMINI_API_KEY) {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, message: "gemini-api-key.txt에 키가 없어요." }));
      return;
    }
    geminiGenerate(
      { system: "", user: "한 줄로 '연결 성공' 이라고만 답해.", model: "gemini-2.5-flash" },
      (result) => {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(result));
      }
    );
    return;
  }

  if (pathname === "/api/news" && req.method === "GET") {
    const q = (parsed.query.q || "").trim();
    if (!q) {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, message: "키워드를 입력해 주세요." }));
      return;
    }
    fetchNews(q, (result) => {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(result));
    });
    return;
  }

  if (pathname === "/api/summarize" && req.method === "POST") {
    return readJsonBody(req, (err, body) => {
      if (err) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, message: "요청 JSON이 올바르지 않아요." }));
        return;
      }
      const keyword = safeText(body.keyword).slice(0, 120);
      const articles = Array.isArray(body.articles) ? body.articles.slice(0, 10) : [];
      if (!keyword || !articles.length) {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, message: "keyword/articles가 필요해요." }));
        return;
      }

      // 본문 수집(가능한 것만)
      const tasks = articles.map(
        (a) =>
          new Promise((resolve) => {
            const u = a.url;
            if (!u) return resolve({ title: a.title || "", url: "", text: safeText(a.description || "") });
            fetchUrlText(u, (_e, text) => {
              const merged = safeText([a.title || "", a.description || "", text].join("\n"));
              resolve({ title: a.title || "", url: u, text: merged.slice(0, 8000) });
            });
          })
      );

      Promise.all(tasks).then((docs) => {
        const context = docs
          .map((d, i) => `#${i + 1} ${d.title}\nURL: ${d.url}\nCONTENT:\n${d.text}\n`)
          .join("\n---\n");

        geminiGenerate(
          {
            system:
              "당신은 뉴스 요약가입니다. 한국어로 답하세요. 과장하지 말고, 사실/추정/의견을 구분하세요. " +
              "아래 기사 묶음을 기반으로, 충분히 상세하게 요약하세요. 핵심만 빠뜨리지 말고, 배경·전개·의견·전망 등을 포함하세요.",
            user:
              `키워드: ${keyword}\n\n` +
              "요청:\n" +
              "- 전체 요약: 12~25줄 정도로 상세히. 배경, 주요 내용, 쟁점, 각 진영/관점, 전망·의견까지 포함.\n" +
              "- 공통 쟁점·이슈: 4~6개, 각각 1~2문장으로 설명.\n" +
              "- 기사별 요약: 기사당 2~4줄로 요지·입장·근거를 포함(없는 기사는 있는 만큼).\n\n" +
              "자료(기사들):\n" +
              context,
            model: body.model || "gemini-2.5-flash",
          },
          (result) => {
            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify(result));
          }
        );
      });
    });
  }

  if (pathname === "/api/chat" && req.method === "POST") {
    return readJsonBody(req, (err, body) => {
      if (err) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, message: "요청 JSON이 올바르지 않아요." }));
        return;
      }
      const keyword = safeText(body.keyword).slice(0, 120);
      const articles = Array.isArray(body.articles) ? body.articles.slice(0, 10) : [];
      const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
      const userMsg = safeText(body.userMessage).slice(0, 1000);
      if (!userMsg) {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, message: "userMessage가 필요해요." }));
        return;
      }

      const articleContext = articles
        .map((a, i) => `#${i + 1} ${safeText(a.title)} (${safeText(a.sourceName)} ${safeText(a.publishedAt)})\n${safeText(a.description)}\nURL:${safeText(a.url)}\n`)
        .join("\n");

      const history = messages
        .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${safeText(m.text)}`)
        .join("\n");

      geminiGenerate(
        {
          system:
            "당신은 '수집된 뉴스'만을 근거로 대화하는 챗봇입니다. 뉴스에 없는 사실은 단정하지 말고, " +
            "필요하면 '기사에 근거가 부족함'이라고 말하세요. 한국어로 답하세요. " +
            "질문에 맞게 배경·전개·의견·전망을 포함해 충분히 상세하게 답하세요. 필요하면 bullet·번호 목록을 활용하세요.",
          user:
            `키워드: ${keyword}\n\n수집 뉴스(요약용 메타):\n${articleContext}\n\n대화 기록:\n${history}\n\n사용자 질문:\n${userMsg}\n\n위 뉴스만 근거로, 질문에 대해 상세히 답하세요(2~4문단 또는 bullet 정리).`,
          model: body.model || "gemini-2.5-flash",
        },
        (result) => {
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify(result));
        }
      );
    });
  }

  let filePath = path.join(__dirname, pathname === "/" ? "news-chat.html" : pathname);
  if (!path.extname(filePath)) filePath = path.join(__dirname, "news-chat.html");
  serveFile(filePath, res);
});

server.listen(PORT, () => {
  console.log("News chat server: http://localhost:" + PORT);
  if (!NEWS_API_KEY) console.warn("NEWS_API_KEY 미설정. 뉴스 검색 전에 환경변수로 설정하세요.");
  if (!GEMINI_API_KEY) console.warn("GEMINI_API_KEY 미설정. 요약/대화 기능은 동작하지 않습니다.");
});
