import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, ArrowLeft, MapPin } from 'lucide-react';
import { OnboardingData } from '@/pages/Onboarding';

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
  const [customCity, setCustomCity] = useState(
    popularCities.includes(data.city) ? '' : data.city
  );

  const selectCity = (city: string) => {
    updateData({ city });
    setCustomCity('');
  };

  const handleCustomCityChange = (value: string) => {
    setCustomCity(value);
    updateData({ city: value });
  };

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
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Enter your city"
              value={customCity}
              onChange={(e) => handleCustomCityChange(e.target.value)}
              className="pl-12 h-14 text-lg bg-input border-border focus:border-primary"
            />
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-4">Or select from popular creative hubs</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {popularCities.map((city, index) => {
                const isSelected = data.city === city;
                return (
                  <motion.button
                    key={city}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => selectCity(city)}
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
            disabled={!data.city.trim()}
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
