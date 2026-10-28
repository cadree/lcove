import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Copy, ExternalLink, Share2, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageMeta } from "@/components/seo/PageMeta";
import { shareLink, buildShareUrl } from "@/lib/shareLink";
import {
  PUBLIC_STORE_ITEM_SELECT,
  PUBLIC_STORE_SELECT,
  publicRow,
  type PublicStore,
  type PublicStoreItem,
} from "@/lib/consumerAccess";
import { readFunctionError } from "@/lib/functionError";
import { errorMessage } from "@/lib/errorMessage";
import { toast } from "sonner";

export default function PublicProductPage() {
  const { itemId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [buying, setBuying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["public-product", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const { data: item, error } = await supabase
        .from("store_items")
        .select(PUBLIC_STORE_ITEM_SELECT)
        .eq("id", itemId!)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      if (!item) return null;
      const row = publicRow<PublicStoreItem>(item);
      const { data: store } = await supabase
        .from("stores")
        .select(PUBLIC_STORE_SELECT)
        .eq("id", row.store_id)
        .eq("is_active", true)
        .maybeSingle();
      if (!store) return null;
      const shop = publicRow<PublicStore>(store);
      const { data: creator } = await supabase
        .from("consumer_creators")
        .select("display_name, avatar_url")
        .eq("user_id", shop.user_id)
        .maybeSingle();
      return {
        item: row,
        store: shop,
        creator,
      };
    },
  });

  useEffect(() => {
    const purchase = searchParams.get("purchase");
    if (!purchase) return;
    if (purchase === "success") {
      setNotice("Payment received. The order is confirmed when Stripe notifies Ether.");
    }
    if (purchase === "cancel") {
      setNotice("Checkout canceled.");
      const orderId = searchParams.get("order");
      const cancelToken = searchParams.get("cancel_token");
      if (orderId && cancelToken) {
        supabase.functions.invoke("purchase-store-item", {
          body: { action: "cancel", orderId, cancelToken },
        }).catch(() => undefined);
      }
    }
    const next = new URLSearchParams(searchParams);
    next.delete("purchase");
    next.delete("order");
    next.delete("cancel_token");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const shareUrl = buildShareUrl.product(itemId || "");

  const checkout = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!data?.item) return;
    if (!name.trim() || !email.trim()) {
      toast.error("Enter your name and email");
      return;
    }
    setBuying(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("purchase-store-item", {
        body: {
          itemId: data.item.id,
          paymentType: "cash",
          quantity,
          guestName: name.trim(),
          guestEmail: email.trim(),
        },
      });
      if (error || result?.error) {
        throw new Error(await readFunctionError(error, result, "Could not start checkout"));
      }
      if (!result?.url) throw new Error("Stripe did not return a checkout link");
      window.location.assign(result.url);
    } catch (err: unknown) {
      const message = errorMessage(err, "Could not start checkout");
      toast.error(message.toLowerCase().includes("limit") ? "Too many checkouts. Try again later." : message);
      setBuying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto min-h-screen max-w-lg space-y-4 bg-background px-4 py-10">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div>
          <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-display font-bold">Item not found</h1>
          <p className="mt-2 text-muted-foreground">This item is not available.</p>
        </div>
      </div>
    );
  }

  const { item, store, creator } = data;
  const image = item.images?.[0];
  const cash = Number(item.price) > 0 && store.accepts_cash && !item.external_url;
  const soldOut = item.type === "product" && item.inventory_count !== null && item.inventory_count < 1;
  const shipping = item.type === "product" ? Number(store.flat_shipping_cents || 0) : 0;
  const tax = Number(store.tax_line_cents || 0);

  return (
    <div className="min-h-screen bg-background">
      <PageMeta title={`${item.title} · Ether`} description={item.description || store.name} image={image?.startsWith("https://") ? image : undefined} />
      <div className="mx-auto max-w-lg px-4 py-6 pb-16">
        <div className="mb-4 flex justify-end gap-2">
          <Button variant="secondary" size="icon" onClick={() => shareLink({ url: shareUrl })}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" onClick={() => shareLink({ title: item.title, url: shareUrl })}>
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
        <Card className="overflow-hidden border-border/50">
          {image && <img src={image} alt={item.title} className="aspect-square w-full object-cover" />}
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge variant="outline" className="mb-2 capitalize">{item.type}</Badge>
                <h1 className="text-2xl font-display font-bold">{item.title}</h1>
                <p className="text-sm text-muted-foreground">{creator?.display_name || store.name}</p>
              </div>
              {cash && <p className="text-lg font-semibold">${Number(item.price).toFixed(2)}</p>}
            </div>
            {item.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.description}</p>}
            {item.location && <p className="text-sm text-muted-foreground">{item.location}</p>}
            {item.duration_minutes ? <p className="text-sm text-muted-foreground">{item.duration_minutes} minutes</p> : null}
            {(shipping > 0 || tax > 0) && cash && (
              <p className="text-xs text-muted-foreground">
                {shipping > 0 ? `Shipping $${(shipping / 100).toFixed(2)}. ` : ""}
                {tax > 0 ? `${store.tax_line_label || "Tax"} $${(tax / 100).toFixed(2)}.` : ""}
              </p>
            )}
            {notice && <p className="text-sm text-primary">{notice}</p>}
            {item.external_url && (
              <Button asChild className="w-full">
                <a href={item.external_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Buy on the creator's site
                </a>
              </Button>
            )}
            {cash && !soldOut && (
              <form onSubmit={checkout} className="space-y-3">
                <p className="text-sm text-muted-foreground">No account needed. Pay with a card.</p>
                <div>
                  <Label htmlFor="guest-name">Name</Label>
                  <Input id="guest-name" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="guest-email">Email</Label>
                  <Input id="guest-email" type="email" value={email} maxLength={255} onChange={(event) => setEmail(event.target.value)} required />
                </div>
                {item.type === "product" && (
                  <div>
                    <Label htmlFor="guest-qty">Quantity</Label>
                    <Input
                      id="guest-qty"
                      type="number"
                      min={1}
                      max={Math.min(10, item.inventory_count ?? 10)}
                      value={quantity}
                      onChange={(event) => setQuantity(Number(event.target.value))}
                    />
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={buying}>
                  {buying ? "Redirecting…" : "Checkout"}
                </Button>
              </form>
            )}
            {soldOut && <p className="text-sm text-muted-foreground">This item is sold out.</p>}
            {!cash && !item.external_url && (
              <p className="text-sm text-muted-foreground">Card checkout is not available for this item.</p>
            )}
            <Button variant="outline" className="w-full" asChild>
              <Link to="/auth">Sign in to pay with credits</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
