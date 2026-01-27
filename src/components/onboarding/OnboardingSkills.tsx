import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, ArrowLeft, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { OnboardingData } from '@/pages/Onboarding';

interface Props {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface Skill {
  id: string;
  name: string;
  category: string | null;
}

const OnboardingSkills = ({ data, updateData, onNext, onBack }: Props) => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[OnboardingSkills] Fetching skills from Supabase...');
      console.log('[OnboardingSkills] Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
      
      const { data: skillsData, error: fetchError } = await supabase
        .from('skills')
        .select('id, name, category')
        .order('category', { ascending: true });
      
      if (fetchError) {
        console.error('[OnboardingSkills] Supabase error:', fetchError);
        setError(`Failed to load skills: ${fetchError.message}`);
        setSkills([]);
      } else if (!skillsData || skillsData.length === 0) {
        console.warn('[OnboardingSkills] No skills found in database');
        setError('No skills available. Please try again later.');
        setSkills([]);
      } else {
        console.log('[OnboardingSkills] Loaded skills:', skillsData.length);
        setSkills(skillsData);
        setError(null);
      }
    } catch (err) {
      console.error('[OnboardingSkills] Unexpected error:', err);
      setError('An unexpected error occurred. Please try again.');
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const toggleSkill = (name: string) => {
    const current = data.skills;
    if (current.includes(name)) {
      updateData({ skills: current.filter((s) => s !== name) });
    } else if (current.length < 10) {
      updateData({ skills: [...current, name] });
    }
  };

  const groupedSkills = skills.reduce((acc, skill) => {
    const category = skill.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(skill);
    return acc;
  }, {} as Record<string, Skill[]>);

  return (
    <div className="min-h-screen flex flex-col p-6 pb-32">
      <div className="max-w-2xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <p className="text-primary text-sm font-medium mb-2">Step 3 of 4</p>
          <h1 className="font-display text-4xl md:text-5xl text-foreground mb-2">
            Your Skills
          </h1>
          <p className="text-muted-foreground">
            Select up to 10 skills you bring to the table
          </p>
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full"
            />
            <p className="text-sm text-muted-foreground">Loading skills...</p>
          </div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-4"
          >
            <AlertCircle className="w-12 h-12 text-destructive/70" />
            <p className="text-muted-foreground text-center max-w-sm">{error}</p>
            <Button
              onClick={fetchSkills}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          </motion.div>
        ) : skills.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-4"
          >
            <p className="text-muted-foreground text-center">
              No skills found. You can skip this step for now.
            </p>
            <Button
              onClick={fetchSkills}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {Object.entries(groupedSkills).map(([category, items], catIndex) => (
              <div key={category}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">{category}</h3>
                <div className="flex flex-wrap gap-2">
                  {items.map((skill, index) => {
                    const isSelected = data.skills.includes(skill.name);
                    return (
                      <motion.button
                        key={skill.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: catIndex * 0.1 + index * 0.02 }}
                        onClick={() => toggleSkill(skill.name)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-primary text-primary-foreground glow-pink'
                            : 'bg-secondary text-secondary-foreground hover:bg-accent'
                        }`}
                      >
                        {isSelected && <Check className="inline-block w-3 h-3 mr-1" />}
                        {skill.name}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {!loading && !error && skills.length > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-6 text-sm text-muted-foreground text-center"
          >
            {data.skills.length}/10 selected
          </motion.p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background to-transparent">
        <div className="max-w-2xl mx-auto flex gap-3">
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
            variant="ghost"
            className="h-12 px-4 text-muted-foreground hover:text-foreground"
          >
            Skip for now
          </Button>
          <Button
            onClick={onNext}
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

export default OnboardingSkills;
