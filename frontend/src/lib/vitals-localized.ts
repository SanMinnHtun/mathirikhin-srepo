import type { LanguageCode } from "@/i18n/languages";
import { analyzeVitals, RANGES, type VitalAnalysis, type VitalInput, type VitalRecord } from "./vitals";

type InsightLanguage = Extract<LanguageCode, "en" | "my">;

type LocalizedCopy = {
  disclaimer: string;
  unavailableSummary: string;
  unavailableRecommendations: [string, string];
  labels: Record<keyof VitalInput, string>;
  units: Record<keyof VitalInput, string>;
  directions: { below: string; above: string };
  good: (label: string, value: number, unit: string) => string;
  concern: (label: string, direction: string, value: number, unit: string) => string;
  recommendations: {
    temperature: string;
    pressure: string;
    heartRate: string;
    oxygen: string;
    routine: string;
    logging: string;
  };
  summary: {
    emergency: string;
    good: string;
    attention: (count: number) => string;
  };
};

const COPY: Record<InsightLanguage, LocalizedCopy> = {
  en: {
    disclaimer:
      "CareAI provides informational health insights and is not a substitute for professional medical advice.",
    unavailableSummary: "Your reading was saved, but CareAI analysis is temporarily unavailable.",
    unavailableRecommendations: [
      "Consider rechecking a measurement if it seems unexpected.",
      "Contact a qualified healthcare professional if you have concerns or symptoms.",
    ],
    labels: {
      temperature: "Temperature",
      systolic: "Systolic pressure",
      diastolic: "Diastolic pressure",
      heartRate: "Heart rate",
      oxygen: "Oxygen saturation",
    },
    units: {
      temperature: "°C",
      systolic: "mmHg",
      diastolic: "mmHg",
      heartRate: "bpm",
      oxygen: "%",
    },
    directions: { below: "below", above: "above" },
    good: (label, value, unit) => `${label} is within the typical range at ${value}${unit}.`,
    concern: (label, direction, value, unit) =>
      `${label} is ${direction} the typical range at ${value}${unit}.`,
    recommendations: {
      temperature: "Rest, hydrate frequently, and re-check your temperature in a few hours.",
      pressure: "Reduce salt intake, avoid caffeine today, and re-measure while seated and calm.",
      heartRate: "Sit down for five minutes of slow breathing, then take the reading again.",
      oxygen: "Sit upright, breathe deeply, and monitor your oxygen level closely.",
      routine: "Keep your current routine - steady sleep, movement, and hydration are working.",
      logging: "Log your vitals at the same time each day for a more accurate trend.",
    },
    summary: {
      emergency:
        "One or more readings are far outside the safe range. This needs immediate medical attention rather than home monitoring.",
      good: "All five readings sit inside their typical ranges. Your latest vitals look consistent today.",
      attention: (count) =>
        `${count} of your readings fall outside the typical range. Nothing looks alarming, but it's worth watching over the next few days.`,
    },
  },
  my: {
    disclaimer:
      "\u0043\u0061\u0072\u0065\u0041\u0049 \u101e\u100a\u103a \u1000\u103b\u1014\u103a\u1038\u1019\u102c\u101b\u1031\u1038\u1006\u102d\u102f\u1004\u103a\u101b\u102c \u1021\u1001\u103b\u1000\u103a\u1021\u101c\u1000\u103a\u1019\u103b\u102c\u1038\u1000\u102d\u102f\u101e\u102c \u1015\u1031\u1038\u1015\u103c\u102e\u1038 \u1006\u101b\u102c\u101d\u1014\u103a\u1021\u1000\u103c\u1036\u1009\u102c\u100f\u103a\u1000\u102d\u102f \u1021\u1005\u102c\u1038\u1019\u1011\u102d\u102f\u1038\u1014\u102d\u102f\u1004\u103a\u1015\u102b\u104b",
    unavailableSummary:
      "\u101e\u1004\u1037\u103a\u1010\u102d\u102f\u1004\u103a\u1038\u1010\u102c\u1001\u103b\u1000\u103a\u1000\u102d\u102f \u101e\u102d\u1019\u103a\u1038\u1015\u103c\u102e\u1038\u1015\u102b\u1015\u103c\u102e\u104b \u101e\u102d\u102f\u1037\u101e\u1031\u102c\u103a CareAI \u1001\u103dဲ\u1001\u103c\u1019\u103a\u1038\u1005\u102d\u1010\u103a\u1016\u103c\u102c\u1019ှု \u101a\u1001\u102f \u101a\u102c\u101aီ\u1019ရ\u1014\u102d\u102fင်\u1015\u102b\u104b",
    unavailableRecommendations: [
      "\u1010\u102d\u102f\u1004\u103a\u1038\u1010\u102c\u1001\u103b\u1000\u103a\u1010\u1005်\u1001ု \u1019မျှော်လင့်\u1011ား\u101eကဲ့သို့ \u1019ဟုတ်ပါက \u1015ြန်လည်\u1010ိုင်းကြည့်ရန် စဉ်းစားပါ\u104b",
      "စိုးရိမ်မှုများ သို့မဟုတ် ရောဂါလက္ခဏာများ ရှိပါက အရည်အချင်းပြည့်မီသော ကျန်းမာရေးပညာရှင်နှင့် ဆက်သွယ်ပါ\u104b",
    ],
    labels: {
      temperature: "\u1000\u102d\u102f\u101a\u103a\u1021\u1015ူ\u1001ျိန်",
      systolic: "\u1021ပေါ်သွေးပေါင်",
      diastolic: "\u1021ောက်သွေးပေါင်",
      heartRate: "နှလုံးခုန်နှုန်း",
      oxygen: "\u1021ောက်ဆီဂျင်ပြည့်ဝမှု",
    },
    units: {
      temperature: "\u00b0\u0043",
      systolic: "\u006d\u006d\u0048\u0067",
      diastolic: "\u006d\u006d\u0048\u0067",
      heartRate: "\u0062\u0070\u006d",
      oxygen: "%",
    },
    directions: { below: "အောက်", above: "အထက်" },
    good: (label, value, unit) =>
      `${label} သည် ပုံမှန်အတိုင်းအတာအတွင်းရှိပြီး ${value}${unit} ဖြစ်သည်။`,
    concern: (label, direction, value, unit) =>
      `${label} သည် ပုံမှန်အတိုင်းအတာ၏ ${direction} တွင်ရှိပြီး ${value}${unit} ဖြစ်သည်။`,
    recommendations: {
      temperature: "အနားယူပါ၊ ရေများများသောက်ပါ၊ နာရီအနည်းငယ်အကြာတွင် ကိုယ်အပူချိန်ကို ပြန်တိုင်းပါ။",
      pressure: "ဆားလျှော့စားပါ၊ ယနေ့ ကဖိန်းဓာတ်ကို ရှောင်ပါ၊ ထိုင်ပြီး စိတ်အေးအေးထားကာ ပြန်တိုင်းပါ။",
      heartRate: "ငါးမိနစ်ခန့် ထိုင်ပြီး ဖြည်းဖြည်းအသက်ရှူပြီးနောက် ပြန်တိုင်းပါ။",
      oxygen: "မတ်မတ်ထိုင်ပါ၊ အသက်ပြင်းပြင်းရှူပါ၊ အောက်ဆီဂျင်အဆင့်ကို သေချာစောင့်ကြည့်ပါ။",
      routine: "လက်ရှိအလေ့အထများကို ဆက်လုပ်ပါ - အိပ်စက်မှု၊ လှုပ်ရှားမှုနှင့် ရေဓာတ်ထိန်းခြင်းက ကောင်းမွန်နေပါသည်။",
      logging: "ပြောင်းလဲမှုကို ပိုမိုတိကျစွာ မြင်နိုင်ရန် နေ့စဉ် အချိန်တူတွင် တိုင်းတာချက်များ မှတ်တမ်းတင်ပါ။",
    },
    summary: {
      emergency:
        "တိုင်းတာချက်တစ်ခု သို့မဟုတ် ထို့ထက်ပိုသည် လုံခြုံသောအတိုင်းအတာမှ အလွန်ဝေးနေပါသည်။ အိမ်တွင်စောင့်ကြည့်ခြင်းထက် ချက်ချင်းဆေးကုသမှုခံယူရန် လိုအပ်ပါသည်။",
      good: "တိုင်းတာချက်ငါးခုလုံးသည် ပုံမှန်အတိုင်းအတာအတွင်းရှိပါသည်။ သင့်နောက်ဆုံးတိုင်းတာချက်များသည် ယနေ့ တည်ငြိမ်နေပါသည်။",
      attention: (count) =>
        `သင့်တိုင်းတာချက် ${count} ခုသည် ပုံမှန်အတိုင်းအတာပြင်ပတွင်ရှိပါသည်။ အလွန်စိုးရိမ်စရာမဟုတ်သော်လည်း နောက်ရက်များတွင် စောင့်ကြည့်သင့်ပါသည်။`,
    },
  },
};

