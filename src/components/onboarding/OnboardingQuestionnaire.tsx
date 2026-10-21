import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { OnboardingData } from '@/pages/Onboarding';
import {
  QUIZ_INTRO_COPY,
  QUIZ_QUESTIONS,
  optionsForSeed,
  quizSeedForSession,
  type ChoiceId,
} from '@/lib/onboardingQuiz';

interface Props {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onComplete: () => void;
  onBack: () => void;
}

const OnboardingQuestionnaire = ({ data, updateData, onComplete, onBack }: Props) => {
  const [showIntro, setShowIntro] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const quizSeed = useMemo(
    () => quizSeedForSession(window.sessionStorage),
    [],
  );

  const question = QUIZ_QUESTIONS[currentQuestion];
  const selectedAnswer = data.questionnaireResponses[question.id];
  const options = useMemo(
    () => optionsForSeed(question, quizSeed),
    [question, quizSeed],
  );

  const selectAnswer = (answer: ChoiceId) => {
    updateData({
      questionnaireResponses: {
        ...data.questionnaireResponses,
        [question.id]: answer,
      },
    });
  };

  const handleNext = async () => {
    if (currentQuestion < QUIZ_QUESTIONS.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
    } else {
      setIsSubmitting(true);
      await onComplete();
      setIsSubmitting(false);
    }
  };

  const handlePrev = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1);
    } else {
      setShowIntro(true);
    }
  };

  const progress = ((currentQuestion + 1) / QUIZ_QUESTIONS.length) * 100;

  if (showIntro) {
    return (
      <div className="min-h-screen flex flex-col p-6 pb-32">
        <div className="max-w-2xl mx-auto w-full">
          <p className="text-primary text-sm font-medium mb-2">Before the questions</p>
          <h1 className="font-display text-4xl md:text-5xl text-foreground mb-4">
            Mindset Alignment
          </h1>
          <div className="rounded-2xl border border-dashed border-primary/50 bg-primary/5 p-5 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">
              {QUIZ_INTRO_COPY.kicker}
            </p>
            <h2 className="font-display text-2xl text-foreground">{QUIZ_INTRO_COPY.title}</h2>
            <p className="text-base leading-relaxed text-foreground">{QUIZ_INTRO_COPY.body}</p>
            <p className="text-xs text-muted-foreground">
              Placeholder copy lives in src/lib/onboardingQuiz.ts as QUIZ_INTRO_COPY.
            </p>
          </div>
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background to-transparent">
          <div className="max-w-2xl mx-auto flex gap-4">
            <Button onClick={onBack} variant="outline" className="h-12 px-6">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={() => setShowIntro(false)} className="flex-1 h-12 bg-primary hover:bg-primary/90 glow-pink">
              Start questions
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-6 pb-32">
      <div className="max-w-2xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <p className="text-primary text-sm font-medium mb-2">Final Step</p>
          <h1 className="font-display text-4xl md:text-5xl text-foreground mb-2">
            Mindset Alignment
          </h1>
          <div className="h-1 bg-secondary rounded-full overflow-hidden mt-4">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Question {currentQuestion + 1} of {QUIZ_QUESTIONS.length}
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {question.subtitle && (
              <p className="text-primary text-sm italic">{question.subtitle}</p>
            )}
            <h2 className="font-display text-2xl md:text-3xl text-foreground leading-tight">
              {question.question}
            </h2>

            <div className="space-y-3 mt-8">
              {options.map((option, index) => {
                const isSelected = selectedAnswer === option.id;
                return (
                  <motion.button
                    key={option.id}
                    type="button"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => selectAnswer(option.id)}
                    className={`w-full p-5 rounded-xl text-left transition-all ${
                      isSelected
                        ? 'bg-primary text-primary-foreground glow-pink'
                        : 'bg-secondary text-secondary-foreground hover:bg-accent'
                    }`}
                  >
                    <span className="flex items-start gap-4">
                      <span
                        className={`mt-1 h-3 w-3 rounded-full shrink-0 ${
                          isSelected ? 'bg-primary-foreground' : 'bg-muted-foreground/40'
                        }`}
                        aria-hidden
                      />
                      <span className="text-base leading-relaxed">{option.text}</span>
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background to-transparent">
        <div className="max-w-2xl mx-auto flex gap-4">
          <Button onClick={handlePrev} variant="outline" className="h-12 px-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!selectedAnswer || isSubmitting}
            className="flex-1 h-12 bg-primary hover:bg-primary/90 glow-pink"
          >
            {isSubmitting ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
              />
            ) : (
              <>
                {currentQuestion < QUIZ_QUESTIONS.length - 1 ? 'Next' : 'Complete'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingQuestionnaire;
