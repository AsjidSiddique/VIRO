import { supabase } from "./supabase";

export async function validateCoupon(code, subtotal) {
  if (!code?.trim()) return { valid: false, error: "Enter a coupon code" };
  if (!supabase) return { valid: false, error: "Service unavailable" };

  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .eq("enabled", true)
    .single();

  if (error || !data) return { valid: false, error: "Invalid coupon code" };

  if (data.starts_at && new Date(data.starts_at) > new Date())
    return {
      valid: false,
      error: `Coupon valid from ${new Date(data.starts_at).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}`,
    };

  if (data.expires_at && new Date(data.expires_at) < new Date())
    return { valid: false, error: "This coupon has expired" };

  if (data.max_uses !== null && data.used_count >= data.max_uses)
    return { valid: false, error: "Coupon usage limit reached" };

  if (data.min_order && subtotal < data.min_order)
    return {
      valid: false,
      error: `Minimum order Rs.${data.min_order.toLocaleString()} required`,
    };

  const discount =
    data.type === "percent"
      ? Math.round((subtotal * data.value) / 100)
      : Math.min(data.value, subtotal);

  return { valid: true, coupon: data, discount };
}

// redeemCoupon — increments usage count via RPC.
// IMPORTANT: This MUST be awaited in placeOrder(). If it fails, placeOrder()
// should catch the error — otherwise one-use coupons become infinite-use.
export async function redeemCoupon(couponId) {
  if (!supabase) throw new Error("Supabase unavailable");

  const { error } = await supabase.rpc("redeem_coupon", { p_coupon_id: couponId });

  if (error) {
    console.error("[redeemCoupon] RPC failed — usage NOT incremented:", error.message);
    // Belt + suspenders: fetch current count, then increment directly
    try {
      const { data: current } = await supabase
        .from("coupons").select("used_count").eq("id", couponId).single()
      const { error: directErr } = await supabase
        .from("coupons")
        .update({ used_count: (current?.used_count ?? 0) + 1 })
        .eq("id", couponId)
      if (directErr) throw new Error("Coupon redemption failed: " + directErr.message)
    } catch (fallbackErr) {
      throw new Error("Coupon redemption failed: " + fallbackErr.message)
    }
  }
  return { ok: true };
}