export function insightLanguage(language: LanguageCode): InsightLanguage {
  return language === "my" ? "my" : "en";
}

export function localizedDisclaimer(language: LanguageCode): string {
  return COPY[insightLanguage(language)].disclaimer;
}

export function localizedUnavailableSummary(language: LanguageCode): string {
  return COPY[insightLanguage(language)].unavailableSummary;
}

export function localizeVitalAnalysis(record: VitalRecord, language: LanguageCode): VitalAnalysis {
  if (record.analysis.provider === "openrouter" && record.analysis.aiStatus === "completed") {
    return record.analysis;
  }

  const localized = analyzeVitalsLocalized(record, language);
  return {
    ...record.analysis,
    summary:
      record.analysis.provider === "openrouter" && record.analysis.aiStatus === "failed"
        ? localizedUnavailableSummary(language)
        : localized.summary,
    good: localized.good,
    concerns: localized.concerns,
    recommendations:
      record.analysis.provider === "openrouter" && record.analysis.aiStatus === "failed"
        ? [...COPY[insightLanguage(language)].unavailableRecommendations]
        : localized.recommendations,
    disclaimer: localizedDisclaimer(language),
  };
}

export function localizeVitalRecord(record: VitalRecord, language: LanguageCode): VitalRecord {
  return { ...record, analysis: localizeVitalAnalysis(record, language) };
}

