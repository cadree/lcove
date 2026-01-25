import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { homeItems, type HomeItem } from "@/config/homeItems";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface HomeSearchProps {
  onNavigate?: (itemId: string) => void;
}

export function HomeSearch({ onNavigate }: HomeSearchProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const filteredItems = query.trim()
    ? homeItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.description?.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const handleSelect = (item: HomeItem) => {
    onNavigate?.(item.id);
    navigate(item.route);
    setQuery("");
    setIsFocused(false);
    inputRef.current?.blur();
  };

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setQuery("");
        setIsFocused(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <div className="relative px-4">
      <div
        className={cn(
          "relative flex items-center gap-3 rounded-2xl border bg-card/50 backdrop-blur-sm transition-all duration-200",
          isFocused ? "border-primary/50 shadow-lg shadow-primary/5" : "border-border/50"
        )}
      >
        <Search className="absolute left-4 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search everything..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          className="h-12 border-0 bg-transparent pl-11 pr-10 text-base placeholder:text-muted-foreground/60 focus-visible:ring-0"
          aria-label="Search navigation"
        />
        <AnimatePresence>
          {query && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => setQuery("")}
              className="absolute right-3 p-1.5 rounded-full hover:bg-accent"
              aria-label="Clear search"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Search Results Dropdown */}
      <AnimatePresence>
        {isFocused && filteredItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute left-4 right-4 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border/50 bg-card shadow-xl"
          >
            {filteredItems.slice(0, 6).map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
                    index !== filteredItems.length - 1 && "border-b border-border/30"
                  )}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{item.label}</p>
                    {item.description && (
                      <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* No results */}
      <AnimatePresence>
        {isFocused && query.trim() && filteredItems.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute left-4 right-4 top-full z-50 mt-2 rounded-xl border border-border/50 bg-card p-4 text-center shadow-xl"
          >
            <p className="text-sm text-muted-foreground">No results for "{query}"</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
