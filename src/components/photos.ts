import maya from "@/assets/maya.jpg";
import daniel from "@/assets/daniel.jpg";
import sunny from "@/assets/sunny.jpg";
import lantern from "@/assets/lantern.jpg";
import grace from "@/assets/grace.jpg";
import harborview from "@/assets/harborview.jpg";
import willow from "@/assets/willow.jpg";

export const photos: Record<string, string> = {
  maya,
  daniel,
  sunny,
  lantern,
  grace,
  harborview,
  willow,
};

export function photoFor(key: string | null) {
  return key ? (photos[key] ?? null) : null;
}