export function analyzeVitalsLocalized(input: VitalInput, language: LanguageCode): VitalAnalysis {
  const baseline = analyzeVitals(input);
  const copy = COPY[insightLanguage(language)];
  const good: string[] = [];
  const concerns: string[] = [];
  const recommendations: string[] = [];
  let deviations = 0;

  (Object.keys(RANGES) as Array<keyof VitalInput>).forEach((key) => {
    const value = input[key];
    const { min, max } = RANGES[key];
    const label = copy.labels[key];
    const unit = copy.units[key];
    if (value >= min && value <= max) {
      good.push(copy.good(label, value, unit));
    } else {
      deviations += 1;
      concerns.push(copy.concern(label, value < min ? copy.directions.below : copy.directions.above, value, unit));
    }
  });

  if (input.temperature > RANGES.temperature.max) recommendations.push(copy.recommendations.temperature);
  if (input.systolic > RANGES.systolic.max || input.diastolic > RANGES.diastolic.max) {
    recommendations.push(copy.recommendations.pressure);
  }
  if (input.heartRate > RANGES.heartRate.max) recommendations.push(copy.recommendations.heartRate);
  if (input.oxygen < RANGES.oxygen.min) recommendations.push(copy.recommendations.oxygen);
  if (recommendations.length === 0) recommendations.push(copy.recommendations.routine);
  recommendations.push(copy.recommendations.logging);

  return {
    ...baseline,
    summary: baseline.emergency
      ? copy.summary.emergency
      : deviations === 0
        ? copy.summary.good
        : copy.summary.attention(deviations),
    good,
    concerns,
    recommendations,
    disclaimer: copy.disclaimer,
  };
}
