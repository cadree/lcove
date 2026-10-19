export const NUANCE_STORE_URL = "https://nuancebylcove.com";

export const GOLD_LEGACY_NECKLACE_ITEM = "gold-legacy-necklace";

export const NUANCE_BRAND_LINE =
  "The world of LCOVE will speak through the clothes.";

export interface NuanceProduct {
  id: string;
  name: string;
  priceLabel: string | null;
  soldOut: boolean;
  details: string[];
  href: string;
  image: string | null;
  imageAlt: string;
  interestItem: string | null;
}

// Confirmed line facts only. Photos and page links are the public Shopify
// product records for these same pieces.
export const nuanceProducts: NuanceProduct[] = [
  {
    id: "dynasty-denim",
    name: "Dynasty Denim",
    priceLabel: "$79.99",
    soldOut: false,
    details: [],
    href: "https://nuancebylcove.com/products/dynasty-denim",
    image: "/nuance/dynasty-denim.png",
    imageAlt: "Dynasty Denim",
    interestItem: null,
  },
  {
    id: "legacy-bracelet",
    name: "Legacy Bracelet",
    priceLabel: "$40",
    soldOut: false,
    details: [],
    href: "https://nuancebylcove.com/products/legacy-bracelet",
    image: "/nuance/legacy-bracelet.jpg",
    imageAlt: "Legacy Bracelet",
    interestItem: null,
  },
  {
    id: "legacy-necklace-silver",
    name: "Legacy Necklace",
    priceLabel: "$99",
    soldOut: false,
    details: ["Silver", "316 stainless steel", 'Bear charm, "Novi\'s Mask"'],
    href: "https://nuancebylcove.com/products/legacy-necklace-1",
    image: "/nuance/legacy-necklace-silver.png",
    imageAlt: "Legacy Necklace, silver",
    interestItem: null,
  },
  {
    id: "legacy-necklace-gold",
    name: "Gold Legacy Necklace",
    priceLabel: null,
    soldOut: true,
    details: [],
    href: "https://nuancebylcove.com/products/legacy-necklace-gold",
    image: "/nuance/legacy-necklace-gold.jpg",
    imageAlt: "Gold Legacy Necklace",
    interestItem: GOLD_LEGACY_NECKLACE_ITEM,
  },
];
