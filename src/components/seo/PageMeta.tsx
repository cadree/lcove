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

export function applyPageMeta(title: string, description: string) {
  document.title = title;
  setMeta("name", "description", description);
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", description);
  setMeta("property", "og:image", "https://etherbylcove.com/og.png");
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", description);
  setMeta("name", "twitter:image", "https://etherbylcove.com/og.png");
  document.head.querySelector('meta[name="twitter:site"]')?.remove();
}

export function PageMeta({ title, description }: { title: string; description: string }) {
  useEffect(() => {
    applyPageMeta(title, description);
  }, [title, description]);
  return null;
}
