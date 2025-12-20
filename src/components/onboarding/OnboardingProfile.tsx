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
  return;
};
export default OnboardingProfile;