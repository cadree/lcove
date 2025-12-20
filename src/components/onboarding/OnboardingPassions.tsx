import { useState, useEffect, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, ArrowLeft, X, Plus, Sparkles } from 'lucide-react';
import { OnboardingData } from '@/pages/Onboarding';

interface Props {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface Passion {
  id: string;
  name: string;
  category: string | null;
}

const MAX_PASSIONS = 10;
const MIN_PASSION_LENGTH = 2;
const MAX_PASSION_LENGTH = 32;

const OnboardingPassions = ({ data, updateData, onNext, onBack }: Props) => {
  const [suggestions, setSuggestions] = useState<Passion[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSuggestions = async () => {
      const { data: passionsData } = await supabase
        .from('passions')
        .select('*')
        .order('category', { ascending: true });
      
      if (passionsData) {
        setSuggestions(passionsData);
      }
      setLoading(false);
    };
    fetchSuggestions();
  }, []);

  const normalizePassion = (passion: string) => passion.trim().toLowerCase();

  const addPassion = (passionName: string) => {
    const trimmed = passionName.trim();
    setError('');

    if (trimmed.length < MIN_PASSION_LENGTH) {
      setError(`Passion must be at least ${MIN_PASSION_LENGTH} characters`);
      return false;
    }

    if (trimmed.length > MAX_PASSION_LENGTH) {
      setError(`Passion must be ${MAX_PASSION_LENGTH} characters or less`);
      return false;
    }

    if (data.passions.length >= MAX_PASSIONS) {
      setError(`You can add up to ${MAX_PASSIONS} passions`);
      return false;
    }

    const isDuplicate = data.passions.some(
      (p) => normalizePassion(p) === normalizePassion(trimmed)
    );

    if (isDuplicate) {
      setError('This passion is already added');
      return false;
    }

    updateData({ passions: [...data.passions, trimmed] });
    setInputValue('');
    return true;
  };

  const removePassion = (passionToRemove: string) => {
    updateData({ passions: data.passions.filter((p) => p !== passionToRemove) });
    setError('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
        addPassion(inputValue);
      }
    }
  };

  const handleSuggestionClick = (name: string) => {
    addPassion(name);
  };

  const isSuggestionSelected = (name: string) => {
    return data.passions.some((p) => normalizePassion(p) === normalizePassion(name));
  };

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-6 pb-36">
      <div className="max-w-2xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <p className="text-primary text-sm font-medium mb-2">Step 1 of 5</p>
          <h1 className="font-display text-3xl md:text-5xl text-foreground mb-3">
            What are you passionate about?
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Your passion can be anything — from farming to music to fashion — even if it doesn't fit a category yet.
          </p>
          <p className="text-muted-foreground/70 text-xs md:text-sm mt-2">
            You can always update this later.
          </p>
        </motion.div>

        {/* Custom Passion Input */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="relative">
            <Input
              type="text"
              placeholder="Type a passion and press Enter (e.g., Music Production, Urban Farming, Streetwear...)"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setError('');
              }}
              onKeyDown={handleKeyDown}
              className="h-12 pr-12 bg-secondary/50 border-border/50 focus:border-primary"
              maxLength={MAX_PASSION_LENGTH}
            />
            {inputValue.trim() && (
              <button
                type="button"
                onClick={() => addPassion(inputValue)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-primary hover:bg-primary/10 rounded-full transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
          
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-muted-foreground">
              Add as many as you like (up to {MAX_PASSIONS})
            </p>
            <p className="text-xs text-muted-foreground">
              {data.passions.length}/{MAX_PASSIONS}
            </p>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-destructive text-xs mt-2"
            >
              {error}
            </motion.p>
          )}
        </motion.div>

        {/* Selected Passions Tags */}
        <AnimatePresence>
          {data.passions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6"
            >
              <p className="text-sm font-medium text-foreground mb-3">Your passions:</p>
              <div className="flex flex-wrap gap-2">
                {data.passions.map((passion, index) => (
                  <motion.div
                    key={passion}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ delay: index * 0.02 }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-medium"
                  >
                    <span>{passion}</span>
                    <button
                      type="button"
                      onClick={() => removePassion(passion)}
                      className="ml-1 p-0.5 hover:bg-primary-foreground/20 rounded-full transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Suggestions Section */}
        {loading ? (
          <div className="flex justify-center py-10">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full"
            />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="w-4 h-4" />
              <p className="text-sm">Suggestions (optional) — tap to add</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {suggestions.slice(0, 20).map((suggestion, index) => {
                const isSelected = isSuggestionSelected(suggestion.name);
                return (
                  <motion.button
                    key={suggestion.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => !isSelected && handleSuggestionClick(suggestion.name)}
                    disabled={isSelected || data.passions.length >= MAX_PASSIONS}
                    className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                      isSelected
                        ? 'bg-primary/20 text-primary/50 cursor-not-allowed'
                        : data.passions.length >= MAX_PASSIONS
                        ? 'bg-secondary/50 text-muted-foreground/50 cursor-not-allowed'
                        : 'bg-secondary text-secondary-foreground hover:bg-accent hover:scale-105'
                    }`}
                  >
                    {suggestion.name}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Seriousness Slider */}
        {data.passions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 glass-strong rounded-2xl p-4 md:p-6"
          >
            <h3 className="font-display text-lg md:text-xl text-foreground mb-4">
              How serious are you about your passions?
            </h3>
            <div className="space-y-4">
              <Slider
                value={[data.passionSeriousness]}
                onValueChange={([value]) => updateData({ passionSeriousness: value })}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs md:text-sm text-muted-foreground">
                <span>Casual hobby</span>
                <span className="text-primary font-medium text-base md:text-lg">{data.passionSeriousness}</span>
                <span>Life dedication</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-background via-background/95 to-transparent">
        <div className="max-w-2xl mx-auto flex gap-3 md:gap-4">
          <Button
            onClick={onBack}
            variant="outline"
            className="h-12 px-4 md:px-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={onNext}
            disabled={data.passions.length === 0}
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

export default OnboardingPassions;
