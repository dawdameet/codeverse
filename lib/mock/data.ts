import type { BonusChallenge, Challenge } from "../types";

/** Demo credentials for the mock login. Replaced by the backend later. */
export const MOCK_TEAM = {
  id: "team-007",
  teamId: "CV-007",
  teamName: "Kernel Panic",
  accessCode: "OBELISK",
};

type ChallengeDef = Omit<Challenge, "status">;

export const CHALLENGES: ChallengeDef[] = [
  {
    id: "OB-001",
    name: "VAULT INDEX INTEGRITY",
    difficulty: "BEGINNER",
    phase: 1,
    points: 50,
    summary:
      "OBELISK's document index silently drops valid data near its boundaries.",
    description:
      "OBELISK's document indexing system incorrectly handles certain boundary cases. Some valid document data never appears in the index, and documents that sit close to indexing boundaries behave inconsistently. Analysts have noticed records that exist in the vault but cannot be found.",
    expectedBehavior:
      "Every valid document submitted to the indexer should be present in the index and retrievable, including the first and last entries of any batch and documents at the edges of an index segment.",
    observedBehavior:
      "Some valid documents are missing from the index. The problem is most visible with the earliest and latest entries and with datasets of particular sizes. The same inputs do not always produce the same index contents as the raw vault.",
    relatedDocs: [
      { label: "Challenge overview", anchor: "challenges" },
      { label: "Local testing", anchor: "testing" },
    ],
  },
  {
    id: "OB-002",
    name: "TRANSACTION LOOKUP",
    difficulty: "EASY",
    phase: 1,
    points: 75,
    summary:
      "Some valid transaction IDs cannot be retrieved from OBELISK's ledger.",
    description:
      "OBELISK stores transaction IDs in sorted order. When an analyst asks for a specific transaction, the lookup subsystem is expected to return it. Certain valid IDs come back as 'not found' even though they are present in the ledger.",
    expectedBehavior:
      "Looking up any transaction ID that exists in the ledger must find it. Looking up an ID that does not exist must report that it is absent.",
    observedBehavior:
      "A number of transaction IDs that are definitely stored cannot be retrieved. Failures cluster around boundary values of the ledger. Most mid-range lookups work, which makes the fault easy to miss.",
    relatedDocs: [
      { label: "Challenge overview", anchor: "challenges" },
      { label: "Local testing", anchor: "testing" },
    ],
  },
  {
    id: "OB-003",
    name: "QUERY HISTORY",
    difficulty: "MEDIUM",
    phase: 1,
    points: 100,
    summary:
      "OBELISK's query history does not always restore the correct previous state.",
    description:
      "OBELISK maintains a history of executed search queries and supports undo. Undo is supposed to step the session back to exactly where it was before the last query. In practice, some undo operations restore the wrong state, and repeating undo makes it worse.",
    expectedBehavior:
      "Each undo returns the session to the query state that existed immediately before the most recent change. Repeated undo steps walk back through the history in order until it is empty, at which point further undo does nothing harmful.",
    observedBehavior:
      "Undo sometimes restores a state that never existed, or skips one that did. After several consecutive undo operations the session may end up in an inconsistent or unexpected state.",
    relatedDocs: [
      { label: "Challenge overview", anchor: "challenges" },
      { label: "Scoring", anchor: "scoring" },
    ],
  },
  {
    id: "OB-004",
    name: "QUERY PARSER",
    difficulty: "INTERMEDIATE",
    phase: 1,
    points: 150,
    summary:
      "Some valid compound search expressions return incorrect results.",
    description:
      "OBELISK supports compound search expressions such as 'vault AND security', 'vault OR treasury' and '(vault OR treasury) AND security'. Simple expressions behave, but certain valid expressions produce results that do not match the documented query rules.",
    expectedBehavior:
      "Valid expressions evaluate according to the documented query rules, including grouping with parentheses and the relative strength of the operators.",
    observedBehavior:
      "Certain nested or mixed expressions return incorrect result sets. Equivalent expressions written in different ways do not always agree with each other.",
    relatedDocs: [
      { label: "Challenge overview", anchor: "challenges" },
      { label: "Submission rules", anchor: "submission" },
    ],
  },
  {
    id: "OB-005",
    name: "QUERY CACHE",
    difficulty: "HARD",
    phase: 1,
    points: 200,
    summary:
      "Recently used queries vanish from OBELISK's cache while stale ones survive.",
    description:
      "OBELISK caches frequently executed search queries. When the cache reaches capacity, older entries should make room for new ones while recently used entries are preserved. Analysts report queries they ran moments ago disappearing unexpectedly.",
    expectedBehavior:
      "The cache holds up to its configured capacity. When full, the entry that has gone longest without being used is the one that makes way. Using an entry keeps it alive.",
    observedBehavior:
      "Recently used queries are sometimes evicted while less recently used ones remain. Cache behaviour appears inconsistent under mixed read and write traffic.",
    relatedDocs: [
      { label: "Challenge overview", anchor: "challenges" },
      { label: "Rules", anchor: "rules" },
    ],
  },
  {
    id: "OB-006",
    name: "AUTOCOMPLETE AT SCALE",
    difficulty: "ELITE",
    phase: 1,
    points: 300,
    summary:
      "Autocomplete is correct on small vocabularies but grinds to a halt as they grow.",
    description:
      "OBELISK provides autocomplete suggestions as analysts type. On small test datasets it answers instantly and correctly. As the vocabulary grows towards production size, response time degrades dramatically until the feature is unusable.",
    expectedBehavior:
      "Suggestions remain correct and the response stays fast as the vocabulary grows, staying usable on production-sized datasets.",
    observedBehavior:
      "Results are correct but latency climbs sharply with vocabulary size. Large vocabularies take orders of magnitude longer than small ones.",
    relatedDocs: [
      { label: "Phase 2 — The Escape", anchor: "phase-2" },
      { label: "Scoring", anchor: "scoring" },
    ],
  },
];

