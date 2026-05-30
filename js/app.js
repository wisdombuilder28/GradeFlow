/**
 * app.js — Application entry point and event wiring.
 *
 * Responsibilities:
 *  - Bootstrap: load storage → apply theme → render UI
 *  - Wire ALL event listeners (zero inline handlers in HTML)
 *  - Delegate table actions via event delegation
 *  - Coordinate modules without containing business logic
 *
 * Rule: this file orchestrates — it does not implement.
 */

import { state, setState }                    from './state.js';
import { loadSubjects, loadTheme }            from './storage.js';
import { addSubject, deleteSubject,
         updateSubject, findSubjectById }      from './subjects.js';
import { applyTheme, toggleTheme }            from './theme.js';
import { exportData, importData }             from './dataIO.js';
import { validateSubject }                    from './helpers.js';
import { initChartResizeObserver }            from './chart.js';
import {
  initDOM, renderUI, renderAnalytics,
  applyFiltersAndSort, navigateTo,
  openEditModal, closeModal, showModalError,
  showToast, updateGradePreview,
  clearAddForm, toggleSidebar, updateBadge,
  renderInsights
}                                              from './ui.js';

// ═══════════════════════════════════════════════════════════════
//  BOOTSTRAP
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // 1. Cache all DOM references
  initDOM();

  // 2. Restore persisted data
  const savedSubjects = loadSubjects();
  const savedTheme    = loadTheme();
  setState({ subjects: savedSubjects, theme: savedTheme });
  applyTheme(savedTheme);

  // 3. Compute initial filtered list
  applyFiltersAndSort();

  // 4. Render everything
  renderUI();

  // 5. Wire all event listeners
  _bindNavigation();
  _bindDashboard();
  _bindAddSubjectForm();
  _bindModal();
  _bindTableDelegation();
  _bindKeyboard();
  _bindSidebar();
  _bindDataIO();

  // 6. Start chart resize observer
  initChartResizeObserver();

  // 7. Navigate to default section — or honour ?section= from PWA shortcuts
  const launchSection = new URLSearchParams(window.location.search).get('section');
  navigateTo(launchSection || 'dashboard');
});

// ═══════════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════════
function _bindNavigation() {
  // All sidebar nav links are wired via data-section attribute
  document.querySelectorAll('.nav-item[data-section]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.dataset.section);
    });
  });

  // "Add Subject" shortcut button on dashboard page-header
  document.getElementById('btn-goto-add')?.addEventListener('click', () => {
    navigateTo('add-subject');
  });

  // Empty state CTA
  document.getElementById('btn-empty-add')?.addEventListener('click', () => {
    navigateTo('add-subject');
  });

  // Theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    toggleTheme();
    // Redraw chart with correct new palette colours
    if (state.currentSection === 'analytics') {
      setTimeout(renderAnalytics, 50);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD — SEARCH + SORT + FILTER
// ═══════════════════════════════════════════════════════════════
function _bindDashboard() {
  // Search
  const searchEl = document.getElementById('search-input');
  if (searchEl) {
    searchEl.addEventListener('input', (e) => {
      setState({ searchQuery: e.target.value });
      applyFiltersAndSort();
      _renderTableOnly();
    });
  }

  // Sort dropdown
  const sortEl = document.getElementById('sort-select');
  if (sortEl) {
    sortEl.addEventListener('change', (e) => {
      setState({ sortKey: e.target.value });
      applyFiltersAndSort();
      _renderTableOnly();
    });
  }

  // Grade filter pills
  document.querySelectorAll('[data-grade-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const grade = btn.dataset.gradeFilter;
      setState({ filterGrade: grade });
      applyFiltersAndSort();
      _renderTableOnly();

      // Toggle active state on pills
      document.querySelectorAll('[data-grade-filter]').forEach((b) =>
        b.classList.toggle('active', b.dataset.gradeFilter === grade)
      );
    });
  });
}

// ═══════════════════════════════════════════════════════════════
//  ADD SUBJECT FORM
// ═══════════════════════════════════════════════════════════════
function _bindAddSubjectForm() {
  const submitBtn = document.getElementById('btn-add-subject');
  if (submitBtn) {
    submitBtn.addEventListener('click', _handleAddSubject);
  }

  const clearBtn = document.getElementById('btn-clear-form');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearAddForm);
  }

  // Live grade preview on score input
  const scoreInput = document.getElementById('input-score');
  if (scoreInput) {
    scoreInput.addEventListener('input', () => {
      updateGradePreview('preview-grade-badge', '.score-preview', scoreInput.value);
    });
  }

  // Allow Enter key to submit from the form
  ['input-name', 'input-score'].forEach((id) => {
    document.getElementById(id)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') _handleAddSubject();
    });
  });
}

