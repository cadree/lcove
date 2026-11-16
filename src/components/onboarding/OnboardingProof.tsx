import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Globe2, Instagram } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { applicantLinksError, normalizeApplicantLink } from '@/lib/applicantLinks';

interface Props {
  socialProfile: string;
  website: string;
  updateLinks: (links: { socialProfile: string; website: string }) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function OnboardingProof({ socialProfile, website, updateLinks, onNext, onBack }: Props) {
  const [social, setSocial] = useState(socialProfile);
  const [site, setSite] = useState(website);
  const [error, setError] = useState('');

  const continueToOath = (event: FormEvent) => {
    event.preventDefault();
    const validation = applicantLinksError(social, site);
    if (validation) {
      setError(validation);
      return;
    }
    updateLinks({
      socialProfile: normalizeApplicantLink(social) || '',
      website: normalizeApplicantLink(site) || '',
    });
    setError('');
    onNext();
  };

  return (
    <div className="min-h-[100dvh] bg-background px-6 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-lg">
        <p className="mb-2 text-sm font-medium text-primary">Step 4 of 5</p>
        <h1 className="font-display text-3xl text-foreground md:text-4xl">Show us your work</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Before we approve your application, we review the person and the creative work behind it.
          Add at least one public social media profile or personal website.
        </p>

        <form onSubmit={continueToOath} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="application-social" className="flex items-center gap-2">
              <Instagram className="h-4 w-4" /> Social media profile
            </Label>
            <Input id="application-social" type="text" inputMode="url" autoCapitalize="none"
              autoComplete="url" placeholder="https://instagram.com/yourname"
              value={social} maxLength={500}
              onChange={(event) => { setSocial(event.target.value); setError(''); }}
              className="h-12" aria-invalid={Boolean(error) || undefined}
              aria-describedby="review-links-hint" />
            <p className="text-xs text-muted-foreground">Instagram, TikTok, YouTube, LinkedIn, Behance, or another public profile.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="application-website" className="flex items-center gap-2">
              <Globe2 className="h-4 w-4" /> Website or portfolio
            </Label>
            <Input id="application-website" type="url" inputMode="url" autoCapitalize="none"
              autoComplete="url" placeholder="https://yourportfolio.com"
              value={site} maxLength={500}
              onChange={(event) => { setSite(event.target.value); setError(''); }}
              className="h-12" aria-invalid={Boolean(error) || undefined}
              aria-describedby="review-links-hint" />
          </div>

          <p id="review-links-hint" className="text-sm text-muted-foreground">
            At least one link is required. The link must be publicly viewable for review.
          </p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center gap-3 pt-3">
            <Button type="button" variant="outline" className="h-12" onClick={onBack}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button type="submit" className="h-12 flex-1">
              Continue to oath <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
