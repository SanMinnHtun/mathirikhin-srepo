import assert from "node:assert/strict";
import test from "node:test";
import { handleAnalyzeSymptoms } from "./symptoms-api-server";

const input = {
  body_parts: ["Knees"],
  pain_sensations: ["Dull ache"],
  pain_severity: 3,
  duration: "2–3 days",
  gender: "Other / Prefer not to say",
  age: 72,
};
const modelOutput = {
  summary: "A mild knee ache can have several possible causes.",
  possible_conditions: [
    { name: "Joint strain", explanation: "This can sometimes cause knee discomfort." },
  ],
  red_flags: ["Sudden severe weakness"],
  recommended_actions: [
    {
      title: "Track how the discomfort changes",
      detail: "Notice whether the dull ache in your knees changes or affects daily activities.",
    },
    {
      title: "Choose a comfortable level of activity",
      detail: "Avoid activities that clearly worsen the discomfort and seek advice if it persists.",
    },
  ],
};
const env = {
  OPENROUTER_API_KEY: "test-key-not-a-secret",
  OPENROUTER_MODEL: "test/provider-model",
  OPENROUTER_REASONING_MAX_TOKENS: "512",
};

function request(body: unknown, origin = "https://careai.example") {
  return new Request("https://careai.example/api/symptoms/analyze-senior", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

function providerResponse(content: unknown) {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

test("returns a validated OpenRouter summary with server-owned urgency", async () => {
  const originalFetch = globalThis.fetch;
  let providerUrl = "";
  let providerAuthorization = "";
  let providerBody: Record<string, unknown> = {};
  globalThis.fetch = (async (url, options) => {
    providerUrl = String(url);
    providerAuthorization = new Headers(options?.headers).get("authorization") ?? "";
    providerBody = JSON.parse(String(options?.body)) as Record<string, unknown>;
    return providerResponse(modelOutput);
  }) as typeof fetch;

  try {
    const response = await handleAnalyzeSymptoms(request(input), env);
    const result = await response.json();
    const messages = providerBody.messages as Array<{ role: string; content: string }>;

    assert.equal(response.status, 200);
    assert.equal(providerUrl, "https://openrouter.ai/api/v1/chat/completions");
    assert.equal(providerAuthorization, `Bearer ${env.OPENROUTER_API_KEY}`);
    assert.equal(providerBody.model, env.OPENROUTER_MODEL);
    assert.deepEqual(providerBody.reasoning, { max_tokens: 512, exclude: true });
    assert.equal(providerBody.max_tokens, 1800);
    assert.deepEqual(JSON.parse(messages[1].content), {
      body_parts: input.body_parts,
      pain_sensations: input.pain_sensations,
      pain_severity: input.pain_severity,
      duration: input.duration,
      response_language: "en",
    });
    assert.match(
      messages[0].content,
      /explicitly address every selected body area and pain sensation/i,
    );
    assert.match(messages[0].content, /Do not invent symptoms/i);
    assert.equal(result.urgency, "Routine");
    assert.equal(result.urgency_badge_color, "green");
    assert.equal(result.analysis_source, "openrouter");
    assert.equal(result.analysis_status, "openrouter");
    assert.deepEqual(result.selected_answers, {
      body_parts: input.body_parts,
      pain_sensations: input.pain_sensations,
      pain_severity: input.pain_severity,
      duration: input.duration,
    });
    assert.deepEqual(result.recommended_actions[0], modelOutput.recommended_actions[0]);
    assert.equal(JSON.stringify(result).includes(env.OPENROUTER_API_KEY), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reads OpenRouter credentials from server process environment", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENROUTER_API_KEY;
  const originalModel = process.env.OPENROUTER_MODEL;
  let authorization = "";
  process.env.OPENROUTER_API_KEY = "server-env-test-key";
  process.env.OPENROUTER_MODEL = "test/server-env-model";
  globalThis.fetch = (async (_url, options) => {
    authorization = new Headers(options?.headers).get("authorization") ?? "";
    return providerResponse(modelOutput);
  }) as typeof fetch;

  try {
    const response = await handleAnalyzeSymptoms(request(input), {});
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.analysis_source, "openrouter");
    assert.equal(result.analysis_status, "openrouter");
    assert.equal(authorization, "Bearer server-env-test-key");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalApiKey;
    if (originalModel === undefined) delete process.env.OPENROUTER_MODEL;
    else process.env.OPENROUTER_MODEL = originalModel;
  }
});

test("fails clearly if provider configuration is missing", async () => {
  const response = await handleAnalyzeSymptoms(request(input), {});
  const result = await response.json();

  assert.equal(response.status, 503);
  assert.equal(result.analysis_source, undefined);
  assert.equal(result.analysis_status, "configuration_missing");
  assert.equal(result.message, "AI symptom analysis could not be completed. Please try again.");
});

test("instructs the provider to respond in Burmese when Burmese is selected", async () => {
  const originalFetch = globalThis.fetch;
  let systemPrompt = "";
  globalThis.fetch = (async (_url, options) => {
    const providerBody = JSON.parse(String(options?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    systemPrompt = providerBody.messages[0].content;
    return providerResponse(modelOutput);
  }) as typeof fetch;

  try {
    const response = await handleAnalyzeSymptoms(request({ ...input, language: "my" }), env);
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.analysis_source, "openrouter");
    assert.match(systemPrompt, /Burmese \(Myanmar language\)/);
    assert.equal(systemPrompt.includes(env.OPENROUTER_API_KEY), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uses the provider for chest pain while preserving deterministic emergency guidance", async () => {
  const originalFetch = globalThis.fetch;
  let providerCalled = false;
  globalThis.fetch = (async () => {
    providerCalled = true;
    return providerResponse(modelOutput);
  }) as typeof fetch;

  try {
    const response = await handleAnalyzeSymptoms(
      request({ ...input, body_parts: ["Chest", "Knees"] }),
      env,
    );
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(providerCalled, true);
    assert.equal(result.urgency, "Seek immediate attention");
    assert.equal(result.urgency_badge_color, "red");
    assert.equal(result.analysis_source, "openrouter");
    assert.equal(result.analysis_status, "openrouter");
    assert.equal(result.summary, modelOutput.summary);
    assert.match(result.recommended_actions[0].title, /urgent medical assessment/i);
    assert.ok(result.red_flags.length >= modelOutput.red_flags.length);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects invalid request data and cross-origin requests", async () => {
  const invalid = await handleAnalyzeSymptoms(request({ ...input, pain_severity: 11 }), env);
  const crossOrigin = await handleAnalyzeSymptoms(request(input, "https://attacker.example"), env);

  assert.equal(invalid.status, 400);
  assert.equal(crossOrigin.status, 403);
});

test("rejects unsafe provider output instead of presenting it as analyzed", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    providerResponse({
      ...modelOutput,
      summary: "You definitely have arthritis.",
    })) as typeof fetch;

  try {
    const response = await handleAnalyzeSymptoms(request(input), env);
    const result = await response.json();

    assert.equal(response.status, 502);
    assert.equal(result.analysis_source, undefined);
    assert.equal(result.analysis_status, "invalid_provider_response");
    assert.equal(result.summary, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("returns safe actionable status for OpenRouter authentication and billing failures", async () => {
  const originalFetch = globalThis.fetch;
  const expectedStatuses = new Map([
    [401, "provider_auth_error"],
    [402, "provider_quota_error"],
    [404, "model_unavailable"],
  ]);

  try {
    for (const [providerStatus, expectedStatus] of expectedStatuses) {
      globalThis.fetch = (async () =>
        new Response("private provider error details", { status: providerStatus })) as typeof fetch;
      const response = await handleAnalyzeSymptoms(request(input), env);
      const result = await response.json();

      assert.equal(response.status, 502);
      assert.equal(result.analysis_status, expectedStatus);
      assert.equal(JSON.stringify(result).includes("private provider error details"), false);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
