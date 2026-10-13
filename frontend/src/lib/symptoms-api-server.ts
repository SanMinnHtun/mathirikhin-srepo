const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_REASONING_TOKENS = 24_576;

const BODY_PARTS = [
  "Head",
  "Chest",
  "Lower Back",
  "Knees",
  "Stomach",
  "Neck",
  "Shoulders",
  "Hands/Wrists",
  "Legs/Ankles",
] as const;
const PAIN_SENSATIONS = [
  "Dull ache",
  "Sharp / Stabbing",
  "Throbbing",
  "Burning",
  "Tingling / Numbness",
  "Cramping",
] as const;
const DURATIONS = [
  "Just started today",
  "2–3 days",
  "About a week",
  "A few weeks",
  "Months or longer",
] as const;
const GENDERS = ["Female", "Male", "Other / Prefer not to say"] as const;

const URGENCY_COLORS = {
  Routine: "green",
  "See a doctor soon": "yellow",
  "Seek immediate attention": "red",
} as const;

const RED_FLAGS = [
  "Chest pain or pressure, especially with sweating or nausea",
  "Trouble breathing or sudden severe weakness",
  "Sudden face drooping, arm weakness, or trouble speaking",
  "Fainting, loss of consciousness, or severe bleeding",
];

const UNSAFE_LANGUAGE = [
  /\b(?:you (?:definitely )?have)\s+(?!(?:reported|described|selected|mentioned|indicated|experienced|noted|provided|chosen|shared)\b)|\b(?:this proves|confirmed diagnosis|definitive diagnosis)\b/i,
  /\b(?:you are (?:definitely )?safe|nothing to worry about|guaranteed safe)\b/i,
  /\b(?:prescrib(?:e|ed|ing)|start|stop|change|increase|decrease)\s+(?:taking\s+)?(?:your\s+)?(?:medication|medicine|drug|dose|dosage)\b/i,
  /(?:သင့်တွင်|သင့်မှာ).*(?:ရောဂါရှိ|ရောဂါဖြစ်)/u,
  /(?:ဆေး|ဆေးပမာဏ).*(?:စတင်သောက်|ရပ်လိုက်|ပြောင်းလဲ|တိုးသောက်|လျှော့သောက်)/u,
];

type Urgency = keyof typeof URGENCY_COLORS;
type SymptomInput = {
  body_parts: string[];
  pain_sensations: string[];
  pain_severity: number;
  duration: string;
  gender: string;
  language?: "en" | "my";
  age?: number;
};
type PossibleCondition = { name: string; explanation: string };
type Recommendation = { title: string; detail: string };
type ModelContent = {
  summary: string;
  possible_conditions: PossibleCondition[];
  red_flags: string[];
  recommended_actions: Recommendation[];
};
type AnalysisStatus =
  | "openrouter"
  | "configuration_missing"
  | "provider_auth_error"
  | "provider_quota_error"
  | "model_unavailable"
  | "provider_error"
  | "invalid_provider_response"
  | "provider_timeout"
  | "provider_unreachable"
  | "urgent_guidance";
type ProviderFailureStatus = Exclude<AnalysisStatus, "openrouter" | "urgent_guidance">;
type SymptomResult = ModelContent & {
  selected_answers: {
    body_parts: string[];
    pain_sensations: string[];
    pain_severity: number;
    duration: string;
  };
  urgency: Urgency;
  urgency_badge_color: (typeof URGENCY_COLORS)[Urgency];
  analysis_source: "openrouter" | "general-guidance";
  analysis_status: AnalysisStatus;
};
type RuntimeEnv = Record<string, unknown>;

