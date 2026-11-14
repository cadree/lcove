import { useEffect } from "react";

const DEFAULT_IMAGE = "https://etherbylcove.com/og.png";

function setMeta(attr: "name" | "property", key: string, content: string) {
  let node = document.head.querySelector(`meta[${attr}="${key}"]`);
  const created = !node;
  const previous = node?.getAttribute("content") ?? null;
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(attr, key);
    document.head.appendChild(node);
  }
  node.setAttribute("content", content);
  return () => {
    if (!node) return;
    if (created) node.remove();
    else if (previous != null) node.setAttribute("content", previous);
  };
}

function setIcon(href: string | undefined) {
  const nodes = [...document.head.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]')];
  const previous = nodes.map((node) => [node, node.getAttribute("href")] as const);
  if (href) {
    for (const node of nodes) node.setAttribute("href", href);
  }
  return () => {
    for (const [node, value] of previous) {
      if (value) node.setAttribute("href", value);
    }
  };
}

/** image "" clears the card image. Omit image to keep the Ether card. */
function applyPageMeta(title: string, description: string, image?: string, icon?: string) {
  const previousTitle = document.title;
  document.title = title;
  const restore = [
    () => {
      document.title = previousTitle;
    },
    setMeta("name", "description", description),
    setMeta("property", "og:title", title),
    setMeta("property", "og:description", description),
    setMeta("name", "twitter:card", "summary_large_image"),
    setMeta("name", "twitter:title", title),
    setMeta("name", "twitter:description", description),
  ];
  const card = image === undefined ? DEFAULT_IMAGE : image;
  if (card) {
    restore.push(setMeta("property", "og:image", card), setMeta("name", "twitter:image", card));
  }
  document.head.querySelector('meta[name="twitter:site"]')?.remove();
  if (icon) restore.push(setIcon(icon));
  return () => {
    for (const undo of restore) undo();
  };
}

export function PageMeta({ title, description, image, icon }: { title: string; description: string; image?: string; icon?: string }) {
  useEffect(() => applyPageMeta(title, description, image, icon), [title, description, image, icon]);
  return null;
}
