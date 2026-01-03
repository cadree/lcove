import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, ArrowLeft, User } from 'lucide-react';

interface Props {
  displayName: string;
  updateName: (name: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const OnboardingName = ({ displayName, updateName, onNext, onBack }: Props) => {
  const [name, setName] = useState(displayName);
  const [error, setError] = useState('');

  const handleNext = () => {
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      setError('Please enter your name to continue');
      return;
    }
    
    if (trimmedName.length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    
    if (trimmedName.length > 50) {
      setError('Name must be less than 50 characters');
      return;
    }

    // Basic validation - no special characters that could be problematic
    const nameRegex = /^[a-zA-Z\s\-'\.]+$/;
    if (!nameRegex.test(trimmedName)) {
      setError('Please use only letters, spaces, hyphens, or apostrophes');
      return;
    }

    setError('');
    updateName(trimmedName);
    onNext();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-primary/5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-6">
            <User className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-gradient-pink mb-3">
            What's your name?
          </h1>
          <p className="text-muted-foreground text-lg">
            This is how other creators will see you
          </p>
        </motion.div>

        {/* Name Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-strong rounded-2xl p-8 space-y-6 mb-8"
        >
          <div className="space-y-3">
            <Label htmlFor="displayName" className="text-base">
              Display Name
            </Label>
            <Input
              id="displayName"
              type="text"
              placeholder="Enter your name..."
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNext();
              }}
              className="h-14 text-lg bg-background/50"
              maxLength={50}
              autoFocus
            />
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-destructive text-sm"
              >
                {error}
              </motion.p>
            )}
            <p className="text-muted-foreground text-xs">
              Use your real name or a professional alias — this cannot be left empty
            </p>
          </div>
        </motion.div>

        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-between"
        >
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-muted-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!name.trim()}
            className="h-12 px-6 bg-primary hover:bg-primary/90"
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default OnboardingName;
