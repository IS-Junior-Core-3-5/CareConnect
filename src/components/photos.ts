import guardianAngelArt from "@/assets/provider-artwork/guardian-angel.jpg";
import kidsVillageArt from "@/assets/provider-artwork/kids-village.jpg";
import lesPetitsArt from "@/assets/provider-artwork/les-petits.jpg";
import montessoriArt from "@/assets/provider-artwork/montessori.jpg";
import wayToGrowArt from "@/assets/provider-artwork/way-to-grow.jpg";
import type { CareType, Provider } from "@/lib/model";
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

const externalArtwork: Readonly<Record<string, string>> = {
  "les-petits-provo": lesPetitsArt,
  "kids-village-orem": kidsVillageArt,
  "guardian-angel-babysitting-utah": guardianAngelArt,
  "montessori-learning-center-lindon": montessoriArt,
  "way-to-grow-american-fork": wayToGrowArt,
};

const categoryArtwork: Record<CareType, string> = {
  Daycare: lesPetitsArt,
  Preschool: kidsVillageArt,
  Sitter: guardianAngelArt,
  "Family Friend": guardianAngelArt,
};

export function illustrationFor(provider: Pick<Provider, "id" | "listingOrigin" | "careType">) {
  if (provider.listingOrigin === "external" && Object.hasOwn(externalArtwork, provider.id)) {
    return externalArtwork[provider.id];
  }
  return categoryArtwork[provider.careType];
}

export function demoPhotoFor(provider: Pick<Provider, "id" | "isDemo">) {
  return provider.isDemo && /^careconnect-demo-[1-4]-[1-9][0-9]?$/.test(provider.id)
    ? `/demo-provider-photos/${provider.id}.jpg`
    : null;
}

const demoWordmarks = new Set([
  "careconnect-demo-1-4",
  "careconnect-demo-1-8",
  "careconnect-demo-1-14",
  "careconnect-demo-2-6",
  "careconnect-demo-2-13",
]);

export function hasDemoWordmark(id: string) {
  return demoWordmarks.has(id);
}

const demoActivities = new Map([
  ["careconnect-demo-1-1", "Making paper kites outdoors"],
  ["careconnect-demo-1-2", "Watering the garden together"],
  ["careconnect-demo-2-1", "Story time on the classroom rug"],
  ["careconnect-demo-2-4", "Painting at the classroom easel"],
  ["careconnect-demo-2-7", "Making music together"],
]);

export function demoActivityFor(provider: Pick<Provider, "id" | "isDemo">) {
  const caption = provider.isDemo ? demoActivities.get(provider.id) : undefined;
  return caption ? { caption, src: `/demo-provider-photos/${provider.id}-activity.jpg` } : null;
}
