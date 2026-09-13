/**
 * Deterministic similarity detection between projects for builder duplicate-project warnings.
 * Evaluates normalized title and tech stack token overlap.
 */

const STOP_WORDS = new Set([
  "a", "an", "the", "in", "on", "at", "to", "for", "of", "with", "and", "or",
  "by", "from", "as", "is", "are", "be", "this", "that"
]);

function tokenize(text: string): Set<string> {
  // Normalize hyphens and slashes to spaces, but also preserve unhyphenated compounds (e.g. ecommerce)
  const normalized = text.toLowerCase().replace(/[-/]/g, " ");
  return new Set(
    normalized
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t))
  );
}

function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersection++;
    }
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface ProjectComparisonInput {
  title: string;
  techStack: string;
}

export interface SimilarityResult {
  isSimilar: boolean;
  score: number;
  reason?: string;
}

export function detectProjectSimilarity(
  candidate: ProjectComparisonInput,
  existing: ProjectComparisonInput
): SimilarityResult {
  const candTitleTokens = tokenize(candidate.title);
  const existTitleTokens = tokenize(existing.title);

  const candStackTokens = tokenize(candidate.techStack);
  const existStackTokens = tokenize(existing.techStack);

  const titleSimilarity = calculateJaccardSimilarity(candTitleTokens, existTitleTokens);
  const stackSimilarity = calculateJaccardSimilarity(candStackTokens, existStackTokens);

  let sharedTitleTokens = 0;
  for (const t of candTitleTokens) {
    if (existTitleTokens.has(t)) {
      sharedTitleTokens++;
    }
  }

  // Check direct title substring or high token overlap
  const normCandTitle = candidate.title.toLowerCase().trim();
  const normExistTitle = existing.title.toLowerCase().trim();
  const isDirectTitleMatch =
    normCandTitle === normExistTitle ||
    (normCandTitle.length > 5 && normExistTitle.includes(normCandTitle)) ||
    (normExistTitle.length > 5 && normCandTitle.includes(normExistTitle));

  // Weighted score: Title similarity carries 60% weight, tech stack carries 40%
  const compositeScore = titleSimilarity * 0.6 + stackSimilarity * 0.4;

  if (isDirectTitleMatch || titleSimilarity >= 0.4) {
    return {
      isSimilar: true,
      score: Math.max(compositeScore, 0.8),
      reason: "High project title and scope similarity.",
    };
  }

  if (sharedTitleTokens >= 1 && (stackSimilarity >= 0.4 || compositeScore >= 0.35)) {
    return {
      isSimilar: true,
      score: compositeScore,
      reason: "Matching domain keywords with overlapping tech stack.",
    };
  }

  return {
    isSimilar: false,
    score: compositeScore,
  };
}
