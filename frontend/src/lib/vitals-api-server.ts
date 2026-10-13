import { analyzeVitals, type VitalAnalysis, type VitalInput, type VitalRecord } from "./vitals";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_PROVIDER_RESPONSE_BYTES = 128 * 1024;
const MAX_REASONING_TOKENS = 24_576;
const MAX_IDEMPOTENCY_ENTRIES = 500;
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

export const CAREAI_DISCLAIMER =
  "CareAI provides informational health insights and is not a substitute for professional medical advice.";
export const AI_UNAVAILABLE_MESSAGE =
  "Your reading was saved, but CareAI analysis is temporarily unavailable.";

const CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const CHAT_TIMEOUT_MS = 10_000;
const CHAT_MAX_MESSAGE_LENGTH = 2_000;
const CHAT_LANGUAGES = new Set(["en", "my", "zh"]);
const CHAT_OFF_TOPIC_REPLY = "ask only about health ";

const LIMITS = {
  systolic: { min: 50, max: 300 },
  diastolic: { min: 30, max: 200 },
  heartRate: { min: 20, max: 250 },
  oxygen: { min: 50, max: 100 },
  temperature: { min: 30, max: 45 },
} as const satisfies Record<keyof VitalInput, { min: number; max: number }>;

const AI_OUTPUT_KEYS = new Set([
  "summary",
  "whatLooksGood",
  "areasToWatch",
  "recommendations",
  "urgency",
  "disclaimer",
]);

const UNSAFE_MEDICAL_LANGUAGE = [
  /\byou (?:definitely )?have\b/i,
  /\bdiagnos(?:e|ed|is|ing)\b/i,
  /\byou are (?:definitely )?safe\b/i,
  /\b(?:definitely|guaranteed|certainly) safe\b/i,
  /\bthis proves\b/i,
  /\bprescrib(?:e|ed|ing)\b/i,
  /\b(?:stop|start|change|increase|decrease) (?:taking |using )?(?:your )?(?:medication|medicine|drug|dose|dosage)\b/i,
];

export type AiUrgency = "routine" | "monitor" | "seek-care";

export type AiOutput = {
  summary: string;
  whatLooksGood: string[];
  areasToWatch: string[];
  recommendations: string[];
  urgency: AiUrgency;
  disclaimer: string;
};

export type AnalyzeVitalsResponse = {
  reading: VitalRecord;
  healthScore: number;
  analysis: VitalAnalysis;
  analysisStatus: "completed" | "failed";
  errorCode?: "AI_ERROR";
};

type RuntimeEnv = Record<string, unknown>;
type ProviderResult =
  { ok: true; analysis: AiOutput; model: string } | { ok: false; model?: string };

type IdempotentEntry = {
  expiresAt: number;
  response: Promise<AnalyzeVitalsResponse>;
};

const idempotentResponses = new Map<string, IdempotentEntry>();

export async function handleCareAiChat(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") return json({ message: "Unsupported method." }, 405, { allow: "POST" });
  if (!isAllowedOrigin(request)) return json({ message: "Request origin is not allowed." }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return json({ message: "Expected a JSON request." }, 415);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ message: "Invalid request." }, 400);
  }
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return json({ message: "Invalid request." }, 400);
  }
  const body = payload as Record<string, unknown>;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const language = typeof body.language === "string" ? body.language : "";
  if (!message || message.length > CHAT_MAX_MESSAGE_LENGTH || !CHAT_LANGUAGES.has(language)) {
    return json({ message: "Check the message and selected language." }, 400);
  }
  const apiKey = getConfig(env, "OPENROUTER_API_KEY");
  const model = getConfig(env, "OPENROUTER_MODEL");
  if (!apiKey || !model) return json({ reply: chatFallback(language) });
  const languageInstruction = language === "my" ? "Burmese" : language === "zh" ? "Simplified Chinese" : "English";
  const providerRequest = {
    model,
    messages: [
      {
        role: "system",
        content: `You are CareAI, an informational healthcare assistant. Respond strictly in ${languageInstruction}. Answer questions about health and healthcare, including symptoms, wellness, nutrition, exercise, mental health, medical care, and health-related terms that do not use the word health. Do not reject a health question just because it lacks a keyword from a fixed list. Brief greetings (such as hello or hi), thanks, and polite acknowledgments are allowed; respond naturally and briefly, and invite the user to ask a health or healthcare question. If the user asks about a topic unrelated to health or healthcare and it is not a greeting or polite acknowledgment, reply exactly: ${JSON.stringify(CHAT_OFF_TOPIC_REPLY)}. Be warm, concise, and clear. Do not diagnose, prescribe, or advise medication changes. For possible emergencies, advise contacting local emergency services or a medical professional. Keep the answer under 120 words.`,
      },
      { role: "user", content: message },
    ],
    temperature: 0.2,
    max_tokens: 280,
  };
  try {
    const response = await fetchWithTimeout(CHAT_URL, { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: JSON.stringify(providerRequest) }, CHAT_TIMEOUT_MS);
    if (!response.ok) return json({ reply: chatFallback(language) });
    const raw = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const reply = raw.choices?.[0]?.message?.content;
    return json({ reply: typeof reply === "string" && reply.trim() ? reply.trim().slice(0, 2_000) : chatFallback(language) });
  } catch {
    return json({ reply: chatFallback(language) });
  }
}

