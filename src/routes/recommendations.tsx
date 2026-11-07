import { createFileRoute } from "@tanstack/react-router";
import { AiChat } from "@/components/AiChat";
import { AiRecommendations } from "@/components/AiRecommendations";
import { AppShell } from "@/components/NavBar";

export const Route = createFileRoute("/recommendations")({
  head: () => ({
    meta: [
      { title: "Recommendations — CareConnect" },
      {
        name: "description",
        content: "Get AI-powered child care recommendations and ask questions about providers.",
      },
    ],
  }),
  component: RecommendationsPage,
});

function RecommendationsPage() {
  return (
    <AppShell>
      <div className="space-y-8 py-8">
        <AiRecommendations />
        <AiChat />
      </div>
    </AppShell>
  );
}
