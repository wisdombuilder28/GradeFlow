/**
 * ui.js — All DOM rendering and UI state transitions.
 *
 * Responsibilities:
 *  - Section navigation
 *  - Stat cards, subjects table, analytics, insights
 *  - Modal open/close
 *  - Toast notifications
 *  - Grade preview in forms
 *  - Filter / sort computation (applyFiltersAndSort)
 *
 * Rule: this module READS from state and analytics modules.
 * It never writes to state directly — it calls setState only
 * for the derived filteredSubjects list.
 */

import { state, setState }    from './state.js';
import {
  escapeHTML, getGrade, getGradeLabel, getScoreColor
}                              from './helpers.js';
import {
  calculateStats, getGradeDistribution, getPassRate, getInsights, getScoreRange
}                              from './analytics.js';
import { renderChart }         from './chart.js';

// ═══════════════════════════════════════════════════════════════
//  DOM CACHE
//  Queried once at initDOM() to avoid repetitive getElementById calls.
// ═══════════════════════════════════════════════════════════════
export const DOM = {};

export function initDOM() {
  // Stats
  DOM.statTotalVal    = document.getElementById('stat-total-val');
  DOM.statTotalSub    = document.getElementById('stat-total-sub');
  DOM.statAvgVal      = document.getElementById('stat-avg-val');
  DOM.statAvgSub      = document.getElementById('stat-avg-sub');
  DOM.statHighVal     = document.getElementById('stat-high-val');
  DOM.statHighSub     = document.getElementById('stat-high-sub');
  DOM.statLowVal      = document.getElementById('stat-low-val');
  DOM.statLowSub      = document.getElementById('stat-low-sub');

  // Table
  DOM.subjectsTbody   = document.getElementById('subjects-tbody');
  DOM.subjectsTable   = document.getElementById('subjects-table');
  DOM.emptyState      = document.getElementById('empty-state');
  DOM.countPill       = document.getElementById('subject-count-pill');
  DOM.badgeCount      = document.getElementById('badge-count');
  DOM.searchInput     = document.getElementById('search-input');
  DOM.sortSelect      = document.getElementById('sort-select');
  DOM.insightsSection = document.getElementById('insights-section');

  // Analytics
  DOM.gradeBreakdown  = document.getElementById('grade-breakdown');
  DOM.analyticsDetails= document.getElementById('analytics-details');
  DOM.chartSubtitle   = document.getElementById('chart-subtitle');

  // Modal
  DOM.modalBackdrop   = document.getElementById('modal-backdrop');
  DOM.editId          = document.getElementById('edit-id');
  DOM.editName        = document.getElementById('edit-name');
  DOM.editScore       = document.getElementById('edit-score');
  DOM.editGradeBadge  = document.getElementById('edit-grade-badge');
  DOM.modalError      = document.getElementById('modal-error');

  // Misc
  DOM.toastContainer  = document.getElementById('toast-container');
  DOM.sidebar         = document.getElementById('sidebar');
  DOM.sidebarOverlay  = document.getElementById('sidebar-overlay');
}

// ═══════════════════════════════════════════════════════════════
//  MASTER RENDER
// ═══════════════════════════════════════════════════════════════
/**
 * Full re-render: stats + table + badge + analytics (if visible).
 * Call this after any state mutation.
 */
export function renderUI() {
  renderStats();
  renderSubjectsTable();
  updateBadge();
  renderInsights();
  if (state.currentSection === 'analytics') renderAnalytics();
}

// ═══════════════════════════════════════════════════════════════
//  FILTER + SORT  (Phase 4)
// ═══════════════════════════════════════════════════════════════
/**
 * Derive filteredSubjects from subjects by applying the current
 * search query, grade filter, and sort key stored in state.
 * Writes the result back to state.filteredSubjects.
 * @returns {Array} the filtered+sorted list
 */
