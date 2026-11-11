import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/providers")({
  validateSearch: (search: Record<string, unknown>): { preview?: true } =>
    search.preview === true ? { preview: true } : {},
  component: () => <Outlet />,
});
