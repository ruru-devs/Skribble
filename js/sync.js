/**
 * Skribble Sync Manager
 * Communicates with the user's personal Google Apps Script webhook
 * for real-time autosave and Drive storage.
 */

const SkribbleSync = {
  syncTimeout: null,
  isSyncing: false,
  statusBadge: null,

  init() {
    this.statusBadge = document.getElementById('syncStatusBadge');
    this.updateStatusBadge();

    // If credentials exist, do a background fetch
    const auth = SkribbleStorage.getAuth();
    if (auth.url && auth.key) {
      this.fetchFromDrive();
    }
  },

  /**
   * Updates the visual sync status badge in the header
   */
  updateStatusBadge(status = null, label = null) {
    if (!this.statusBadge) return;
    const auth = SkribbleStorage.getAuth();
    const hasAuth = !!(auth.url && auth.key);

    this.statusBadge.classList.remove('online', 'syncing');

    if (status === 'syncing') {
      this.statusBadge.classList.add('syncing');
      this.statusBadge.querySelector('.status-label').textContent = label || 'Syncing...';
    } else if (status === 'online' || (hasAuth && !status)) {
      this.statusBadge.classList.add('online');
      this.statusBadge.querySelector('.status-label').textContent = label || 'Drive Linked';
    } else {
      this.statusBadge.querySelector('.status-label').textContent = label || 'Local Only';
    }
  },

  /**
   * Executes a call to the Google Apps Script webhook
   */
  async callWebhook(payload) {
    const auth = SkribbleStorage.getAuth();
    if (!auth.url || !auth.key) {
      throw new Error('Google Apps Script URL or Secret Key not configured');
    }

    payload.key = auth.key;

    // Use text/plain to avoid CORS preflight options check from Google's redirect
    const response = await fetch(auth.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data.success && data.error) {
      throw new Error(data.error);
    }

    return data;
  },

  /**
   * Tests connection with credentials
   */
  async testConnection(url, key) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({ action: 'ping', key: key })
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Connection failed');
    }

    return data;
  },

  /**
   * Fetches all .skrib notes from the Google Drive Skribble folder
   */
  async fetchFromDrive() {
    const auth = SkribbleStorage.getAuth();
    if (!auth.url || !auth.key) return;

    try {
      this.updateStatusBadge('syncing', 'Checking Drive...');
      const result = await this.callWebhook({ action: 'list' });
      
      if (result && Array.isArray(result.notes)) {
        SkribbleStorage.mergeRemoteNotes(result.notes);
        if (window.SkribbleApp) {
          window.SkribbleApp.renderNotesFeed();
        }
      }
      this.updateStatusBadge('online', 'Drive Synced');
    } catch (err) {
      console.warn('Could not sync with Google Drive:', err.message);
      this.updateStatusBadge(null, 'Offline / Cache');
    }
  },

  /**
   * Schedules a debounced autosave to Google Drive
   */
  scheduleAutosave(note) {
    // 1. Immediately cache locally so no work is lost
    SkribbleStorage.upsertNote(note);

    const saveStatusEl = document.getElementById('editorSaveStatus');
    if (saveStatusEl) {
      saveStatusEl.textContent = 'Saving...';
      saveStatusEl.style.color = 'var(--warning)';
    }

    // 2. Debounce remote push to Google Drive (1.2 seconds)
    clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(async () => {
      const auth = SkribbleStorage.getAuth();
      if (!auth.url || !auth.key) {
        if (saveStatusEl) {
          saveStatusEl.textContent = 'Saved locally';
          saveStatusEl.style.color = 'var(--text-secondary)';
        }
        return;
      }

      try {
        this.updateStatusBadge('syncing', 'Saving note...');
        await this.callWebhook({
          action: 'save',
          note: note
        });

        if (saveStatusEl) {
          saveStatusEl.textContent = 'Saved to Drive';
          saveStatusEl.style.color = 'var(--accent)';
        }
        this.updateStatusBadge('online', 'Drive Synced');
      } catch (err) {
        console.warn('Autosave to Drive failed:', err.message);
        if (saveStatusEl) {
          saveStatusEl.textContent = 'Saved locally (Drive unreachable)';
          saveStatusEl.style.color = 'var(--warning)';
        }
        this.updateStatusBadge(null, 'Sync Error');
      }
    }, 1200);
  },

  /**
   * Deletes a note from Google Drive
   */
  async deleteFromDrive(noteId) {
    const auth = SkribbleStorage.getAuth();
    if (!auth.url || !auth.key) return;

    try {
      this.updateStatusBadge('syncing', 'Deleting...');
      await this.callWebhook({
        action: 'delete',
        noteId: noteId
      });
      this.updateStatusBadge('online', 'Drive Synced');
    } catch (err) {
      console.warn('Could not delete from Drive:', err.message);
    }
  }
};

window.SkribbleSync = SkribbleSync;
