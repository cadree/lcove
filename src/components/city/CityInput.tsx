import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { resolveCity, suggestCities } from "@/lib/cities";
import { cn } from "@/lib/utils";

interface CityInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export function CityInput({
  id,
  value,
  onChange,
  placeholder = "Where are you based?",
  className,
  inputClassName,
}: CityInputProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const suggestions = useMemo(() => (open ? suggestCities(value) : []), [open, value]);
  const resolved = useMemo(() => resolveCity(value), [value]);
  const hint = resolved.confidence === "fuzzy" ? resolved.suggestion : null;
  const showHint = Boolean(hint && value.trim().toLowerCase() !== hint.label.toLowerCase());

  const choose = (label: string) => {
    onChange(label);
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-autocomplete="list"
        aria-controls={id ? `${id}-cities` : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => {
          setOpen(true);
          setActiveIndex(0);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && suggestions.length > 0) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) => (index + 1) % suggestions.length);
          } else if (event.key === "ArrowUp" && suggestions.length > 0) {
            event.preventDefault();
            setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
          } else if (event.key === "Enter" && open && suggestions.length > 0) {
            event.preventDefault();
            choose(suggestions[Math.min(activeIndex, suggestions.length - 1)].label);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className={cn("bg-background/50", inputClassName)}
      />
      {open && suggestions.length > 0 && (
        <ul
          id={id ? `${id}-cities` : undefined}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-popover p-1 shadow-lg"
        >
          {suggestions.map((city, index) => (
            <li key={city.key} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(city.label)}
                className={cn(
                  "flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm",
                  index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                )}
              >
                {city.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {showHint && hint && (
        <button
          type="button"
          onClick={() => choose(hint.label)}
          className="mt-2 min-h-11 text-left text-sm text-primary underline-offset-2 hover:underline"
        >
          Did you mean {hint.label}?
        </button>
      )}
    </div>
  );
}