function _handleAddSubject() {
  const nameInput  = document.getElementById('input-name');
  const scoreInput = document.getElementById('input-score');
  const errorEl    = document.getElementById('form-error');

  const name  = nameInput.value.trim();
  const score = scoreInput.value;

  const error = validateSubject(name, score);
  if (error) {
    errorEl.textContent = error;
    errorEl.classList.remove('hidden');
    nameInput.focus();
    return;
  }

  errorEl.classList.add('hidden');
  const subject = addSubject(name, score);
  applyFiltersAndSort();
  renderUI();
  clearAddForm();
  showToast(`"${subject.name}" added successfully`, 'success');
  navigateTo('dashboard');
}

// ═══════════════════════════════════════════════════════════════
//  EDIT MODAL
// ═══════════════════════════════════════════════════════════════
function _bindModal() {
  // Save / update
  document.getElementById('btn-save-edit')?.addEventListener('click', _handleUpdateSubject);

  // Cancel (modal footer button — same action, separate ID to avoid duplicate)
  document.getElementById('btn-cancel-edit-2')?.addEventListener('click', closeModal);

  // Click outside modal to close
  document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') closeModal();
  });

  // Live grade preview in edit modal
  document.getElementById('edit-score')?.addEventListener('input', (e) => {
    updateGradePreview('edit-grade-badge', '#modal-backdrop .score-preview', e.target.value);
  });
}

function _handleUpdateSubject() {
  const id    = Number(document.getElementById('edit-id').value);
  const name  = document.getElementById('edit-name').value.trim();
  const score = document.getElementById('edit-score').value;

  const error = validateSubject(name, score);
  if (error) {
    showModalError(error);
    return;
  }

  const ok = updateSubject(id, name, score);
  if (!ok) {
    showModalError('Subject not found. Please refresh and try again.');
    return;
  }

  applyFiltersAndSort();
  renderUI();
  closeModal();
  showToast(`"${name}" updated successfully`, 'info');
}

// ═══════════════════════════════════════════════════════════════
//  TABLE EVENT DELEGATION  (Phase 2)
//  One listener on tbody handles Edit + Delete for all rows.
// ═══════════════════════════════════════════════════════════════
function _bindTableDelegation() {
  const tbody = document.getElementById('subjects-tbody');
  if (!tbody) return;

  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const id     = Number(btn.dataset.id);
    const action = btn.dataset.action;

    if (action === 'edit') {
      openEditModal(id);
    }

    if (action === 'delete') {
      const subject = findSubjectById(id);
      if (!subject) return;

      // Custom confirm to keep UX consistent
      if (window.confirm(`Delete "${subject.name}"? This cannot be undone.`)) {
        deleteSubject(id);
        applyFiltersAndSort();
        renderUI();
        showToast(`"${subject.name}" deleted`, 'error');
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════════
function _bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Escape closes the modal
    if (e.key === 'Escape') closeModal();

    // Enter in modal saves
    const modal = document.getElementById('modal-backdrop');
    if (e.key === 'Enter' && !modal.classList.contains('hidden')) {
      _handleUpdateSubject();
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  MOBILE SIDEBAR
// ═══════════════════════════════════════════════════════════════
function _bindSidebar() {
  document.getElementById('hamburger')?.addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', toggleSidebar);
}

// ═══════════════════════════════════════════════════════════════
//  EXPORT / IMPORT  (Phase 5)
// ═══════════════════════════════════════════════════════════════
function _bindDataIO() {
  // Export button
  document.getElementById('btn-export')?.addEventListener('click', () => {
    const ok = exportData();
    if (ok) {
      showToast('Data exported successfully', 'success');
    } else {
      showToast('Nothing to export — add some subjects first', 'error');
    }
  });

  // Import: trigger hidden file input
  document.getElementById('btn-import')?.addEventListener('click', () => {
    document.getElementById('import-file-input')?.click();
  });

  // Handle file selection
  document.getElementById('import-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    importData(
      file,
      (imported) => {
        applyFiltersAndSort();
        renderUI();
        showToast(`${imported.length} subjects imported successfully`, 'success');
        navigateTo('dashboard');
      },
      (errMsg) => {
        showToast(`Import failed: ${errMsg}`, 'error');
      }
    );

    // Reset so the same file can be re-imported if needed
    e.target.value = '';
  });
}

// ═══════════════════════════════════════════════════════════════
//  INTERNAL UTILITY
// ═══════════════════════════════════════════════════════════════
/**
 * Re-render only the table + badge (avoids full renderUI on search/sort).
 * ui.js is already statically imported, so we call its exports directly.
 */
function _renderTableOnly() {
  // renderUI is cheap enough here; table + badge are the only things
  // search/sort/filter need to update.
  renderUI();
}