export async function handleAnalyzeSymptoms(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return json({ message: "Unsupported method." }, 405, { allow: "POST" });
  }
  if (!isSameOrigin(request)) return json({ message: "Request origin is not allowed." }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return json({ message: "Expected a JSON request." }, 415);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ message: "Check the symptom details and try again." }, 400);
  }
  if (!isValidRequest(payload)) {
    return json({ message: "Check the symptom details and try again." }, 400);
  }

  const urgency = getUrgency(payload);
  const apiKey = getConfig(env, "OPENROUTER_API_KEY");
  const model = getConfig(env, "OPENROUTER_MODEL");
  if (!apiKey || !model) {
    return createAnalysisFailure("configuration_missing");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers = new Headers({
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "x-title": getConfig(env, "OPENROUTER_APP_NAME") ?? "CareAI",
    });
    const siteUrl = getConfig(env, "OPENROUTER_SITE_URL");
    if (siteUrl) headers.set("http-referer", siteUrl);

    const providerPayload: Record<string, unknown> = {
      model,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "symptom_guidance",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              possible_conditions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    explanation: { type: "string" },
                  },
                  required: ["name", "explanation"],
                  additionalProperties: false,
                },
              },
              red_flags: { type: "array", items: { type: "string" } },
              recommended_actions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    detail: { type: "string" },
                  },
                  required: ["title", "detail"],
                  additionalProperties: false,
                },
              },
            },
            required: ["summary", "possible_conditions", "red_flags", "recommended_actions"],
            additionalProperties: false,
          },
        },
      },
      temperature: 0.2,
      max_tokens: 1800,
      messages: [
        {
          role: "system",
          content: [
            payload.language === "my"
              ? "You are CareAI, an informational symptom guide for older adults. Reply entirely in Burmese (Myanmar language). မြန်မာဘာသာဖြင့်သာ ဖြေပါ။ ရောဂါအတည်မပြုပါနှင့်၊ ဆေးညွှန်းမပေးပါနှင့်၊ ဆေးသောက်ပုံပြောင်းရန် မညွှန်ကြားပါနှင့်။"
              : "You are CareAI, an informational symptom guide for older adults. Reply entirely in English.",
            "Use short, warm, clear English. Do not diagnose, claim certainty or safety, prescribe, or recommend changing medicine.",
            "Base every statement only on the supplied answers. Do not invent symptoms, medical history, causes, or facts that were not supplied.",
            "Use phrasing such as 'you reported' or 'you selected'. Do not use the phrase 'you have', which can sound like a diagnosis.",
            "In the summary, explicitly address every selected body area and pain sensation, the pain severity out of 10, and the selected duration. Explain what the questionnaire can and cannot establish.",
            "Describe possible conditions only as cautious possibilities; do not rank them as diagnoses or imply that an option is confirmed.",
            `The server-assigned urgency is ${urgency}; it is authoritative. If it is "Seek immediate attention", clearly advise immediate emergency medical care and do not suggest delaying care.`,
            "Return one JSON object with exactly these keys: summary, possible_conditions, red_flags, recommended_actions.",
            "summary must be 1 to 1200 characters.",
            "possible_conditions must contain at most 4 objects with name and explanation strings.",
            "red_flags must contain at most 6 short strings.",
            "recommended_actions must contain 2 or 3 objects with exactly title and detail string fields. Each detail must explain how the suggestion relates to the selected answers and when to seek professional help. Do not give medication instructions.",
            "Keep warning signs distinct from routine next steps and include common symptoms that need urgent care.",
            `The server-assigned urgency is ${urgency}. It is authoritative and must not be minimized or contradicted. If it is "Seek immediate attention", clearly advise seeking emergency medical care now.`,
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            body_parts: payload.body_parts,
            pain_sensations: payload.pain_sensations,
            pain_severity: payload.pain_severity,
            duration: payload.duration,
            response_language: payload.language ?? "en",
            application_urgency: urgency,
          }),
        },
      ],
    };
    const reasoningMaxTokens = getReasoningMaxTokens(env);
    if (reasoningMaxTokens !== undefined) {
      providerPayload.reasoning = { max_tokens: reasoningMaxTokens, exclude: true };
    }

    const providerResponse = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify(providerPayload),
    });
    if (!providerResponse.ok) {
      return createAnalysisFailure(getProviderErrorStatus(providerResponse.status));
    }

    const contentLength = Number(providerResponse.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
      return createAnalysisFailure("invalid_provider_response");
    }
    const responseText = await providerResponse.text();
    if (new TextEncoder().encode(responseText).byteLength > MAX_RESPONSE_BYTES) {
      return createAnalysisFailure("invalid_provider_response");
    }

    let content: unknown;
    try {
      content = readModelContent(JSON.parse(responseText));
    } catch {
      content = undefined;
    }
    if (!isValidModelContent(content)) {
      return createAnalysisFailure("invalid_provider_response");
    }

    const normalizedContent = urgency === "Seek immediate attention"
      ? addDeterministicEmergencyGuidance(content, payload)
      : content;

    return json({
      ...normalizedContent,
      selected_answers: getSelectedAnswers(payload),
      urgency,
      urgency_badge_color: URGENCY_COLORS[urgency],
      analysis_source: "openrouter",
      analysis_status: "openrouter",
    } satisfies SymptomResult);
  } catch (error) {
    const status: ProviderFailureStatus =
      error instanceof Error && error.name === "AbortError"
        ? "provider_timeout"
        : "provider_unreachable";
    return createAnalysisFailure(status);
  } finally {
    clearTimeout(timeout);
  }
}

