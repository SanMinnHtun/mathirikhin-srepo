import { useEffect, useRef, useState, type FormEvent } from "react";
import { Activity, HeartPulse, Info, LoaderCircle, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getFirebaseAuth } from "@/lib/firebase-client";

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
];
const SENSATIONS = [
  "Dull ache",
  "Sharp / Stabbing",
  "Throbbing",
  "Burning",
  "Tingling / Numbness",
  "Cramping",
];
const DURATIONS = [
  "Just started today",
  "2–3 days",
  "About a week",
  "A few weeks",
  "Months or longer",
];
const GENDERS = ["Female", "Male", "Other / Prefer not to say"];
const COLORS: Record<string, string> = {
  Routine: "border-emerald-200 bg-emerald-50 text-emerald-900",
  "See a doctor soon": "border-amber-300 bg-amber-50 text-amber-950",
  "Seek immediate attention": "border-red-300 bg-red-50 text-red-900",
};
type SymptomResult = {
  selected_answers: {
    body_parts: string[];
    pain_sensations: string[];
    pain_severity: number;
    duration: string;
  };
  urgency: keyof typeof COLORS;
  urgency_badge_color: "green" | "yellow" | "red";
  summary: string;
  possible_conditions: Array<{ name: string; explanation: string }>;
  red_flags: string[];
  recommended_actions: Array<{ title: string; detail: string }>;
  analysis_source: "openrouter";
  analysis_status: "openrouter";
};
type AnalysisFailureStatus =
  | "configuration_missing"
  | "provider_auth_error"
  | "provider_quota_error"
  | "model_unavailable"
  | "provider_error"
  | "invalid_provider_response"
  | "provider_timeout"
  | "provider_unreachable";

const symptomApiBaseUrl = (import.meta.env.VITE_CAREAI_API_BASE_URL ?? "").replace(/\/+$/, "");

