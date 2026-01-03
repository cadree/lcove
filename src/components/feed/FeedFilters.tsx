import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Briefcase, Image, Globe } from "lucide-react";

interface FeedFiltersProps {
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  postTypeFilter: 'all' | 'regular' | 'portfolio';
  setPostTypeFilter: (filter: 'all' | 'regular' | 'portfolio') => void;
  regionFilter: string | null;
  setRegionFilter: (region: string | null) => void;
  availableRegions: string[];
}

const mediaCategories = ["All", "Photo", "Video", "Text"];

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
    <div className="space-y-4 mb-5">
      {/* Post Type Toggle */}
      <div className="flex gap-2">
        <Button
          variant={postTypeFilter === 'all' ? "default" : "glass"}
          size="sm"
          onClick={() => setPostTypeFilter('all')}
          className="whitespace-nowrap"
        >
          All Posts
        </Button>
        <Button
          variant={postTypeFilter === 'regular' ? "default" : "glass"}
          size="sm"
          onClick={() => setPostTypeFilter('regular')}
          className="whitespace-nowrap"
        >
          <Image className="w-3 h-3 mr-1" />
          Regular
        </Button>
        <Button
          variant={postTypeFilter === 'portfolio' ? "default" : "glass"}
          size="sm"
          onClick={() => setPostTypeFilter('portfolio')}
          className="whitespace-nowrap"
        >
          <Briefcase className="w-3 h-3 mr-1" />
          Portfolio
        </Button>
      </div>

      {/* Region Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <Button
          variant={regionFilter === null ? "default" : "glass"}
          size="sm"
          onClick={() => setRegionFilter(null)}
          className="whitespace-nowrap"
        >
          <Globe className="w-3 h-3 mr-1" />
          All Regions
        </Button>
        {availableRegions.map((region) => (
          <Button
            key={region}
            variant={regionFilter === region ? "default" : "glass"}
            size="sm"
            onClick={() => setRegionFilter(region)}
            className="whitespace-nowrap"
          >
            <MapPin className="w-3 h-3 mr-1" />
            {region}
          </Button>
        ))}
      </div>

      {/* Media Type Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {mediaCategories.map((category, index) => (
          <motion.div
            key={category}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
          >
            <Button
              variant={activeCategory === category ? "default" : "glass"}
              size="sm"
              onClick={() => setActiveCategory(category)}
              className="whitespace-nowrap"
            >
              {category}
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