function chatFallback(language: string): string {
  if (language === "my") return "လောလောဆယ် CareAI ခွဲခြမ်းစိတ်ဖြာမှု မရရှိနိုင်သေးပါ။ အရေးပေါ်အခြေအနေဖြစ်ပါက ဒေသခံ အရေးပေါ်ဝန်ဆောင်မှု သို့မဟုတ် ကျန်းမာရေးပညာရှင်ထံ ချက်ချင်း ဆက်သွယ်ပါ။";
  if (language === "zh") return "CareAI 暂时无法提供分析。如果这是紧急情况，请立即联系当地急救服务或医疗专业人员。";
  return "CareAI analysis is temporarily unavailable. If this may be an emergency, contact local emergency services or a medical professional now.";
}

export async function handleAnalyzeVitals(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return json({ code: "VALIDATION_ERROR", message: "Unsupported method." }, 405, {
      allow: "POST",
    });
  }

  if (!isAllowedOrigin(request)) {
    return json({ code: "PERMISSION_ERROR", message: "Request origin is not allowed." }, 403);
  }

  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return json({ code: "VALIDATION_ERROR", message: "Expected a JSON request." }, 415);
  }

  const input = await readVitalInput(request);
  if (!input.ok) {
    return json({ code: "VALIDATION_ERROR", message: "Check the highlighted values." }, 400);
  }

  const idempotencyKey = readIdempotencyKey(request);
  if (idempotencyKey === null) {
    return json({ code: "VALIDATION_ERROR", message: "Invalid idempotency key." }, 400);
  }

  const response = idempotencyKey
    ? await runIdempotently(idempotencyKey, () => analyzeValidatedVitals(input.value, env))
    : await analyzeValidatedVitals(input.value, env);

  return json(response);
}

async function analyzeValidatedVitals(
  input: VitalInput,
  env: unknown,
): Promise<AnalyzeVitalsResponse> {
  const baseline = analyzeVitals(input);
  const provider = await requestAiAnalysis(input, baseline, env);
  const analysis = provider.ok
    ? mergeProviderAnalysis(baseline, provider.analysis, provider.model)
    : createUnavailableAnalysis(baseline, provider.model);

  const reading: VitalRecord = {
    ...input,
    id: crypto.randomUUID(),
    recordedAt: new Date().toISOString(),
    analysis,
  };

  return {
    reading,
    healthScore: baseline.score,
    analysis,
    analysisStatus: analysis.aiStatus === "completed" ? "completed" : "failed",
    ...(analysis.aiStatus === "failed" ? { errorCode: "AI_ERROR" as const } : {}),
  };
}

export async function readVitalInput(
  request: Request,
): Promise<{ ok: true; value: VitalInput } | { ok: false }> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return { ok: false };
  }

  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false };
  }

  const record = payload as Record<string, unknown>;
  const expectedKeys = Object.keys(LIMITS);
  const actualKeys = Object.keys(record);
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => !Object.hasOwn(LIMITS, key))
  ) {
    return { ok: false };
  }

  const value = {} as VitalInput;
  for (const key of expectedKeys as Array<keyof VitalInput>) {
    const raw = record[key];
    const limit = LIMITS[key];
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw < limit.min || raw > limit.max) {
      return { ok: false };
    }
    value[key] = raw;
  }

  return { ok: true, value };
}

