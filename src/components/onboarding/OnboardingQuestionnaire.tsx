import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { OnboardingData } from '@/pages/Onboarding';

interface Props {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onComplete: () => void;
  onBack: () => void;
}

const questions = [
  {
    id: 1,
    question: 'When you encounter an idea that challenges your beliefs, what is your natural reaction?',
    options: {
      A: 'I reject it immediately if it conflicts with what I already know',
      B: 'I feel discomfort but try to understand it anyway',
      C: 'I get curious and explore it without needing to agree',
    },
  },
  {
    id: 2,
    question: 'Which statement resonates with you most?',
    options: {
      A: 'Reality is mostly fixed; you adapt to it',
      B: 'Reality can be influenced with effort and strategy',
      C: 'Reality responds to perception, energy, and alignment',
    },
  },
  {
    id: 3,
    question: 'How do you typically respond to negative emotions (anger, frustration, sadness)?',
    options: {
      A: 'I vent them freely; they need to be expressed',
      B: 'I feel them, then try to move past them',
      C: 'I observe them, extract the lesson, and consciously redirect',
    },
  },
  {
    id: 4,
    question: 'Which best describes your relationship with discipline?',
    options: {
      A: 'I rely on motivation; discipline comes and goes',
      B: 'I try to be disciplined but struggle with consistency',
      C: 'When I tell myself "I will," I follow through',
    },
  },
  {
    id: 5,
    question: '"If everything in my life is my responsibility — even the difficult parts — I gain more power, not less."',
    subtitle: 'Read carefully and choose the response that feels true, not flattering:',
    options: {
      A: 'I disagree',
      B: "I'm unsure but open to this idea",
      C: 'I strongly agree',
    },
  },
  {
    id: 6,
    question: 'In collaboration, which feels most aligned with you?',
    options: {
      A: 'I focus primarily on my own success',
      B: 'I often put others first, even at my own expense',
      C: 'I seek harmony where my success benefits others and vice versa',
    },
  },
  {
    id: 7,
    question: 'When learning something new, you trust most:',
    options: {
      A: 'Authority and credentials',
      B: 'Research and cross-checking',
      C: 'Intuition supported by lived experience',
    },
  },
  {
    id: 8,
    question: 'Which sentence feels like it was written about you?',
    options: {
      A: '"I want stability and clear instructions."',
      B: '"I want freedom, but with structure."',
      C: '"I\'ve always felt like I don\'t fully belong in the existing system."',
    },
  },
  {
    id: 9,
    question: 'How do you see money?',
    options: {
      A: 'As the primary measure of success',
      B: 'As a tool for freedom',
      C: 'As stored energy representing time, discipline, and intention',
    },
  },
  {
    id: 10,
    question: 'Do you believe curiosity is something to be controlled or something to be protected?',
    subtitle: 'Answer instinctively:',
    options: {
      A: 'Controlled',
      B: 'Balanced',
      C: 'Protected',
    },
  },
];

const OnboardingQuestionnaire = ({ data, updateData, onComplete, onBack }: Props) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const question = questions[currentQuestion];
  const selectedAnswer = data.questionnaireResponses[question.id];

  const selectAnswer = (answer: 'A' | 'B' | 'C') => {
    updateData({
      questionnaireResponses: {
        ...data.questionnaireResponses,
        [question.id]: answer,
      },
    });
  };

  const handleNext = async () => {
    if (currentQuestion < questions.length - 1) {
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
      onBack();
    }
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen flex flex-col p-6 pb-32">
      <div className="max-w-2xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <p className="text-primary text-sm font-medium mb-2">Step 5 of 5</p>
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
            Question {currentQuestion + 1} of {questions.length}
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
              {(Object.entries(question.options) as [keyof typeof question.options, string][]).map(
                ([key, text]) => {
                  const isSelected = selectedAnswer === key;
                  return (
                    <motion.button
                      key={key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: ['A', 'B', 'C'].indexOf(key) * 0.1 }}
                      onClick={() => selectAnswer(key as 'A' | 'B' | 'C')}
                      className={`w-full p-5 rounded-xl text-left transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground glow-pink'
                          : 'bg-secondary text-secondary-foreground hover:bg-accent'
                      }`}
                    >
                      <span className="flex items-start gap-4">
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
                            isSelected
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {key}
                        </span>
                        <span className="text-base leading-relaxed">{text}</span>
                      </span>
                    </motion.button>
                  );
                }
              )}
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
                {currentQuestion < questions.length - 1 ? 'Next' : 'Complete'}
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