function isValidRequest(value: unknown): value is SymptomInput {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const required = ["body_parts", "pain_sensations", "pain_severity", "duration", "gender"];
  if (
    Object.keys(input).some((key) => ![...required, "age", "language"].includes(key)) ||
    required.some((key) => !Object.hasOwn(input, key)) ||
    !isChoiceList(input.body_parts, BODY_PARTS) ||
    !isChoiceList(input.pain_sensations, PAIN_SENSATIONS) ||
    typeof input.pain_severity !== "number" ||
    !Number.isInteger(input.pain_severity) ||
    input.pain_severity < 1 ||
    input.pain_severity > 10 ||
    typeof input.duration !== "string" ||
    !DURATIONS.includes(input.duration as (typeof DURATIONS)[number]) ||
    typeof input.gender !== "string" ||
    !GENDERS.includes(input.gender as (typeof GENDERS)[number]) ||
    (Object.hasOwn(input, "language") && input.language !== "en" && input.language !== "my")
  ) {
    return false;
  }
  return (
    !Object.hasOwn(input, "age") ||
    (typeof input.age === "number" &&
      Number.isInteger(input.age) &&
      input.age >= 1 &&
      input.age <= 120)
  );
}

function isChoiceList(value: unknown, allowed: readonly string[]): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= allowed.length &&
    value.every(
      (item) =>
        typeof item === "string" &&
        allowed.includes(item) &&
        value.indexOf(item) === value.lastIndexOf(item),
    )
  );
}

function getUrgency(input: SymptomInput): Urgency {
  if (input.body_parts.includes("Chest") || input.pain_severity >= 8) {
    return "Seek immediate attention";
  }
  if (
    input.pain_severity >= 5 ||
    ["About a week", "A few weeks", "Months or longer"].includes(input.duration)
  ) {
    return "See a doctor soon";
  }
  return "Routine";
}

function getSelectedAnswers(input: SymptomInput): SymptomResult["selected_answers"] {
  return {
    body_parts: input.body_parts,
    pain_sensations: input.pain_sensations,
    pain_severity: input.pain_severity,
    duration: input.duration,
  };
}

