import { supabase } from "@/integrations/supabase/client";

export const providerPhotoStorage = supabase.storage.from("provider-profile-photos");

export const providerPhotoExtensions = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
export const providerPhotoMaxBytes = 5 * 1024 * 1024;

export function providerPhotoUrl(path: string) {
  return providerPhotoStorage.getPublicUrl(path).data.publicUrl;
}
