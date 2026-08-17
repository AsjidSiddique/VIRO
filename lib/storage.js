import { supabase } from "./supabase";

const BUCKET = "products_img";

// Canvas-based image compression — runs in browser before upload.
// Resizes to maxWidth (keeps aspect ratio), converts to WebP at given quality.
// A 4MB phone photo → ~150KB WebP. Zero server cost, instant for users.
async function compressImage(file, maxWidth, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(resolve, "image/webp", quality);
    };
    img.src = url;
  });
}

export async function uploadProductImage(file, productCount = null) {
  if (!supabase) throw new Error("Supabase not available");
  // Compress: max 1200px wide, 0.82 quality → great sharpness, ~100-200KB
  const compressed = await compressImage(file, 1200, 0.82);

  // Filename: product-18-<timestamp>.webp
  // Timestamp ensures uniqueness — no conflicts even if re-uploading same product
  const base = productCount != null ? `product-${productCount}` : 'product'
  const safeName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 24)
  const filePath = `products/${base}-${safeName}-${Date.now()}.webp`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, compressed, { contentType: "image/webp", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function deleteProductImage(publicUrl) {
  if (!supabase) return;
  const marker = `/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const path = publicUrl.slice(idx + marker.length);
  await supabase.storage.from(BUCKET).remove([path]);
}

const CAT_BUCKET = "products_img";

export async function uploadCategoryImage(file) {
  if (!supabase) throw new Error("Supabase not available");
  // Compress category images too: max 800px (they display as small icons/thumbnails)
  const compressed = await compressImage(file, 800, 0.85);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
  const path = `categories/${filename}`;
  const { error } = await supabase.storage
    .from(CAT_BUCKET)
    .upload(path, compressed, { contentType: "image/webp", cacheControl: "3600", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(CAT_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ── Hero section images — stored in the dedicated hero_section bucket ─────────
const HERO_BUCKET = "hero_section";

export async function uploadHeroImage(file) {
  if (!supabase) throw new Error("Supabase not available");
  // Compress hero images: max 1400px wide (full-width banners), good quality
  const compressed = await compressImage(file, 1400, 0.88);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
  const { error } = await supabase.storage
    .from(HERO_BUCKET)
    .upload(filename, compressed, { contentType: "image/webp", cacheControl: "3600", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(HERO_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

export async function deleteHeroImage(publicUrl) {
  if (!supabase) return;
  const marker = `/${HERO_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const path = publicUrl.slice(idx + marker.length);
  await supabase.storage.from(HERO_BUCKET).remove([path]);
}

// ── Promo popup banner image — own dedicated bucket ──────────────────────
// NOTE: this bucket must exist in Supabase Storage before deploy — it is
// NOT auto-created by this code. Create it in the Supabase dashboard:
//   Storage → New bucket → name: promo_popup → Public bucket: ON
// (mirrors how hero_section / products_img were set up).
const PROMO_BUCKET = "promo_popup";

export async function uploadPromoPopupImage(file) {
  if (!supabase) throw new Error("Supabase not available");
  const compressed = await compressImage(file, 900, 0.88);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
  const { error } = await supabase.storage
    .from(PROMO_BUCKET)
    .upload(filename, compressed, { contentType: "image/webp", cacheControl: "3600", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(PROMO_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

export async function deletePromoPopupImage(publicUrl) {
  if (!supabase) return;
  const marker = `/${PROMO_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const path = publicUrl.slice(idx + marker.length);
  await supabase.storage.from(PROMO_BUCKET).remove([path]);
}

// ── Review screenshots — admin-attached proof-of-review images (e.g. a
// WhatsApp screenshot from a real customer), shown on the product page
// alongside normal text reviews. Bucket must exist in Supabase Storage
// before use — create it in the dashboard: Storage → New bucket →
// name: Reviews → Public bucket: ON (mirrors hero_section/promo_popup).
const REVIEW_BUCKET = "Reviews";

export async function uploadReviewScreenshot(file) {
  if (!supabase) throw new Error("Supabase not available");
  // Lighter compression than product photos — these are just proof
  // screenshots, not merchandise shots people zoom into.
  const compressed = await compressImage(file, 900, 0.82);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
  const { error } = await supabase.storage
    .from(REVIEW_BUCKET)
    .upload(filename, compressed, { contentType: "image/webp", cacheControl: "3600", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(REVIEW_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

export async function deleteReviewScreenshot(publicUrl) {
  if (!supabase) return;
  const marker = `/${REVIEW_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const path = publicUrl.slice(idx + marker.length);
  await supabase.storage.from(REVIEW_BUCKET).remove([path]);
}

// ── Deal Box hero/bundle image — reuses the existing products_img bucket
// (already public, no new bucket to create) under its own deals/ folder ──
const DEAL_BUCKET = "products_img";

export async function uploadDealBoxImage(file) {
  if (!supabase) throw new Error("Supabase not available");
  const compressed = await compressImage(file, 1000, 0.85);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
  const path = `deals/${filename}`;
  const { error } = await supabase.storage
    .from(DEAL_BUCKET)
    .upload(path, compressed, { contentType: "image/webp", cacheControl: "3600", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(DEAL_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteDealBoxImage(publicUrl) {
  if (!supabase) return;
  const marker = `/${DEAL_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const path = publicUrl.slice(idx + marker.length);
  await supabase.storage.from(DEAL_BUCKET).remove([path]);
}