function isSymptomResult(value: unknown): value is SymptomResult {
  if (value == null || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  const expectedColor: Record<string, string> = {
    Routine: "green",
    "See a doctor soon": "yellow",
    "Seek immediate attention": "red",
  };
  return (
    typeof result.urgency === "string" &&
    result.urgency_badge_color === expectedColor[result.urgency] &&
    result.selected_answers != null &&
    typeof result.selected_answers === "object" &&
    Array.isArray(result.selected_answers.body_parts) &&
    result.selected_answers.body_parts.every((item) => typeof item === "string") &&
    Array.isArray(result.selected_answers.pain_sensations) &&
    result.selected_answers.pain_sensations.every((item) => typeof item === "string") &&
    typeof result.selected_answers.pain_severity === "number" &&
    Number.isInteger(result.selected_answers.pain_severity) &&
    result.selected_answers.pain_severity >= 1 &&
    result.selected_answers.pain_severity <= 10 &&
    typeof result.selected_answers.duration === "string" &&
    typeof result.summary === "string" &&
    Array.isArray(result.possible_conditions) &&
    result.possible_conditions.every(
      (item) =>
        item != null &&
        typeof item === "object" &&
        typeof item.name === "string" &&
        typeof item.explanation === "string",
    ) &&
    Array.isArray(result.red_flags) &&
    result.red_flags.every((item) => typeof item === "string") &&
    Array.isArray(result.recommended_actions) &&
    result.recommended_actions.every(
      (item) =>
        item != null &&
        typeof item === "object" &&
        typeof item.title === "string" &&
        typeof item.detail === "string",
    ) &&
    result.analysis_source === "openrouter" &&
    result.analysis_status === "openrouter"
  );
}

export function SeniorSymptomChecker() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage === "my" ? "my" : "en";
  const localizedBodyParts = t("symptomCheck.bodyParts", { returnObjects: true }) as string[];
  const localizedSensations = t("symptomCheck.sensations", { returnObjects: true }) as string[];
  const localizedDurations = t("symptomCheck.durations", { returnObjects: true }) as string[];
  const localizedGenders = t("symptomCheck.genders", { returnObjects: true }) as string[];
  const [bodyParts, setBodyParts] = useState<string[]>([]);
  const [sensations, setSensations] = useState<string[]>([]);
  const [severity, setSeverity] = useState<number | null>(null);
  const [duration, setDuration] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [result, setResult] = useState<SymptomResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const ageIsValid = age === "" || (/^\d+$/.test(age) && Number(age) >= 1 && Number(age) <= 120);
  const complete =
    bodyParts.length > 0 &&
    sensations.length > 0 &&
    severity !== null &&
    duration &&
    gender &&
    ageIsValid;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialogOpen && !dialog.open) dialog.showModal();
    if (!dialogOpen && dialog.open) dialog.close();
  }, [dialogOpen]);

  function toggle(values: string[], setValues: (value: string[]) => void, choice: string) {
    setValues(
      values.includes(choice) ? values.filter((item) => item !== choice) : [...values, choice],
    );
  }

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete || loading) return;
    setResult(null);
    setError("");
    setLoading(true);
    setDialogOpen(true);
    try {
      const user = getFirebaseAuth().currentUser;
      if (!user) {
        setError(t("symptomCheck.requestError"));
        return;
      }
      const idToken = await user.getIdToken();
      const response = await fetch(`${symptomApiBaseUrl}/api/symptoms/analyze-senior`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          body_parts: bodyParts,
          pain_sensations: sensations,
          pain_severity: severity,
          duration,
          gender,
          language,
          ...(age ? { age: Number(age) } : {}),
        }),
      });
      if (!response.ok) {
        const failure: unknown = await response.json().catch(() => null);
        const failureStatus =
          failure != null && typeof failure === "object"
            ? (failure as Record<string, unknown>)["analysis_status"]
            : undefined;
        setError(
          isAnalysisFailureStatus(failureStatus)
            ? t(`symptomCheck.${getAnalysisStatusKey(failureStatus)}`)
            : t("symptomCheck.requestError"),
        );
        return;
      }
      const payload: unknown = await response.json();
      if (!isSymptomResult(payload)) {
        setError(t("symptomCheck.incompleteError"));
        return;
      }
      setResult(payload);
    } catch {
      setError(t("symptomCheck.connectionError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="text-center">
        <span className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/90 px-4 py-2 text-sm font-bold text-blue-800 shadow-sm">
          <HeartPulse className="size-5" aria-hidden="true" />
          {t("symptomCheck.badge")}
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          {t("symptomCheck.introTitle")}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-600">
          {t("symptomCheck.introBody")}
        </p>
      </header>

      <form onSubmit={(event) => void analyze(event)} className="space-y-5">
        <ChoiceGroup
          title={t("symptomCheck.bodyTitle")}
          help={t("symptomCheck.bodyHelp")}
          choices={BODY_PARTS.map((value, index) => ({
            value,
            label: localizedBodyParts[index],
          }))}
          selected={bodyParts}
          onToggle={(choice) => toggle(bodyParts, setBodyParts, choice)}
          ariaLabel={t("symptomCheck.areaOptionsAria")}
        />
        <ChoiceGroup
          title={t("symptomCheck.sensationTitle")}
          help={t("symptomCheck.sensationHelp")}
          choices={SENSATIONS.map((value, index) => ({
            value,
            label: localizedSensations[index],
          }))}
          selected={sensations}
          onToggle={(choice) => toggle(sensations, setSensations, choice)}
          ariaLabel={t("symptomCheck.sensationOptionsAria")}
        />

        <fieldset className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:p-7">
          <legend className="px-1 text-xl font-bold text-slate-900">
            {t("symptomCheck.severityTitle")}
          </legend>
          <p className="mb-4 text-sm text-slate-600">{t("symptomCheck.severityHelp")}</p>
          <div
            className="grid grid-cols-5 gap-2 sm:grid-cols-10"
            role="group"
            aria-label={t("symptomCheck.severityAria")}
          >
            {Array.from({ length: 10 }, (_, index) => index + 1).map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={severity === level}
                onClick={() => setSeverity(level)}
                className={`min-h-12 rounded-xl border text-lg font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${
                  severity === level
                    ? "border-blue-700 bg-blue-700 text-white"
                    : "border-blue-100 bg-white text-slate-800 hover:bg-blue-50"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </fieldset>

        <ChoiceGroup
          title={t("symptomCheck.durationTitle")}
          help={t("symptomCheck.durationHelp")}
          choices={DURATIONS.map((value, index) => ({
            value,
            label: localizedDurations[index],
          }))}
          selected={duration ? [duration] : []}
          onToggle={(choice) => setDuration(choice === duration ? "" : choice)}
          ariaLabel={t("symptomCheck.durationTitle")}
        />
        <fieldset className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:p-7">
          <legend className="px-1 text-xl font-bold text-slate-900">
            {t("symptomCheck.aboutTitle")}
          </legend>
          <p className="mb-4 text-sm text-slate-600">{t("symptomCheck.aboutBody")}</p>
          <div className="flex flex-wrap gap-2">
            {GENDERS.map((choice, index) => (
              <button
                key={choice}
                type="button"
                aria-pressed={gender === choice}
                onClick={() => setGender(choice)}
                className={`min-h-12 rounded-xl border px-4 py-2 font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${
                  gender === choice
                    ? "border-blue-700 bg-blue-700 text-white"
                    : "border-blue-100 bg-white text-slate-800 hover:bg-blue-50"
                }`}
              >
                {localizedGenders[index]}
              </button>
            ))}
          </div>
          <label htmlFor="symptom-age" className="mt-5 block text-sm font-semibold text-slate-800">
            {t("symptomCheck.age")}{" "}
            <span className="font-normal text-slate-500">{t("symptomCheck.ageOptional")}</span>
          </label>
          <input
            id="symptom-age"
            type="number"
            min={1}
            max={120}
            step={1}
            value={age}
            onChange={(event) => setAge(event.target.value)}
            className="mt-2 min-h-12 w-full max-w-xs rounded-xl border border-blue-200 px-4"
            aria-invalid={!ageIsValid}
            aria-describedby={!ageIsValid ? "symptom-age-error" : undefined}
          />
          {!ageIsValid ? (
            <p id="symptom-age-error" role="alert" className="mt-2 text-sm text-red-700">
              {t("symptomCheck.ageError")}
            </p>
          ) : null}
        </fieldset>

        <p className="rounded-2xl border border-blue-100 bg-white p-4 text-sm leading-6 text-slate-700">
          <Info className="mr-2 inline size-4 align-[-3px]" aria-hidden="true" />
          {t("symptomCheck.disclaimer")}
        </p>
        <button
          type="submit"
          disabled={!complete || loading}
          className="min-h-14 w-full rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 px-6 py-3 text-lg font-bold text-white shadow-md hover:from-blue-800 hover:to-indigo-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-500"
        >
          {t("symptomCheck.submit")}
        </button>
      </form>

      <dialog
        ref={dialogRef}
        aria-labelledby="symptom-result-title"
        onCancel={(event) => {
          if (loading) event.preventDefault();
          else setDialogOpen(false);
        }}
        className="m-auto max-h-[min(92dvh,900px)] w-[min(770px,calc(100vw-1rem))] overflow-hidden rounded-3xl border-0 bg-slate-50 p-0 shadow-2xl backdrop:bg-slate-950/55"
      >
        <div className="flex max-h-[min(92dvh,900px)] flex-col">
          <header className="flex items-center gap-3 border-b border-blue-100 bg-white px-5 py-4">
            <span className="grid size-11 place-items-center rounded-full bg-blue-50 text-blue-700">
              <HeartPulse className="size-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-blue-700">
                CareAI
              </p>
              <h2 id="symptom-result-title" className="text-xl font-bold text-slate-900">
                {t("symptomCheck.resultTitle")}
              </h2>
            </div>
          </header>
          <div
            className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-7"
            aria-live="polite"
            aria-busy={loading}
          >
            {loading ? (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <LoaderCircle
                  className="size-12 animate-spin text-blue-700 motion-reduce:animate-none"
                  aria-hidden="true"
                />
                <p className="mt-4 text-lg font-bold text-slate-900">
                  {t("symptomCheck.preparing")}
                </p>
              </div>
            ) : error ? (
              <div
                className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-slate-800"
                role="alert"
              >
                <h3 className="font-bold">{t("symptomCheck.errorTitle")}</h3>
                <p className="mt-2">{error}</p>
              </div>
            ) : result ? (
              <>
                <div
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 font-bold ${COLORS[result.urgency]}`}
                >
                  <Activity className="size-4" aria-hidden="true" />
                  {t(
                    result.urgency === "Routine"
                      ? "symptomCheck.urgencyRoutine"
                      : result.urgency === "See a doctor soon"
                        ? "symptomCheck.urgencySoon"
                        : "symptomCheck.urgencyImmediate",
                  )}
                </div>
                <p className="rounded-2xl border border-blue-100 bg-white p-5 leading-7 text-slate-800">
                  {result.summary}
                </p>
                <section className="rounded-2xl border border-blue-100 bg-white p-5">
                  <h3 className="font-bold text-slate-900">{t("symptomCheck.selectedAnswers")}</h3>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-semibold text-slate-500">{t("symptomCheck.area")}</dt>
                      <dd className="mt-1 text-slate-800">
                        {translateChoices(
                          result.selected_answers.body_parts,
                          BODY_PARTS,
                          localizedBodyParts,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-500">
                        {t("symptomCheck.sensation")}
                      </dt>
                      <dd className="mt-1 text-slate-800">
                        {translateChoices(
                          result.selected_answers.pain_sensations,
                          SENSATIONS,
                          localizedSensations,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-500">
                        {t("symptomCheck.painLevel")}
                      </dt>
                      <dd className="mt-1 text-slate-800">
                        {result.selected_answers.pain_severity}/10
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-500">{t("symptomCheck.duration")}</dt>
                      <dd className="mt-1 text-slate-800">
                        {translateChoices(
                          [result.selected_answers.duration],
                          DURATIONS,
                          localizedDurations,
                        )}
                      </dd>
                    </div>
                  </dl>
                </section>
                <p className="text-sm text-slate-600" role="status">
                  {t("symptomCheck.aiCompleted")}
                </p>
                <section className="rounded-2xl border border-blue-100 bg-white p-5">
                  <h3 className="font-bold text-slate-900">
                    {t("symptomCheck.possibleExplanations")}
                  </h3>
                  {result.possible_conditions.length ? (
                    <div className="mt-3 space-y-2">
                      {result.possible_conditions.map((item, index) => (
                        <details
                          key={`${item.name}-${index}`}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                          <summary className="cursor-pointer font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                            {item.name}
                          </summary>
                          <p className="mt-2 text-sm leading-6 text-slate-700">
                            {item.explanation}
                          </p>
                        </details>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600">
                      {t("symptomCheck.noExplanations")}
                    </p>
                  )}
                </section>
                <section className="rounded-2xl border-2 border-red-200 bg-red-50 p-5">
                  <h3 className="flex items-center gap-2 font-bold text-red-950">
                    <ShieldAlert className="size-5" aria-hidden="true" />
                    {t("symptomCheck.warningSigns")}
                  </h3>
                  <p className="mt-2 text-sm text-red-950">{t("symptomCheck.urgentHelp")}</p>
                  <ResultList title="" items={result.red_flags} />
                </section>
                <section className="rounded-2xl border border-blue-100 bg-white p-5">
                  <h3 className="font-bold text-slate-900">{t("symptomCheck.suggestions")}</h3>
                  <p className="mt-1 text-sm text-slate-600">{t("symptomCheck.suggestionsHelp")}</p>
                  {result.recommended_actions.length ? (
                    <div className="mt-3 space-y-2">
                      {result.recommended_actions.map((action, index) => (
                        <details
                          key={`${action.title}-${index}`}
                          className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3"
                        >
                          <summary className="cursor-pointer font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                            {action.title}
                          </summary>
                          <p className="mt-2 text-sm leading-6 text-slate-700">{action.detail}</p>
                        </details>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600">
                      {t("symptomCheck.contactProfessional")}
                    </p>
                  )}
                </section>
                <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                  {t("symptomCheck.disclaimer")}
                </p>
              </>
            ) : null}
          </div>
          {!loading ? (
            <footer className="border-t border-blue-100 bg-white p-4">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="min-h-14 w-full rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 px-5 py-3 font-bold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
              >
                {t("symptomCheck.editAnswers")}
              </button>
            </footer>
          ) : null}
        </div>
      </dialog>
    </div>
  );
}

function ChoiceGroup({
  title,
  help,
  choices,
  selected,
  onToggle,
  ariaLabel,
}: {
  title: string;
  help: string;
  choices: readonly { value: string; label: string }[];
  selected: string[];
  onToggle: (choice: string) => void;
  ariaLabel: string;
}) {
  return (
    <fieldset className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:p-7">
      <legend className="px-1 text-xl font-bold text-slate-900">{title}</legend>
      <p className="mb-4 text-sm text-slate-600">{help}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={ariaLabel}>
        {choices.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={selected.includes(value)}
            onClick={() => onToggle(value)}
            className={`min-h-12 rounded-xl border px-4 py-2 font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${
              selected.includes(value)
                ? "border-blue-700 bg-blue-700 text-white"
                : "border-blue-100 bg-white text-slate-800 hover:bg-blue-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function translateChoices(
  values: string[],
  choices: readonly string[],
  localized: string[],
): string {
  return values
    .map((value) => {
      const index = choices.indexOf(value);
      return index >= 0 ? localized[index] : value;
    })
    .join(", ");
}

function isAnalysisFailureStatus(value: unknown): value is AnalysisFailureStatus {
  return typeof value === "string" && [
    "configuration_missing",
    "provider_auth_error",
    "provider_quota_error",
    "model_unavailable",
    "provider_error",
    "invalid_provider_response",
    "provider_timeout",
    "provider_unreachable",
  ].includes(value);
}

function getAnalysisStatusKey(status: AnalysisFailureStatus): string {
  const keys: Record<AnalysisFailureStatus, string> = {
    configuration_missing: "statusConfiguration",
    provider_auth_error: "statusAuthentication",
    provider_quota_error: "statusQuota",
    model_unavailable: "statusModel",
    provider_error: "statusProvider",
    invalid_provider_response: "requestError",
    provider_timeout: "statusTimeout",
    provider_unreachable: "statusUnreachable",
  };
  return keys[status];
}

function ResultList({ title, items, empty }: { title: string; items: string[]; empty?: string }) {
  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-5">
      {title ? <h3 className="font-bold text-slate-900">{title}</h3> : null}
      {items.length ? (
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
          {items.map((item, index) => (
            <li key={`${index}-${item}`}>{item}</li>
          ))}
        </ul>
      ) : empty ? (
        <p className="mt-2 text-sm text-slate-600">{empty}</p>
      ) : null}
    </section>
  );
}
