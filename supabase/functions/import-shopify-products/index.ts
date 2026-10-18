import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function shopHost(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Shop URL is required");
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProto);
  } catch {
    throw new Error("Shop URL is not valid");
  }
  if (url.username || url.password) throw new Error("Shop URL is not valid");
  const host = url.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Shop URL is not valid");
  }
  if (host.includes(":") || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    throw new Error("Shop URL is not valid");
  }
  return host;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error("Authentication failed");

    const { storeId, shopUrl } = await req.json();
    if (!storeId) throw new Error("Store ID is required");

    const { data: store, error: storeError } = await supabaseAdmin
      .from("stores")
      .select("id, user_id, shopify_store_url")
      .eq("id", storeId)
      .single();
    if (storeError || !store || store.user_id !== user.id) {
      throw new Error("You don't own this store");
    }

    const host = shopHost(shopUrl || store.shopify_store_url || "");
    const productsUrl = `https://${host}/products.json?limit=250`;
    const response = await fetch(productsUrl, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error("That shop did not publish a public product list");
    }
    const body = await response.json();
    const products = Array.isArray(body?.products) ? body.products : [];

    let imported = 0;
    for (const product of products) {
      const handle = typeof product.handle === "string" ? product.handle.trim() : "";
      const title = typeof product.title === "string" ? product.title.trim() : "";
      if (!handle || !title) continue;
      const variant = Array.isArray(product.variants) ? product.variants[0] : null;
      const price = Number(variant?.price ?? 0);
      const image = Array.isArray(product.images) && product.images[0]?.src
        ? String(product.images[0].src)
        : null;
      const externalUrl = `https://${host}/products/${handle}`;

      const { data: existing } = await supabaseAdmin
        .from("store_items")
        .select("id")
        .eq("store_id", storeId)
        .eq("external_handle", handle)
        .maybeSingle();

      const row = {
        store_id: storeId,
        type: "product",
        title,
        price: Number.isFinite(price) ? price : 0,
        credits_price: 0,
        currency: "USD",
        images: image ? [image] : [],
        is_active: true,
        external_source: "shopify",
        external_handle: handle,
        external_url: externalUrl,
        shopify_product_id: product.id != null ? String(product.id) : null,
      };

      if (existing) {
        const { error } = await supabaseAdmin.from("store_items").update(row).eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabaseAdmin.from("store_items").insert(row);
        if (error) throw new Error(error.message);
      }
      imported += 1;
    }

    await supabaseAdmin
      .from("stores")
      .update({ shopify_store_url: host })
      .eq("id", storeId);

    return new Response(JSON.stringify({ imported, shop: host }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
