import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  importStatusMessage,
  linkCardFromOpenGraph,
  mapShopifyProducts,
  pageUrl,
  parseOpenGraph,
  shopHost,
} from "../_shared/store-import.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function readHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error("That website did not respond");
  const text = await response.text();
  return text.slice(0, 500_000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let ownedStoreId: string | null = null;

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
    ownedStoreId = store.id;

    const host = shopHost(shopUrl || store.shopify_store_url || "");
    const site = pageUrl(shopUrl || store.shopify_store_url || host);
    const productsUrl = `https://${host}/products.json?limit=250`;
    const response = await fetch(productsUrl, {
      headers: { accept: "application/json" },
      redirect: "follow",
    });

    let rows = null;
    let source: "shopify" | "link" = "link";
    if (response.ok) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("json") || contentType.includes("javascript")) {
        try {
          rows = mapShopifyProducts(await response.json(), host);
          if (rows) source = "shopify";
        } catch {
          rows = null;
        }
      }
    }

    if (!rows) {
      const html = await readHtml(site);
      const card = linkCardFromOpenGraph(parseOpenGraph(html, site));
      if (!card) {
        throw new Error("That website did not publish a Shopify catalog or a page preview");
      }
      rows = [card];
      source = "link";
    }

    let imported = 0;
    for (const row of rows) {
      const { data: existing } = await supabaseAdmin
        .from("store_items")
        .select("id")
        .eq("store_id", storeId)
        .eq("external_handle", row.external_handle)
        .maybeSingle();

      const record = { ...row, store_id: storeId };
      if (existing) {
        const { error } = await supabaseAdmin.from("store_items").update(record).eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabaseAdmin.from("store_items").insert(record);
        if (error) throw new Error(error.message);
      }
      imported += 1;
    }

    const message = importStatusMessage(source, imported);
    const status = source === "shopify" ? "imported" : "link";
    const visibleUrl = source === "shopify" ? host : site;
    const statusUpdate = {
      shopify_store_url: visibleUrl,
      website_url: site,
      import_status: status,
      import_error: null,
      import_count: imported,
      imported_at: new Date().toISOString(),
    };
    const { error: statusError } = await supabaseAdmin.from("stores").update(statusUpdate).eq("id", storeId);
    if (statusError) {
      await supabaseAdmin.from("stores").update({ shopify_store_url: visibleUrl }).eq("id", storeId);
    }

    return new Response(JSON.stringify({
      imported,
      shop: host,
      source,
      status,
      message,
      website: site,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (ownedStoreId) {
      await supabaseAdmin
        .from("stores")
        .update({
          import_status: "failed",
          import_error: message.slice(0, 500),
          import_count: 0,
        })
        .eq("id", ownedStoreId);
    }
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
