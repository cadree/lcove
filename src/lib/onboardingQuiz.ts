// Mindset quiz. Letters identify a sentence, not a rank and not a screen position.
// Placeholder intro copy lives in QUIZ_INTRO_COPY. The owner replaces that text.
// File: src/lib/onboardingQuiz.ts

export type ChoiceId = "A" | "B" | "C";
export type Mindset = "steady" | "flexible" | "exploratory";

export interface QuizOption {
  id: ChoiceId;
  text: string;
  mindset: Mindset;
}

export interface QuizQuestion {
  id: number;
  question: string;
  subtitle?: string;
  options: QuizOption[];
}

export const QUIZ_INTRO_COPY = {
  kicker: "PLACEHOLDER — owner writes the final text",
  title: "PLACEHOLDER: Why these questions",
  body: "PLACEHOLDER: New members answer these so Ether can see a spread of how you think. There is no single correct letter. Replace this paragraph with the final welcome before launch.",
} as const;

const MINDSET_BY_CHOICE: Record<ChoiceId, Mindset> = {
  A: "steady",
  B: "flexible",
  C: "exploratory",
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: "When you encounter an idea that challenges your beliefs, what is your natural reaction?",
    options: [
      { id: "A", mindset: "steady", text: "I reject it immediately if it conflicts with what I already know" },
      { id: "B", mindset: "flexible", text: "I feel discomfort but try to understand it anyway" },
      { id: "C", mindset: "exploratory", text: "I get curious and explore it without needing to agree" },
    ],
  },
  {
    id: 2,
    question: "Which statement resonates with you most?",
    options: [
      { id: "A", mindset: "steady", text: "Reality is mostly fixed; you adapt to it" },
      { id: "B", mindset: "flexible", text: "Reality can be influenced with effort and strategy" },
      { id: "C", mindset: "exploratory", text: "Reality responds to perception, energy, and alignment" },
    ],
  },
  {
    id: 3,
    question: "How do you typically respond to negative emotions (anger, frustration, sadness)?",
    options: [
      { id: "A", mindset: "steady", text: "I vent them freely; they need to be expressed" },
      { id: "B", mindset: "flexible", text: "I feel them, then try to move past them" },
      { id: "C", mindset: "exploratory", text: "I observe them, extract the lesson, and consciously redirect" },
    ],
  },
  {
    id: 4,
    question: "Which best describes your relationship with discipline?",
    options: [
      { id: "A", mindset: "steady", text: "I rely on motivation; discipline comes and goes" },
      { id: "B", mindset: "flexible", text: "I try to be disciplined but struggle with consistency" },
      { id: "C", mindset: "exploratory", text: 'When I tell myself "I will," I follow through' },
    ],
  },
  {
    id: 5,
    question: '"If everything in my life is my responsibility — even the difficult parts — I gain more power, not less."',
    subtitle: "Read carefully and choose the response that feels true, not flattering:",
    options: [
      { id: "A", mindset: "steady", text: "I disagree" },
      { id: "B", mindset: "flexible", text: "I'm unsure but open to this idea" },
      { id: "C", mindset: "exploratory", text: "I strongly agree" },
    ],
  },
  {
    id: 6,
    question: "In collaboration, which feels most aligned with you?",
    options: [
      { id: "A", mindset: "steady", text: "I focus primarily on my own success" },
      { id: "B", mindset: "flexible", text: "I often put others first, even at my own expense" },
      { id: "C", mindset: "exploratory", text: "I seek harmony where my success benefits others and vice versa" },
    ],
  },
  {
    id: 7,
    question: "When learning something new, you trust most:",
    options: [
      { id: "A", mindset: "steady", text: "Authority and credentials" },
      { id: "B", mindset: "flexible", text: "Research and cross-checking" },
      { id: "C", mindset: "exploratory", text: "Intuition supported by lived experience" },
    ],
  },
  {
    id: 8,
    question: "Which sentence feels like it was written about you?",
    options: [
      { id: "A", mindset: "steady", text: '"I want stability and clear instructions."' },
      { id: "B", mindset: "flexible", text: '"I want freedom, but with structure."' },
      { id: "C", mindset: "exploratory", text: '"I\'ve always felt like I don\'t fully belong in the existing system."' },
    ],
  },
  {
    id: 9,
    question: "How do you see money?",
    options: [
      { id: "A", mindset: "steady", text: "As the primary measure of success" },
      { id: "B", mindset: "flexible", text: "As a tool for freedom" },
      { id: "C", mindset: "exploratory", text: "As stored energy representing time, discipline, and intention" },
    ],
  },
  {
    id: 10,
    question: "Do you believe curiosity is something to be controlled or something to be protected?",
    subtitle: "Answer instinctively:",
    options: [
      { id: "A", mindset: "steady", text: "Controlled" },
      { id: "B", mindset: "flexible", text: "Balanced" },
      { id: "C", mindset: "exploratory", text: "Protected" },
    ],
  },
];

export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function shuffleWithSeed<T>(items: readonly T[], seed: string): T[] {
  const copy = items.slice();
  let state = hashSeed(seed) || 1;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    const swap = copy[i];
    copy[i] = copy[j];
    copy[j] = swap;
  }
  return copy;
}

export function optionsForUser(question: QuizQuestion, userId: string): QuizOption[] {
  return shuffleWithSeed(question.options, `${userId}:${question.id}`);
}

export interface MindsetScore {
  score: number;
  spread: number;
  passed: boolean;
  level: 1 | 2;
  counts: Record<Mindset, number>;
}

// A spread of mindsets scores higher than repeating one answer.
// Every mix of two or three mindsets passes. No letter is worth more than another.
export function scoreMindsetSpread(choices: ChoiceId[]): MindsetScore {
  const counts: Record<Mindset, number> = { steady: 0, flexible: 0, exploratory: 0 };
  for (const choice of choices) {
    const mindset = MINDSET_BY_CHOICE[choice];
    if (mindset) counts[mindset] += 1;
  }
  const total = choices.length;
  const spread = (Object.values(counts) as number[]).filter((count) => count > 0).length;
  const maxShare = total === 0 ? 1 : Math.max(counts.steady, counts.flexible, counts.exploratory) / total;
  const base = spread >= 3 ? 90 : spread === 2 ? 70 : 30;
  const evenness = Math.round((1 - maxShare) * 10);
  const score = total === 0 ? 0 : Math.min(100, base + evenness);
  const passed = spread >= 2;
  return { score, spread, passed, level: passed ? 2 : 1, counts };
}
