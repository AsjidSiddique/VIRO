import { supabase } from "./supabase";
// Site settings — read from Supabase, cached in memory

let cache = {};

export async function getSetting(key) {
  if (cache[key]) return cache[key];
  try {
    if (!supabase) return null;
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (data) cache[key] = data.value;
    return data?.value || null;
  } catch {
    return null;
  }
}

export async function setSetting(key, value) {
  cache[key] = value;
  if (!supabase) return;
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function getAllSettings() {
  try {
    if (!supabase) return {};
    const { data } = await supabase.from("site_settings").select("*");
    const result = {};
    data?.forEach((row) => {
      result[row.key] = row.value;
      cache[row.key] = row.value;
    });
    return result;
  } catch {
    return {};
  }
}

export async function uploadHeroImage(file) {
  if (!supabase) throw new Error("Supabase not available");
  const ext = file.name.split(".").pop();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from("header_ads_imgs")
    .upload(name, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("header_ads_imgs").getPublicUrl(name);
  return { url: data.publicUrl, name };
}

export async function deleteHeroImage(filename) {
  if (!supabase) return;
  await supabase.storage.from("header_ads_imgs").remove([filename]);
}