export function applyFiltersAndSort() {
  let list = [...state.subjects];

  // 1. Text search
  const q = state.searchQuery.trim().toLowerCase();
  if (q) list = list.filter((s) => s.name.toLowerCase().includes(q));

  // 2. Grade filter
  if (state.filterGrade !== 'all') {
    list = list.filter((s) => getGrade(s.score) === state.filterGrade);
  }

  // 3. Sort
  switch (state.sortKey) {
    case 'highest-score': list.sort((a, b) => b.score - a.score);                  break;
    case 'lowest-score':  list.sort((a, b) => a.score - b.score);                  break;
    case 'alpha-az':      list.sort((a, b) => a.name.localeCompare(b.name));        break;
    case 'alpha-za':      list.sort((a, b) => b.name.localeCompare(a.name));        break;
    case 'recently-added':
    default: /* preserve insertion order (newest first from addSubject) */          break;
  }

  setState({ filteredSubjects: list });
  return list;
}

// ═══════════════════════════════════════════════════════════════
//  STAT CARDS
// ═══════════════════════════════════════════════════════════════
export function renderStats() {
  const { total, average, highest, lowest } = calculateStats();

  _setAnimated(DOM.statTotalVal, String(total));
  DOM.statTotalSub.textContent = total === 0
    ? 'No subjects yet'
    : `${total} subject${total !== 1 ? 's' : ''} tracked`;

  if (average !== null) {
    _setAnimated(DOM.statAvgVal, average.toFixed(1));
    const g = getGrade(average);
    DOM.statAvgSub.textContent = `Grade ${g} · ${getGradeLabel(g)}`;
  } else {
    DOM.statAvgVal.textContent = '—';
    DOM.statAvgSub.textContent = '—';
  }

  if (highest) {
    _setAnimated(DOM.statHighVal, String(highest.score));
    DOM.statHighSub.textContent = highest.name;
  } else {
    DOM.statHighVal.textContent = '—';
    DOM.statHighSub.textContent = '—';
  }

  if (lowest) {
    _setAnimated(DOM.statLowVal, String(lowest.score));
    DOM.statLowSub.textContent = lowest.name;
  } else {
    DOM.statLowVal.textContent = '—';
    DOM.statLowSub.textContent = '—';
  }
}

