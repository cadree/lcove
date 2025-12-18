import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
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

const OnboardingPassions = ({ data, updateData, onNext, onBack }: Props) => {
  const [passions, setPassions] = useState<Passion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPassions = async () => {
      const { data: passionsData } = await supabase
        .from('passions')
        .select('*')
        .order('category', { ascending: true });
      
      if (passionsData) {
        setPassions(passionsData);
      }
      setLoading(false);
    };
    fetchPassions();
  }, []);

  const togglePassion = (name: string) => {
    const current = data.passions;
    if (current.includes(name)) {
      updateData({ passions: current.filter((p) => p !== name) });
    } else {
      updateData({ passions: [...current, name] });
    }
  };

  const groupedPassions = passions.reduce((acc, passion) => {
    const category = passion.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(passion);
    return acc;
  }, {} as Record<string, Passion[]>);

  return (
    <div className="min-h-screen flex flex-col p-6 pb-32">
      <div className="max-w-2xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <p className="text-primary text-sm font-medium mb-2">Step 1 of 5</p>
          <h1 className="font-display text-4xl md:text-5xl text-foreground mb-2">
            Your Passions
          </h1>
          <p className="text-muted-foreground">
            Select the creative passions that define you
          </p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-20">
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
            className="space-y-6"
          >
            {Object.entries(groupedPassions).map(([category, items], catIndex) => (
              <div key={category}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">{category}</h3>
                <div className="flex flex-wrap gap-2">
                  {items.map((passion, index) => {
                    const isSelected = data.passions.includes(passion.name);
                    return (
                      <motion.button
                        key={passion.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: catIndex * 0.1 + index * 0.02 }}
                        onClick={() => togglePassion(passion.name)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-primary text-primary-foreground glow-pink'
                            : 'bg-secondary text-secondary-foreground hover:bg-accent'
                        }`}
                      >
                        {isSelected && <Check className="inline-block w-3 h-3 mr-1" />}
                        {passion.name}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {data.passions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10 glass-strong rounded-2xl p-6"
          >
            <h3 className="font-display text-xl text-foreground mb-4">
              How serious are you about your passion?
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
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Casual hobby</span>
                <span className="text-primary font-medium text-lg">{data.passionSeriousness}</span>
                <span>Life dedication</span>
              </div>
            </div>
          </motion.div>
        )}
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