function makeGeneralGuidance(
  input: SymptomInput,
  urgency: Urgency,
  analysisStatus: AnalysisStatus,
): SymptomResult {
  const BURMESE_BODY_PARTS: Record<string, string> = {
    Head: "ဦးခေါင်း",
    Chest: "ရင်ဘတ်",
    "Lower Back": "ခါးအောက်ပိုင်း",
    Knees: "ဒူး",
    Stomach: "ဗိုက်",
    Neck: "လည်ပင်း",
    Shoulders: "ပခုံး",
    "Hands/Wrists": "လက်/လက်ကောက်ဝတ်",
    "Legs/Ankles": "ခြေထောက်/ခြေကျင်းဝတ်",
  };
  const BURMESE_SENSATIONS: Record<string, string> = {
    "Dull ache": "အောင့်အောင့်နာခြင်း",
    "Sharp / Stabbing": "စူးရှ/ထိုးအောင့်ခြင်း",
    Throbbing: "တဒိတ်ဒိတ်နာခြင်း",
    Burning: "ပူလောင်ခြင်း",
    "Tingling / Numbness": "ကျင်ခြင်း/ထုံခြင်း",
    Cramping: "ကြွက်တက်ခြင်း",
  };
  const BURMESE_DURATIONS: Record<string, string> = {
    "Just started today": "ယနေ့မှ စတင်ဖြစ်သည်",
    "2–3 days": "2–3 ရက်",
    "About a week": "တစ်ပတ်ခန့်",
    "A few weeks": "ရက်သတ္တပတ်အနည်းငယ်",
    "Months or longer": "လများ သို့မဟုတ် ပိုကြာ",
  };
  const BURMESE_RED_FLAGS = [
    "ရင်ဘတ်နာခြင်း သို့မဟုတ် ဖိကျပ်ခြင်း၊ အထူးသဖြင့် ချွေးထွက်ခြင်း သို့မဟုတ် ပျို့ခြင်းနှင့်တွဲဖြစ်ပါက",
    "အသက်ရှူရခက်ခြင်း သို့မဟုတ် ရုတ်တရက် အလွန်အားနည်းခြင်း",
    "မျက်နှာတစ်ခြမ်းရွဲ့ခြင်း၊ လက်မောင်းအားနည်းခြင်း သို့မဟုတ် စကားပြောရခက်ခြင်း",
    "မေ့လဲခြင်း၊ သတိလစ်ခြင်း သို့မဟုတ် သွေးထွက်များခြင်း",
  ];
  if (input.language === "my") {
    return makeBurmeseGeneralGuidance(input, urgency, analysisStatus);
  }
  const locationText = input.body_parts.join(", ");
  const sensationText = input.pain_sensations.join(", ");
  const selectedAnswers = getSelectedAnswers(input);
  if (urgency === "Seek immediate attention") {
    return {
      summary: `You selected ${sensationText} in ${locationText}, pain ${input.pain_severity}/10, lasting ${input.duration.toLowerCase()}. This questionnaire cannot determine the cause. ${input.body_parts.includes("Chest") ? "Chest discomfort can have serious causes, so seek urgent medical assessment." : "Pain at this severity should be assessed promptly."}`,
      possible_conditions: [],
      red_flags: RED_FLAGS,
      recommended_actions: [
        {
          title: "Get urgent medical assessment",
          detail:
            "Your selected answers include chest discomfort or severe pain. Contact local emergency services or seek emergency care now, especially if the pain is new, worsening, or accompanied by other symptoms.",
        },
        {
          title: "Ask someone nearby for help",
          detail:
            "If you feel faint, weak, short of breath, or unsafe traveling alone, ask someone nearby to stay with you and help contact emergency services.",
        },
      ],
      selected_answers: selectedAnswers,
      urgency,
      urgency_badge_color: URGENCY_COLORS[urgency],
      analysis_source: "general-guidance",
      analysis_status: analysisStatus,
    };
  }

  function makeBurmeseGeneralGuidance(
    input: SymptomInput,
    urgency: Urgency,
    analysisStatus: AnalysisStatus,
  ): SymptomResult {
    const bodyParts = translateBurmese(input.body_parts, BURMESE_BODY_PARTS);
    const sensations = translateBurmese(input.pain_sensations, BURMESE_SENSATIONS);
    const locations = bodyParts.join("၊ ");
    const feeling = sensations.join("၊ ");
    const duration = BURMESE_DURATIONS[input.duration] ?? input.duration;
    const selectedAnswers = getSelectedAnswers(input);
    if (urgency === "Seek immediate attention") {
      return {
        summary: `သင်ရွေးချယ်ထားသည်မှာ ${locations} တွင် ${feeling} ခံစားရခြင်း၊ နာကျင်မှုပြင်းအား ${input.pain_severity}/10 နှင့် ကြာချိန် ${duration} ဖြစ်ပါသည်။ ဤမေးခွန်းလွှာဖြင့် နာကျင်ရသည့်အကြောင်းရင်းကို သတ်မှတ်၍မရပါ။ ${input.body_parts.includes("Chest") ? "ရင်ဘတ်မအီမသာဖြစ်ခြင်းသည် ပြင်းထန်သောအကြောင်းရင်းများကြောင့် ဖြစ်နိုင်သဖြင့် ယခုချက်ချင်း ဆေးကုသမှုခံယူပါ။" : "ဤမျှပြင်းထန်သော နာကျင်မှုအတွက် ချက်ချင်း ဆေးဘက်ဆိုင်ရာ စစ်ဆေးမှုခံယူပါ။"}`,
        possible_conditions: [],
        red_flags: BURMESE_RED_FLAGS,
        recommended_actions: [
          {
            title: "အရေးပေါ် ဆေးကုသမှုခံယူပါ",
            detail:
              "သင်ရွေးချယ်ထားသော အဖြေများတွင် ရင်ဘတ်မအီမသာဖြစ်ခြင်း သို့မဟုတ် ပြင်းထန်သောနာကျင်မှု ပါဝင်ပါသည်။ အထူးသဖြင့် နာကျင်မှုအသစ်ဖြစ်ခြင်း၊ ပိုဆိုးလာခြင်း သို့မဟုတ် အခြားလက္ခဏာများနှင့်တွဲဖြစ်ပါက အရေးပေါ်ဝန်ဆောင်မှုကို ဆက်သွယ်ပါ သို့မဟုတ် အရေးပေါ်ဆေးကုသမှု ခံယူပါ။",
          },
          {
            title: "အနီးရှိသူတစ်ဦး၏ အကူအညီတောင်းပါ",
            detail:
              "မူးဝေခြင်း၊ အားနည်းခြင်း၊ အသက်ရှူမဝခြင်း သို့မဟုတ် တစ်ယောက်တည်း သွားလာရန် မလုံခြုံပါက အနီးရှိသူတစ်ဦးကို အတူနေပေးရန်နှင့် အရေးပေါ်ဝန်ဆောင်မှုကို ဆက်သွယ်ပေးရန် တောင်းပါ။",
          },
        ],
        selected_answers: selectedAnswers,
        urgency,
        urgency_badge_color: URGENCY_COLORS[urgency],
        analysis_source: "general-guidance",
        analysis_status: analysisStatus,
      };
    }

    const summary =
      urgency === "See a doctor soon"
        ? `သင်ရွေးချယ်ထားသည်မှာ ${locations} တွင် ${feeling} ခံစားရခြင်း၊ နာကျင်မှုပြင်းအား ${input.pain_severity}/10 နှင့် ကြာချိန် ${duration} ဖြစ်ပါသည်။ ဤအချက်အလက်များသည် သင်ဖော်ပြထားသည့်အခြေအနေကိုသာ ပြသပြီး အကြောင်းရင်းကို မသတ်မှတ်နိုင်ပါ။ နာကျင်မှုအသင့်အတင့်ရှိခြင်း သို့မဟုတ် တစ်ပတ်နှင့်အထက် ကြာနေခြင်းကြောင့် ကျန်းမာရေးပညာရှင်နှင့် မကြာမီ တိုင်ပင်ပါ။`
        : `သင်ရွေးချယ်ထားသည်မှာ ${locations} တွင် ${feeling} ခံစားရခြင်း၊ နာကျင်မှုပြင်းအား ${input.pain_severity}/10 နှင့် ကြာချိန် ${duration} ဖြစ်ပါသည်။ ဤအချက်အလက်များသည် သင်ဖော်ပြထားသည့်အခြေအနေကိုသာ ပြသပြီး အကြောင်းရင်းကို မသတ်မှတ်နိုင်ပါ။ ဆက်လက်ဖြစ်ပွားပါက၊ ပိုဆိုးလာပါက သို့မဟုတ် နေ့စဉ်လုပ်ငန်းများကို ထိခိုက်ပါက ကျန်းမာရေးပညာရှင်နှင့် တိုင်ပင်ပါ။`;

    return {
      summary,
      possible_conditions: [],
      red_flags: BURMESE_RED_FLAGS,
      recommended_actions:
        urgency === "See a doctor soon"
          ? [
              {
                title: "မကြာမီ ကျန်းမာရေးပညာရှင်နှင့် တိုင်ပင်ပါ",
                detail: `သင်ရွေးချယ်ထားသော နာကျင်မှုပြင်းအား ${input.pain_severity}/10 နှင့် ကြာချိန် ${duration} ကို ကျန်းမာရေးပညာရှင်အား ပြောပြတိုင်ပင်ပါ။`,
              },
              {
                title: "ပိုဆိုးလာခြင်း သို့မဟုတ် လက္ခဏာအသစ်များကို သတိပြုပါ",
                detail:
                  "နာကျင်မှု ပြင်းထန်လာပါက၊ လျင်မြန်စွာ ပိုဆိုးလာပါက သို့မဟုတ် အထက်ပါ သတိပြုရမည့်လက္ခဏာများ ဖြစ်လာပါက ပိုစောစွာ ဆေးကုသမှုခံယူပါ။",
              },
            ]
          : [
              {
                title: "မအီမသာဖြစ်မှု ပြောင်းလဲပုံကို မှတ်သားပါ",
                detail: `${locations} တွင်ဖြစ်သော ${feeling} သည် ပြင်းအား၊ ဖြစ်ပွားနှုန်း သို့မဟုတ် နေ့စဉ်လုပ်ငန်းများအပေါ် သက်ရောက်မှု ပြောင်းလဲခြင်းရှိမရှိ သတိပြုပါ။`,
              },
              {
                title: "သက်သောင့်သက်သာရှိသော လှုပ်ရှားမှုကို ရွေးပါ",
                detail:
                  "နာကျင်မှုပိုဆိုးစေသော လှုပ်ရှားမှုများကို ရှောင်ပါ။ ဆက်လက်ဖြစ်ပွားခြင်း၊ ပိုဆိုးလာခြင်း သို့မဟုတ် စိုးရိမ်စရာရှိပါက ကျန်းမာရေးပညာရှင်နှင့် တိုင်ပင်ပါ။",
              },
            ],
      selected_answers: selectedAnswers,
      urgency,
      urgency_badge_color: URGENCY_COLORS[urgency],
      analysis_source: "general-guidance",
      analysis_status: analysisStatus,
    };
  }

  function translateBurmese(values: string[], translations: Record<string, string>): string[] {
    return values.map((value) => translations[value] ?? value);
  }
  return {
    summary: `You selected ${sensationText} in ${locationText}, with pain at ${input.pain_severity}/10 for ${input.duration.toLowerCase()}. These details describe what you reported but cannot identify a cause. ${
      urgency === "See a doctor soon"
        ? "Because the pain is moderate or has lasted a week or longer, consider discussing it with a healthcare professional."
        : "If it continues, worsens, or affects your usual activities, contact a healthcare professional."
    }`,
    possible_conditions: [],
    red_flags: RED_FLAGS,
    recommended_actions:
      urgency === "See a doctor soon"
        ? [
            {
              title: "Arrange a timely health review",
              detail: `Since you selected ${input.pain_severity}/10 pain lasting ${input.duration.toLowerCase()}, consider discussing the ${sensationText.toLowerCase()} in your ${locationText.toLowerCase()} with a healthcare professional.`,
            },
            {
              title: "Watch for worsening or new symptoms",
              detail:
                "Seek care sooner if the pain becomes severe, rapidly worsens, or comes with any warning signs listed above.",
            },
          ]
        : [
            {
              title: "Track how the discomfort changes",
              detail: `Notice whether the ${sensationText.toLowerCase()} in your ${locationText.toLowerCase()} changes in intensity, frequency, or effect on everyday activities.`,
            },
            {
              title: "Choose a comfortable level of activity",
              detail:
                "Avoid activities that clearly worsen the discomfort. If it persists, worsens, or concerns you, contact a healthcare professional.",
            },
          ],
    selected_answers: selectedAnswers,
    urgency,
    urgency_badge_color: URGENCY_COLORS[urgency],
    analysis_source: "general-guidance",
    analysis_status: analysisStatus,
  };
}