async function requestAiAnalysis(
  input: VitalInput,
  baseline: VitalAnalysis,
  env: unknown,
): Promise<ProviderResult> {
  const apiKey = getConfig(env, "OPENROUTER_API_KEY");
  const model = getConfig(env, "OPENROUTER_MODEL");
  if (!apiKey || !model) return { ok: false, ...(model ? { model } : {}) };

  const deterministicUrgency = getDeterministicUrgency(baseline);
  const siteUrl = getConfig(env, "OPENROUTER_SITE_URL");
  const appName = getConfig(env, "OPENROUTER_APP_NAME") ?? "CareAI";
  const reasoningMaxTokens = getReasoningMaxTokens(env);
  const headers = new Headers({
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
    "x-title": appName,
  });
  if (siteUrl) headers.set("http-referer", siteUrl);

  const payload: Record<string, unknown> = {
    model,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(),
      },
      {
        role: "user",
        content: JSON.stringify({
          systolic: input.systolic,
          diastolic: input.diastolic,
          heartRate: input.heartRate,
          oxygenSaturation: input.oxygen,
          temperatureC: input.temperature,
          healthScore: baseline.score,
          applicationUrgency: deterministicUrgency,
        }),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 700,
  };
  if (reasoningMaxTokens !== undefined) {
    payload.reasoning = { max_tokens: reasoningMaxTokens, exclude: true };
  }
  const body = JSON.stringify(payload);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetchWithTimeout(
        OPENROUTER_URL,
        { method: "POST", headers, body },
        REQUEST_TIMEOUT_MS,
      );
    } catch {
      if (attempt === 0) continue;
      return { ok: false, model };
    }

    if (!response.ok) {
      if (attempt === 0 && response.status >= 500) continue;
      return { ok: false, model };
    }

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_PROVIDER_RESPONSE_BYTES) {
      return { ok: false, model };
    }

    let responseText: string;
    try {
      responseText = await response.text();
    } catch {
      return { ok: false, model };
    }
    if (new TextEncoder().encode(responseText).byteLength > MAX_PROVIDER_RESPONSE_BYTES) {
      return { ok: false, model };
    }

    let payload: unknown;
    try {
      payload = JSON.parse(responseText);
    } catch {
      return { ok: false, model };
    }

    const content = readProviderContent(payload);
    if (content === undefined) return { ok: false, model };
    const normalized = normalizeAiOutput(content);
    if (!normalized || normalized.urgency !== deterministicUrgency) {
      return { ok: false, model };
    }

    return { ok: true, analysis: normalized, model };
  }

  return { ok: false, model };
}

function buildSystemPrompt(): string {
  return [
    "You are CareAI, an informational health insight assistant.",
    "Return only one valid JSON object with exactly these fields: summary, whatLooksGood, areasToWatch, recommendations, urgency, disclaimer.",
    "summary and disclaimer must be strings. The three list fields must be arrays containing 0 to 3 concise strings. urgency must be routine, monitor, or seek-care.",
    `The disclaimer must be exactly: ${CAREAI_DISCLAIMER}`,
    "Use the supplied healthScore and applicationUrgency as authoritative. Do not calculate a score or select a different urgency.",
    "Use plain, cautious language about the app's typical reference ranges. Do not diagnose, prescribe, discuss medication changes, claim certainty, claim the user is safe, or claim to replace a clinician.",
    "Do not infer identity, medical history, symptoms, causes, or conditions that were not supplied.",
  ].join(" ");
}

export function normalizeAiOutput(content: string): AiOutput | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.trim());
  } catch {
    return undefined;
  }

  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  const record = parsed as Record<string, unknown>;
  if (
    Object.keys(record).length !== AI_OUTPUT_KEYS.size ||
    Object.keys(record).some((key) => !AI_OUTPUT_KEYS.has(key))
  ) {
    return undefined;
  }

  const summary = normalizeText(record["summary"], 600);
  const whatLooksGood = normalizeTextArray(record["whatLooksGood"]);
  const areasToWatch = normalizeTextArray(record["areasToWatch"]);
  const recommendations = normalizeTextArray(record["recommendations"]);
  const urgency = record["urgency"];
  if (
    summary === undefined ||
    whatLooksGood === undefined ||
    areasToWatch === undefined ||
    recommendations === undefined ||
    (urgency !== "routine" && urgency !== "monitor" && urgency !== "seek-care") ||
    typeof record["disclaimer"] !== "string"
  ) {
    return undefined;
  }

  const generatedText = [summary, ...whatLooksGood, ...areasToWatch, ...recommendations];
  if (generatedText.some(containsUnsafeMedicalLanguage)) return undefined;

  return {
    summary,
    whatLooksGood,
    areasToWatch,
    recommendations,
    urgency,
    disclaimer: CAREAI_DISCLAIMER,
  };
}

