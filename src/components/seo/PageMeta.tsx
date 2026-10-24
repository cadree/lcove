import { useEffect } from "react";

function setMeta(attr: "name" | "property", key: string, content: string) {
  let node = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(attr, key);
    document.head.appendChild(node);
  }
  node.setAttribute("content", content);
}

export function applyPageMeta(title: string, description: string, image?: string) {
  const card = image || "https://etherbylcove.com/og.png";
  document.title = title;
  setMeta("name", "description", description);
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", description);
  setMeta("property", "og:image", card);
  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", description);
  setMeta("name", "twitter:image", card);
  document.head.querySelector('meta[name="twitter:site"]')?.remove();
}

export function PageMeta({ title, description, image }: { title: string; description: string; image?: string }) {
  useEffect(() => {
    applyPageMeta(title, description, image);
  }, [title, description, image]);
  return null;
}
