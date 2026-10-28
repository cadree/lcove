import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, ArrowLeft, User } from 'lucide-react';
import { displayNameError } from '@/lib/displayName';
import { MEMBER_OF_HINT, MEMBER_OF_LIMIT, memberOfError, normalizeMemberOf } from '@/lib/etherId';

interface Props {
  displayName: string;
  memberOf: string;
  updateName: (name: string) => void;
  updateMemberOf: (memberOf: string) => void;
  onNext: () => void;
  onBack?: () => void;
}

const OnboardingName = ({ displayName, memberOf, updateName, updateMemberOf, onNext, onBack }: Props) => {
  const [name, setName] = useState(displayName);
  const [member, setMember] = useState(memberOf);
  const [error, setError] = useState('');
  const [memberError, setMemberError] = useState('');

  const handleNext = () => {
    const trimmedName = name.trim();
    const nextError = displayNameError(trimmedName);
    const nextMemberError = memberOfError(member);
    if (nextError || nextMemberError) {
      setError(nextError || '');
      setMemberError(nextMemberError || '');
      return;
    }

    setError('');
    setMemberError('');
    updateName(trimmedName);
    updateMemberOf(normalizeMemberOf(member) || '');
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
          <p className="text-primary text-sm font-medium mb-2">Step 1 of 4</p>
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
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'displayName-error' : 'displayName-hint'}
            />
            {error && (
              <motion.p
                id="displayName-error"
                role="alert"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-destructive text-sm"
              >
                {error}
              </motion.p>
            )}
            <p id="displayName-hint" className="text-muted-foreground text-xs">
              Letters, spaces, hyphens, or apostrophes.
            </p>
          </div>

          <div className="space-y-3">
            <Label htmlFor="memberOf" className="text-base">
              Member of
            </Label>
            <Input
              id="memberOf"
              type="text"
              placeholder="LCOVE"
              value={member}
              maxLength={MEMBER_OF_LIMIT}
              onChange={(e) => {
                setMember(e.target.value);
                if (memberError) setMemberError('');
              }}
              className="h-14 text-lg bg-background/50"
              aria-invalid={memberError ? true : undefined}
              aria-describedby={memberError ? 'memberOf-error' : 'memberOf-hint'}
            />
            {memberError && (
              <p id="memberOf-error" role="alert" className="text-destructive text-sm">
                {memberError}
              </p>
            )}
            <p id="memberOf-hint" className="text-muted-foreground text-xs">
              {MEMBER_OF_HINT}
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
          {onBack ? (
            <Button
              variant="ghost"
              onClick={onBack}
              className="text-muted-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          ) : (
            <span />
          )}
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
