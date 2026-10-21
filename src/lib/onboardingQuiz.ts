// Onboarding quiz. Letters identify a sentence, not a rank and not a screen position.
// A red flag is an option that conflicts with a collaborative creative community.
// Every other option is equally valid. There is no best answer.
// QUIZ_INTRO_COPY is the text shown before the questions.

export type ChoiceId = "A" | "B" | "C";

export interface QuizOption {
  id: ChoiceId;
  text: string;
  /** True only when this sentence conflicts with a collaborative creative community. */
  redFlag: boolean;
}

export interface QuizQuestion {
  id: number;
  question: string;
  subtitle?: string;
  options: QuizOption[];
}

export const QUIZ_INTRO_COPY = {
  kicker: "10 questions",
  title: "How answers are scored",
  body: "Each question has three sentences. A letter only labels a sentence, and the order changes between visits. One sentence is marked as a conflict with working in a group. Two or more of those answers fails this step. One does not. Every other sentence counts the same.",
} as const;

/** Two or more red-flag answers fails. One red flag still passes. */
export const RED_FLAG_FAIL_THRESHOLD = 2;

export const QUIZ_SEED_STORAGE_KEY = "ether-onboarding-quiz-seed";

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: "When you encounter an idea that challenges your beliefs, what is your natural reaction?",
    options: [
      { id: "A", redFlag: false, text: "I reject it immediately if it conflicts with what I already know" },
      { id: "B", redFlag: false, text: "I feel discomfort but try to understand it anyway" },
      { id: "C", redFlag: false, text: "I get curious and explore it without needing to agree" },
    ],
  },
  {
    id: 2,
    question: "Which statement resonates with you most?",
    options: [
      { id: "A", redFlag: false, text: "Reality is mostly fixed; you adapt to it" },
      { id: "B", redFlag: false, text: "Reality can be influenced with effort and strategy" },
      { id: "C", redFlag: false, text: "Reality responds to perception, energy, and alignment" },
    ],
  },
  {
    id: 3,
    question: "How do you typically respond to negative emotions (anger, frustration, sadness)?",
    options: [
      { id: "A", redFlag: false, text: "I vent them freely; they need to be expressed" },
      { id: "B", redFlag: false, text: "I feel them, then try to move past them" },
      { id: "C", redFlag: false, text: "I observe them, extract the lesson, and consciously redirect" },
    ],
  },
  {
    id: 4,
    question: "Which best describes your relationship with discipline?",
    options: [
      { id: "A", redFlag: false, text: "I rely on motivation; discipline comes and goes" },
      { id: "B", redFlag: false, text: "I try to be disciplined but struggle with consistency" },
      { id: "C", redFlag: false, text: 'When I tell myself "I will," I follow through' },
    ],
  },
  {
    id: 5,
    question: '"If everything in my life is my responsibility — even the difficult parts — I gain more power, not less."',
    subtitle: "Read carefully and choose the response that feels true, not flattering:",
    options: [
      { id: "A", redFlag: false, text: "I disagree" },
      { id: "B", redFlag: false, text: "I'm unsure but open to this idea" },
      { id: "C", redFlag: false, text: "I strongly agree" },
    ],
  },
  {
    id: 6,
    question: "In collaboration, which feels most aligned with you?",
    options: [
      { id: "A", redFlag: true, text: "I focus primarily on my own success" },
      { id: "B", redFlag: false, text: "I often put others first, even at my own expense" },
      { id: "C", redFlag: false, text: "I seek harmony where my success benefits others and vice versa" },
    ],
  },
  {
    id: 7,
    question: "When learning something new, you trust most:",
    options: [
      { id: "A", redFlag: false, text: "Authority and credentials" },
      { id: "B", redFlag: false, text: "Research and cross-checking" },
      { id: "C", redFlag: false, text: "Intuition supported by lived experience" },
    ],
  },
  {
    id: 8,
    question: "Which sentence feels like it was written about you?",
    options: [
      { id: "A", redFlag: false, text: '"I want stability and clear instructions."' },
      { id: "B", redFlag: false, text: '"I want freedom, but with structure."' },
      { id: "C", redFlag: false, text: '"I\'ve always felt like I don\'t fully belong in the existing system."' },
    ],
  },
  {
    id: 9,
    question: "How do you see money?",
    options: [
      { id: "A", redFlag: false, text: "As the primary measure of success" },
      { id: "B", redFlag: false, text: "As a tool for freedom" },
      { id: "C", redFlag: false, text: "As stored energy representing time, discipline, and intention" },
    ],
  },
  {
    id: 10,
    question: "Do you believe curiosity is something to be controlled or something to be protected?",
    subtitle: "Answer instinctively:",
    options: [
      { id: "A", redFlag: false, text: "Controlled" },
      { id: "B", redFlag: false, text: "Balanced" },
      { id: "C", redFlag: false, text: "Protected" },
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

export function optionsForSeed(question: QuizQuestion, seed: string): QuizOption[] {
  return shuffleWithSeed(question.options, `${seed}:${question.id}`);
}

export interface QuizSeedStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** New each visit. A refresh in the same tab reads the seed already stored. */
export function createQuizSeed(random: () => number = Math.random): string {
  let seed = "";
  for (let i = 0; i < 4; i += 1) {
    seed += Math.floor(random() * 0x100000000).toString(16).padStart(8, "0");
  }
  return seed;
}

export function quizSeedForSession(storage: QuizSeedStorage, random?: () => number): string {
  const existing = storage.getItem(QUIZ_SEED_STORAGE_KEY);
  if (existing) return existing;
  const seed = createQuizSeed(random);
  storage.setItem(QUIZ_SEED_STORAGE_KEY, seed);
  return seed;
}

export function clearQuizSeed(storage: Pick<QuizSeedStorage, "removeItem">): void {
  storage.removeItem(QUIZ_SEED_STORAGE_KEY);
}

export interface RedFlagScore {
  /** How many selected options are red flags. This is what the profile stores as onboarding_score. */
  score: number;
  redFlags: number;
  passed: boolean;
  level: 1 | 2;
}

export function passedRedFlagCount(redFlags: number): boolean {
  return redFlags < RED_FLAG_FAIL_THRESHOLD;
}

export function scoreRedFlags(responses: Record<number, ChoiceId | undefined>): RedFlagScore {
  let redFlags = 0;
  for (const question of QUIZ_QUESTIONS) {
    const choice = responses[question.id];
    const option = question.options.find((item) => item.id === choice);
    if (option?.redFlag) redFlags += 1;
  }
  const passed = passedRedFlagCount(redFlags);
  return {
    score: redFlags,
    redFlags,
    passed,
    level: passed ? 2 : 1,
  };
}
