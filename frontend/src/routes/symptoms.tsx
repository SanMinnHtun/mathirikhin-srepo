import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/app/PageHeader";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SeniorSymptomChecker } from "@/components/SeniorSymptomChecker";

export const Route = createFileRoute("/symptoms")({
  head: () => ({
    meta: [
      { title: "Symptom Check — CareAI" },
      {
        name: "description",
        content: "A clear, accessible symptom questionnaire with informational next steps.",
      },
    ],
  }),
  component: SymptomsPage,
});

function SymptomsPage() {
  const { t } = useTranslation();
  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <PageHeader
          eyebrow={t("symptomCheck.eyebrow")}
          title={t("symptomCheck.title")}
          subtitle={t("symptomCheck.subtitle")}
        />
        <SeniorSymptomChecker />
      </div>
    </ProtectedRoute>
  );
}
