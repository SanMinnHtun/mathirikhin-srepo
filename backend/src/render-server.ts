import express, {
  type NextFunction,
  type Request as ExpressRequest,
  type Response as ExpressResponse,
} from "express";
import { verifyAuth } from "./auth/verifyAuth.js";
import { handleAnalyzeSymptoms } from "./symptoms-api-server.js";

const app = express();
const SYMPTOM_ROUTE = "/api/symptoms/analyze-senior";

app.disable("x-powered-by");

app.use((request, response, next) => {
  const origin = request.header("origin");
  const allowedOrigins = getAllowedOrigins();

  if (origin && !allowedOrigins.includes(origin)) {
    response.status(403).json({ message: "Request origin is not allowed." });
    return;
  }

  if (origin) {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("vary", "Origin");
  }
  response.setHeader("cache-control", "no-store");

  if (request.method === "OPTIONS" && request.path === SYMPTOM_ROUTE) {
    response.setHeader("access-control-allow-methods", "POST, OPTIONS");
    response.setHeader("access-control-allow-headers", "Authorization, Content-Type");
    response.setHeader("access-control-max-age", "600");
    response.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json({ limit: "16kb", strict: true }));

app.get("/healthz", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.all(SYMPTOM_ROUTE, async (request, response, next) => {
  try {
    try {
      await verifyAuth(request);
    } catch {
      response.status(401).json({ message: "Please sign in again." });
      return;
    }

    const apiRequest = toWebRequest(request);
    const apiResponse = await handleAnalyzeSymptoms(apiRequest, process.env);
    apiResponse.headers.forEach((value, key) => response.setHeader(key, value));
    response.status(apiResponse.status).send(Buffer.from(await apiResponse.arrayBuffer()));
  } catch (error) {
    next(error);
  }
});

app.use((_request, response) => {
  response.status(404).json({ message: "Not found." });
});

app.use(
  (
    error: unknown,
    _request: ExpressRequest,
    response: ExpressResponse,
    _next: NextFunction,
  ) => {
    if (error instanceof SyntaxError) {
      response.status(400).json({ message: "Check the symptom details and try again." });
      return;
    }
    console.error("Symptom API request failed.");
    response.status(500).json({ message: "The symptom analysis request could not be completed." });
  },
);

function getAllowedOrigins(): string[] {
  return (process.env.CAREAI_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function toWebRequest(request: ExpressRequest): Request {
  const headers = new Headers();
  const contentType = request.header("content-type");
  const origin = request.header("origin");
  const fetchSite = request.header("sec-fetch-site");
  const authorization = request.header("authorization");
  if (contentType) headers.set("content-type", contentType);
  if (authorization) headers.set("authorization", authorization);
  if (origin) headers.set("origin", origin);
  if (fetchSite) headers.set("sec-fetch-site", fetchSite);

  const url = new URL(request.originalUrl, `http://${request.get("host") ?? "localhost"}`);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return new Request(url, {
    method: request.method,
    headers,
    ...(hasBody ? { body: JSON.stringify(request.body) } : {}),
  });
}

const port = Number(process.env.PORT ?? "10000");
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be a valid TCP port.");
}

app.listen(port, "0.0.0.0", () => {
  console.info("CareAI symptom API is listening.");
});
