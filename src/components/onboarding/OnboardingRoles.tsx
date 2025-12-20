import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { OnboardingData } from '@/pages/Onboarding';

interface Props {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface Role {
  id: string;
  name: string;
  category: string | null;
}

const OnboardingRoles = ({ data, updateData, onNext, onBack }: Props) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      const { data: rolesData } = await supabase
        .from('creative_roles')
        .select('*')
        .order('category', { ascending: true });
      
      if (rolesData) {
        setRoles(rolesData);
      }
      setLoading(false);
    };
    fetchRoles();
  }, []);

  const toggleRole = (name: string) => {
    const current = data.roles;
    if (current.includes(name)) {
      updateData({ roles: current.filter((r) => r !== name) });
    } else if (current.length < 5) {
      updateData({ roles: [...current, name] });
    }
  };

  const groupedRoles = roles.reduce((acc, role) => {
    const category = role.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(role);
    return acc;
  }, {} as Record<string, Role[]>);

  return (
    <div className="min-h-screen flex flex-col p-6 pb-32">
      <div className="max-w-2xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <p className="text-primary text-sm font-medium mb-2">Step 4 of 5</p>
          <h1 className="font-display text-4xl md:text-5xl text-foreground mb-2">
            Your Roles
          </h1>
          <p className="text-muted-foreground">
            How do you identify in the creative space? Select up to 5.
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
            {Object.entries(groupedRoles).map(([category, items], catIndex) => (
              <div key={category}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">{category}</h3>
                <div className="flex flex-wrap gap-2">
                  {items.map((role, index) => {
                    const isSelected = data.roles.includes(role.name);
                    return (
                      <motion.button
                        key={role.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: catIndex * 0.1 + index * 0.02 }}
                        onClick={() => toggleRole(role.name)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-primary text-primary-foreground glow-pink'
                            : 'bg-secondary text-secondary-foreground hover:bg-accent'
                        }`}
                      >
                        {isSelected && <Check className="inline-block w-3 h-3 mr-1" />}
                        {role.name}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-sm text-muted-foreground text-center"
        >
          {data.roles.length}/5 selected
        </motion.p>
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
            disabled={data.roles.length === 0}
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

export default OnboardingRoles;
