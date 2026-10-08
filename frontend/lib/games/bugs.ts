import { Rng } from "./prng.ts";

/**
 * Game 5 - Bug Hunt Terminal.
 *
 * NOTE: answers currently live in the browser bundle. For the real event, move `grade()` and the
 * answer fields to the server (the content below has no secrets beyond the answer key).
 */

export interface Snippet {
  id: number;
  title: string;
  weight: 1 | 2 | 3;
  intent: string; // what the code is supposed to do
  code: string[]; // lines
  question: string; // what to predict
  options: string[]; // shuffled per session
  bugPrompt: string; // what the clicked line should be
  // answer key
  answer: string;
  bugLine: number; // 1-based
}

type Raw = Omit<Snippet, "options"> & { distractors: [string, string, string] };

const RAW: Raw[] = [
  {
    id: 1,
    title: "Tally",
    weight: 1,
    intent: "total() should return the sum of ALL the numbers in the list.",
    code: [
      "def total(nums):",
      "    result = 0",
      "    for i in range(len(nums) - 1):",
      "        result += nums[i]",
      "    return result",
      "",
      "print(total([3, 5, 2, 8]))",
    ],
    question: "What does the program print?",
    answer: "10",
    distractors: ["18", "13", "8"],
    bugPrompt: "Click the line that stops it from adding everything.",
    bugLine: 3,
  },
  {
    id: 2,
    title: "High score",
    weight: 1,
    intent: "largest() should return the biggest number in the list.",
    code: [
      "def largest(nums):",
      "    best = 0",
      "    for n in nums:",
      "        if n > best:",
      "            best = n",
      "    return best",
      "",
      "print(largest([-7, -3, -9]))",
    ],
    question: "What does the program print?",
    answer: "0",
    distractors: ["-3", "-7", "-9"],
    bugPrompt: "Click the line that is wrong when every number is negative.",
    bugLine: 2,
  },
  {
    id: 3,
    title: "Vowel counter",
    weight: 1,
    intent: "count_vowels() should count vowels, ignoring upper or lower case.",
    code: [
      "def count_vowels(text):",
      "    count = 0",
      "    for ch in text:",
      '        if ch in "aeiou":',
      "            count += 1",
      "    return count",
      "",
      'print(count_vowels("Operation ALPHA"))',
    ],
    question: "What does the program print?",
    answer: "4",
    distractors: ["7", "5", "3"],
    bugPrompt: "Click the line that misses some vowels.",
    bugLine: 4,
  },
  {
    id: 4,
    title: "Shopping bucket",
    weight: 2,
    intent: "Each call to add_item() should start with a fresh, empty bucket unless one is given.",
    code: [
      "def add_item(item, bucket=[]):",
      "    bucket.append(item)",
      "    return bucket",
      "",
      'add_item("a")',
      'print(add_item("b"))',
    ],
    question: "What does the program print?",
    answer: "['a', 'b']",
    distractors: ["['b']", "['a']", "['b', 'a']"],
    bugPrompt: "Click the line that makes the two calls share data.",
    bugLine: 1,
  },
  {
    id: 5,
    title: "Door check",
    weight: 2,
    intent: 'balanced() should say whether every ")" has a matching "(" before it, and all are closed.',
    code: [
      "def balanced(text):",
      "    depth = 0",
      "    for ch in text:",
      '        if ch == "(":',
      "            depth += 1",
      '        elif ch == ")":',
      "            depth -= 1",
      "    return depth == 0",
      "",
      'print(balanced("())("))',
    ],
    question: "What does the program print?",
    answer: "True",
    distractors: ["False", "0", "It crashes with an error"],
    bugPrompt: 'Click the line where a ")" arriving too early goes unnoticed.',
    bugLine: 7,
  },
  {
    id: 6,
    title: "Paging",
    weight: 2,
    intent: "page() should return exactly `size` items for the given page number (page 0 is the first).",
    code: [
      "def page(items, number, size):",
      "    start = number * size",
      "    return items[start:start + size - 1]",
      "",
      'print(page(list("ABCDEFGH"), 1, 3))',
    ],
    question: "What does the program print?",
    answer: "['D', 'E']",
    distractors: ["['D', 'E', 'F']", "['A', 'B']", "['E', 'F']"],
    bugPrompt: "Click the line that returns the wrong number of items.",
    bugLine: 3,
  },
  {
    id: 7,
    title: "Duplicates",
    weight: 3,
    intent: "unique() should drop repeats but keep the first of each, in order. It must also stay fast for 1,000,000 items.",
    code: [
      "def unique(items):",
      "    seen = []",
      "    result = []",
      "    for x in items:",
      "        if x not in seen:",
      "            seen.append(x)",
      "            result.append(x)",
      "    return result",
      "",
      "print(unique([4, 1, 4, 2, 1]))",
    ],
    question: "What does the program print?",
    answer: "[4, 1, 2]",
    distractors: ["[1, 2, 4]", "[4, 1, 4, 2, 1]", "[2, 4, 1]"],
    bugPrompt: "The output is right, but it is far too slow on huge inputs. Click the line that causes it.",
    bugLine: 5,
  },
  {
    id: 8,
    title: "Delayed alarms",
    weight: 3,
    intent: "funcs[i]() should return i * 10, so the list should be [0, 10, 20].",
    code: [
      "funcs = []",
      "for i in range(3):",
      "    funcs.append(lambda: i * 10)",
      "",
      "print([f() for f in funcs])",
    ],
    question: "What does the program print?",
    answer: "[20, 20, 20]",
    distractors: ["[0, 10, 20]", "[0, 0, 0]", "[10, 20, 30]"],
    bugPrompt: "Click the line where each function fails to remember its own number.",
    bugLine: 3,
  },
];

export function makeSession(seed: number): Snippet[] {
  const rng = new Rng(seed);
  return RAW.map(({ distractors, ...rest }) => ({
    ...rest,
    options: rng.shuffle([rest.answer, ...distractors]),
  }));
}

export interface Answer {
  choice: string | null;
  line: number | null;
}

export interface Graded {
  score: number;
  max: number;
  correctOutputs: number;
  correctLines: number;
}

export const POINTS_PER_WEIGHT = 10;

export function grade(session: Snippet[], answers: Record<number, Answer>): Graded {
  let score = 0;
  let max = 0;
  let correctOutputs = 0;
  let correctLines = 0;
  for (const s of session) {
    const a = answers[s.id];
    const pts = s.weight * POINTS_PER_WEIGHT;
    max += pts * 2;
    if (a?.choice === s.answer) {
      score += pts;
      correctOutputs++;
    }
    if (a?.line === s.bugLine) {
      score += pts;
      correctLines++;
    }
  }
  return { score, max, correctOutputs, correctLines };
}

export function maxScore(): number {
  return RAW.reduce((n, s) => n + s.weight * POINTS_PER_WEIGHT * 2, 0);
}
