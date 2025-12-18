import { Button } from "@/components/ui/button";
import { 
  MapPin, 
  Calendar, 
  Briefcase, 
  User,
  Filter
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface CalendarFiltersProps {
  selectedCity: string;
  selectedState: string;
  selectedTypes: string[];
  cities: string[];
  states: string[];
  onCityChange: (city: string) => void;
  onStateChange: (state: string) => void;
  onTypesChange: (types: string[]) => void;
}

export function CalendarFilters({
  selectedCity,
  selectedState,
  selectedTypes,
  cities,
  states,
  onCityChange,
  onStateChange,
  onTypesChange,
}: CalendarFiltersProps) {
  const itemTypes = [
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'personal', label: 'Personal', icon: User },
  ];

  const toggleType = (typeId: string) => {
    if (selectedTypes.includes(typeId)) {
      onTypesChange(selectedTypes.filter(t => t !== typeId));
    } else {
      onTypesChange([...selectedTypes, typeId]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {/* City Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="glass" size="sm" className="gap-2">
            <MapPin className="w-4 h-4" />
            {selectedCity}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="glass-strong border-border/30 w-48 p-2">
          <div className="space-y-1">
            {cities.map(city => (
              <button
                key={city}
                onClick={() => onCityChange(city)}
                className={cn(
                  "w-full px-3 py-2 text-sm text-left rounded-lg transition-colors",
                  selectedCity === city 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-accent/50"
                )}
              >
                {city}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* State Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="glass" size="sm" className="gap-2">
            <MapPin className="w-4 h-4" />
            {selectedState}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="glass-strong border-border/30 w-48 p-2">
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {states.map(state => (
              <button
                key={state}
                onClick={() => onStateChange(state)}
                className={cn(
                  "w-full px-3 py-2 text-sm text-left rounded-lg transition-colors",
                  selectedState === state 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-accent/50"
                )}
              >
                {state}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Type Filters */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="glass" size="sm" className="gap-2">
            <Filter className="w-4 h-4" />
            {selectedTypes.length === 3 ? 'All Types' : `${selectedTypes.length} Types`}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="glass-strong border-border/30 w-48 p-2">
          <div className="space-y-1">
            {itemTypes.map(type => (
              <button
                key={type.id}
                onClick={() => toggleType(type.id)}
                className={cn(
                  "w-full px-3 py-2 text-sm text-left rounded-lg transition-colors flex items-center gap-2",
                  selectedTypes.includes(type.id)
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-accent/50"
                )}
              >
                <type.icon className="w-4 h-4" />
                {type.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
