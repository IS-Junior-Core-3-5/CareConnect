import { createFileRoute } from "@tanstack/react-router";
import { AiChat } from "@/components/AiChat";
import { AppShell } from "@/components/NavBar";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "AI Assistant — CareConnect" },
      {
        name: "description",
        content: "Chat with CareConnect's AI and ask for childcare recommendations that fit your family.",
      },
    ],
  }),
  component: AssistantPage,
});

function AssistantPage() {
  return (
    <AppShell>
      <AiChat page />
    </AppShell>
  );
}
