import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Filter } from "lucide-react";

interface FeedFiltersProps {
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  postTypeFilter: 'all' | 'regular' | 'portfolio';
  setPostTypeFilter: (filter: 'all' | 'regular' | 'portfolio') => void;
  regionFilter: string | null;
  setRegionFilter: (region: string | null) => void;
  availableRegions: Array<{ key: string; display: string }>;
}

export function FeedFilters({
  activeCategory,
  setActiveCategory,
  postTypeFilter,
  setPostTypeFilter,
  regionFilter,
  setRegionFilter,
  availableRegions,
}: FeedFiltersProps) {
  return (
    <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {/* Post Type Select */}
      <Select 
        value={postTypeFilter} 
        onValueChange={(val) => setPostTypeFilter(val as 'all' | 'regular' | 'portfolio')}
      >
        <SelectTrigger className="h-11 w-[8.5rem] shrink-0 gap-2 border border-border bg-card/70 pl-3">
          <Filter className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent className="bg-popover">
          <SelectItem value="all">All Posts</SelectItem>
          <SelectItem value="regular">Regular</SelectItem>
          <SelectItem value="portfolio">Portfolio</SelectItem>
        </SelectContent>
      </Select>

      {/* Region Select */}
      <Select 
        value={regionFilter || "all"} 
        onValueChange={(val) => setRegionFilter(val === "all" ? null : val)}
      >
        <SelectTrigger className="h-11 w-[8.5rem] shrink-0 gap-2 border border-border bg-card/70 pl-3">
          <MapPin className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="Region" />
        </SelectTrigger>
        <SelectContent className="bg-popover">
          <SelectItem value="all">All Regions</SelectItem>
          {availableRegions.map((region) => (
            <SelectItem key={region.key} value={region.key}>
              {region.display}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Media Type Chips - compact inline */}
      <div className="flex shrink-0 gap-1.5">
        {["All", "Photo", "Video", "Text"].map((category) => (
          <Button
            key={category}
            variant={activeCategory === category ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveCategory(category)}
            className="min-h-11 h-11 px-3 text-xs"
          >
            {category}
          </Button>
        ))}
      </div>
    </div>
  );
}