function addDeterministicEmergencyGuidance(
  content: ModelContent,
  input: SymptomInput,
): ModelContent {
  const emergencyGuidance = makeGeneralGuidance(input, "Seek immediate attention", "urgent_guidance");
  const emergencyAction = emergencyGuidance.recommended_actions[0];
  return {
    ...content,
    red_flags: [...new Set([...content.red_flags, ...emergencyGuidance.red_flags])].slice(0, 6),
    recommended_actions: emergencyAction
      ? [emergencyAction, ...content.recommended_actions].slice(0, 3)
      : content.recommended_actions,
  };
}

function createAnalysisFailure(status: ProviderFailureStatus): Response {
  const httpStatus = status === "configuration_missing" ? 503 : status === "provider_timeout" ? 504 : 502;
  return json(
    {
      analysis_status: status,
      message: "AI symptom analysis could not be completed. Please try again.",
    },
    httpStatus,
  );
}

function getProviderErrorStatus(status: number): ProviderFailureStatus {
  if (status === 401 || status === 403) return "provider_auth_error";
  if (status === 402) return "provider_quota_error";
  if (status === 404) return "model_unavailable";
  return "provider_error";
}

function getReasoningMaxTokens(env: unknown): number | undefined {
  const raw = getConfig(env, "OPENROUTER_REASONING_MAX_TOKENS");
  if (!raw || !/^-?\d+$/.test(raw)) return undefined;
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) return undefined;
  return value === -1 || (value >= 0 && value <= MAX_REASONING_TOKENS) ? value : undefined;
}

