//@name Vertex_Gemini
//@display-name 🔷 Vertex Gemini
//@api 3.0
//@version 1.0.1

// ===== Settings Arguments =====

// Auth
//@arg vg_service_account_json string Vertex Service Account JSON (전체 JSON 붙여넣기) [필수]
//@arg vg_location string Location (예: us-central1, asia-northeast1, global) [필수, 기본값 us-central1] - 최신 Gemini 3.x 모델은 프로젝트에 따라 특정 리전에서 404가 날 수 있습니다. 그 경우 "global"로 설정해보세요.
//@arg vg_token_bridge_url string Token Bridge URL (선택사항 - CORS 우회용 Worker URL)

// Model
//@arg vg_custom_model string 추가 커스텀 모델 ID (목록에 없는 모델을 직접 등록하고 싶을 때만)
//@arg vg_dynamic_models string 동적 모델 목록 JSON (자동 관리, 수정하지 마세요)

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

    for (const msg of messages) {
      if (!msg || !msg.role) continue;
      const role = msg.role;

      if (role === "system") {
        if (preserveSystem) {
          const text = typeof msg.content === "string" ? msg.content : extractText(msg.content);
          if (text.trim()) systemParts.push({ text: text.trim() });
        }
        continue;
      }

      const geminiRole = role === "assistant" ? "model" : "user";
      const parts = convertContentToParts(msg.content);
      if (parts.length === 0) continue;

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
      return { success: true, content: text };
    } catch (e) {
      return { success: false, content: `[${PLUGIN_NAME}] 응답 파싱 오류: ${e.message}` };
    }
  }

  function createSSEStream(response, abortSignal) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    return new ReadableStream({
      async pull(controller) {
        while (true) {
          if (abortSignal?.aborted) { controller.close(); reader.cancel(); return; }
          const { done, value } = await reader.read();
          if (done) { controller.close(); return; }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (jsonStr === "[DONE]") { controller.close(); return; }
            try {
              const data = JSON.parse(jsonStr);
              const candidate = data.candidates?.[0];
              if (!candidate) continue;
              for (const part of candidate.content?.parts || []) {
                if (part.text) controller.enqueue(part.text);
                else if (part.inlineData) {
                  const { mimeType, data: imgData } = part.inlineData;
                  controller.enqueue(`![generated](data:${mimeType};base64,${imgData})`);
                }
              }
            } catch { /* skip malformed line */ }
          }
        }
      },
      cancel() { reader.cancel(); }
    });
  }

  // ─── Gemini Fetcher ───────────────────────────────────────────────────────────

  async function callGemini(args, modelId, abortSignal) {
    const saJson      = await getArg("vg_service_account_json", "");
    const location    = (await getArg("vg_location", "us-central1")).trim() || "us-central1";
    const bridgeUrl   = (await getArg("vg_token_bridge_url", "")).trim();
    const streaming   = await getBoolArg("vg_streaming", true);
    const preserveSys = await getBoolArg("vg_preserve_system", true);
    const grounding   = await getBoolArg("vg_grounding", false);
    const groundingDR = parseFloat2(await getArg("vg_grounding_dynamic_retrieval", ""), undefined);
    const serviceTier = (await getArg("vg_service_tier", "")).trim().toUpperCase();

    if (!saJson.trim()) {
      return { success: false, content: `[${PLUGIN_NAME}] Service Account JSON이 설정되지 않았습니다. 플러그인 설정에서 입력해 주세요.` };
    }

    let sa;
    try { sa = parseSA(saJson); }
    catch (e) { return { success: false, content: `[${PLUGIN_NAME}] SA JSON 오류: ${e.message}` }; }

    let accessToken;
    try { accessToken = await getAccessToken(saJson, bridgeUrl || undefined); }
    catch (e) { return { success: false, content: `[${PLUGIN_NAME}] 인증 오류: ${e.message}` }; }

    const baseUrl = location === "global"
      ? "https://aiplatform.googleapis.com"
      : `https://${location}-aiplatform.googleapis.com`;
    const modelPath = `${baseUrl}/v1/projects/${sa.project_id}/locations/${location}/publishers/google/models/${modelId}`;

    const messages = args?.prompt_chat || [];
    const { contents, systemParts } = convertMessagesToGemini(messages, preserveSys);

    let genConfig;
    try { genConfig = await buildGenerationConfig(args); }
    catch (e) { return { success: false, content: `[${PLUGIN_NAME}] 파라미터 오류: ${e.message}` }; }

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
      let res;
      try {
        res = await Risuai.nativeFetch(streamUrl, { method: "POST", headers, body: bodyStr, signal: abortSignal });
      } catch {
        try {
          res = await fetch(streamUrl, { method: "POST", headers, body: bodyStr, signal: abortSignal });
        } catch (e2) {
          return { success: false, content: `[${PLUGIN_NAME}] 네트워크 오류: ${e2.message}` };
        }
      }

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) delete _tokenCache[sa.client_email];
        const errText = await res.text().catch(() => "");
        return { success: false, content: `[${PLUGIN_NAME}] API 오류 ${res.status}: ${errText.substring(0, 300)}` };
      }

      if (!res.body) {
        return await callGeminiNonStream(modelPath, headers, bodyStr, abortSignal, genConfig);
      }

      return { success: true, content: createSSEStream(res, abortSignal) };
    } else {
      return await callGeminiNonStream(modelPath, headers, bodyStr, abortSignal, genConfig);
    }
  }

  async function callGeminiNonStream(modelPath, headers, bodyStr, abortSignal, genConfig) {
    const url = `${modelPath}:generateContent`;
    let res;
    try {
      res = await Risuai.nativeFetch(url, { method: "POST", headers, body: bodyStr, signal: abortSignal });
    } catch {
      try {
        res = await fetch(url, { method: "POST", headers, body: bodyStr, signal: abortSignal });
      } catch (e2) {
        return { success: false, content: `[${PLUGIN_NAME}] 네트워크 오류: ${e2.message}` };
      }
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { success: false, content: `[${PLUGIN_NAME}] API 오류 ${res.status}: ${errText.substring(0, 300)}` };
    }

    const data = await res.json();
    return parseGeminiResponse(data, genConfig);
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

    let res;
    try {
      res = await Risuai.nativeFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
    } catch (e) {
      return { success: false, content: `[${PLUGIN_NAME}] 네트워크 오류: ${e.message}` };
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
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
        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ instances: [] }),
        });
        // 404/403 = model not found or no access. Any other status (e.g. 400
        // invalid argument for the empty instances) means the model exists.
        return res.status !== 404 && res.status !== 403;
      }
      const url = `${baseUrl}/v1/projects/${project}/locations/${location}/publishers/google/models/${id}:generateContent`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "hi" }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
      });
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

  async function registerModel(model) {
    const displayName = `🔷 ${model.name}`;
    await Risuai.addProvider(
      displayName,
      async (args, abortSignal) => {
        try {
          if (isImagenId(model.id)) {
            return await callImagen(args, model.id);
          }
          const imageMode = await getArg("vg_image_mode", "none");
          if (imageMode === "imagen") {
            return await callImagen(args, model.id);
          }
          return await callGemini(args, model.id, abortSignal);
        } catch (e) {
          err("Fetcher crash:", e);
          return { success: false, content: `[${PLUGIN_NAME}] 오류: ${e.message}` };
        }
      },
      { tokenizer: "gpt-4" }
    );
  }

  async function registerAllModels(models) {
    let registered = 0;
    for (const model of models) {
      try {
        await registerModel(model);
        registered++;
      } catch (e) {
        warn(`모델 등록 실패 (${model.id}):`, e.message);
      }
    }

    // Register a manually-typed custom model too, if set and not already present
    const customId = (await getArg("vg_custom_model", "")).trim();
    if (customId && !models.some(m => m.id === customId)) {
      try {
        await registerModel({ id: customId, name: `Custom: ${customId}` });
        registered++;
      } catch (e) {
        warn(`커스텀 모델 등록 실패 (${customId}):`, e.message);
      }
    }

    log(`✓ ${registered}개 모델을 RisuAI에 등록했습니다.`);
    return registered;
  }

  // ─── Settings UI ─────────────────────────────────────────────────────────────

  async function renderSettings() {
    const fields = [
      "vg_service_account_json",
      "vg_token_bridge_url",
      "vg_location",
      "vg_custom_model",
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
        const count = await registerAllModels(finalModels);
        status.className = "vg-status ok";
        status.textContent = models
          ? `✓ Vertex에서 ${models.length}개 모델 로드, ${count}개 등록 완료. 모델 선택창을 확인하세요.`
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
