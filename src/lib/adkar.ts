// ADKAR readiness scoring (Prosci): Awareness, Desire, Knowledge, Ability,
// Reinforcement — each 1–5. Lowest dimension is the "barrier point".

export type Adkar = {
  awareness: number;
  desire: number;
  knowledge: number;
  ability: number;
  reinforcement: number;
};

export const ADKAR_DIMENSIONS: (keyof Adkar)[] = [
  "awareness",
  "desire",
  "knowledge",
  "ability",
  "reinforcement",
];

export function adkarScore(a: Adkar): number {
  const total = ADKAR_DIMENSIONS.reduce((s, d) => s + a[d], 0);
  return Math.round((total / (ADKAR_DIMENSIONS.length * 5)) * 100);
}

export function barrierPoint(a: Adkar): keyof Adkar {
  return ADKAR_DIMENSIONS.reduce((min, d) => (a[d] < a[min] ? d : min), ADKAR_DIMENSIONS[0]);
}

export function readinessTone(score: number): "success" | "warn" | "danger" {
  if (score >= 75) return "success";
  if (score >= 50) return "warn";
  return "danger";
}
