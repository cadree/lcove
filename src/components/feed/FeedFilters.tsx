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
  availableRegions: string[];
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
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      {/* Post Type Select */}
      <Select 
        value={postTypeFilter} 
        onValueChange={(val) => setPostTypeFilter(val as 'all' | 'regular' | 'portfolio')}
      >
        <SelectTrigger className="w-[130px] h-9 glass border-0 pl-3 gap-2">
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
        <SelectTrigger className="w-[150px] h-9 glass border-0 pl-3 gap-2">
          <MapPin className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="Region" />
        </SelectTrigger>
        <SelectContent className="bg-popover">
          <SelectItem value="all">All Regions</SelectItem>
          {availableRegions.map((region) => (
            <SelectItem key={region} value={region}>
              {region}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Media Type Chips - compact inline */}
      <div className="flex gap-1.5 ml-auto">
        {["All", "Photo", "Video", "Text"].map((category) => (
          <Button
            key={category}
            variant={activeCategory === category ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveCategory(category)}
            className="h-8 px-3 text-xs"
          >
            {category}
          </Button>
        ))}
      </div>
    </div>
  );
}
