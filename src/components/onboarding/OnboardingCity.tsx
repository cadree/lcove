import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, ArrowLeft, MapPin, Check, X } from 'lucide-react';
import { OnboardingData } from '@/pages/Onboarding';
import { normalizeCity } from '@/lib/cityNormalization';

interface Props {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const popularCities = [
  'Los Angeles',
  'New York',
  'London',
  'Tokyo',
  'Paris',
  'Berlin',
  'Miami',
  'Atlanta',
  'Toronto',
  'Sydney',
  'Amsterdam',
  'Lagos',
];

const OnboardingCity = ({ data, updateData, onNext, onBack }: Props) => {
  // Track the input value separately from confirmed city
  const [inputValue, setInputValue] = useState(
    popularCities.includes(data.city) ? '' : data.city
  );
  // The confirmed city is stored in data.city
  const confirmedCity = data.city;
  const isConfirmed = confirmedCity.trim().length > 0;

  const confirmCity = (city: string) => {
    const trimmed = city.trim();
    if (trimmed.length >= 2) {
      // Normalize the city for consistent storage
      const { city_display, city_key } = normalizeCity(trimmed);
      updateData({ 
        city: city_display,
        cityDisplay: city_display,
        cityKey: city_key,
      });
      // Clear input if it matches what was just confirmed (custom input)
      if (!popularCities.includes(city_display)) {
        setInputValue(city_display);
      } else {
        setInputValue('');
      }
    }
  };

  const selectPopularCity = (city: string) => {
    // Popular cities are already clean, but normalize for consistency
    const { city_display, city_key } = normalizeCity(city);
    updateData({ 
      city: city_display,
      cityDisplay: city_display,
      cityKey: city_key,
    });
    setInputValue('');
  };

  const clearSelection = () => {
    updateData({ city: '' });
    setInputValue('');
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    // Don't auto-confirm while typing - wait for explicit confirmation
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim().length >= 2) {
      e.preventDefault();
      confirmCity(inputValue);
    }
  };

  const canConfirmInput = inputValue.trim().length >= 2 && inputValue.trim() !== confirmedCity;

  return (
    <div className="min-h-screen flex flex-col p-6 pb-32">
      <div className="max-w-2xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <p className="text-primary text-sm font-medium mb-2">Step 2 of 5</p>
          <h1 className="font-display text-4xl md:text-5xl text-foreground mb-2">
            Your City
          </h1>
          <p className="text-muted-foreground">
            Where are you based? Local connections are prioritized.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          {/* City Input with Confirm Button */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Enter your city"
                  value={inputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className={`pl-12 h-14 text-lg bg-input border-border focus:border-primary ${
                    isConfirmed && inputValue === confirmedCity ? 'border-primary/50' : ''
                  }`}
                />
              </div>
              <Button
                onClick={() => confirmCity(inputValue)}
                disabled={!canConfirmInput}
                className="h-14 px-4 bg-primary hover:bg-primary/90"
              >
                <Check className="h-5 w-5 mr-2" />
                Use this city
              </Button>
            </div>

            {/* Helper text when typing but not confirmed */}
            {inputValue.trim().length > 0 && inputValue.trim() !== confirmedCity && (
              <p className="text-sm text-muted-foreground">
                Type your city, then tap "Use this city" or press Enter
              </p>
            )}

            {/* Selected City Chip */}
            {isConfirmed && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary rounded-full border border-primary/30">
                  <MapPin className="h-4 w-4" />
                  <span className="font-medium">Selected: {confirmedCity}</span>
                  <button
                    onClick={clearSelection}
                    className="ml-1 p-0.5 hover:bg-primary/30 rounded-full transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Popular Cities */}
          <div>
            <p className="text-sm text-muted-foreground mb-4">Or select from popular creative hubs</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {popularCities.map((city, index) => {
                const isSelected = confirmedCity === city;
                return (
                  <motion.button
                    key={city}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => selectPopularCity(city)}
                    className={`p-4 rounded-xl text-left transition-all ${
                      isSelected
                        ? 'bg-primary text-primary-foreground glow-pink'
                        : 'bg-secondary text-secondary-foreground hover:bg-accent'
                    }`}
                  >
                    <span className="font-medium">{city}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background to-transparent">
        <div className="max-w-2xl mx-auto flex gap-4">
          <Button
            onClick={onBack}
            variant="outline"
            className="h-12 px-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={onNext}
            disabled={!isConfirmed}
            className="flex-1 h-12 bg-primary hover:bg-primary/90 glow-pink"
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingCity;
