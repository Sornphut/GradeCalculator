export const SCORE_LIMITS = {
  assignment: 30,
  quiz: 10,
  midterm: 30,
  final: 30,
} as const;

export function calculateGrade(total: number): string {
  if (total >= 80) return "A";
  if (total >= 75) return "B+";
  if (total >= 70) return "B";
  if (total >= 65) return "C+";
  if (total >= 60) return "C";
  if (total >= 55) return "D+";
  if (total >= 50) return "D";
  return "F";
}
