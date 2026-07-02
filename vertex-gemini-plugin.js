//@name Vertex_Gemini
//@display-name 🔷 Vertex Gemini
//@api 3.0
//@version 1.2.0

// ===== Settings Arguments =====

// Auth
//@arg vg_service_account_json string Vertex Service Account JSON (전체 JSON 붙여넣기) [필수]
//@arg vg_location string Location (예: us-central1, asia-northeast1, global) [필수, 기본값 us-central1] - 최신 Gemini 3.x 모델은 프로젝트에 따라 특정 리전에서 404가 날 수 있습니다. 그 경우 "global"로 설정해보세요.
//@arg vg_token_bridge_url string Token Bridge URL (선택사항 - CORS 우회용 Worker URL)

// Model
//@arg vg_custom_model string 추가 커스텀 모델 ID (목록에 없는 모델을 직접 등록하고 싶을 때만)
//@arg vg_dynamic_models string 동적 모델 목록 JSON (자동 관리, 수정하지 마세요)
//@arg vg_excluded_models string 등록에서 제외할 모델 ID 목록 (콤마 구분, 자동 관리)
//@arg vg_token_stats string 누적 토큰 사용량 통계 JSON (자동 관리, 수정하지 마세요)

// Generation Config
//@arg vg_temperature string Temperature (0.0~2.0, 기본값: 1.0)
//@arg vg_max_tokens string Max Output Tokens (기본값: 8192)
//@arg vg_top_p string Top P (기본값: 0.95)
//@arg vg_top_k string Top K
//@arg vg_frequency_penalty string Frequency Penalty
//@arg vg_presence_penalty string Presence Penalty
//@arg vg_stop_sequences string Stop Sequences (쉼표로 구분)
//@arg vg_seed string Seed (정수, 재현성)

// Thinking / Reasoning
//@arg vg_thinking_budget int Thinking Budget (토큰 수, 0=비활성)
//@arg vg_thinking_level string Thinking Level (off / MINIMAL / LOW / MEDIUM / HIGH / AUTO)
//@arg vg_include_thoughts string 사고 과정 출력에 포함 (true/false, 기본: false)

// Safety Settings
//@arg vg_safety_harassment string 희롱 (BLOCK_NONE / BLOCK_ONLY_HIGH / BLOCK_MEDIUM_AND_ABOVE / BLOCK_LOW_AND_ABOVE)
//@arg vg_safety_hate_speech string 혐오 발언 (BLOCK_NONE / BLOCK_ONLY_HIGH / BLOCK_MEDIUM_AND_ABOVE / BLOCK_LOW_AND_ABOVE)
//@arg vg_safety_sexually_explicit string 성적 노출 (BLOCK_NONE / BLOCK_ONLY_HIGH / BLOCK_MEDIUM_AND_ABOVE / BLOCK_LOW_AND_ABOVE)
//@arg vg_safety_dangerous string 위험 콘텐츠 (BLOCK_NONE / BLOCK_ONLY_HIGH / BLOCK_MEDIUM_AND_ABOVE / BLOCK_LOW_AND_ABOVE)
//@arg vg_safety_civic string 시민 무결성 (BLOCK_NONE / BLOCK_ONLY_HIGH / BLOCK_MEDIUM_AND_ABOVE / BLOCK_LOW_AND_ABOVE)

// Grounding
//@arg vg_grounding string Google Search Grounding 활성화 (true/false)
//@arg vg_grounding_dynamic_retrieval string Dynamic Retrieval 임계값 (0.0~1.0, grounding 활성화 시)

// Service Tier
//@arg vg_service_tier string Service Tier (auto / flex / default, 기본: default)

// Streaming & Display
//@arg vg_streaming string 스트리밍 활성화 (true/false, 기본: true)
//@arg vg_preserve_system string System 프롬프트 보존 (true/false, 기본: true)

// Image Generation
//@arg vg_image_mode string 이미지 생성 모드 (none / gemini / imagen)
//@arg vg_image_aspect_ratio string 이미지 비율 (1:1 / 16:9 / 9:16 / 4:3 / 3:4)
//@arg vg_image_count string 이미지 생성 수 (1~4)

