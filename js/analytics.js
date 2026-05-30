/**
 * analytics.js — Analytics engine.
 * Pure computation: no DOM access, no side effects.
 * Returns structured data consumed by ui.js for rendering.
 */

import { state }                    from './state.js';
import { getGrade, getGradeLabel }  from './helpers.js';

// ─── CORE STATS ───────────────────────────────────────────────
/**
 * Calculate aggregate statistics from the subjects array.
 * @returns {{ total: number, average: number|null, highest: object|null, lowest: object|null }}
 */
export function calculateStats() {
  const { subjects } = state;
  if (!subjects.length) return { total: 0, average: null, highest: null, lowest: null };

  const total   = subjects.length;
  const scores  = subjects.map((s) => s.score);
  const average = scores.reduce((a, b) => a + b, 0) / total;
  const max     = Math.max(...scores);
  const min     = Math.min(...scores);

  // If multiple subjects share the highest/lowest score, pick the first match
  return {
    total,
    average,
    highest: subjects.find((s) => s.score === max) ?? null,
    lowest:  subjects.find((s) => s.score === min) ?? null,
  };
}

// ─── GRADE DISTRIBUTION ───────────────────────────────────────
/**
 * Count subjects per grade and compute percentage.
 * @returns {{ [grade: string]: { count: number, pct: number } }}
 */
export function getGradeDistribution() {
  const { subjects } = state;
  const dist = { A: 0, B: 0, C: 0, D: 0, F: 0 };

  subjects.forEach((s) => dist[getGrade(s.score)]++);

  const total = subjects.length || 1; // avoid division by zero
  const result = {};
  for (const [grade, count] of Object.entries(dist)) {
    result[grade] = { count, pct: Math.round((count / total) * 100) };
  }
  return result;
}

// ─── PASS RATE ────────────────────────────────────────────────
/**
 * Calculate how many subjects are at or above a passing score of 50.
 * @returns {{ passing: number, total: number, rate: number }}
 */
export function getPassRate() {
  const { subjects } = state;
  const passing = subjects.filter((s) => s.score >= 50).length;
  const total   = subjects.length;
  return { passing, total, rate: total ? Math.round((passing / total) * 100) : 0 };
}

// ─── SCORE RANGE ──────────────────────────────────────────────
/**
 * Spread between highest and lowest score.
 * @returns {number}
 */
export function getScoreRange() {
  const { subjects } = state;
  if (subjects.length < 2) return 0;
  const scores = subjects.map((s) => s.score);
  return Math.max(...scores) - Math.min(...scores);
}

// ─── DYNAMIC INSIGHTS ─────────────────────────────────────────
/**
 * Generate contextual insight messages from current data.
 * Each insight has: { type: 'positive'|'neutral'|'warning'|'danger', icon: string, html: string }
 * @returns {Array<{ type: string, icon: string, html: string }>}
 */
export function getInsights() {
  const { subjects } = state;
  if (!subjects.length) return [];

  const insights = [];
  const { average, highest, lowest } = calculateStats();
  const { rate, passing, total }     = getPassRate();
  const avgGrade        = getGrade(average);
  const failingSubjects = subjects.filter((s) => s.score < 40);
  const allExcellent    = subjects.every((s) => s.score >= 70);

  // 1. Strongest subject
  if (highest) {
    insights.push({
      type: 'positive',
      icon: '⭐',
      html: `<strong>${highest.name}</strong> is your strongest subject with a score of <strong>${highest.score}</strong>.`,
    });
  }

  // 2. All subjects excellent
  if (allExcellent && subjects.length >= 2) {
    insights.push({
      type: 'positive',
      icon: '🏆',
      html: `Outstanding — you have an <strong>A</strong> grade across all <strong>${subjects.length}</strong> subjects.`,
    });
  }

  // 3. Failing subjects warning
  if (failingSubjects.length > 0) {
    const names = failingSubjects.map((s) => `<em>${s.name}</em>`).join(', ');
    insights.push({
      type: 'danger',
      icon: '⚠️',
      html: `You are failing <strong>${failingSubjects.length}</strong> subject${failingSubjects.length > 1 ? 's' : ''}: ${names}.`,
    });
  }

  // 4. Pass rate context (only meaningful with 3+ subjects)
  if (total >= 3) {
    const sentiment = rate >= 70 ? 'positive' : rate >= 50 ? 'neutral' : 'danger';
    const advice    = rate >= 70 ? 'Keep it up!' : rate >= 50 ? 'There is room for improvement.' : 'Focus on weaker subjects.';
    insights.push({
      type: sentiment,
      icon: rate >= 70 ? '✅' : rate >= 50 ? '📊' : '📉',
      html: `Your pass rate is <strong>${rate}%</strong> (${passing}/${total} subjects passing). ${advice}`,
    });
  }

  // 5. Average grade summary
  if (average !== null) {
    insights.push({
      type: avgGrade === 'A' ? 'positive' : avgGrade === 'F' ? 'danger' : 'neutral',
      icon: '📈',
      html: `Overall average is <strong>${average.toFixed(1)}</strong> — Grade <strong>${avgGrade}</strong> (${getGradeLabel(avgGrade)}).`,
    });
  }

  // 6. Weakest subject advice
  if (lowest && lowest.score < 60 && lowest !== highest) {
    insights.push({
      type: 'warning',
      icon: '💡',
      html: `<strong>${lowest.name}</strong> needs the most attention — current score: <strong>${lowest.score}</strong>.`,
    });
  }

  return insights;
}
