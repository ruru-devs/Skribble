/**
 * Skribble Storage Manager
 * Handles local caching and serialization of .skrib format notes.
 */

const SkribbleStorage = {
  KEYS: {
    NOTES: 'skribble_notes_cache',
    AUTH: 'skribble_drive_auth',
    ACTIVE_VIEW: 'skribble_active_view'
  },

  /**
   * Retrieves all locally cached notes, sorted by updated date descending
   */
  getNotes() {
    try {
      const raw = localStorage.getItem(this.KEYS.NOTES);
      if (!raw) return [];
      const notes = JSON.parse(raw);
      return Array.isArray(notes) ? notes : [];
    } catch (e) {
      console.error('Failed to read notes from localStorage', e);
      return [];
    }
  },

  /**
   * Saves the entire notes array into localStorage
   */
  setNotes(notes) {
    try {
      localStorage.setItem(this.KEYS.NOTES, JSON.stringify(notes));
    } catch (e) {
      console.error('Failed to save notes into localStorage', e);
    }
  },

  /**
   * Finds a note by its ID
   */
  getNoteById(id) {
    const notes = this.getNotes();
    return notes.find(n => n.id === id) || null;
  },

  /**
   * Saves or updates a single note in local storage
   */
  upsertNote(note) {
    const notes = this.getNotes();
    const index = notes.findIndex(n => n.id === note.id);
    
    // Ensure timestamps
    const now = new Date().toISOString();
    note.updatedAt = now;
    if (!note.createdAt) {
      note.createdAt = now;
    }

    if (index >= 0) {
      notes[index] = note;
    } else {
      notes.unshift(note);
    }

    this.setNotes(notes);
    return note;
  },

  /**
   * Deletes a note locally by its ID
   */
  deleteNote(id) {
    const notes = this.getNotes().filter(n => n.id !== id);
    this.setNotes(notes);
  },

  /**
   * Merges remote notes fetched from Google Drive with local notes
   * Uses newest updatedAt timestamp to resolve conflicts
   */
  mergeRemoteNotes(remoteNotes) {
    if (!Array.isArray(remoteNotes)) return this.getNotes();
    
    const localNotes = this.getNotes();
    const noteMap = new Map();

    // Add local notes to map
    for (const note of localNotes) {
      if (note.id) noteMap.set(note.id, note);
    }

    // Merge or insert remote notes
    for (const remote of remoteNotes) {
      if (!remote.id) continue;
      const local = noteMap.get(remote.id);
      if (!local) {
        noteMap.set(remote.id, remote);
      } else {
        const localTime = new Date(local.updatedAt || 0).getTime();
        const remoteTime = new Date(remote.updatedAt || 0).getTime();
        // If remote is newer, use remote; otherwise keep local
        if (remoteTime >= localTime) {
          noteMap.set(remote.id, { ...local, ...remote });
        }
      }
    }

    const merged = Array.from(noteMap.values());
    merged.sort((a, b) => new Date(b.createdAt || b.updatedAt).getTime() - new Date(a.createdAt || a.updatedAt).getTime());
    this.setNotes(merged);
    return merged;
  },

  /**
   * Gets stored Google Apps Script credentials
   */
  getAuth() {
    try {
      const raw = localStorage.getItem(this.KEYS.AUTH);
      return raw ? JSON.parse(raw) : { url: '', key: '' };
    } catch {
      return { url: '', key: '' };
    }
  },

  /**
   * Saves Google Apps Script credentials
   */
  setAuth(url, key) {
    localStorage.setItem(this.KEYS.AUTH, JSON.stringify({ url: url.trim(), key: key.trim() }));
  },

  /**
   * Generates a unique note ID
   */
  generateId() {
    return 'skrib_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  },

  /**
   * Exports a note object as a downloadable .skrib file
   */
  exportNoteFile(note) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(note, null, 2));
    const downloadAnchor = document.createElement('a');
    const safeTitle = (note.title || 'untitled').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${safeTitle}_${note.id}.skrib`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  /**
   * Exports all notes as a combined JSON backup
   */
  exportAllNotes() {
    const notes = this.getNotes();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(notes, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `skribble_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }
};

window.SkribbleStorage = SkribbleStorage;
