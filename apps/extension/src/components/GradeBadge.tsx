import type { Grade } from "../api/types";

const GRADE_LABELS: Record<Grade, string> = {
  A: "Must read",
  B: "Strong match",
  C: "Related",
  D: "Filtered"
};

interface GradeBadgeProps {
  grade: Grade;
  count: number;
}

export function GradeBadge({ grade, count }: GradeBadgeProps) {
  return (
    <div class={`grade-badge grade-${grade.toLowerCase()}`} aria-label={`${grade} ${GRADE_LABELS[grade]} ${count}`}>
      <strong>{grade} · {count}</strong>
      <span>{GRADE_LABELS[grade]}</span>
    </div>
  );
}
