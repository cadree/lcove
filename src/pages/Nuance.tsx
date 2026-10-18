import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { GoldInterestForm } from "@/components/nuance/GoldInterestForm";
import { useAuth } from "@/contexts/AuthContext";
import { NUANCE_BRAND_LINE, NUANCE_STORE_URL, nuanceProducts, type NuanceProduct } from "@/data/nuance";

const Nuance = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(user ? "/feed" : "/");
  };

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={goBack}
            className="mb-4"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#F5A6CF]">
            Nuance by LCOVE
          </p>
          <h1 className="font-display text-4xl sm:text-5xl mt-2">Nuance</h1>
          <p className="font-display text-xl sm:text-2xl italic text-foreground/90 mt-3 max-w-xl">
            {NUANCE_BRAND_LINE}
          </p>
          <span className="mt-4 block h-px w-16 bg-[#F5A6CF]" aria-hidden="true" />
          <p className="mt-4 max-w-xl text-sm text-muted-foreground leading-relaxed">
            Buying opens{" "}
            <a
              href={NUANCE_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              nuancebylcove.com
            </a>
            . Ether does not take payment for these pieces.
          </p>
        </motion.header>

        <div className="grid gap-4 sm:grid-cols-2">
          {nuanceProducts.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} />
          ))}
        </div>
      </div>
    </PageLayout>
  );
};

function ProductCard({ product, index }: { product: NuanceProduct; index: number }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(product.image) && !imageFailed;

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index }}
      className="overflow-hidden rounded-2xl border border-border/40 bg-card"
      style={product.soldOut ? { boxShadow: "inset 3px 0 0 #F5A6CF" } : undefined}
    >
      {showImage ? (
        <img
          src={product.image ?? undefined}
          alt={product.imageAlt}
          className="aspect-[4/5] w-full object-cover bg-muted"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="aspect-[4/5] w-full bg-muted flex items-center justify-center px-6">
          <p className="font-display text-2xl text-center text-foreground/80">{product.name}</p>
        </div>
      )}

      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl leading-tight">{product.name}</h2>
          {product.priceLabel ? (
            <p className="text-sm font-medium shrink-0">{product.priceLabel}</p>
          ) : null}
        </div>

        {product.details.length > 0 ? (
          <ul className="text-sm text-muted-foreground space-y-1">
            {product.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        ) : null}

        {product.soldOut ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed">
              Sold out. Everyone who joins the interest list gets{" "}
              <span className="text-[#F5A6CF] font-medium">40% off</span> when pre-orders open.
            </p>
            <GoldInterestForm />
          </div>
        ) : null}

        <Button asChild variant="outline" className="w-full">
          <a href={product.href} target="_blank" rel="noopener noreferrer">
            View on Nuance
            <ExternalLink />
          </a>
        </Button>
      </div>
    </motion.article>
  );
}

export default Nuance;
