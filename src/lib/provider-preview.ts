import { useQuery, useQueryClient } from "@tanstack/react-query";
import { scheduleFromRows } from "@/lib/model";

export const previewSchedule = scheduleFromRows(
  [0, 2, 4].map((day_of_week) => ({ day_of_week, block: "Morning" })),
);

export function supportsPracticeRequest(id: string) {
  return id === "careconnect-demo-1-1" || id === "careconnect-demo-1-2";
}

const key = "careconnect-preview-favorites";
const empty: string[] = [];

export function usePreviewFavorites(enabled: boolean) {
  const queryClient = useQueryClient();
  const { data: favorites = empty } = useQuery({
    queryKey: [key],
    enabled: enabled && typeof window !== "undefined",
    staleTime: Infinity,
    queryFn: () => {
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
        return Array.isArray(saved) ? saved.filter((id) => typeof id === "string") : [];
      } catch {
        return [];
      }
    },
  });
  function toggle(id: string) {
    const current = queryClient.getQueryData<string[]>([key]) ?? empty;
    const next = current.includes(id) ? current.filter((saved) => saved !== id) : [...current, id];
    queryClient.setQueryData([key], next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // The current visit can still use favorites when browser storage is unavailable.
    }
  }
  return { favorites, toggle };
}
