import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, ChevronLeft, User, Phone, Sparkles } from 'lucide-react';
import { OnboardingData } from '@/pages/Onboarding';

interface Props {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const OnboardingProfile = ({ data, updateData, onNext, onBack }: Props) => {
  const [errors, setErrors] = useState<{ displayName?: string; phone?: string }>({});

  const validateAndContinue = () => {
    const newErrors: { displayName?: string; phone?: string } = {};

    if (!data.displayName?.trim()) {
      newErrors.displayName = 'Please enter your name';
    } else if (data.displayName.trim().length < 2) {
      newErrors.displayName = 'Name must be at least 2 characters';
    }

    // Phone is optional but if provided, validate format
    if (data.phone && !/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/.test(data.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onNext();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6"
          >
            <User className="w-8 h-8 text-primary" />
          </motion.div>
          
          <h1 className="font-display text-3xl font-medium text-foreground mb-3">
            Let's get to know you
          </h1>
          <p className="text-muted-foreground">
            Tell us what to call you. We encourage using your real name or what you go by — it helps build genuine connections.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Your Name *
            </Label>
            <Input
              id="displayName"
              type="text"
              placeholder="Enter your name (e.g., Jordan, Alex Chen)"
              value={data.displayName || ''}
              onChange={(e) => {
                updateData({ displayName: e.target.value });
                if (errors.displayName) setErrors({ ...errors, displayName: undefined });
              }}
              className={errors.displayName ? 'border-destructive' : ''}
            />
            {errors.displayName && (
              <p className="text-sm text-destructive">{errors.displayName}</p>
            )}
            <p className="text-xs text-muted-foreground">
              <Sparkles className="w-3 h-3 inline mr-1" />
              This is how you'll appear to other members in the community
            </p>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Phone Number <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={data.phone || ''}
              onChange={(e) => {
                updateData({ phone: e.target.value });
                if (errors.phone) setErrors({ ...errors, phone: undefined });
              }}
              className={errors.phone ? 'border-destructive' : ''}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Used for important updates and connecting with collaborators
            </p>
          </div>
        </div>

        {/* Why Real Name */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 p-4 rounded-xl bg-muted/50 border border-border"
        >
          <p className="text-sm text-muted-foreground text-center">
            💡 <span className="text-foreground font-medium">Pro tip:</span> Members who use their real names tend to get more collaboration requests and build stronger connections.
          </p>
        </motion.div>

        {/* Navigation */}
        <div className="flex gap-3 mt-10">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button onClick={validateAndContinue} className="flex-1">
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default OnboardingProfile;