function mergeProviderAnalysis(
  baseline: VitalAnalysis,
  provider: AiOutput,
  model: string,
): VitalAnalysis {
  return {
    ...baseline,
    aiStatus: "completed",
    urgency: getDeterministicUrgency(baseline),
    disclaimer: CAREAI_DISCLAIMER,
    provider: "openrouter",
    model,
    summary: provider.summary,
    good: provider.whatLooksGood,
    concerns: provider.areasToWatch,
    recommendations: provider.recommendations,
  };
}

function createUnavailableAnalysis(baseline: VitalAnalysis, model?: string): VitalAnalysis {
  return {
    ...baseline,
    aiStatus: "failed",
    urgency: getDeterministicUrgency(baseline),
    disclaimer: CAREAI_DISCLAIMER,
    provider: "openrouter",
    ...(model ? { model } : {}),
    summary: AI_UNAVAILABLE_MESSAGE,
    good: baseline.good.slice(0, 3),
    concerns: baseline.concerns.slice(0, 3),
    recommendations: [
      "Consider rechecking a measurement if it seems unexpected.",
      "Contact a qualified healthcare professional if you have concerns or symptoms.",
    ],
  };
}

function getDeterministicUrgency(baseline: VitalAnalysis): AiUrgency {
  if (baseline.emergency) return "seek-care";
  return baseline.status === "Good" ? "routine" : "monitor";
}

function readProviderContent(payload: unknown): string | undefined {
  if (payload == null || typeof payload !== "object") return undefined;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const first = choices[0];
  if (first == null || typeof first !== "object") return undefined;
  const message = (first as { message?: unknown }).message;
  if (message == null || typeof message !== "object") return undefined;
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" && content.length <= 12_000 ? content : undefined;
}

function normalizeText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : undefined;
}

function normalizeTextArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length > 3) return undefined;
  const normalized = value.map((item) => normalizeText(item, 240));
  return normalized.every((item): item is string => item !== undefined) ? normalized : undefined;
}

function containsUnsafeMedicalLanguage(value: string): boolean {
  return UNSAFE_MEDICAL_LANGUAGE.some((pattern) => pattern.test(value));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function isAllowedOrigin(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;
  const origin = request.headers.get("origin");
  return origin == null || origin === new URL(request.url).origin;
}

function readIdempotencyKey(request: Request): string | undefined | null {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key) return undefined;
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(key) ? key : null;
}

async function runIdempotently(
  key: string,
  operation: () => Promise<AnalyzeVitalsResponse>,
): Promise<AnalyzeVitalsResponse> {
  const now = Date.now();
  for (const [storedKey, entry] of idempotentResponses) {
    if (entry.expiresAt <= now) idempotentResponses.delete(storedKey);
  }

  const existing = idempotentResponses.get(key);
  if (existing) return existing.response;

  if (idempotentResponses.size >= MAX_IDEMPOTENCY_ENTRIES) {
    const oldestKey = idempotentResponses.keys().next().value as string | undefined;
    if (oldestKey) idempotentResponses.delete(oldestKey);
  }

  const response = operation();
  idempotentResponses.set(key, { expiresAt: now + IDEMPOTENCY_TTL_MS, response });
  try {
    return await response;
  } catch (error) {
    idempotentResponses.delete(key);
    throw error;
  }
}

function getConfig(env: unknown, key: string): string | undefined {
  const fromEnv = env != null && typeof env === "object" ? (env as RuntimeEnv)[key] : undefined;
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  const fromProcess = typeof process !== "undefined" ? process.env[key] : undefined;
  return fromProcess?.trim() || undefined;
}

function getReasoningMaxTokens(env: unknown): number | undefined {
  const raw = getConfig(env, "OPENROUTER_REASONING_MAX_TOKENS");
  if (!raw || !/^-?\d+$/.test(raw)) return undefined;
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) return undefined;
  return value === -1 || (value >= 0 && value <= MAX_REASONING_TOKENS) ? value : undefined;
}

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}
