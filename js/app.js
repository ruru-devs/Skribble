/**
 * Skribble Main Application Controller
 */

const SkribbleApp = {
  currentView: 'listView',
  searchQuery: '',

  init() {
    SkribbleSync.init();
    SkribbleEditor.init();

    this.bindEvents();
    this.renderNotesFeed();
    this.renderTimeline();

    // Check if demo/initial note is needed for new users
    this.checkFirstRun();
  },

  bindEvents() {
    // Bottom Nav switching
    document.querySelectorAll('.bottom-nav .nav-item[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.switchView(view);
      });
    });

    // Settings modal triggers
    const openSettings = () => this.openSettingsModal();
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('settingsNavBtn').addEventListener('click', openSettings);
    document.getElementById('syncStatusBadge').addEventListener('click', openSettings);
    document.getElementById('settingsModalCloseBtn').addEventListener('click', () => this.closeSettingsModal());

    // Settings Form Submit
    document.getElementById('settingsForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSettings();
    });

    // Test Connection Button
    document.getElementById('testSyncBtn').addEventListener('click', () => this.testSettingsConnection());

    // Floating Add Note Button
    document.getElementById('floatingAddBtn').addEventListener('click', () => {
      SkribbleEditor.open();
    });

    // Search Toggle & Input
    const searchContainer = document.getElementById('searchBarContainer');
    const searchInput = document.getElementById('searchInput');
    document.getElementById('searchToggleBtn').addEventListener('click', () => {
      searchContainer.classList.toggle('hidden');
      if (!searchContainer.classList.contains('hidden')) {
        searchInput.focus();
      } else {
        searchInput.value = '';
        this.searchQuery = '';
        this.renderNotesFeed();
      }
    });

    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderNotesFeed();
    });

    document.getElementById('searchClearBtn').addEventListener('click', () => {
      searchInput.value = '';
      this.searchQuery = '';
      this.renderNotesFeed();
    });

    // Export / Import tools in Settings
    document.getElementById('exportAllJsonBtn').addEventListener('click', () => {
      SkribbleStorage.exportAllNotes();
    });

    document.getElementById('importSkribInput').addEventListener('change', (e) => {
      this.handleImportFile(e);
    });

    // Lightbox close
    document.getElementById('lightboxCloseBtn').addEventListener('click', () => this.closeLightbox());
    document.querySelector('.lightbox-backdrop').addEventListener('click', () => this.closeLightbox());
  },

  switchView(viewId) {
    this.currentView = viewId;
    document.querySelectorAll('.view-panel').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.bottom-nav .nav-item[data-view]').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewId);
    });

    if (viewId === 'calendarView') {
      this.renderTimeline();
    }
  },

  /**
   * Renders the chronological notes feed matching the clean dark layout
   */
  renderNotesFeed() {
    const feed = document.getElementById('notesFeed');
    const emptyState = document.getElementById('emptyState');
    const statsEl = document.getElementById('bannerStats');

    let notes = SkribbleStorage.getNotes();

    // Filter by search query if present
    if (this.searchQuery) {
      notes = notes.filter(n => {
        const text = ((n.title || '') + ' ' + (n.plainText || '') + ' ' + (n.tags || []).join(' ')).toLowerCase();
        return text.includes(this.searchQuery);
      });
    }

    if (statsEl) {
      statsEl.textContent = `${notes.length} note${notes.length === 1 ? '' : 's'} recorded`;
    }

    if (notes.length === 0) {
      feed.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');

    feed.innerHTML = notes.map(note => {
      const date = new Date(note.createdAt || note.updatedAt || Date.now());
      
      // Formatting matching date cues: e.g. "04 MAR", "2026, Wednesday"
      const day = String(date.getDate()).padStart(2, '0');
      const monthStr = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      const yearStr = date.getFullYear();
      const weekdayStr = date.toLocaleDateString('en-US', { weekday: 'long' });
      const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();

      // Find first image attachment for right-hand preview
      const imageAtt = (note.attachments || []).find(a => a.type === 'image');
      const hasAudio = (note.attachments || []).some(a => a.type === 'audio');

      const snippet = note.plainText || (note.contentHtml ? note.contentHtml.replace(/<[^>]+>/g, '') : 'No additional text');

      return `
        <article class="note-card" data-id="${note.id}">
          <div class="note-card-main">
            <div class="note-card-date-row">
              <span class="note-date-day">${day} ${monthStr}</span>
              <span class="note-date-sub">${yearStr}, ${weekdayStr}</span>
            </div>
            <div class="note-time">${timeStr}</div>
            ${note.title ? `<div class="note-title-line">${this.escapeHtml(note.title)}</div>` : ''}
            <div class="note-snippet">${this.escapeHtml(snippet)}</div>
            
            <div class="note-meta-badges">
              ${hasAudio ? `<span class="meta-badge audio-badge">🎙️ Voice Note</span>` : ''}
              ${(note.tags || []).slice(0, 3).map(t => `<span class="meta-badge">#${this.escapeHtml(t)}</span>`).join('')}
            </div>
          </div>
          
          ${imageAtt ? `
            <div class="note-thumbnail-wrap">
              <img class="note-thumbnail-img" src="${imageAtt.data}" alt="Thumbnail">
              <div class="note-thumbnail-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </div>
            </div>
          ` : ''}
        </article>
      `;
    }).join('');

    // Attach click listeners to open notes in editor
    feed.querySelectorAll('.note-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const note = SkribbleStorage.getNoteById(id);
        if (note) SkribbleEditor.open(note);
      });
    });
  },

  /**
   * Renders the Timeline view grouped by Month and Year
   */
  renderTimeline() {
    const container = document.getElementById('timelineContainer');
    if (!container) return;

    const notes = SkribbleStorage.getNotes();
    if (notes.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No notes to display</h3></div>';
      return;
    }

    // Group notes by month
    const groups = {};
    notes.forEach(note => {
      const d = new Date(note.createdAt || note.updatedAt || Date.now());
      const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(note);
    });

    container.innerHTML = Object.keys(groups).map(monthKey => `
      <section class="timeline-month-group">
        <h3 class="timeline-month-title">${monthKey}</h3>
        <div class="notes-feed">
          ${groups[monthKey].map(note => {
            const date = new Date(note.createdAt || note.updatedAt);
            const day = String(date.getDate()).padStart(2, '0');
            const monthStr = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
            const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
            const snippet = note.plainText || note.title || 'Untitled note';

            return `
              <div class="note-card" data-id="${note.id}">
                <div class="note-card-main">
                  <div class="note-card-date-row">
                    <span class="note-date-day">${day} ${monthStr}</span>
                    <span class="note-date-sub">${timeStr}</span>
                  </div>
                  ${note.title ? `<div class="note-title-line">${this.escapeHtml(note.title)}</div>` : ''}
                  <div class="note-snippet">${this.escapeHtml(snippet)}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `).join('');

    container.querySelectorAll('.note-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const note = SkribbleStorage.getNoteById(id);
        if (note) SkribbleEditor.open(note);
      });
    });
  },

  /**
   * Settings modal handlers
   */
  openSettingsModal() {
    const auth = SkribbleStorage.getAuth();
    document.getElementById('gasUrlInput').value = auth.url || '';
    document.getElementById('gasKeyInput').value = auth.key || '';
    document.getElementById('settingsFeedback').classList.add('hidden');
    document.getElementById('settingsModal').classList.remove('hidden');
  },

  closeSettingsModal() {
    document.getElementById('settingsModal').classList.add('hidden');
  },

  saveSettings() {
    const url = document.getElementById('gasUrlInput').value;
    const key = document.getElementById('gasKeyInput').value;
    SkribbleStorage.setAuth(url, key);

    this.showSettingsFeedback('Credentials saved on this device!', 'success');
    SkribbleSync.updateStatusBadge();

    if (url && key) {
      SkribbleSync.fetchFromDrive();
    }
  },

  async testSettingsConnection() {
    const url = document.getElementById('gasUrlInput').value.trim();
    const key = document.getElementById('gasKeyInput').value.trim();

    if (!url || !key) {
      this.showSettingsFeedback('Please enter both the Web App URL and the Secret Key.', 'error');
      return;
    }

    this.showSettingsFeedback('Testing connection to Google Apps Script...', '');
    try {
      const res = await SkribbleSync.testConnection(url, key);
      this.showSettingsFeedback(`✓ Success! Connected to folder: "${res.folderName || 'Skribble Notes'}"`, 'success');
    } catch (err) {
      this.showSettingsFeedback(`✕ Connection failed: ${err.message}`, 'error');
    }
  },

  showSettingsFeedback(msg, type) {
    const el = document.getElementById('settingsFeedback');
    el.textContent = msg;
    el.className = 'feedback-banner ' + (type || '');
    el.classList.remove('hidden');
  },

  /**
   * Import .skrib or JSON file
   */
  handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (Array.isArray(data)) {
          SkribbleStorage.mergeRemoteNotes(data);
        } else if (data && typeof data === 'object') {
          if (!data.id) data.id = SkribbleStorage.generateId();
          SkribbleStorage.upsertNote(data);
          SkribbleSync.scheduleAutosave(data);
        }
        this.renderNotesFeed();
        alert('File imported successfully!');
        this.closeSettingsModal();
      } catch (err) {
        alert('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  },

  /**
   * Lightbox
   */
  openLightbox(src) {
    document.getElementById('lightboxImg').src = src;
    document.getElementById('imageLightbox').classList.remove('hidden');
  },

  closeLightbox() {
    document.getElementById('imageLightbox').classList.add('hidden');
    document.getElementById('lightboxImg').src = '';
  },

  /**
   * Adds an initial welcome note on fresh install
   */
  checkFirstRun() {
    const notes = SkribbleStorage.getNotes();
    if (notes.length === 0) {
      const welcomeNote = {
        id: SkribbleStorage.generateId(),
        title: 'Welcome to Skribble',
        contentHtml: `<p>Welcome to your personal journal and notes workspace. Here are some things you can try:</p>
<ul>
  <li><b>Rich formatting:</b> Bold, italic, underline, strikethrough, and <mark style="background-color: #4ade80; color: #0d0f12;">highlighting</mark>.</li>
  <li><b>Voice Notes:</b> Tap the microphone icon above to record WebM audio clips right into your note.</li>
  <li><b>Photos:</b> Attach images from your camera or paste them directly from your clipboard.</li>
  <li><b>Drive Auto-Sync:</b> Tap the Settings icon to link your personal Google Apps Script webhook for real-time cloud backup.</li>
</ul>`,
        plainText: 'Welcome to your personal journal and notes workspace. Rich formatting, voice notes, photos, and Google Drive auto-sync.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: ['welcome', 'guide'],
        attachments: []
      };
      SkribbleStorage.upsertNote(welcomeNote);
      this.renderNotesFeed();
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

window.addEventListener('DOMContentLoaded', () => {
  window.SkribbleApp = SkribbleApp;
  SkribbleApp.init();
});