function readModelContent(value: unknown): unknown {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const choices = (value as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const first = choices[0];
  if (first == null || typeof first !== "object" || Array.isArray(first)) return undefined;
  const message = (first as Record<string, unknown>).message;
  if (message == null || typeof message !== "object" || Array.isArray(message)) return undefined;
  const content = (message as Record<string, unknown>).content;
  if (typeof content !== "string" || content.length > MAX_RESPONSE_BYTES) return undefined;
  try {
    return JSON.parse(content);
  } catch {
    return undefined;
  }
}

function isValidModelContent(value: unknown): value is ModelContent {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
  const output = value as Record<string, unknown>;
  const allowedKeys = ["summary", "possible_conditions", "red_flags", "recommended_actions"];
  if (Object.keys(output).some((key) => !allowedKeys.includes(key))) return false;
  if (
    !isText(output.summary, 1200) ||
    !isSafeText(output.summary) ||
    !Array.isArray(output.possible_conditions) ||
    output.possible_conditions.length > 8 ||
    !output.possible_conditions.every(isPossibleCondition) ||
    !isSafeTextList(output.red_flags, 10, 300) ||
    !Array.isArray(output.recommended_actions) ||
    output.recommended_actions.length < 2 ||
    output.recommended_actions.length > 5 ||
    !output.recommended_actions.every(isRecommendation)
  ) {
    return false;
  }
  return true;
}

function isPossibleCondition(value: unknown): value is PossibleCondition {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
  const condition = value as Record<string, unknown>;
  return (
    Object.keys(condition).length === 2 &&
    isText(condition.name, 120) &&
    isText(condition.explanation, 800) &&
    isSafeText(condition.name) &&
    isSafeText(condition.explanation)
  );
}

function isRecommendation(value: unknown): value is Recommendation {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
  const recommendation = value as Record<string, unknown>;
  return (
    Object.keys(recommendation).length === 2 &&
    isText(recommendation.title, 120) &&
    isText(recommendation.detail, 1000) &&
    isSafeText(recommendation.title) &&
    isSafeText(recommendation.detail)
  );
}

function isSafeTextList(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => isText(item, maxLength) && isSafeText(item))
  );
}

function isText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isSafeText(value: string): boolean {
  return !UNSAFE_LANGUAGE.some((pattern) => pattern.test(value));
}

function getConfig(env: unknown, key: string): string | undefined {
  const boundValue = env != null && typeof env === "object" ? (env as RuntimeEnv)[key] : undefined;
  if (typeof boundValue === "string" && boundValue.trim()) return boundValue.trim();
  const processValue = typeof process !== "undefined" ? process.env[key] : undefined;
  return processValue?.trim() || undefined;
}

function isSameOrigin(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  return origin == null || origin === new URL(request.url).origin;
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
