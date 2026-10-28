import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatItemList, parseItemList } from "@/lib/itemList";

export function ItemListField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  const items = parseItemList(value);
  const [draft, setDraft] = useState("");

  const add = () => {
    const next = draft.trim();
    if (!next) return;
    onChange(formatItemList([...items, next]));
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-1">
              <span className="text-sm">{item}</span>
              <button
                type="button"
                className="mono-label inline-flex h-11 items-center text-[10px] text-muted-foreground"
                aria-label={`Remove ${item}`}
                onClick={() => onChange(formatItemList(items.filter((_, itemIndex) => itemIndex !== index)))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add}>Add</Button>
      </div>
    </div>
  );
}

export function XpExplainer() {
  return (
    <p className="text-xs text-muted-foreground">
      XP tracks creative progress. Levels unlock at 40, 100, 200, and 400. A small assist is about 10, a scene about 25, and a lead about 50. XP is not money and does not convert to credits.
    </p>
  );
}
