export interface ResearchQuestion {
  question: string;
  expectedAnswerable: boolean;
  expectedIntentKinds: string[];
}

export const RESEARCH_QUESTIONS: ResearchQuestion[] = [
  {
    question: 'why did login break',
    expectedAnswerable: true,
    expectedIntentKinds: ['why-broken', 'find-dependencies'],
  },
  {
    question: 'what calls validateToken transitively',
    expectedAnswerable: true,
    expectedIntentKinds: ['find-callers'],
  },
  {
    question: 'what depends on JWT_SECRET',
    expectedAnswerable: true,
    expectedIntentKinds: ['find-dependencies'],
  },
  {
    question: 'what depends on auth.ts transitively',
    expectedAnswerable: true,
    expectedIntentKinds: ['find-dependencies'],
  },
  {
    question: 'how do I cook a pancake',
    expectedAnswerable: false,
    expectedIntentKinds: ['unknown'],
  },
];