// ═══════════════════════════════════════════════════════════════
//  SUBJECTS TABLE
// ═══════════════════════════════════════════════════════════════
export function renderSubjectsTable() {
  const list = state.filteredSubjects;
  const { subjects } = state;

  DOM.countPill.textContent = `${subjects.length} subject${subjects.length !== 1 ? 's' : ''}`;

  if (subjects.length === 0) {
    DOM.subjectsTable.style.display = 'none';
    DOM.emptyState.classList.add('visible');
    DOM.subjectsTbody.innerHTML = '';
    return;
  }

  DOM.subjectsTable.style.display = '';
  DOM.emptyState.classList.remove('visible');

  if (list.length === 0) {
    DOM.subjectsTbody.innerHTML = `
      <tr>
        <td colspan="6" class="no-results-cell">
          No subjects match the current filter.
        </td>
      </tr>`;
    return;
  }

  DOM.subjectsTbody.innerHTML = list.map((s, i) => {
    const grade = getGrade(s.score);
    const color = getScoreColor(s.score);
    return `
      <tr class="row-enter">
        <td class="row-index">${String(i + 1).padStart(2, '0')}</td>
        <td class="subject-name">${escapeHTML(s.name)}</td>
        <td class="score-cell" style="color:${color}">
          ${s.score}<span class="score-denom">/100</span>
        </td>
        <td><span class="grade-badge grade-${grade}">${grade}</span></td>
        <td>
          <div class="perf-bar-wrap">
            <div class="perf-bar-track">
              <div class="perf-bar-fill" style="width:${s.score}%; background:${color}"></div>
            </div>
            <span class="perf-val">${s.score}%</span>
          </div>
        </td>
        <td class="actions-cell">
          <button class="btn-action btn-edit"
            data-action="edit" data-id="${s.id}" aria-label="Edit ${escapeHTML(s.name)}">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z"
                stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
            </svg>
            Edit
          </button>
          <button class="btn-action btn-delete"
            data-action="delete" data-id="${s.id}" aria-label="Delete ${escapeHTML(s.name)}">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M3 4h10M6 4V3h4v1M5 4v9h6V4H5z"
                stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Delete
          </button>
        </td>
      </tr>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
//  INSIGHTS  (Phase 6)
// ═══════════════════════════════════════════════════════════════
export function renderInsights() {
  if (!DOM.insightsSection) return;
  const insights = getInsights();

  if (!insights.length) {
    DOM.insightsSection.innerHTML = '';
    DOM.insightsSection.style.display = 'none';
    return;
  }

  DOM.insightsSection.style.display = '';
  DOM.insightsSection.innerHTML = `
    <div class="insights-header">
      <span class="insights-title">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/>
          <path d="M10 9v5M10 7v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        Performance Insights
      </span>
      <span class="insights-count">${insights.length} insight${insights.length !== 1 ? 's' : ''}</span>
    </div>
    <div class="insights-grid">
      ${insights.map((ins) => `
        <div class="insight-card insight-${ins.type}">
          <span class="insight-icon">${ins.icon}</span>
          <p class="insight-text">${ins.html}</p>
        </div>`).join('')}
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
//  ANALYTICS SECTION
// ═══════════════════════════════════════════════════════════════
export function renderAnalytics() {
  renderChart();
  _renderGradeBreakdown();
  _renderAnalyticsDetails();

  if (DOM.chartSubtitle) {
    DOM.chartSubtitle.textContent =
      state.subjects.length ? `${state.subjects.length} subject${state.subjects.length !== 1 ? 's' : ''}` : 'No data';
  }
}

function _renderGradeBreakdown() {
  if (!DOM.gradeBreakdown) return;

  if (!state.subjects.length) {
    DOM.gradeBreakdown.innerHTML = '<p class="no-data-text">No data yet</p>';
    return;
  }

  const dist   = getGradeDistribution();
  const colors = {
    A: 'var(--grade-A)', B: 'var(--grade-B)', C: 'var(--grade-C)',
    D: 'var(--grade-D)', F: 'var(--grade-F)',
  };

  DOM.gradeBreakdown.innerHTML = ['A', 'B', 'C', 'D', 'F'].map((g) => `
    <div class="breakdown-row">
      <div class="breakdown-header">
        <div class="breakdown-label">
          <span class="grade-badge grade-${g}">${g}</span>
          <span class="breakdown-label-text">${getGradeLabel(g)}</span>
        </div>
        <span class="breakdown-count">${dist[g].count} · ${dist[g].pct}%</span>
      </div>
      <div class="breakdown-bar-track">
        <div class="breakdown-bar-fill" style="width:${dist[g].pct}%; background:${colors[g]}"></div>
      </div>
    </div>`).join('');
}

function _renderAnalyticsDetails() {
  if (!DOM.analyticsDetails) return;

  const { total, average } = calculateStats();
  if (!total) {
    DOM.analyticsDetails.innerHTML = '';
    return;
  }

  const { rate, passing } = getPassRate();
  const range   = getScoreRange();
  const avgGrade = getGrade(average);

  DOM.analyticsDetails.innerHTML = `
    <div class="detail-card">
      <div class="detail-label">Pass Rate</div>
      <div class="detail-value" style="color:var(--green)">${rate}%</div>
      <div class="detail-sub">${passing} of ${total} subjects passing (score ≥ 50)</div>
    </div>
    <div class="detail-card">
      <div class="detail-label">Overall Grade</div>
      <div class="detail-value" style="color:var(--grade-${avgGrade})">${avgGrade}</div>
      <div class="detail-sub">Average score: ${average.toFixed(1)} — ${getGradeLabel(avgGrade)}</div>
    </div>
    <div class="detail-card">
      <div class="detail-label">Score Range</div>
      <div class="detail-value" style="font-size:18px">${range} pts</div>
      <div class="detail-sub">Spread across ${total} subject${total !== 1 ? 's' : ''}</div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════════
export function navigateTo(section) {
  setState({ currentSection: section });

  // Toggle section visibility
  document.querySelectorAll('.section').forEach((el) => el.classList.add('hidden'));
  document.getElementById(`section-${section}`)?.classList.remove('hidden');

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.section === section);
  });

  // Section-specific renders
  if (section === 'analytics') renderAnalytics();
  if (section === 'dashboard')  renderSubjectsTable();

  closeSidebar();
}

// ═══════════════════════════════════════════════════════════════
//  MODAL
// ═══════════════════════════════════════════════════════════════
export function openEditModal(id) {
  const subject = state.subjects.find((s) => s.id === id);
  if (!subject) return;

  DOM.editId.value    = id;
  DOM.editName.value  = subject.name;
  DOM.editScore.value = subject.score;
  DOM.modalError.classList.add('hidden');

  const grade = getGrade(subject.score);
  DOM.editGradeBadge.textContent = grade;
  DOM.editGradeBadge.className   = `preview-grade grade-${grade}`;

  DOM.modalBackdrop.classList.remove('hidden');
  setTimeout(() => DOM.editName.focus(), 80);
}

export function closeModal() {
  DOM.modalBackdrop.classList.add('hidden');
  DOM.modalError.classList.add('hidden');
}

export function showModalError(msg) {
  DOM.modalError.textContent = msg;
  DOM.modalError.classList.remove('hidden');
}

// ═══════════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════════
/**
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} type
 */
export function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-dot"></span><span>${escapeHTML(message)}</span>`;
  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

// ═══════════════════════════════════════════════════════════════
//  GRADE PREVIEW (used in add + edit forms)
// ═══════════════════════════════════════════════════════════════
/**
 * Update the inline grade badge preview when a score input changes.
 * @param {string} badgeId     - ID of the badge <span>
 * @param {string} previewSel  - CSS selector for the preview wrapper
 * @param {string|number} val  - Current score value
 */
export function updateGradePreview(badgeId, previewSel, val) {
  const badge   = document.getElementById(badgeId);
  const preview = document.querySelector(previewSel);
  if (!badge || !preview) return;

  const num = parseFloat(val);
  if (val === '' || isNaN(num)) {
    badge.textContent = '—';
    badge.className   = 'preview-grade';
    return;
  }

  const score = Math.min(100, Math.max(0, num));
  const grade = getGrade(score);
  badge.textContent = grade;
  badge.className   = `preview-grade grade-${grade}`;
}

// ═══════════════════════════════════════════════════════════════
//  BADGE
// ═══════════════════════════════════════════════════════════════
export function updateBadge() {
  DOM.badgeCount.textContent = state.subjects.length;
}

// ═══════════════════════════════════════════════════════════════
//  SIDEBAR (mobile)
// ═══════════════════════════════════════════════════════════════
export function toggleSidebar() {
  DOM.sidebar.classList.toggle('open');
  DOM.sidebarOverlay.classList.toggle('open');
}

export function closeSidebar() {
  DOM.sidebar.classList.remove('open');
  DOM.sidebarOverlay.classList.remove('open');
}

// ═══════════════════════════════════════════════════════════════
//  CLEAR ADD FORM
// ═══════════════════════════════════════════════════════════════
export function clearAddForm() {
  document.getElementById('input-name').value  = '';
  document.getElementById('input-score').value = '';
  document.getElementById('form-error').classList.add('hidden');
  updateGradePreview('preview-grade-badge', '.score-preview', '');
}

// ═══════════════════════════════════════════════════════════════
//  INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════

/** Animate a stat value only if it actually changed. */
function _setAnimated(el, newVal) {
  if (!el || el.textContent === newVal) return;
  el.textContent = newVal;
  el.classList.remove('updating');
  void el.offsetWidth; // trigger reflow to restart animation
  el.classList.add('updating');
}
