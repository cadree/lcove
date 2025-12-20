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
const OnboardingProfile = ({
  data,
  updateData,
  onNext,
  onBack
}: Props) => {
  const [errors, setErrors] = useState<{
    displayName?: string;
    phone?: string;
  }>({});
  const validateAndContinue = () => {
    const newErrors: {
      displayName?: string;
      phone?: string;
    } = {};
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
    <div className="min-h-screen flex flex-col p-6 pb-32">
      <div className="max-w-lg mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <p className="text-primary text-sm font-medium mb-2">Step 1 of 5</p>
          <h1 className="font-display text-4xl md:text-5xl text-foreground mb-2">
            Let's get to know you
          </h1>
          <p className="text-muted-foreground">
            Use the name you actually go by — first name, nickname, or artist name. This is how others will see you.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-foreground flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Your Name
              <span className="text-primary">*</span>
            </Label>
            <div className="relative">
              <Input
                id="displayName"
                value={data.displayName}
                onChange={(e) => updateData({ displayName: e.target.value })}
                placeholder="What should we call you?"
                className={`h-14 text-lg bg-secondary border-border ${
                  errors.displayName ? 'border-destructive' : ''
                }`}
              />
              {data.displayName && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                >
                  <Sparkles className="h-5 w-5 text-primary" />
                </motion.div>
              )}
            </div>
            {errors.displayName && (
              <p className="text-destructive text-sm">{errors.displayName}</p>
            )}
            <p className="text-muted-foreground text-xs">
              Use your real name or the name you're known by in creative circles
            </p>
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-foreground flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              Phone Number
              <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              value={data.phone}
              onChange={(e) => updateData({ phone: e.target.value })}
              placeholder="+1 (555) 123-4567"
              className={`h-14 text-lg bg-secondary border-border ${
                errors.phone ? 'border-destructive' : ''
              }`}
            />
            {errors.phone && (
              <p className="text-destructive text-sm">{errors.phone}</p>
            )}
            <p className="text-muted-foreground text-xs">
              For account recovery and important updates only
            </p>
          </div>
        </motion.div>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background to-transparent">
        <div className="max-w-lg mx-auto flex gap-4">
          <Button onClick={onBack} variant="outline" className="h-12 px-6">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={validateAndContinue}
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
export default OnboardingProfile;