// ===== Plugin Body =====
(async () => {
  try {

  // ─── Constants ───────────────────────────────────────────────────────────────

  const PLUGIN_NAME = "🔷 Vertex Gemini";
  const GOOGLE_OAUTH_URL = "https://oauth2.googleapis.com/token";
  const GOOGLE_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

  // Token cache: email → {token, expiry}
  const _tokenCache = {};

  const SAFETY_THRESHOLDS = [
    "BLOCK_NONE",
    "BLOCK_ONLY_HIGH",
    "BLOCK_MEDIUM_AND_ABOVE",
    "BLOCK_LOW_AND_ABOVE",
    "OFF",
  ];

  const SAFETY_CATEGORIES = [
    { key: "vg_safety_harassment",        category: "HARM_CATEGORY_HARASSMENT" },
    { key: "vg_safety_hate_speech",       category: "HARM_CATEGORY_HATE_SPEECH" },
    { key: "vg_safety_sexually_explicit", category: "HARM_CATEGORY_SEXUALLY_EXPLICIT" },
    { key: "vg_safety_dangerous",         category: "HARM_CATEGORY_DANGEROUS_CONTENT" },
    { key: "vg_safety_civic",             category: "HARM_CATEGORY_CIVIC_INTEGRITY" },
  ];

  // Static fallback models (Gemini 3.0+) — used only if dynamic fetch fails/unconfigured
  const FALLBACK_MODELS = [
    { id: "gemini-3.0-pro",          name: "Gemini 3.0 Pro" },
    { id: "gemini-3.0-flash",        name: "Gemini 3.0 Flash" },
    { id: "gemini-3.0-flash-lite",   name: "Gemini 3.0 Flash Lite" },
    { id: "gemini-3.5-pro",          name: "Gemini 3.5 Pro" },
    { id: "gemini-3.5-flash",        name: "Gemini 3.5 Flash" },
    { id: "gemini-3.5-flash-lite",   name: "Gemini 3.5 Flash Lite" },
    { id: "gemini-3.0-pro-exp",      name: "Gemini 3.0 Pro Exp" },
    { id: "gemini-3.0-flash-exp",    name: "Gemini 3.0 Flash Exp" },
    { id: "imagen-4.0-generate-001", name: "Imagen 4.0" },
    { id: "imagen-4.0-ultra-generate-001", name: "Imagen 4.0 Ultra" },
    { id: "imagen-3.0-generate-001", name: "Imagen 3.0" },
    { id: "imagen-3.0-fast-generate-001", name: "Imagen 3.0 Fast" },
  ];

  // ─── Logging ─────────────────────────────────────────────────────────────────

  function log(...args)  { console.log(`[${PLUGIN_NAME}]`, ...args); }
  function warn(...args) { console.warn(`[${PLUGIN_NAME}]`, ...args); }
  function err(...args)  { console.error(`[${PLUGIN_NAME}]`, ...args); }

  // ─── Arg Helpers (RisuAI v3.0 API: Risuai.getArgument / Risuai.setArgument) ───

  async function getArg(key, fallback = "") {
    try {
      const v = await Risuai.getArgument(key);
      return (v === null || v === undefined || v === "") ? fallback : v;
    } catch { return fallback; }
  }

  async function getBoolArg(key, fallback = false) {
    const v = await getArg(key, "");
    if (v === "") return fallback;
    return v === "true" || v === "1" || v === true;
  }

  // ─── Debug/Diagnostics Helpers ────────────────────────────────────────────────

  // Tracks every model this session actually handed to Risuai.addProvider,
  // so the diagnostics panel can show ground truth instead of guessing.
  const _registeredModels = [];

  // Live log of REAL fetcher invocations coming from RisuAI's actual chat UI
  // (as opposed to the synthetic diagnostics test, which never leaves this
  // iframe's own JS realm). This is module-level state that survives across
  // opening/closing the settings panel, because RisuAI keeps this plugin's
  // sandboxed iframe alive for the whole session — only a full page reload
  // clears it. Capped so a runaway loop can't grow it forever.
  const _chatLog = [];
  let _chatLogEpoch = 0;
  // Muted while the synthetic diagnostics panel drives callGemini/
  // callGeminiNonStream/createSSEStream directly, so those runs don't get
  // interleaved with (and misread as) a real RisuAI-triggered chat call.
  let _chatLogMuted = false;
  function chatLog(...parts) {
    if (_chatLogMuted) return;
    const rel = _chatLogEpoch ? `+${Date.now() - _chatLogEpoch}ms` : "+0ms";
    _chatLog.push(`[${rel}] ${parts.map(p => typeof p === "string" ? p : JSON.stringify(p)).join(" ")}`);
    if (_chatLog.length > 2000) _chatLog.splice(0, _chatLog.length - 2000);
  }
  function chatLogNewCall(label) {
    _chatLogEpoch = Date.now();
    _chatLog.push(`\n=== ${label} (${new Date().toISOString()}) ===`);
  }

  // Never print secrets raw - only enough to eyeball "is this the right one".
  function redact(s, keep = 6) {
    if (!s) return "(비어 있음)";
    const str = String(s);
    return str.length <= keep * 2 ? "*".repeat(str.length) : `${str.slice(0, keep)}...${str.slice(-keep)} (길이 ${str.length})`;
  }

  // Runs fn() with a timeout and never throws - always resolves to a
  // {ok, detail, ms} result, so one bad/hanging step can't take down the
  // rest of a diagnostic run.
  async function runStep(name, fn, timeoutMs = 20000) {
    const start = Date.now();
    try {
      const result = await Promise.race([
        (async () => fn())(),
        new Promise((_, rej) => setTimeout(() => rej(new Error(`시간 초과 (${timeoutMs}ms)`)), timeoutMs)),
      ]);
      return { name, ok: true, detail: (result === undefined || result === null) ? "" : String(result), ms: Date.now() - start };
    } catch (e) {
      let msg;
      try { msg = (e && (e.stack || e.message)) ? (e.stack || e.message) : JSON.stringify(e); }
      catch { msg = String(e); }
      return { name, ok: false, detail: msg, ms: Date.now() - start };
    }
  }

  function parseFloat2(s, fallback) {
    const n = parseFloat(s);
    return isNaN(n) ? fallback : n;
  }

  function parseInt2(s, fallback) {
    const n = parseInt(s, 10);
    return isNaN(n) ? fallback : n;
  }

  function base64url(buf) {
    const bytes = new Uint8Array(buf);
    let str = "";
    for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function toB64Url(obj) {
    return btoa(JSON.stringify(obj))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  // ─── JWT & Access Token ───────────────────────────────────────────────────────

  function parseSA(jsonStr) {
    const s = (jsonStr || "").trim();
    if (!s) throw new Error("Service Account JSON이 비어 있습니다.");
    let o;
    try { o = JSON.parse(s); } catch (e) { throw new Error(`JSON 파싱 오류: ${e.message}`); }
    if (o.type !== "service_account") throw new Error("type이 service_account가 아닙니다.");
    if (!o.client_email || !o.private_key) throw new Error("client_email 또는 private_key 누락.");
    if (!o.private_key.includes("PRIVATE KEY")) throw new Error("private_key가 PEM 형식이 아닙니다.");
    if (!o.project_id) throw new Error("project_id가 JSON에 없습니다.");
    return o;
  }

  async function getAccessToken(saJson, bridgeUrl) {
    const sa = parseSA(saJson);
    const cacheKey = sa.client_email;
    const now = Math.floor(Date.now() / 1000);

    const cached = _tokenCache[cacheKey];
    if (cached && cached.expiry > now + 60) return cached.token;

    const header  = toB64Url({ alg: "RS256", typ: "JWT" });
    const payload = toB64Url({
      iss:   sa.client_email,
      scope: GOOGLE_SCOPE,
      aud:   GOOGLE_OAUTH_URL,
      iat:   now,
      exp:   now + 3600,
    });
    const sigInput = `${header}.${payload}`;

    const pemBody = sa.private_key
      .replace(/-----BEGIN .*?-----/g, "")
      .replace(/-----END .*?-----/g, "")
      .replace(/\s/g, "");
    const derBuf = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0)).buffer;

    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8", derBuf,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false, ["sign"]
    );

    const sigBuf = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5", cryptoKey,
      new TextEncoder().encode(sigInput)
    );

    const jwt = `${sigInput}.${base64url(sigBuf)}`;

    let accessToken;
    if (bridgeUrl) {
      const res = await Risuai.nativeFetch(bridgeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assertion: jwt }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "bridge error");
        throw new Error(`Token bridge ${res.status}: ${t}`);
      }
      const data = await res.json();
      accessToken = data.access_token;
      _tokenCache[cacheKey] = { token: accessToken, expiry: now + (data.expires_in || 3600) };
    } else {
      const form = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
      let res;
      try {
        res = await Risuai.nativeFetch(GOOGLE_OAUTH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form,
        });
      } catch {
        res = await fetch(GOOGLE_OAUTH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form,
        });
      }
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`OAuth token error ${res.status}: ${t.substring(0, 200)}`);
      }
      const data = await res.json();
      accessToken = data.access_token;
      _tokenCache[cacheKey] = { token: accessToken, expiry: now + (data.expires_in || 3600) };
    }

    return accessToken;
  }

  // ─── Message Conversion ───────────────────────────────────────────────────────

  function extractText(content) {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.filter(p => p.type === "text").map(p => p.text || "").join("\n");
    }
    return "";
  }

  function convertContentToParts(content) {
    if (typeof content === "string") {
      return content.trim() ? [{ text: content }] : [];
    }
    if (!Array.isArray(content)) return [];

    const parts = [];
    for (const part of content) {
      if (part.type === "text") {
        if (part.text && part.text.trim()) parts.push({ text: part.text });
      } else if (part.type === "image_url") {
        const url = part.image_url?.url || "";
        if (url.startsWith("data:")) {
          const [header, data] = url.split(",");
          const mimeType = header.replace("data:", "").replace(";base64", "");
          parts.push({ inlineData: { mimeType, data } });
        } else {
          parts.push({ fileData: { mimeType: "image/jpeg", fileUri: url } });
        }
      } else if (part.type === "image" && part.source) {
        const src = part.source;
        if (src.type === "base64") {
          parts.push({ inlineData: { mimeType: src.media_type || "image/png", data: src.data } });
        }
      }
    }
    return parts;
  }

  // RisuAI attaches uploaded images/audio to a chat message via a sibling
  // `multimodals` array on the message object (NOT inside `content`), e.g.
  // `{ role: "user", content: "...", multimodals: [{ type: "image", base64: "data:image/png;base64,..." }] }`.
  // `prompt_chat` messages carry this field straight through, so it has to
  // be read separately from `convertContentToParts` or attachments are
  // silently dropped and the model only ever sees the surrounding text.
  function convertMultimodalsToParts(multimodals) {
    if (!Array.isArray(multimodals)) return [];
    const parts = [];
    for (const item of multimodals) {
      if (!item || typeof item !== "object") continue;
      if (item.type === "image" || item.type === "audio" || item.type === "video") {
        const raw = item.base64 || item.data || "";
        if (raw.startsWith("data:")) {
          const [header, data] = raw.split(",");
          const mimeType = header.replace("data:", "").replace(";base64", "");
          if (data) parts.push({ inlineData: { mimeType, data } });
        } else if (raw) {
          const fallbackMime = item.mimeType || (item.type === "image" ? "image/png" : item.type === "audio" ? "audio/mpeg" : "video/mp4");
          parts.push({ inlineData: { mimeType: fallbackMime, data: raw } });
        } else if (item.url) {
          const fallbackMime = item.mimeType || (item.type === "image" ? "image/jpeg" : item.type === "audio" ? "audio/mpeg" : "video/mp4");
          parts.push({ fileData: { mimeType: fallbackMime, fileUri: item.url } });
        }
      }
    }
    return parts;
  }

  function ensureAlternating(contents) {
    if (!contents.length) return [];
    const result = [];
    for (const msg of contents) {
      const last = result[result.length - 1];
      if (last && last.role === msg.role) {
        last.parts.push(...msg.parts);
      } else {
        result.push({ role: msg.role, parts: [...msg.parts] });
      }
    }
    if (result.length > 0 && result[0].role === "model") {
      result.unshift({ role: "user", parts: [{ text: "(continued)" }] });
    }
    return result;
  }

  function convertMessagesToGemini(messages, preserveSystem) {
    const contents = [];
    let systemParts = [];
    // Only LEADING system messages (persona/description/scenario/jailbreak,
    // before any real dialogue turn) are treated as global systemInstruction.
    // A "system"-role message that appears AFTER the conversation has
    // started is usually an in-context instruction for that specific turn
    // (e.g. an author's note or "[System: ...]" reminder RisuAI's prompt
    // template injects right before generation) - folding it into the
    // global system block instead of keeping it as part of the actual turn
    // can leave the real ask out of `contents` entirely, so Gemini has
    // nothing concrete to respond to.
    let sawDialogueTurn = false;

    for (const msg of messages) {
      if (!msg || !msg.role) continue;
      const role = msg.role;

      if (role === "system" && !sawDialogueTurn) {
        if (preserveSystem) {
          const text = typeof msg.content === "string" ? msg.content : extractText(msg.content);
          if (text.trim()) systemParts.push({ text: text.trim() });
        }
        continue;
      }

      sawDialogueTurn = true;
      const geminiRole = role === "assistant" ? "model" : "user";
      const parts = [...convertContentToParts(msg.content), ...convertMultimodalsToParts(msg.multimodals)];
      if (parts.length === 0) continue;

      // Trailing system-role messages (an in-context note/instruction, not
      // the persona preamble) get folded into a user turn - but mark them
      // with a "system: " text prefix so the model can still tell it's a
      // meta-instruction rather than something the human literally typed.
      // Matches the reference plugin's exact convention for this case.
      if (role === "system" && parts[0] && typeof parts[0].text === "string" && !parts[0].text.startsWith("system: ")) {
        parts[0] = { ...parts[0], text: `system: ${parts[0].text}` };
      }

      const last = contents[contents.length - 1];
      if (last && last.role === geminiRole) {
        last.parts.push(...parts);
      } else {
        contents.push({ role: geminiRole, parts });
      }
    }

    return { contents: ensureAlternating(contents), systemParts };
  }

  // ─── Safety Settings ─────────────────────────────────────────────────────────

  async function buildSafetySettings() {
    const settings = [];
    for (const { key, category } of SAFETY_CATEGORIES) {
      const val = (await getArg(key, "BLOCK_NONE")).trim().toUpperCase();
      if (val && SAFETY_THRESHOLDS.includes(val)) {
        settings.push({ category, threshold: val });
      }
    }
    return settings;
  }

  // ─── Generation Config Builder ────────────────────────────────────────────────

  async function buildGenerationConfig(args) {
    const tempStr    = await getArg("vg_temperature", "1.0");
    const maxTokStr  = await getArg("vg_max_tokens", "8192");
    const topPStr    = await getArg("vg_top_p", "");
    const topKStr    = await getArg("vg_top_k", "");
    const freqPStr   = await getArg("vg_frequency_penalty", "");
    const presPStr   = await getArg("vg_presence_penalty", "");
    const stopSeqStr = await getArg("vg_stop_sequences", "");
    const seedStr    = await getArg("vg_seed", "");

    const temperature = parseFloat2(
      args?.temperature !== undefined && args?.temperature !== null ? String(args.temperature) : tempStr,
      1.0
    );
    const maxTokens = parseInt2(
      args?.max_tokens !== undefined && args?.max_tokens !== null ? String(args.max_tokens) : maxTokStr,
      8192
    );

    const genConfig = { temperature, maxOutputTokens: maxTokens };

    const topP = (args?.top_p !== undefined && args?.top_p !== null) ? args.top_p : parseFloat2(topPStr, undefined);
    if (topP !== undefined) genConfig.topP = topP;

    const topK = (args?.top_k !== undefined && args?.top_k !== null) ? args.top_k : parseInt2(topKStr, undefined);
    if (topK !== undefined) genConfig.topK = topK;

    const freqP = (args?.frequency_penalty !== undefined && args?.frequency_penalty !== null) ? args.frequency_penalty : parseFloat2(freqPStr, undefined);
    if (freqP !== undefined) genConfig.frequencyPenalty = freqP;

    const presP = (args?.presence_penalty !== undefined && args?.presence_penalty !== null) ? args.presence_penalty : parseFloat2(presPStr, undefined);
    if (presP !== undefined) genConfig.presencePenalty = presP;

    if (stopSeqStr.trim()) {
      genConfig.stopSequences = stopSeqStr.split(",").map(s => s.trim()).filter(Boolean);
    }

    const seed = parseInt2(seedStr, undefined);
    if (seed !== undefined) genConfig.seed = seed;

    const thinkingBudget  = parseInt2(await getArg("vg_thinking_budget", "0"), 0);
    const thinkingLevel   = (await getArg("vg_thinking_level", "off")).trim();
    const includeThoughts = await getBoolArg("vg_include_thoughts", false);

    if (thinkingLevel && thinkingLevel !== "off" && thinkingLevel !== "none") {
      const tc = { includeThoughts };
      if (thinkingBudget > 0) tc.thinkingBudget = thinkingBudget;
      if (thinkingLevel !== "AUTO") tc.thinkingLevel = thinkingLevel.toUpperCase();
      genConfig.thinkingConfig = tc;
    } else if (thinkingBudget > 0) {
      genConfig.thinkingConfig = { includeThoughts, thinkingBudget };
    }

    return genConfig;
  }

  // ─── Token Usage Tracking ───────────────────────────────────────────────────────

  const TOKEN_STATS_ARG = "vg_token_stats";
  const EMPTY_TOKEN_TOTALS = { input: 0, output: 0, reasoning: 0, cached: 0, total: 0 };

  // Gemini reports usage as promptTokenCount/candidatesTokenCount/etc. -
  // normalize to a flat shape shared by both the running totals and the
  // per-model breakdown so the accumulation code doesn't need to know
  // about Gemini's specific field names.
  function normalizeGeminiUsage(u) {
    if (!u || typeof u !== "object") return null;
    const input = u.promptTokenCount || 0;
    const output = u.candidatesTokenCount || 0;
    const reasoning = u.thoughtsTokenCount || 0;
    const cached = u.cachedContentTokenCount || 0;
    const total = u.totalTokenCount || (input + output + reasoning);
    return { input, output, reasoning, cached, total };
  }

  async function loadTokenStats() {
    try {
      const raw = await getArg(TOKEN_STATS_ARG, "");
      if (!raw.trim()) return { totals: { ...EMPTY_TOKEN_TOTALS }, requests: 0, perModel: {} };
      const parsed = JSON.parse(raw);
      parsed.totals = { ...EMPTY_TOKEN_TOTALS, ...(parsed.totals || {}) };
      parsed.perModel = parsed.perModel || {};
      parsed.requests = parsed.requests || 0;
      return parsed;
    } catch {
      return { totals: { ...EMPTY_TOKEN_TOTALS }, requests: 0, perModel: {} };
    }
  }

  async function saveTokenStats(stats) {
    try { await Risuai.setArgument(TOKEN_STATS_ARG, JSON.stringify(stats)); }
    catch (e) { warn("토큰 통계 저장 실패:", e.message); }
  }

  async function recordTokenUsage(modelId, usage) {
    if (!usage) return;
    const stats = await loadTokenStats();
    for (const k of Object.keys(EMPTY_TOKEN_TOTALS)) stats.totals[k] = (stats.totals[k] || 0) + (usage[k] || 0);
    stats.requests += 1;
    if (!stats.perModel[modelId]) stats.perModel[modelId] = { ...EMPTY_TOKEN_TOTALS, requests: 0 };
    const m = stats.perModel[modelId];
    for (const k of Object.keys(EMPTY_TOKEN_TOTALS)) m[k] = (m[k] || 0) + (usage[k] || 0);
    m.requests += 1;
    await saveTokenStats(stats);
    chatLog(`토큰 사용량 기록: model=${modelId}, 이번 요청 input=${usage.input}/output=${usage.output}/total=${usage.total} (누적 total=${stats.totals.total}, 누적 요청수=${stats.requests})`);
  }

  async function resetTokenStats() {
    await saveTokenStats({ totals: { ...EMPTY_TOKEN_TOTALS }, requests: 0, perModel: {} });
  }

  // ─── Response Parsing ─────────────────────────────────────────────────────────

  function partsToText(parts, includeThoughts) {
    let text = "";
    for (const part of parts || []) {
      if (part.thought && !includeThoughts) continue;
      if (part.text) {
        text += part.thought ? `<thinking>\n${part.text}\n</thinking>\n` : part.text;
      } else if (part.inlineData) {
        const { mimeType, data } = part.inlineData;
        text += `![generated](data:${mimeType};base64,${data})`;
      }
    }
    return text;
  }

  function parseGeminiResponse(data, genConfig) {
    try {
      if (!data.candidates || data.candidates.length === 0) {
        const reason = data.promptFeedback?.blockReason || "unknown";
        return { success: false, content: `[${PLUGIN_NAME}] 응답 차단됨: ${reason}` };
      }
      const candidate = data.candidates[0];
      if (candidate.finishReason === "SAFETY") {
        return { success: false, content: `[${PLUGIN_NAME}] 안전 필터로 차단됨` };
      }
      const includeThoughts = genConfig?.thinkingConfig?.includeThoughts;
      const text = partsToText(candidate.content?.parts, includeThoughts);
      return { success: true, content: text, usage: normalizeGeminiUsage(data.usageMetadata) };
    } catch (e) {
      return { success: false, content: `[${PLUGIN_NAME}] 응답 파싱 오류: ${e.message}` };
    }
  }

  function createSSEStream(response, abortSignal, includeThoughts = false, onUsage) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let pullCount = 0;
    let enqueueCount = 0;

    chatLog("createSSEStream: ReadableStream 생성됨 (아직 아무도 읽지 않음)");

    return new ReadableStream({
      async pull(controller) {
        pullCount++;
        if (pullCount === 1) chatLog("pull() 최초 호출됨 — RisuAI(또는 다른 소비자)가 스트림을 실제로 읽기 시작함");
        while (true) {
          if (abortSignal?.aborted) { chatLog("abortSignal aborted, 스트림 닫음"); controller.close(); reader.cancel(); return; }
          let done, value;
          try {
            ({ done, value } = await reader.read());
          } catch (e) {
            chatLog("reader.read() 예외:", e && (e.stack || e.message) || e);
            controller.error(e);
            return;
          }
          if (done) { chatLog(`업스트림 완료(done). 총 pull() ${pullCount}회, enqueue ${enqueueCount}회`); controller.close(); return; }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (jsonStr === "[DONE]") { chatLog("[DONE] 마커 수신, 스트림 닫음"); controller.close(); return; }
            try {
              const data = JSON.parse(jsonStr);
              if (data.usageMetadata && onUsage) onUsage(normalizeGeminiUsage(data.usageMetadata));
              const candidate = data.candidates?.[0];
              if (!candidate) continue;
              for (const part of candidate.content?.parts || []) {
                if (part.thought && !includeThoughts) {
                  chatLog(`사고 과정(thought) 파트 건너뜀 (includeThoughts=false): "${(part.text || "").slice(0, 60)}"`);
                  continue;
                }
                if (part.text) {
                  enqueueCount++;
                  const text = part.thought ? `<thinking>\n${part.text}\n</thinking>\n` : part.text;
                  if (enqueueCount <= 3 || enqueueCount % 20 === 0) chatLog(`enqueue #${enqueueCount}${part.thought ? " [thought]" : ""}: "${text.slice(0, 60)}"`);
                  controller.enqueue(text);
                } else if (part.inlineData) {
                  const { mimeType, data: imgData } = part.inlineData;
                  enqueueCount++;
                  chatLog(`enqueue #${enqueueCount}: 이미지 (${mimeType}, base64 길이 ${imgData.length})`);
                  controller.enqueue(`![generated](data:${mimeType};base64,${imgData})`);
                }
              }
            } catch (e) { chatLog("SSE 라인 파싱 실패(무시하고 계속):", jsonStr.slice(0, 150)); }
          }
        }
      },
      cancel(reason) { chatLog("cancel() 호출됨 (소비자가 스트림을 취소함):", reason); reader.cancel(); }
    });
  }

  // ─── Gemini Fetcher ───────────────────────────────────────────────────────────

  async function callGemini(args, modelId, abortSignal) {
    chatLog(`callGemini 시작 (model=${modelId}, abortSignal=${abortSignal ? "있음" : "없음"})`);
    const saJson      = await getArg("vg_service_account_json", "");
    const location    = (await getArg("vg_location", "us-central1")).trim() || "us-central1";
    const bridgeUrl   = (await getArg("vg_token_bridge_url", "")).trim();
    const streaming   = await getBoolArg("vg_streaming", true);
    const preserveSys = await getBoolArg("vg_preserve_system", true);
    const grounding   = await getBoolArg("vg_grounding", false);
    const groundingDR = parseFloat2(await getArg("vg_grounding_dynamic_retrieval", ""), undefined);
    const serviceTier = (await getArg("vg_service_tier", "")).trim().toUpperCase();
    chatLog(`설정 로드 완료: location=${location}, streaming=${streaming}, grounding=${grounding}`);

    if (!saJson.trim()) {
      chatLog("SA JSON 비어있음 - 중단");
      return { success: false, content: `[${PLUGIN_NAME}] Service Account JSON이 설정되지 않았습니다. 플러그인 설정에서 입력해 주세요.` };
    }

    let sa;
    try { sa = parseSA(saJson); chatLog("SA JSON 파싱 성공:", sa.project_id); }
    catch (e) { chatLog("SA JSON 파싱 실패:", e.message); return { success: false, content: `[${PLUGIN_NAME}] SA JSON 오류: ${e.message}` }; }

    let accessToken;
    try { accessToken = await getAccessToken(saJson, bridgeUrl || undefined); chatLog("토큰 획득 성공:", redact(accessToken, 6)); }
    catch (e) { chatLog("토큰 획득 실패:", e.message); return { success: false, content: `[${PLUGIN_NAME}] 인증 오류: ${e.message}` }; }

    const baseUrl = location === "global"
      ? "https://aiplatform.googleapis.com"
      : `https://${location}-aiplatform.googleapis.com`;
    const modelPath = `${baseUrl}/v1/projects/${sa.project_id}/locations/${location}/publishers/google/models/${modelId}`;

    const messages = args?.prompt_chat || [];
    chatLog(`args.prompt_chat 메시지 수: ${messages.length}, args 키 목록: ${Object.keys(args || {}).join(", ")}`);
    chatLog("원본 prompt_chat 역할 순서:", messages.map(m => m?.role || "?").join(" -> "));
    const multimodalCount = messages.reduce((n, m) => n + (Array.isArray(m?.multimodals) ? m.multimodals.length : 0), 0);
    chatLog(`msg.multimodals 첨부 개수 합계: ${multimodalCount}`);
    const { contents, systemParts } = convertMessagesToGemini(messages, preserveSys);
    chatLog(`Gemini 형식 변환 완료: contents ${contents.length}개, systemParts ${systemParts.length}개`);
    chatLog("변환된 contents 역할 순서:", contents.map(c => c.role).join(" -> "));
    contents.forEach((c, i) => {
      const preview = (c.parts || []).map(p => p.text ? p.text.slice(0, 80) : p.inlineData ? `(inlineData: ${p.inlineData.mimeType}, ${p.inlineData.data?.length || 0}자)` : p.fileData ? `(fileData: ${p.fileData.fileUri})` : "(비텍스트 part)").join(" | ");
      chatLog(`  contents[${i}] role=${c.role}: "${preview}"`);
    });
    chatLog(`  systemInstruction 미리보기 (앞 200자): "${systemParts.map(p => p.text).join(" ").slice(0, 200)}"`);

    let genConfig;
    try { genConfig = await buildGenerationConfig(args); }
    catch (e) { chatLog("생성 파라미터 오류:", e.message); return { success: false, content: `[${PLUGIN_NAME}] 파라미터 오류: ${e.message}` }; }

    const safetySettings = await buildSafetySettings();

    const body = { contents, generationConfig: genConfig };
    if (systemParts.length > 0) body.systemInstruction = { parts: systemParts };
    if (safetySettings.length > 0) body.safetySettings = safetySettings;

    if (grounding) {
      const tool = { googleSearch: {} };
      if (groundingDR !== undefined) {
        tool.googleSearch.dynamicRetrievalConfig = { mode: "MODE_DYNAMIC", dynamicThreshold: groundingDR };
      }
      body.tools = [tool];
    }

    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
    if (serviceTier === "AUTO" || serviceTier === "FLEX") {
      headers["X-Goog-Api-Key-Type"] = serviceTier.toLowerCase();
    }

    const bodyStr = JSON.stringify(body);

    if (streaming) {
      const streamUrl = `${modelPath}:streamGenerateContent?alt=sse`;
      chatLog("스트리밍 모드: nativeFetch 호출 시작 ->", streamUrl);
      let res;
      try {
        res = await Risuai.nativeFetch(streamUrl, { method: "POST", headers, body: bodyStr, signal: abortSignal });
        chatLog("nativeFetch 응답 도착. status=", res.status);
      } catch (e1) {
        chatLog("nativeFetch 실패, fetch()로 폴백 시도:", e1 && (e1.message || e1));
        try {
          res = await fetch(streamUrl, { method: "POST", headers, body: bodyStr, signal: abortSignal });
          chatLog("fetch() 폴백 응답 도착. status=", res.status);
        } catch (e2) {
          chatLog("fetch() 폴백도 실패:", e2.message);
          return { success: false, content: `[${PLUGIN_NAME}] 네트워크 오류: ${e2.message}` };
        }
      }

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) delete _tokenCache[sa.client_email];
        const errText = await res.text().catch(() => "");
        chatLog(`API 오류 응답 (status=${res.status}):`, errText.slice(0, 500));
        return { success: false, content: `[${PLUGIN_NAME}] API 오류 ${res.status}: ${errText.substring(0, 300)}` };
      }

      if (!res.body) {
        chatLog("res.body가 없음 (스트림 미지원 응답) - 비스트리밍으로 폴백");
        return await callGeminiNonStream(modelPath, headers, bodyStr, abortSignal, genConfig, modelId);
      }

      // A raw ReadableStream returned here has to cross the plugin's
      // sandboxed iframe -> RisuAI postMessage boundary. In testing, the
      // user confirmed non-streaming (plain string content) always
      // delivers correctly, while this ReadableStream path silently
      // produces nothing in the RisuAI chat UI despite our own logs
      // showing pull()/enqueue/close all completing normally on this side
      // of that boundary. Rather than keep guessing at the exact transfer
      // failure, drain the stream fully here (still using the streaming
      // endpoint) and return a plain string, matching the delivery method
      // that's proven to actually work.
      chatLog("스트림을 iframe 내부에서 끝까지 직접 읽어서 문자열로 반환합니다 (ReadableStream 직접 반환은 RisuAI에 전달되지 않는 것으로 확인됨).");
      let streamUsage = null;
      const stream = createSSEStream(res, abortSignal, !!genConfig?.thinkingConfig?.includeThoughts, u => { streamUsage = u; });
      const reader = stream.getReader();
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += value;
      }
      chatLog(`스트림 드레인 완료. 최종 텍스트 길이=${fullText.length}`);
      if (streamUsage) await recordTokenUsage(modelId, streamUsage);
      return { success: true, content: fullText };
    } else {
      chatLog("비스트리밍 모드: callGeminiNonStream 호출");
      return await callGeminiNonStream(modelPath, headers, bodyStr, abortSignal, genConfig, modelId);
    }
  }

  async function callGeminiNonStream(modelPath, headers, bodyStr, abortSignal, genConfig, modelId) {
    const url = `${modelPath}:generateContent`;
    chatLog("callGeminiNonStream: nativeFetch 호출 시작 ->", url);
    let res;
    try {
      res = await Risuai.nativeFetch(url, { method: "POST", headers, body: bodyStr, signal: abortSignal });
      chatLog("nativeFetch 응답 도착. status=", res.status);
    } catch (e1) {
      chatLog("nativeFetch 실패, fetch()로 폴백 시도:", e1 && (e1.message || e1));
      try {
        res = await fetch(url, { method: "POST", headers, body: bodyStr, signal: abortSignal });
        chatLog("fetch() 폴백 응답 도착. status=", res.status);
      } catch (e2) {
        chatLog("fetch() 폴백도 실패:", e2.message);
        return { success: false, content: `[${PLUGIN_NAME}] 네트워크 오류: ${e2.message}` };
      }
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      chatLog(`API 오류 응답 (status=${res.status}):`, errText.slice(0, 500));
      return { success: false, content: `[${PLUGIN_NAME}] API 오류 ${res.status}: ${errText.substring(0, 300)}` };
    }

    const data = await res.json();
    chatLog("응답 JSON 파싱 완료, parseGeminiResponse 호출");
    const parsed = parseGeminiResponse(data, genConfig);
    if (parsed.success && parsed.usage && modelId) await recordTokenUsage(modelId, parsed.usage);
    chatLog("최종 반환:", JSON.stringify(parsed).slice(0, 300));
    return parsed;
  }

  // ─── Imagen Fetcher ───────────────────────────────────────────────────────────

  async function callImagen(args, modelId) {
    const saJson    = await getArg("vg_service_account_json", "");
    const location  = (await getArg("vg_location", "us-central1")).trim() || "us-central1";
    const bridgeUrl = (await getArg("vg_token_bridge_url", "")).trim();
    const aspect    = (await getArg("vg_image_aspect_ratio", "1:1")).trim() || "1:1";
    const count     = parseInt2(await getArg("vg_image_count", "1"), 1);

    if (!saJson.trim()) return { success: false, content: `[${PLUGIN_NAME}] Service Account JSON 없음` };

    let sa;
    try { sa = parseSA(saJson); }
    catch (e) { return { success: false, content: `[${PLUGIN_NAME}] SA JSON 오류: ${e.message}` }; }

    let accessToken;
    try { accessToken = await getAccessToken(saJson, bridgeUrl || undefined); }
    catch (e) { return { success: false, content: `[${PLUGIN_NAME}] 인증 오류: ${e.message}` }; }

    const baseUrl = location === "global"
      ? "https://aiplatform.googleapis.com"
      : `https://${location}-aiplatform.googleapis.com`;
    const url = `${baseUrl}/v1/projects/${sa.project_id}/locations/${location}/publishers/google/models/${modelId}:predict`;

    const messages = args?.prompt_chat || [];
    let prompt = "";
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") { prompt = extractText(messages[i].content); break; }
    }

    const body = {
      instances: [{ prompt }],
      parameters: { sampleCount: Math.min(Math.max(count, 1), 4), aspectRatio: aspect },
    };

    chatLog("callImagen: nativeFetch 호출 시작 ->", url);
    let res;
    try {
      res = await Risuai.nativeFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      chatLog("nativeFetch 응답 도착. status=", res.status);
    } catch (e) {
      chatLog("callImagen nativeFetch 실패:", e.message);
      return { success: false, content: `[${PLUGIN_NAME}] 네트워크 오류: ${e.message}` };
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      chatLog(`Imagen API 오류 응답 (status=${res.status}):`, errText.slice(0, 500));
      return { success: false, content: `[${PLUGIN_NAME}] Imagen 오류 ${res.status}: ${errText.substring(0, 300)}` };
    }

    const data = await res.json();
    const predictions = data.predictions || [];
    let result = "";
    for (const pred of predictions) {
      if (pred.bytesBase64Encoded) {
        const mime = pred.mimeType || "image/png";
        result += `![generated](data:${mime};base64,${pred.bytesBase64Encoded})\n`;
      }
    }

    return result.trim()
      ? { success: true, content: result.trim() }
      : { success: false, content: `[${PLUGIN_NAME}] Imagen 응답에 이미지 없음` };
  }

  // ─── Dynamic Model Fetch ──────────────────────────────────────────────────────

  // The publisher model catalog (`/v1beta1/publishers/google/models`) lists
  // every model Google has ever published, including ones a given project/
  // region has no access to (e.g. restricted previews). Listing alone is not
  // proof of availability, so each candidate is probed against the actual
  // per-project endpoint the chat fetcher will use, and only models that
  // respond (not 404/403) are kept. Probes use minimal bodies that error out
  // on real validation (not 404) without doing real generation work, except
  // for plain gemini text calls where a 1-token reply is cheap enough to do
  // for real.
  async function probeModelAvailable(accessToken, baseUrl, project, location, id) {
    try {
      if (isImagenId(id)) {
        const url = `${baseUrl}/v1/projects/${project}/locations/${location}/publishers/google/models/${id}:predict`;
        const opts = {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ instances: [] }),
        };
        let res;
        try { res = await Risuai.nativeFetch(url, opts); }
        catch { res = await fetch(url, opts); }
        // 404/403 = model not found or no access. Any other status (e.g. 400
        // invalid argument for the empty instances) means the model exists.
        return res.status !== 404 && res.status !== 403;
      }
      const url = `${baseUrl}/v1/projects/${project}/locations/${location}/publishers/google/models/${id}:generateContent`;
      const opts = {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "hi" }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
      };
      let res;
      try { res = await Risuai.nativeFetch(url, opts); }
      catch { res = await fetch(url, opts); }
      return res.ok;
    } catch {
      return false;
    }
  }

  async function probeAll(accessToken, baseUrl, project, location, candidates, concurrency = 5) {
    const results = new Array(candidates.length);
    let next = 0;
    async function worker() {
      while (next < candidates.length) {
        const i = next++;
        results[i] = await probeModelAvailable(accessToken, baseUrl, project, location, candidates[i].id);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, worker));
    return candidates.filter((_, i) => results[i]);
  }

  async function fetchDynamicModels() {
    try {
      const saJson    = await getArg("vg_service_account_json", "");
      const location  = (await getArg("vg_location", "us-central1")).trim() || "us-central1";
      const bridgeUrl = (await getArg("vg_token_bridge_url", "")).trim();

      if (!saJson.trim()) return null;

      let sa;
      try { sa = parseSA(saJson); } catch { return null; }

      let accessToken;
      try { accessToken = await getAccessToken(saJson, bridgeUrl || undefined); } catch { return null; }

      const baseUrl = location === "global"
        ? "https://aiplatform.googleapis.com"
        : `https://${location}-aiplatform.googleapis.com`;

      const models = [];
      let pageToken = null;
      let page = 0;

      while (page < 30) {
        page++;
        // NOTE: publisher model listing only exists under v1beta1, not v1.
        // v1 returns a bare 404 for this path.
        let url = `${baseUrl}/v1beta1/publishers/google/models?pageSize=100`;
        if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

        let res;
        try {
          res = await Risuai.nativeFetch(url, { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } });
        } catch {
          try {
            res = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } });
          } catch { break; }
        }

        if (!res.ok) break;
        const data = await res.json();
        // Response field is `publisherModels`, not `models`.
        if (data.publisherModels) models.push(...data.publisherModels);
        if (!data.nextPageToken) break;
        pageToken = data.nextPageToken;
      }

      const filtered = [];
      for (const m of models) {
        const id = (m.name || "").split("/").pop();
        if (!id) continue;

        const isImageModel = id.startsWith("imagen-");
        const isGeminiLatest = id.startsWith("gemini-") && (() => {
          const match = id.match(/^gemini-(\d+)/);
          return match && parseInt(match[1], 10) >= 3;
        })();

        if (isGeminiLatest || isImageModel) {
          filtered.push({ id, name: m.displayName || id });
        }
      }

      if (filtered.length === 0) return null;

      const available = await probeAll(accessToken, baseUrl, sa.project_id, location, filtered);

      if (available.length > 0) {
        try { await Risuai.setArgument("vg_dynamic_models", JSON.stringify(available)); } catch {}
        return available;
      }
      return null;
    } catch (e) {
      warn("동적 모델 fetch 실패:", e.message);
      return null;
    }
  }

  // ─── Model Registration ───────────────────────────────────────────────────────

  function isImagenId(id) {
    return id.startsWith("imagen-");
  }

  // RisuAI only forwards real attachment bytes (image/audio/video) to a
  // provider's fetcher if the provider declared the matching capability
  // flag when it was registered via addProvider - otherwise RisuAI
  // downgrades the attachment to a plain-text caption before the fetcher
  // ever runs, which is why `msg.multimodals` showed up empty even after
  // convertMultimodalsToParts was added. These numeric values mirror
  // RisuAI's internal model-flag enum (hasImageInput:0, hasImageOutput:1,
  // hasAudioInput:2, hasAudioOutput:3, hasFullSystemPrompt:6, hasStreaming:8,
  // hasVideoInput:12).
  const MODEL_FLAG_HAS_IMAGE_INPUT = 0;
  const MODEL_FLAG_HAS_IMAGE_OUTPUT = 1;
  const MODEL_FLAG_HAS_AUDIO_INPUT = 2;
  const MODEL_FLAG_HAS_FULL_SYSTEM_PROMPT = 6;
  const MODEL_FLAG_HAS_STREAMING = 8;
  const MODEL_FLAG_HAS_VIDEO_INPUT = 12;

  async function registerModel(model) {
    const displayName = `🔷 ${model.name}`;
    _registeredModels.push({ id: model.id, name: model.name, displayName });
    const flags = isImagenId(model.id)
      ? [MODEL_FLAG_HAS_IMAGE_OUTPUT]
      : [MODEL_FLAG_HAS_IMAGE_INPUT, MODEL_FLAG_HAS_AUDIO_INPUT, MODEL_FLAG_HAS_VIDEO_INPUT, MODEL_FLAG_HAS_FULL_SYSTEM_PROMPT, MODEL_FLAG_HAS_STREAMING];
    await Risuai.addProvider(
      displayName,
      async (args, abortSignal) => {
        // This is the ACTUAL entry point RisuAI's real chat UI calls - as
        // opposed to the synthetic diagnostics test, which never leaves this
        // iframe's own JS realm. Every real chat attempt starts a fresh log
        // section here so "마지막 실제 채팅 로그 보기" always reflects the
        // most recent genuine invocation from RisuAI itself.
        chatLogNewCall(`실제 채팅 호출 수신 (모델: ${model.id})`);
        try {
          chatLog("addProvider 콜백 진입. args 타입:", typeof args, "/ mode:", args?.mode, "/ prompt_chat 길이:", args?.prompt_chat?.length);
          let result;
          if (isImagenId(model.id)) {
            chatLog("Imagen 모델로 판단, callImagen 호출");
            result = await callImagen(args, model.id);
          } else {
            const imageMode = await getArg("vg_image_mode", "none");
            if (imageMode === "imagen") {
              chatLog("vg_image_mode=imagen 설정에 따라 callImagen 호출");
              result = await callImagen(args, model.id);
            } else {
              result = await callGemini(args, model.id, abortSignal);
            }
          }
          chatLog(`addProvider 콜백이 값을 반환하려는 중: success=${result?.success}, content 타입=${typeof result?.content}${result?.content && typeof result.content.getReader === "function" ? " (ReadableStream)" : ""}`);
          return result;
        } catch (e) {
          err("Fetcher crash:", e);
          chatLog("addProvider 콜백에서 예외 발생(치명적):", e && (e.stack || e.message) || e);
          return { success: false, content: `[${PLUGIN_NAME}] 오류: ${e.message}` };
        }
      },
      { tokenizer: "gpt-4", model: { flags } }
    );
  }

  async function getExcludedModelIds() {
    const raw = await getArg("vg_excluded_models", "");
    return new Set(raw.split(",").map(s => s.trim()).filter(Boolean));
  }

  async function registerAllModels(models) {
    _registeredModels.length = 0;
    const excluded = await getExcludedModelIds();
    let registered = 0;
    let skipped = 0;
    for (const model of models) {
      if (excluded.has(model.id)) { skipped++; continue; }
      try {
        await registerModel(model);
        registered++;
      } catch (e) {
        warn(`모델 등록 실패 (${model.id}):`, e.message);
      }
    }

    // Register a manually-typed custom model too, if set and not already present
    const customId = (await getArg("vg_custom_model", "")).trim();
    if (customId && !excluded.has(customId) && !models.some(m => m.id === customId)) {
      try {
        await registerModel({ id: customId, name: `Custom: ${customId}` });
        registered++;
      } catch (e) {
        warn(`커스텀 모델 등록 실패 (${customId}):`, e.message);
      }
    }

    log(`✓ ${registered}개 모델을 RisuAI에 등록했습니다. (제외됨: ${skipped}개)`);
    return registered;
  }

  // ─── Diagnostics ──────────────────────────────────────────────────────────────

  // Runs a battery of isolated, self-timing checks against the user's real
  // environment and streams results into the given <textarea id="vg-diag-output">
  // as each one finishes. Every step is wrapped by runStep, so a hung fetch or
  // an unexpected throw can never prevent the remaining steps from running.
  // ctx carries forward whatever earlier steps managed to produce (sa, token,
  // etc.) so later steps can reuse it, but every step re-checks ctx itself
  // and degrades gracefully instead of assuming a prior step succeeded.
  async function runDiagnostics(root, diagModelId) {
    const out = root.querySelector("#vg-diag-output");
    const ctx = {};
    const lines = [];
    let stepNum = 0;

    function append(line) {
      lines.push(line);
      if (out) {
        out.value = lines.join("\n");
        out.scrollTop = out.scrollHeight;
      }
    }

    async function step(name, fn, timeoutMs) {
      stepNum++;
      append(`\n[${stepNum}] ${name} — 실행 중...`);
      const r = await runStep(name, fn, timeoutMs);
      lines[lines.length - 1] = `[${stepNum}] ${name} — ${r.ok ? "✅ 성공" : "❌ 실패"} (${r.ms}ms)`;
      if (r.detail) append(String(r.detail).split("\n").map(l => "    " + l).join("\n"));
      if (out) { out.value = lines.join("\n"); out.scrollTop = out.scrollHeight; }
      return r;
    }

    _chatLogMuted = true;
    try {
      append(`=== 🔷 Vertex Gemini 종합 진단 시작 (${new Date().toISOString()}) ===`);

      await step("환경 체크", async () => {
        const info = [
          `Risuai 객체: ${typeof Risuai}`,
          `Risuai.nativeFetch: ${typeof Risuai?.nativeFetch}`,
          `Risuai.addProvider: ${typeof Risuai?.addProvider}`,
          `Risuai.getArgument/setArgument: ${typeof Risuai?.getArgument}/${typeof Risuai?.setArgument}`,
          `crypto.subtle: ${typeof crypto?.subtle}`,
          `현재 세션에서 등록된 모델 수: ${_registeredModels.length}`,
        ];
        return info.join("\n");
      });

      await step("설정값 스냅샷", async () => {
        const saRaw = await getArg("vg_service_account_json", "");
        let saSummary = "(비어 있음)";
        if (saRaw.trim()) {
          try {
            const parsed = JSON.parse(saRaw);
            saSummary = [
              `type: ${parsed.type}`,
              `project_id: ${parsed.project_id}`,
              `client_email: ${parsed.client_email}`,
              `private_key 존재: ${!!parsed.private_key} (길이 ${parsed.private_key ? parsed.private_key.length : 0})`,
            ].join(", ");
          } catch (e) {
            saSummary = `JSON 파싱 불가: ${e.message}`;
          }
        }
        const other = [
          `vg_service_account_json: ${saSummary}`,
          `vg_location: ${await getArg("vg_location", "(기본값 us-central1)")}`,
          `vg_token_bridge_url: ${redact(await getArg("vg_token_bridge_url", ""), 10)}`,
          `vg_custom_model: ${await getArg("vg_custom_model", "(없음)")}`,
          `vg_streaming: ${await getArg("vg_streaming", "(기본값 true)")}`,
          `vg_image_mode: ${await getArg("vg_image_mode", "(기본값 none)")}`,
          `vg_dynamic_models 캐시: ${(await getArg("vg_dynamic_models", "")).slice(0, 300) || "(없음)"}`,
        ];
        return other.join("\n");
      });

      await step("SA JSON 파싱", async () => {
        const saRaw = await getArg("vg_service_account_json", "");
        const sa = parseSA(saRaw);
        ctx.sa = sa;
        return `project_id=${sa.project_id}, client_email=${sa.client_email}, private_key 길이=${sa.private_key.length}`;
      });

      await step("JWT 서명 + 토큰 교환 (getAccessToken)", async () => {
        const saRaw = await getArg("vg_service_account_json", "");
        const bridgeUrl = (await getArg("vg_token_bridge_url", "")).trim();
        const token = await getAccessToken(saRaw, bridgeUrl || undefined);
        ctx.accessToken = token;
        return `토큰 획득 성공: ${redact(token, 8)}`;
      });

      await step("nativeFetch 원시 동작 확인 (인증 없는 요청)", async () => {
        const testUrl = "https://www.google.com/generate_204";
        let res;
        try {
          res = await Risuai.nativeFetch(testUrl, { method: "GET" });
        } catch (e) {
          throw new Error(`Risuai.nativeFetch 자체가 실패함: ${e.message || e}. RisuAI 플러그인 sandbox의 네트워크 권한 문제일 수 있습니다.`);
        }
        return `nativeFetch 응답 status=${res.status} (네트워크 경로 자체는 정상 동작)`;
      });

      const location = (await getArg("vg_location", "us-central1")).trim() || "us-central1";
      const baseUrl = location === "global" ? "https://aiplatform.googleapis.com" : `https://${location}-aiplatform.googleapis.com`;
      ctx.location = location;
      ctx.baseUrl = baseUrl;

      await step(`동적 모델 목록 조회 (location=${location})`, async () => {
        if (!ctx.accessToken) throw new Error("이전 단계(토큰 교환)가 실패해서 건너뜁니다.");
        const url = `${baseUrl}/v1beta1/publishers/google/models?pageSize=100`;
        let res;
        try { res = await Risuai.nativeFetch(url, { method: "GET", headers: { Authorization: `Bearer ${ctx.accessToken}` } }); }
        catch (e) { res = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${ctx.accessToken}` } }); }
        const bodyText = await res.text();
        if (!res.ok) throw new Error(`status=${res.status}, body=${bodyText.slice(0, 500)}`);
        let data;
        try { data = JSON.parse(bodyText); } catch { throw new Error(`JSON 파싱 실패: ${bodyText.slice(0, 300)}`); }
        const models = data.publisherModels || [];
        ctx.listedModels = models;
        const ids = models.map(m => (m.name || "").split("/").pop());
        return `status=${res.status}, 총 ${models.length}개 모델 카탈로그에서 확인. 예시: ${ids.slice(0, 8).join(", ")}`;
      });

      await step("모델 가용성 프로브 테스트 (대표 모델 몇 개)", async () => {
        if (!ctx.accessToken || !ctx.sa) throw new Error("이전 단계(토큰/SA 파싱)가 실패해서 건너뜁니다.");
        const candidates = [];
        if (diagModelId) candidates.push(diagModelId);
        candidates.push("gemini-2.5-flash", "gemini-3-flash-preview", "imagen-4.0-generate-001");
        const results = [];
        for (const id of [...new Set(candidates)]) {
          const available = await probeModelAvailable(ctx.accessToken, baseUrl, ctx.sa.project_id, location, id);
          results.push(`${id}: ${available ? "✅ 사용 가능" : "❌ 사용 불가/404"}`);
        }
        return results.join("\n");
      });

      const chatModelId = (diagModelId || "").trim() || "gemini-2.5-flash";
      const testArgs = {
        prompt_chat: [{ role: "user", content: "디버그 테스트 메시지입니다. 'OK'라고만 답해주세요." }],
        temperature: 0.1,
        max_tokens: 32,
      };

      await step(`비스트리밍 채팅 왕복 테스트 (모델: ${chatModelId})`, async () => {
        if (!ctx.accessToken || !ctx.sa) throw new Error("이전 단계(토큰/SA 파싱)가 실패해서 건너뜁니다.");
        const modelPath = `${baseUrl}/v1/projects/${ctx.sa.project_id}/locations/${location}/publishers/google/models/${chatModelId}`;
        const { contents, systemParts } = convertMessagesToGemini(testArgs.prompt_chat, true);
        const genConfig = await buildGenerationConfig(testArgs);
        const safetySettings = await buildSafetySettings();
        const body = { contents, generationConfig: genConfig };
        if (systemParts.length > 0) body.systemInstruction = { parts: systemParts };
        if (safetySettings.length > 0) body.safetySettings = safetySettings;
        const result = await callGeminiNonStream(modelPath, { "Content-Type": "application/json", Authorization: `Bearer ${ctx.accessToken}` }, JSON.stringify(body), undefined, genConfig);
        if (!result.success) throw new Error(`실패 응답: ${result.content}`);
        return `성공. 응답: ${String(result.content).slice(0, 300)}`;
      });

      await step(`스트리밍 채팅 왕복 테스트 (모델: ${chatModelId})`, async () => {
        if (!ctx.accessToken || !ctx.sa) throw new Error("이전 단계(토큰/SA 파싱)가 실패해서 건너뜁니다.");
        const modelPath = `${baseUrl}/v1/projects/${ctx.sa.project_id}/locations/${location}/publishers/google/models/${chatModelId}`;
        const { contents, systemParts } = convertMessagesToGemini(testArgs.prompt_chat, true);
        const genConfig = await buildGenerationConfig(testArgs);
        const headers = { "Content-Type": "application/json", Authorization: `Bearer ${ctx.accessToken}` };
        const body = { contents, generationConfig: genConfig };
        if (systemParts.length > 0) body.systemInstruction = { parts: systemParts };
        const streamUrl = `${modelPath}:streamGenerateContent?alt=sse`;
        let res;
        try { res = await Risuai.nativeFetch(streamUrl, { method: "POST", headers, body: JSON.stringify(body) }); }
        catch (e) { res = await fetch(streamUrl, { method: "POST", headers, body: JSON.stringify(body) }); }
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`status=${res.status}, body=${errText.slice(0, 500)}`);
        }
        if (!res.body) throw new Error("응답에 스트림 body가 없습니다 (res.body is null).");
        const stream = createSSEStream(res, undefined, !!genConfig?.thinkingConfig?.includeThoughts);
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let full = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          full += typeof value === "string" ? value : decoder.decode(value);
        }
        return `스트리밍 성공. 최종 텍스트: ${full.slice(0, 300)}`;
      }, 30000);

      await step("등록된 모델 목록 확인", async () => {
        if (_registeredModels.length === 0) {
          return "이 세션에서 addProvider로 등록된 모델이 없습니다. '모델 목록 새로고침 & 등록' 버튼을 먼저 눌러보세요.";
        }
        return _registeredModels.map(m => `- ${m.displayName} (id=${m.id})`).join("\n");
      });

      append(`\n=== 진단 완료 (${new Date().toISOString()}) ===`);
    } catch (fatal) {
      append(`\n!!! 진단 러너 자체에서 예상치 못한 오류 발생: ${fatal && (fatal.stack || fatal.message) || fatal} !!!`);
    } finally {
      _chatLogMuted = false;
    }
  }

  // ─── Model Selection List UI ────────────────────────────────────────────────

  // Renders checkboxes for `models` into #vg-model-list, checked/unchecked
  // according to the current (unsaved-included) value of the hidden
  // #vg_excluded_models field, and keeps that hidden field in sync as the
  // user toggles boxes. Purely a DOM helper - actual persistence happens
  // when the user clicks Save or the "체크 상태 반영" button.
  function renderModelList(root, models) {
    const listEl = root.querySelector("#vg-model-list");
    const hidden = root.querySelector("#vg_excluded_models");
    if (!listEl || !hidden) return;

    if (!models || models.length === 0) {
      listEl.innerHTML = `<span style="color:#666;">모델 목록을 아직 불러오지 않았습니다.</span>`;
      return;
    }

    const excluded = new Set(String(hidden.value || "").split(",").map(s => s.trim()).filter(Boolean));

    listEl.innerHTML = models.map((m, i) => `
      <label style="display:flex; align-items:center; gap:6px; padding:3px 0; cursor:pointer;">
        <input type="checkbox" class="vg-model-checkbox" data-model-id="${m.id}" ${excluded.has(m.id) ? "" : "checked"}>
        <span>${m.name || m.id}${m.name && m.name !== m.id ? ` <span style="color:#666;">(${m.id})</span>` : ""}</span>
      </label>
    `).join("");

    listEl.querySelectorAll(".vg-model-checkbox").forEach(cb => {
      cb.addEventListener("change", () => {
        const id = cb.getAttribute("data-model-id");
        const current = new Set(String(hidden.value || "").split(",").map(s => s.trim()).filter(Boolean));
        if (cb.checked) current.delete(id); else current.add(id);
        hidden.value = Array.from(current).join(",");
      });
    });
  }

  function getModelListCheckboxIds(root) {
    return Array.from(root.querySelectorAll(".vg-model-checkbox")).map(cb => cb.getAttribute("data-model-id"));
  }

  async function loadCachedOrFallbackModels() {
    const cached = await getArg("vg_dynamic_models", "");
    if (cached.trim()) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch { /* fall through to fallback list */ }
    }
    return FALLBACK_MODELS;
  }

  // ─── Chat Image Management ──────────────────────────────────────────────────

  // RisuAI embeds uploaded/generated images directly inside a message's
  // text (Message.data) as a macro tag - {{inlay::ID}}, {{inlayed::ID}}, or
  // {{inlayeddata::ID}} - rather than as a separate structured field.
  const INLAY_TAG_RE = /\{\{(inlay|inlayed|inlayeddata)::(.+?)\}\}/g;

  // Scans the currently open chat for messages containing an inlay tag.
  // Returns enough context to show the user which message is which without
  // needing to render the actual image (the plugin API doesn't expose a way
  // to read inlay asset bytes, only the chat's own text data).
  async function scanChatImages() {
    const charIndex = await Risuai.getCurrentCharacterIndex();
    const chatIndex = await Risuai.getCurrentChatIndex();
    const chat = await Risuai.getChatFromIndex(charIndex, chatIndex);
    if (!chat || !Array.isArray(chat.message)) {
      throw new Error("현재 열려 있는 채팅을 찾을 수 없습니다. 채팅창을 먼저 열어주세요.");
    }
    const matches = [];
    chat.message.forEach((msg, msgIndex) => {
      const data = String(msg?.data || "");
      let m;
      INLAY_TAG_RE.lastIndex = 0;
      while ((m = INLAY_TAG_RE.exec(data))) {
        const start = Math.max(0, m.index - 30);
        const end = Math.min(data.length, m.index + m[0].length + 30);
        matches.push({
          msgIndex,
          role: msg.role,
          tag: m[0],
          contextSnippet: `${start > 0 ? "…" : ""}${data.slice(start, m.index)}[[이미지 태그]]${data.slice(m.index + m[0].length, end)}${end < data.length ? "…" : ""}`,
        });
      }
    });
    return { charIndex, chatIndex, matches };
  }

  // Removes ONE specific tag occurrence from ONE specific message and saves
  // the chat back. Re-fetches the chat fresh right before writing so a
  // stale in-memory copy can't clobber other edits made in the meantime.
  async function removeChatImageTag(charIndex, chatIndex, msgIndex, tag) {
    const chat = await Risuai.getChatFromIndex(charIndex, chatIndex);
    if (!chat || !Array.isArray(chat.message) || !chat.message[msgIndex]) {
      throw new Error("메시지를 다시 찾지 못했습니다 (그 사이 채팅이 변경되었을 수 있습니다). 목록을 새로고침해주세요.");
    }
    const msg = chat.message[msgIndex];
    const data = String(msg.data || "");
    const idx = data.indexOf(tag);
    if (idx === -1) {
      throw new Error("해당 이미지 태그를 메시지에서 찾지 못했습니다 (이미 제거되었을 수 있습니다).");
    }
    msg.data = data.slice(0, idx) + data.slice(idx + tag.length);
    await Risuai.setChatToIndex(charIndex, chatIndex, chat);
  }

  // ─── Settings UI ─────────────────────────────────────────────────────────────

  async function renderSettings() {
    const fields = [
      "vg_service_account_json",
      "vg_token_bridge_url",
      "vg_location",
      "vg_custom_model",
      "vg_excluded_models",
      "vg_temperature",
      "vg_max_tokens",
      "vg_top_p",
      "vg_top_k",
      "vg_frequency_penalty",
      "vg_presence_penalty",
      "vg_stop_sequences",
      "vg_seed",
      "vg_service_tier",
      "vg_thinking_level",
      "vg_thinking_budget",
      "vg_include_thoughts",
      "vg_grounding",
      "vg_grounding_dynamic_retrieval",
      "vg_image_mode",
      "vg_image_aspect_ratio",
      "vg_image_count",
      "vg_streaming",
      "vg_preserve_system",
      ...SAFETY_CATEGORIES.map(s => s.key),
    ];

    document.body.innerHTML = `
      <div id="vg-root" style="
        padding: 16px; font-family: sans-serif; color: #e0e0e0; background: #1a1a2e;
        max-width: 720px; margin: 0 auto; min-height: 100vh; box-sizing: border-box;
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h2 style="margin:0; color:#7eb8f7;">🔷 Vertex Gemini 설정</h2>
          <button id="vg-close-btn" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:6px;color:#ccc;cursor:pointer;font-size:13px;padding:6px 14px;">✕ 닫기</button>
        </div>

        <style>
          .vg-section { margin-bottom: 24px; }
          .vg-section h3 { margin:0 0 12px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.15); font-size:14px; font-weight:600; color:#7eb8f7; }
          .vg-row { display:flex; align-items:flex-start; margin-bottom:10px; gap:12px; }
          .vg-row label { flex:0 0 200px; font-size:12px; padding-top:6px; color:#aaa; }
          .vg-row input, .vg-row select, .vg-row textarea {
            flex:1; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.2);
            border-radius:6px; color:inherit; font-size:13px; padding:5px 8px; outline:none;
          }
          .vg-row textarea { min-height:80px; resize:vertical; font-size:11px; }
          .vg-row input:focus, .vg-row select:focus, .vg-row textarea:focus { border-color:#7eb8f7; }
          .vg-btn { background:#2563eb; border:none; border-radius:6px; color:#fff; cursor:pointer; font-size:13px; padding:6px 14px; margin-right:8px; }
          .vg-btn:hover { background:#1d4ed8; }
          .vg-btn-secondary { background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:6px; color:#ccc; cursor:pointer; font-size:13px; padding:6px 14px; }
          .vg-status { font-size:12px; color:#aaa; margin-top:4px; }
          .vg-status.ok { color:#4ade80; }
          .vg-status.err { color:#f87171; }
          .vg-required { color:#f87171; }
        </style>

        <div class="vg-section">
          <h3>🔑 Vertex AI 인증 <span class="vg-required">(필수)</span></h3>
          <div class="vg-row">
            <label>Service Account JSON <span class="vg-required">*</span></label>
            <textarea id="vg_service_account_json" placeholder='{"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----...","client_email":"...@...iam.gserviceaccount.com",...}'></textarea>
          </div>
          <div class="vg-row">
            <label>Token Bridge URL <span style="color:#666">(선택, CORS 막힐 때만)</span></label>
            <input id="vg_token_bridge_url" type="text" placeholder="https://your-worker.workers.dev/token">
          </div>
          <div class="vg-row">
            <label></label>
            <div><button class="vg-btn" id="vg-test-auth">🔍 인증 테스트</button><span class="vg-status" id="vg-auth-status"></span></div>
          </div>
        </div>

        <div class="vg-section">
          <h3>🐞 디버그 / 진단</h3>
          <p style="font-size:11px;color:#888;margin:0 0 10px;">
            아래 버튼을 누르면 인증, 토큰 발급, 네트워크, 모델 목록, 실제 채팅(스트리밍/비스트리밍)까지
            전부 순서대로 테스트하고 결과를 아래 박스에 출력합니다. 한 단계가 실패하거나 멈춰도
            (타임아웃 처리됨) 나머지 단계는 계속 진행됩니다. 결과를 복사해서 대화창에 붙여넣어 주세요.
            (Service Account의 private_key나 전체 토큰 값은 출력하지 않습니다.)
          </p>
          <div class="vg-row">
            <label>테스트할 모델 ID <span style="color:#666">(선택)</span></label>
            <input id="vg-diag-model" type="text" placeholder="비워두면 gemini-2.5-flash 사용">
          </div>
          <div class="vg-row">
            <label></label>
            <div>
              <button class="vg-btn" id="vg-run-diagnostics">🧪 종합 진단 실행</button>
              <button class="vg-btn-secondary" id="vg-copy-diagnostics">📋 클립보드에 복사</button>
            </div>
          </div>
          <div class="vg-row">
            <label></label>
            <textarea id="vg-diag-output" readonly style="min-height:300px; font-family:monospace; font-size:11px; white-space:pre-wrap;" placeholder="진단 실행 결과가 여기에 표시됩니다."></textarea>
          </div>
          <p style="font-size:11px;color:#f0b429;margin:16px 0 6px;">
            ⚠ 위 진단은 이 설정 화면 안에서만 실행되기 때문에, RisuAI 채팅창에서 실제로 메시지를
            보낼 때 통과하는 경로(플러그인 iframe → RisuAI 본체로 응답 전달)는 검증하지 못합니다.
            "채팅이 무한 대기한다" 같은 문제는 아래 버튼으로 확인하세요.
          </p>
          <div class="vg-row">
            <label></label>
            <div>
              <button class="vg-btn" id="vg-view-chatlog">📜 마지막 실제 채팅 로그 보기</button>
              <button class="vg-btn-secondary" id="vg-copy-chatlog">📋 클립보드에 복사</button>
              <button class="vg-btn-secondary" id="vg-clear-chatlog">🗑 로그 지우기</button>
            </div>
          </div>
          <p style="font-size:11px;color:#888;margin:4px 0 10px;">
            사용법: 이 설정창을 닫지 않아도 됩니다(닫아도 무방). RisuAI 채팅창으로 가서 이 모델로
            실제 메시지를 하나 보내보세요 (응답이 오든 안 오든, 무한 대기 상태여도 상관없습니다).
            그 다음 이 설정창을 다시 열고 아래 버튼을 눌러 방금 그 호출의 실제 진행 상황을 확인하세요.
          </p>
          <div class="vg-row">
            <label></label>
            <textarea id="vg-chatlog-output" readonly style="min-height:300px; font-family:monospace; font-size:11px; white-space:pre-wrap;" placeholder="아직 기록된 실제 채팅 호출이 없습니다. 채팅을 먼저 보내보세요."></textarea>
          </div>
        </div>

        <div class="vg-section">
          <h3>🌐 위치 & 모델</h3>
          <div class="vg-row">
            <label>Location <span class="vg-required">*</span></label>
            <select id="vg_location">
              <option value="us-central1">us-central1 (미국 아이오와)</option>
              <option value="us-east1">us-east1</option>
              <option value="us-east4">us-east4</option>
              <option value="us-east5">us-east5</option>
              <option value="us-south1">us-south1</option>
              <option value="us-west1">us-west1</option>
              <option value="us-west4">us-west4</option>
              <option value="europe-west1">europe-west1</option>
              <option value="europe-west2">europe-west2 (런던)</option>
              <option value="europe-west3">europe-west3 (프랑크푸르트)</option>
              <option value="europe-west4">europe-west4</option>
              <option value="asia-east1">asia-east1 (대만)</option>
              <option value="asia-east2">asia-east2 (홍콩)</option>
              <option value="asia-northeast1">asia-northeast1 (도쿄)</option>
              <option value="asia-northeast3">asia-northeast3 (서울)</option>
              <option value="asia-southeast1">asia-southeast1 (싱가포르)</option>
              <option value="global">global</option>
            </select>
          </div>
          <div class="vg-row">
            <label>추가 커스텀 모델 ID <span style="color:#666">(선택)</span></label>
            <input id="vg_custom_model" type="text" placeholder="목록에 없는 모델을 직접 추가하려면 입력 (예: gemini-3.0-ultra)">
          </div>
          <div class="vg-row">
            <label></label>
            <div><button class="vg-btn" id="vg-fetch-models">⬇ 모델 목록 새로고침 & 등록</button><span class="vg-status" id="vg-model-status"></span></div>
          </div>
          <p style="font-size:11px;color:#888;margin:4px 0 0;">저장 후 "모델 목록 새로고침 & 등록"을 누르면 RisuAI 모델 선택창에 모델들이 나타납니다. (또는 플러그인 재시작/재활성화)</p>

          <input type="hidden" id="vg_excluded_models">
          <div class="vg-row" style="margin-top:14px;">
            <label>불러온 모델 목록</label>
            <div style="flex:1;">
              <p style="font-size:11px;color:#888;margin:0 0 8px;">
                체크 해제한 모델은 다음 등록부터 RisuAI 모델 선택창에 나타나지 않습니다.
                (다시 불러오지 않고 지금 목록 그대로 반영하려면 "체크 상태 반영" 사용)
              </p>
              <div id="vg-model-list" style="max-height:260px; overflow-y:auto; border:1px solid rgba(255,255,255,0.15); border-radius:6px; padding:8px; font-size:12px;">
                <span style="color:#666;">모델 목록을 아직 불러오지 않았습니다.</span>
              </div>
              <div style="margin-top:8px;">
                <button class="vg-btn-secondary" id="vg-select-all-models">전체 선택</button>
                <button class="vg-btn-secondary" id="vg-select-none-models">전체 해제</button>
                <button class="vg-btn" id="vg-apply-model-selection">✅ 체크 상태 반영 (다시 등록)</button>
                <span class="vg-status" id="vg-model-selection-status"></span>
              </div>
            </div>
          </div>
        </div>

        <div class="vg-section">
          <h3>⚙ 생성 설정</h3>
          <div class="vg-row"><label>Temperature (0.0~2.0)</label><input id="vg_temperature" type="number" step="0.05" min="0" max="2" placeholder="1.0"></div>
          <div class="vg-row"><label>Max Output Tokens</label><input id="vg_max_tokens" type="number" min="1" placeholder="8192"></div>
          <div class="vg-row"><label>Top P</label><input id="vg_top_p" type="number" step="0.01" min="0" max="1" placeholder="0.95"></div>
          <div class="vg-row"><label>Top K</label><input id="vg_top_k" type="number" min="1" placeholder=""></div>
          <div class="vg-row"><label>Frequency Penalty</label><input id="vg_frequency_penalty" type="number" step="0.01" placeholder=""></div>
          <div class="vg-row"><label>Presence Penalty</label><input id="vg_presence_penalty" type="number" step="0.01" placeholder=""></div>
          <div class="vg-row"><label>Stop Sequences</label><input id="vg_stop_sequences" type="text" placeholder="word1,word2"></div>
          <div class="vg-row"><label>Seed</label><input id="vg_seed" type="number" placeholder=""></div>
          <div class="vg-row">
            <label>Service Tier</label>
            <select id="vg_service_tier"><option value="">default</option><option value="auto">auto</option><option value="flex">flex</option></select>
          </div>
        </div>

        <div class="vg-section">
          <h3>🧠 사고 (Thinking / Reasoning)</h3>
          <div class="vg-row">
            <label>Thinking Level</label>
            <select id="vg_thinking_level">
              <option value="off">off (비활성)</option><option value="AUTO">AUTO</option>
              <option value="MINIMAL">MINIMAL</option><option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option>
            </select>
          </div>
          <div class="vg-row"><label>Thinking Budget (토큰)</label><input id="vg_thinking_budget" type="number" min="0" placeholder="0 = 자동"></div>
          <div class="vg-row">
            <label>사고 과정 출력</label>
            <select id="vg_include_thoughts"><option value="false">숨김 (기본)</option><option value="true">표시</option></select>
          </div>
        </div>

        <div class="vg-section">
          <h3>🛡 안전 설정</h3>
          <p style="font-size:12px;color:#888;margin:0 0 10px">BLOCK_NONE = 완전 해제</p>
          ${SAFETY_CATEGORIES.map(({ key, category }) => `
          <div class="vg-row">
            <label>${category.replace("HARM_CATEGORY_", "").replace(/_/g, " ")}</label>
            <select id="${key}">
              <option value="BLOCK_NONE">BLOCK_NONE (차단 없음)</option>
              <option value="BLOCK_ONLY_HIGH">BLOCK_ONLY_HIGH</option>
              <option value="BLOCK_MEDIUM_AND_ABOVE">BLOCK_MEDIUM_AND_ABOVE</option>
              <option value="BLOCK_LOW_AND_ABOVE">BLOCK_LOW_AND_ABOVE</option>
              <option value="OFF">OFF (API 기본값)</option>
            </select>
          </div>`).join("")}
        </div>

        <div class="vg-section">
          <h3>🔍 Grounding (Google 검색)</h3>
          <div class="vg-row">
            <label>Google Search Grounding</label>
            <select id="vg_grounding"><option value="false">비활성</option><option value="true">활성화</option></select>
          </div>
          <div class="vg-row"><label>Dynamic Retrieval 임계값 (0.0~1.0)</label><input id="vg_grounding_dynamic_retrieval" type="number" step="0.05" min="0" max="1" placeholder="비워두면 항상 검색"></div>
        </div>

        <div class="vg-section">
          <h3>🖼 이미지 생성</h3>
          <div class="vg-row">
            <label>이미지 생성 모드</label>
            <select id="vg_image_mode">
              <option value="none">없음 (텍스트 전용)</option>
              <option value="gemini">Gemini 네이티브 이미지 출력</option>
              <option value="imagen">Imagen 전용 모델</option>
            </select>
          </div>
          <div class="vg-row">
            <label>이미지 비율 (Imagen)</label>
            <select id="vg_image_aspect_ratio">
              <option value="1:1">1:1</option><option value="16:9">16:9</option>
              <option value="9:16">9:16</option><option value="4:3">4:3</option><option value="3:4">3:4</option>
            </select>
          </div>
          <div class="vg-row"><label>생성 이미지 수 (Imagen, 1~4)</label><input id="vg_image_count" type="number" min="1" max="4" placeholder="1"></div>
        </div>

        <div class="vg-section">
          <h3>🔧 기타</h3>
          <div class="vg-row">
            <label>스트리밍</label>
            <select id="vg_streaming"><option value="true">활성 (기본)</option><option value="false">비활성</option></select>
          </div>
          <div class="vg-row">
            <label>System Prompt 보존</label>
            <select id="vg_preserve_system"><option value="true">보존 (기본)</option><option value="false">무시</option></select>
          </div>
        </div>

        <div class="vg-section">
          <h3>🖼 채팅 이미지 관리</h3>
          <p style="font-size:11px;color:#888;margin:0 0 10px;">
            현재 열려 있는 채팅에서 이미지가 첨부된 메시지를 찾아서, 뒤 메시지를 지우지 않고도
            해당 메시지의 이미지만 바로 제거할 수 있습니다. 먼저 RisuAI에서 이미지가 포함된
            채팅을 열어둔 상태에서 아래 버튼을 눌러주세요.
          </p>
          <div class="vg-row">
            <label></label>
            <div>
              <button class="vg-btn" id="vg-scan-images">🔍 현재 채팅에서 이미지 찾기</button>
              <span class="vg-status" id="vg-image-scan-status"></span>
            </div>
          </div>
          <div class="vg-row">
            <label></label>
            <div id="vg-image-list" style="flex:1; max-height:320px; overflow-y:auto;"></div>
          </div>
        </div>

        <div class="vg-section">
          <h3>📊 토큰 사용량 (추정)</h3>
          <p style="font-size:11px;color:#888;margin:0 0 10px;">
            Gemini API 응답에 포함된 usageMetadata를 매 요청마다 누적 집계한 값입니다 (Google 결제 대시보드의
            정확한 청구 값과는 약간 차이가 날 수 있습니다). 스트리밍/비스트리밍 실제 채팅 호출에서만 집계되며,
            위 진단 패널의 테스트 호출은 집계에서 제외됩니다.
          </p>
          <div class="vg-row">
            <label></label>
            <div>
              <button class="vg-btn" id="vg-refresh-token-stats">🔄 새로고침</button>
              <button class="vg-btn-secondary" id="vg-reset-token-stats">🗑 통계 초기화</button>
            </div>
          </div>
          <div class="vg-row">
            <label></label>
            <div id="vg-token-stats-output" style="flex:1; font-size:12px; line-height:1.6;">불러오는 중...</div>
          </div>
        </div>

        <div style="margin-top:20px; display:flex; gap:10px; flex-wrap:wrap; padding-bottom: 40px;">
          <button class="vg-btn" id="vg-save-btn">💾 저장</button>
          <button class="vg-btn-secondary" id="vg-reset-btn">↩ 초기화</button>
          <span class="vg-status" id="vg-save-status"></span>
        </div>
      </div>
    `;

    const root = document.getElementById("vg-root");

    for (const key of fields) {
      const val = await getArg(key, "");
      const el = root.querySelector(`#${key}`);
      if (!el || val === "") continue;
      el.value = val;
    }

    renderModelList(root, await loadCachedOrFallbackModels());

    root.querySelector("#vg-select-all-models").addEventListener("click", () => {
      root.querySelectorAll(".vg-model-checkbox").forEach(cb => { cb.checked = true; });
      root.querySelector("#vg_excluded_models").value = "";
    });

    root.querySelector("#vg-select-none-models").addEventListener("click", () => {
      root.querySelectorAll(".vg-model-checkbox").forEach(cb => { cb.checked = false; });
      root.querySelector("#vg_excluded_models").value = getModelListCheckboxIds(root).join(",");
    });

    root.querySelector("#vg-apply-model-selection").addEventListener("click", async () => {
      const status = root.querySelector("#vg-model-selection-status");
      status.className = "vg-status";
      status.textContent = "적용 중...";
      try {
        await Risuai.setArgument("vg_excluded_models", root.querySelector("#vg_excluded_models").value || "");
        const models = await loadCachedOrFallbackModels();
        const count = await registerAllModels(models);
        status.className = "vg-status ok";
        status.textContent = `✓ 체크 상태 반영 완료. ${count}개 모델 등록됨 (재조회 없이 캐시된 목록 사용). 모델 선택창을 확인하세요.`;
      } catch (e) {
        status.className = "vg-status err";
        status.textContent = `✗ ${e.message}`;
      }
    });

    root.querySelector("#vg-close-btn").addEventListener("click", async () => {
      await Risuai.hideContainer();
    });

    root.querySelector("#vg-test-auth").addEventListener("click", async () => {
      const status = root.querySelector("#vg-auth-status");
      status.className = "vg-status";
      status.textContent = "테스트 중...";
      try {
        const saJson = root.querySelector("#vg_service_account_json").value;
        const bridgeUrl = root.querySelector("#vg_token_bridge_url").value.trim();
        const token = await getAccessToken(saJson, bridgeUrl || undefined);
        status.className = "vg-status ok";
        status.textContent = `✓ 인증 성공 (token: ${token.substring(0, 20)}...)`;
      } catch (e) {
        status.className = "vg-status err";
        status.textContent = `✗ ${e.message}`;
      }
    });

    root.querySelector("#vg-run-diagnostics").addEventListener("click", async () => {
      const btn = root.querySelector("#vg-run-diagnostics");
      const out = root.querySelector("#vg-diag-output");
      const diagModelId = root.querySelector("#vg-diag-model").value.trim();
      btn.disabled = true;
      const originalLabel = btn.textContent;
      btn.textContent = "⏳ 진행 중...";
      try {
        // Persist current form values first so diagnostics test what's
        // actually on screen, not stale saved settings.
        for (const key of fields) {
          const el = root.querySelector(`#${key}`);
          if (!el) continue;
          try { await Risuai.setArgument(key, el.value || ""); } catch {}
        }
        out.value = "";
        await runDiagnostics(root, diagModelId);
      } catch (e) {
        // runDiagnostics already catches everything internally, but this
        // outer guard exists so a bug in the harness itself can never leave
        // the button stuck disabled or throw into RisuAI's UI.
        out.value += `\n\n!!! 예상치 못한 오류: ${e && (e.stack || e.message) || e} !!!`;
      } finally {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    });

    root.querySelector("#vg-copy-diagnostics").addEventListener("click", async () => {
      const out = root.querySelector("#vg-diag-output");
      try {
        await navigator.clipboard.writeText(out.value);
      } catch {
        // Clipboard permissions aren't guaranteed inside the plugin sandbox -
        // fall back to selecting the text so the user can Ctrl+C manually.
        out.focus();
        out.select();
      }
    });

    async function refreshImageList() {
      const status = root.querySelector("#vg-image-scan-status");
      const listEl = root.querySelector("#vg-image-list");
      status.className = "vg-status";
      status.textContent = "검색 중...";
      try {
        const { charIndex, chatIndex, matches } = await scanChatImages();
        if (matches.length === 0) {
          listEl.innerHTML = `<span style="color:#666; font-size:12px;">이 채팅에서 이미지가 포함된 메시지를 찾지 못했습니다.</span>`;
          status.className = "vg-status ok";
          status.textContent = "✓ 검색 완료 (이미지 없음)";
          return;
        }
        listEl.innerHTML = matches.map((m, i) => `
          <div style="border:1px solid rgba(255,255,255,0.15); border-radius:6px; padding:8px; margin-bottom:8px;">
            <div style="font-size:11px; color:#888; margin-bottom:4px;">메시지 #${m.msgIndex} (${m.role === "user" ? "사용자" : "캐릭터"})</div>
            <div style="font-size:12px; margin-bottom:6px; word-break:break-all;">${m.contextSnippet.replace(/</g, "&lt;")}</div>
            <button class="vg-btn-secondary vg-remove-image-btn" data-idx="${i}" style="font-size:11px; padding:4px 10px;">🗑 이 이미지 태그 제거</button>
          </div>
        `).join("");

        listEl.querySelectorAll(".vg-remove-image-btn").forEach(btn => {
          btn.addEventListener("click", async () => {
            const m = matches[Number(btn.getAttribute("data-idx"))];
            btn.disabled = true;
            btn.textContent = "제거 중...";
            try {
              await removeChatImageTag(charIndex, chatIndex, m.msgIndex, m.tag);
              status.className = "vg-status ok";
              status.textContent = `✓ 메시지 #${m.msgIndex}에서 이미지를 제거했습니다. RisuAI 채팅창을 새로고침(채팅 다시 열기)하면 반영됩니다.`;
              await refreshImageList();
            } catch (e) {
              btn.disabled = false;
              btn.textContent = "🗑 이 이미지 태그 제거";
              status.className = "vg-status err";
              status.textContent = `✗ ${e.message}`;
            }
          });
        });

        status.className = "vg-status ok";
        status.textContent = `✓ 이미지 ${matches.length}개 발견`;
      } catch (e) {
        status.className = "vg-status err";
        status.textContent = `✗ ${e.message}`;
        listEl.innerHTML = "";
      }
    }

    root.querySelector("#vg-scan-images").addEventListener("click", refreshImageList);

    async function renderTokenStatsPanel() {
      const out = root.querySelector("#vg-token-stats-output");
      const stats = await loadTokenStats();
      const t = stats.totals;
      const modelRows = Object.entries(stats.perModel)
        .sort((a, b) => (b[1].total || 0) - (a[1].total || 0))
        .map(([id, m]) => `
          <tr>
            <td style="padding:4px 8px; border-bottom:1px solid rgba(255,255,255,0.08);">${id}</td>
            <td style="padding:4px 8px; border-bottom:1px solid rgba(255,255,255,0.08); text-align:right;">${m.requests}</td>
            <td style="padding:4px 8px; border-bottom:1px solid rgba(255,255,255,0.08); text-align:right;">${m.input.toLocaleString()}</td>
            <td style="padding:4px 8px; border-bottom:1px solid rgba(255,255,255,0.08); text-align:right;">${m.output.toLocaleString()}</td>
            <td style="padding:4px 8px; border-bottom:1px solid rgba(255,255,255,0.08); text-align:right;">${m.reasoning.toLocaleString()}</td>
            <td style="padding:4px 8px; border-bottom:1px solid rgba(255,255,255,0.08); text-align:right;">${m.total.toLocaleString()}</td>
          </tr>
        `).join("");

      out.innerHTML = `
        <div style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:12px;">
          <div><b>${stats.requests.toLocaleString()}</b><br><span style="color:#888; font-size:11px;">누적 요청 수</span></div>
          <div><b>${t.input.toLocaleString()}</b><br><span style="color:#888; font-size:11px;">Input 토큰</span></div>
          <div><b>${t.output.toLocaleString()}</b><br><span style="color:#888; font-size:11px;">Output 토큰</span></div>
          <div><b>${t.reasoning.toLocaleString()}</b><br><span style="color:#888; font-size:11px;">Thinking 토큰</span></div>
          <div><b>${t.cached.toLocaleString()}</b><br><span style="color:#888; font-size:11px;">Cached 토큰</span></div>
          <div><b>${t.total.toLocaleString()}</b><br><span style="color:#7eb8f7; font-size:11px;">전체 합계</span></div>
        </div>
        ${modelRows ? `
          <table style="width:100%; border-collapse:collapse; font-size:11px;">
            <thead>
              <tr style="color:#888; text-align:left;">
                <th style="padding:4px 8px;">모델</th>
                <th style="padding:4px 8px; text-align:right;">요청수</th>
                <th style="padding:4px 8px; text-align:right;">Input</th>
                <th style="padding:4px 8px; text-align:right;">Output</th>
                <th style="padding:4px 8px; text-align:right;">Thinking</th>
                <th style="padding:4px 8px; text-align:right;">합계</th>
              </tr>
            </thead>
            <tbody>${modelRows}</tbody>
          </table>
        ` : `<span style="color:#666;">아직 기록된 요청이 없습니다. 실제 채팅을 한 번 보내면 여기에 집계됩니다.</span>`}
      `;
    }

    renderTokenStatsPanel();

    root.querySelector("#vg-refresh-token-stats").addEventListener("click", renderTokenStatsPanel);

    root.querySelector("#vg-reset-token-stats").addEventListener("click", async () => {
      if (!confirm("누적된 토큰 사용량 통계를 전부 초기화할까요?")) return;
      await resetTokenStats();
      await renderTokenStatsPanel();
    });

    root.querySelector("#vg-view-chatlog").addEventListener("click", () => {
      const out = root.querySelector("#vg-chatlog-output");
      try {
        out.value = _chatLog.length > 0
          ? _chatLog.join("\n")
          : "아직 기록된 실제 채팅 호출이 없습니다. RisuAI 채팅창에서 이 모델로 메시지를 하나 보낸 뒤 다시 눌러주세요.";
        out.scrollTop = out.scrollHeight;
      } catch (e) {
        out.value = `로그를 불러오는 중 오류: ${e && (e.stack || e.message) || e}`;
      }
    });

    root.querySelector("#vg-clear-chatlog").addEventListener("click", () => {
      _chatLog.length = 0;
      const out = root.querySelector("#vg-chatlog-output");
      out.value = "";
    });

    root.querySelector("#vg-copy-chatlog").addEventListener("click", async () => {
      const out = root.querySelector("#vg-chatlog-output");
      try {
        await navigator.clipboard.writeText(out.value);
      } catch {
        out.focus();
        out.select();
      }
    });

    root.querySelector("#vg-fetch-models").addEventListener("click", async () => {
      const status = root.querySelector("#vg-model-status");
      status.className = "vg-status";
      status.textContent = "저장 후 모델 목록을 가져오는 중...";

      // Persist all fields first so the fetch/register uses fresh values
      for (const key of fields) {
        const el = root.querySelector(`#${key}`);
        if (!el) continue;
        try { await Risuai.setArgument(key, el.value || ""); } catch {}
      }

      try {
        const models = await fetchDynamicModels();
        const finalModels = (models && models.length > 0) ? models : FALLBACK_MODELS;
        renderModelList(root, finalModels);
        const count = await registerAllModels(finalModels);
        status.className = "vg-status ok";
        status.textContent = models
          ? `✓ Vertex에서 ${models.length}개 모델 로드, ${count}개 등록 완료. 아래 목록에서 제외하고 싶은 모델의 체크를 해제할 수 있습니다.`
          : `⚠ 동적 로드 실패, 기본 모델 ${count}개 등록함. SA JSON/권한을 확인하세요.`;
      } catch (e) {
        status.className = "vg-status err";
        status.textContent = `✗ ${e.message}`;
      }
    });

    root.querySelector("#vg-save-btn").addEventListener("click", async () => {
      const status = root.querySelector("#vg-save-status");
      status.className = "vg-status";
      status.textContent = "저장 중...";
      try {
        for (const key of fields) {
          const el = root.querySelector(`#${key}`);
          if (!el) continue;
          await Risuai.setArgument(key, el.value || "");
        }
        status.className = "vg-status ok";
        status.textContent = "✓ 저장 완료! 모델 목록을 갱신하려면 위의 '모델 목록 새로고침 & 등록' 버튼을 누르세요.";
      } catch (e) {
        status.className = "vg-status err";
        status.textContent = `✗ 저장 실패: ${e.message}`;
      }
    });

    root.querySelector("#vg-reset-btn").addEventListener("click", async () => {
      if (!confirm("모든 설정을 초기화하시겠습니까?")) return;
      for (const key of fields) {
        const el = root.querySelector(`#${key}`);
        if (el) el.value = "";
        try { await Risuai.setArgument(key, ""); } catch {}
      }
      renderModelList(root, await loadCachedOrFallbackModels());
    });

    await Risuai.showContainer("fullscreen");
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────

  log("초기화 시작...");

  try {
    Risuai.registerSetting(PLUGIN_NAME, renderSettings);
    log("✓ 설정 탭 등록 완료 (플러그인 설정 메뉴에서 확인 가능)");
  } catch (e) {
    err("설정 탭 등록 실패:", e.message);
  }

  let models = null;
  try {
    models = await fetchDynamicModels();
    if (models && models.length > 0) log(`✓ Vertex에서 동적 모델 ${models.length}개 로드`);
  } catch (e) {
    warn("동적 모델 로드 실패:", e.message);
  }

  if (!models || models.length === 0) {
    try {
      const cached = await getArg("vg_dynamic_models", "");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          models = parsed;
          log(`✓ 캐시된 모델 ${models.length}개 사용`);
        }
      }
    } catch {}
  }

  if (!models || models.length === 0) {
    models = FALLBACK_MODELS;
    log(`⚠ Service Account JSON 미설정 또는 fetch 실패 — 기본 모델 목록 ${models.length}개 사용`);
  }

  await registerAllModels(models);

  log("✓ 초기화 완료");

  } catch (fatal) {
    console.error("[🔷 Vertex Gemini] 치명적 초기화 오류:", fatal);
  }
})();