export const BONUS: BonusChallenge = {
  id: "OB-BONUS",
  name: "THE LEDGER",
  summary: "A spreadsheet-style formula engine for OBELISK.",
  description:
    "A brownie-point extension to OBELISK: analysts want cells that can reference one another and compute values, in the manner of a spreadsheet. Full briefing will be released when the bonus is unlocked.",
  example: ["A1 = 10", "A2 = 5", "B1 = 20", "C3 = B1 + (A3 * A2)"],
  status: "CLASSIFIED",
  points: 100,
};

const TEAM_NAMES = [
  "Segmentation Fault", "Null Terminators", "Stack Smashers", "Heap Overflow",
  "Race Condition", "Dangling Pointer", "Off By One", "Deadlock Dynasty",
  "Bit Rot", "Core Dumped", "Syntax Heist", "Undefined Behavior",
  "Merge Conflict", "Fork Bomb", "Cache Miss", "Infinite Loop", "Zero Day",
  "Root Access", "Byte Bandits", "Segfault Syndicate", "Big O No",
  "Garbage Collectors", "Hash Collision", "Rubber Ducks", "Tail Recursion",
  "Memory Leak", "Packet Loss", "Bad Alloc", "Buffer Bandits", "Thread Safe",
  "Stack Trace",
];

/** Solved challenge numbers per rival team (digits = OB-00N). */
const TEAM_SOLVED = [
  "123456", "12456", "12346", "1346", "12345", "1236", // above the demo team
  "", "1", "2", "3", "12", "13", "4", "23", "14", "5", "24", "1", "2", "12",
  "3", "", "13", "23", "1", "12", "4", "2", "1", "3", "14",
];

export const RIVALS = TEAM_NAMES.map((teamName, i) => ({
  teamId: `CV-${String(i + 8).padStart(3, "0")}`,
  teamName,
  solved: TEAM_SOLVED[i].split("").map((n) => `OB-00${n}`),
}));
