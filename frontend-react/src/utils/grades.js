/**
 * Utility functions for calculating and styling grades based on backend Grading Scale intervals.
 * Never hardcodes percentage thresholds or letter grades.
 */

/**
 * Computes a letter grade dynamically from backend Grading Scale intervals.
 * 
 * @param {number|string} percentage - Student's score percentage (0-100).
 * @param {Array<{grade: string, min_percentage: number}>} intervals - Intervals from backend DocType.
 * @returns {string} The letter grade (e.g., 'A+', 'A', 'F'), or 'Grade unavailable' if intervals missing.
 */
export function calculateGradeFromScale(percentage, intervals) {
  if (percentage === null || percentage === undefined || percentage === '' || isNaN(percentage)) {
    return '—';
  }

  if (!Array.isArray(intervals) || intervals.length === 0) {
    return 'Grade unavailable';
  }

  const pct = Number(percentage);

  // Intervals are sorted in descending order of min_percentage by the backend
  for (const interval of intervals) {
    const minPct = Number(interval.min_percentage);
    if (!isNaN(minPct) && pct >= minPct) {
      return interval.grade;
    }
  }

  // If score is below all defined thresholds, return the lowest interval's grade (e.g. F)
  return intervals[intervals.length - 1]?.grade || 'Grade unavailable';
}

/**
 * Determines if a calculated grade is considered passing under the active scale.
 * 
 * @param {string} grade - The calculated letter grade.
 * @param {Array<{grade: string, min_percentage: number}>} intervals - Intervals from backend.
 * @returns {boolean} True if grade is not failing / not unavailable.
 */
export function isPassingGrade(grade, intervals) {
  if (!grade || grade === '—' || grade === 'Grade unavailable') {
    return false;
  }

  if (Array.isArray(intervals) && intervals.length > 0) {
    const lastInterval = intervals[intervals.length - 1];
    // The lowest interval (e.g. min_percentage: 0) represents failure
    if (grade.toUpperCase() === String(lastInterval.grade).toUpperCase()) {
      return false;
    }
  }

  return grade.toUpperCase() !== 'F';
}

/**
 * Generates Tailwind CSS classes for badge styling based on the grade letter.
 * 
 * @param {string} grade - The letter grade.
 * @returns {string} Tailwind CSS class string.
 */
export function getGradeBadgeTheme(grade) {
  if (!grade || grade === '—' || grade === 'N/A' || grade === 'Grade unavailable') {
    return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }

  const g = String(grade).toUpperCase().trim();
  if (g.startsWith('A')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border-emerald-800';
  }
  if (g.startsWith('B')) {
    return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/80 dark:text-indigo-400 dark:border-indigo-800';
  }
  if (g.startsWith('C')) {
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/80 dark:text-amber-400 dark:border-amber-800';
  }
  if (g.startsWith('D')) {
    return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/80 dark:text-orange-400 dark:border-orange-800';
  }
  return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/80 dark:text-rose-400 dark:border-rose-800';
}
