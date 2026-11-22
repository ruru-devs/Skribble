/**
 * Skribble Editor Controller
 * Handles rich text editing, styling, attachments, hyperlinks, and voice recordings.
 */

const SkribbleEditor = {
  currentNote: null,
  activeAudioElement: null,
  mediaRecorder: null,
  audioChunks: [],
  recordInterval: null,
  recordStartTime: 0,

  elements: {
    view: null,
    titleInput: null,
    contentArea: null,
    dateText: null,
    saveStatus: null,
    voiceList: null,
    voiceSection: null,
    imagesList: null,
    imagesSection: null,
    tagsList: null,
    tagInput: null,
    imageInput: null,
    highlightPalette: null,
    highlightToolBtn: null,
    linkPopup: null,
    linkTitle: null,
    linkUrl: null,
    recordingBanner: null,
    recordingTimer: null
  },

  init() {
    this.elements.view = document.getElementById('editorView');
    this.elements.titleInput = document.getElementById('noteTitleInput');
    this.elements.contentArea = document.getElementById('noteContentEditor');
    this.elements.dateText = document.getElementById('editorDateText');
    this.elements.saveStatus = document.getElementById('editorSaveStatus');
    this.elements.voiceList = document.getElementById('voiceNotesList');
    this.elements.voiceSection = document.getElementById('voiceNotesSection');
    this.elements.imagesList = document.getElementById('attachedImagesList');
    this.elements.imagesSection = document.getElementById('attachedImagesSection');
    this.elements.tagsList = document.getElementById('tagsList');
    this.elements.tagInput = document.getElementById('tagInputField');
    this.elements.imageInput = document.getElementById('imageInput');
    this.elements.highlightPalette = document.getElementById('highlightPalette');
    this.elements.highlightToolBtn = document.getElementById('highlightToolBtn');
    this.elements.linkPopup = document.getElementById('linkPreviewPopup');
    this.elements.linkTitle = document.getElementById('linkPreviewTitle');
    this.elements.linkUrl = document.getElementById('linkPreviewUrl');
    this.elements.recordingBanner = document.getElementById('recordingBanner');
    this.elements.recordingTimer = document.getElementById('recordingTimer');

    this.bindEvents();
  },

  bindEvents() {
    // Input changes trigger autosave
    this.elements.titleInput.addEventListener('input', () => this.handleContentChange());
    this.elements.contentArea.addEventListener('input', () => this.handleContentChange());

    // Paste handler for images and links
    this.elements.contentArea.addEventListener('paste', (e) => this.handlePaste(e));

    // Formatting buttons
    document.querySelectorAll('.formatting-toolbar .tool-btn[data-command]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const cmd = btn.dataset.command;
        const val = btn.dataset.val || null;
        document.execCommand(cmd, false, val);
        this.elements.contentArea.focus();
        this.handleContentChange();
      });
    });

    // Highlight palette toggle
    this.elements.highlightToolBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.elements.highlightPalette.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!this.elements.highlightPalette.contains(e.target) && e.target !== this.elements.highlightToolBtn) {
        this.elements.highlightPalette.classList.add('hidden');
      }
    });

    // Color swatch clicks
    this.elements.highlightPalette.querySelectorAll('.color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const color = dot.dataset.color;
        if (color === 'transparent') {
          document.execCommand('removeFormat', false, null);
        } else {
          document.execCommand('hiliteColor', false, color);
        }
        this.elements.highlightPalette.classList.add('hidden');
        this.elements.contentArea.focus();
        this.handleContentChange();
      });
    });

    // Link insertion
    document.getElementById('insertLinkBtn').addEventListener('click', () => this.promptInsertLink());

    // Link click preview in editor
    this.elements.contentArea.addEventListener('click', (e) => {
      const anchor = e.target.closest('a');
      if (anchor) {
        e.preventDefault();
        this.showLinkPopup(anchor);
      } else {
        this.elements.linkPopup.classList.add('hidden');
      }
    });

    // Link popup action buttons
    document.getElementById('linkPreviewOpenBtn').addEventListener('click', () => {
      const url = this.elements.linkUrl.textContent;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    });

    document.getElementById('linkPreviewCloseBtn').addEventListener('click', () => {
      this.elements.linkPopup.classList.add('hidden');
    });

    document.getElementById('linkPreviewRemoveBtn').addEventListener('click', () => {
      if (this.currentActiveAnchor) {
        const text = this.currentActiveAnchor.textContent;
        const textNode = document.createTextNode(text);
        this.currentActiveAnchor.parentNode.replaceChild(textNode, this.currentActiveAnchor);
        this.elements.linkPopup.classList.add('hidden');
        this.handleContentChange();
      }
    });

    // Image attachments via file input
    this.elements.imageInput.addEventListener('change', (e) => this.handleImageSelect(e));

    // Voice recording events
    document.getElementById('recordVoiceBtn').addEventListener('click', () => this.startVoiceRecording());
    document.getElementById('stopRecordBtn').addEventListener('click', () => this.stopVoiceRecording(true));
    document.getElementById('cancelRecordBtn').addEventListener('click', () => this.stopVoiceRecording(false));

    // Tags input
    this.elements.tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = this.elements.tagInput.value.trim().replace(/^#/, '');
        if (val && !this.currentNote.tags.includes(val)) {
          this.currentNote.tags.push(val);
          this.renderTags();
          this.elements.tagInput.value = '';
          this.handleContentChange();
        }
      }
    });

    // Back & Done buttons
    document.getElementById('editorBackBtn').addEventListener('click', () => this.close());
    document.getElementById('editorDoneBtn').addEventListener('click', () => this.close());

    // Export note button (.skrib)
    document.getElementById('exportNoteBtn').addEventListener('click', () => {
      if (this.currentNote) {
        this.updateCurrentNoteFromFields();
        SkribbleStorage.exportNoteFile(this.currentNote);
      }
    });

    // Delete note button
    document.getElementById('deleteNoteBtn').addEventListener('click', () => {
      if (this.currentNote && confirm('Are you sure you want to delete this note?')) {
        const noteId = this.currentNote.id;
        SkribbleStorage.deleteNote(noteId);
        SkribbleSync.deleteFromDrive(noteId);
        this.close();
        if (window.SkribbleApp) window.SkribbleApp.renderNotesFeed();
      }
    });
  },

  /**
   * Opens the editor with a given note (or creates a new one)
   */
  open(note = null) {
    if (!note) {
      this.currentNote = {
        id: SkribbleStorage.generateId(),
        title: '',
        contentHtml: '',
        plainText: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        attachments: []
      };
    } else {
      this.currentNote = JSON.parse(JSON.stringify(note));
      if (!this.currentNote.attachments) this.currentNote.attachments = [];
      if (!this.currentNote.tags) this.currentNote.tags = [];
    }

    // Populate fields
    this.elements.titleInput.value = this.currentNote.title || '';
    this.elements.contentArea.innerHTML = this.currentNote.contentHtml || '';

    // Date display
    const d = new Date(this.currentNote.createdAt || Date.now());
    this.elements.dateText.textContent = d.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }) + ' • ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    this.elements.saveStatus.textContent = 'Ready';
    this.elements.saveStatus.style.color = 'var(--accent)';

    this.renderAttachments();
    this.renderTags();

    // Show editor
    this.elements.view.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  },

  close() {
    this.updateCurrentNoteFromFields();
    if (this.currentNote && (this.currentNote.title || this.currentNote.plainText || this.currentNote.attachments.length)) {
      SkribbleSync.scheduleAutosave(this.currentNote);
    }
    
    // Stop any active audio
    if (this.activeAudioElement) {
      this.activeAudioElement.pause();
      this.activeAudioElement = null;
    }

    this.elements.view.classList.add('hidden');
    document.body.style.overflow = '';
    this.elements.linkPopup.classList.add('hidden');

    if (window.SkribbleApp) {
      window.SkribbleApp.renderNotesFeed();
    }
  },

  handleContentChange() {
    if (!this.currentNote) return;
    this.updateCurrentNoteFromFields();
    SkribbleSync.scheduleAutosave(this.currentNote);
  },

  updateCurrentNoteFromFields() {
    if (!this.currentNote) return;
    this.currentNote.title = this.elements.titleInput.value.trim();
    this.currentNote.contentHtml = this.elements.contentArea.innerHTML;
    this.currentNote.plainText = this.elements.contentArea.innerText.trim();
  },

  /**
   * Clipboard paste handler: handles directly pasted images
   */
  handlePaste(e) {
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    const items = clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        this.readAndAttachImage(file);
      }
    }
  },

  /**
   * Prompts user for hyperlink and creates anchor
   */
  promptInsertLink() {
    const selection = window.getSelection();
    const selectedText = selection.toString();
    const url = prompt('Enter website link URL:', 'https://');
    
    if (url && url !== 'https://') {
      const fullUrl = /^https?:\/\//i.test(url) ? url : 'https://' + url;
      if (selectedText) {
        document.execCommand('createLink', false, fullUrl);
      } else {
        const title = prompt('Enter link title:', fullUrl) || fullUrl;
        const linkHtml = `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer">${title}</a>&nbsp;`;
        document.execCommand('insertHTML', false, linkHtml);
      }
      this.handleContentChange();
    }
  },

  /**
   * Shows link preview popup
   */
  showLinkPopup(anchor) {
    this.currentActiveAnchor = anchor;
    const url = anchor.getAttribute('href');
    this.elements.linkTitle.textContent = anchor.textContent || 'Link';
    this.elements.linkUrl.textContent = url;
    this.elements.linkPopup.classList.remove('hidden');
  },

  /**
   * Image attachment file selection
   */
  handleImageSelect(e) {
    const files = e.target.files;
    if (!files || !files.length) return;

    for (let i = 0; i < files.length; i++) {
      this.readAndAttachImage(files[i]);
    }
    this.elements.imageInput.value = '';
  },

  readAndAttachImage(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target.result;
      const attachment = {
        id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type: 'image',
        name: file.name || 'Pasted Image',
        mimeType: file.type || 'image/jpeg',
        data: base64Data
      };
      this.currentNote.attachments.push(attachment);
      this.renderAttachments();
      this.handleContentChange();
    };
    reader.readAsDataURL(file);
  },

  /**
   * Voice Recording via MediaRecorder (WebM/Opus)
   */
  async startVoiceRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.start();
      this.recordStartTime = Date.now();

      // Start live timer
      this.elements.recordingBanner.classList.remove('hidden');
      this.elements.recordingTimer.textContent = '00:00';
      this.recordInterval = setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - this.recordStartTime) / 1000);
        const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
        const secs = String(elapsedSec % 60).padStart(2, '0');
        this.elements.recordingTimer.textContent = `${mins}:${secs}`;
      }, 500);

    } catch (err) {
      alert('Microphone access is required to record voice notes: ' + err.message);
    }
  },

  stopVoiceRecording(saveClip = true) {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return;

    clearInterval(this.recordInterval);
    this.elements.recordingBanner.classList.add('hidden');

    const durationSec = Math.max(1, Math.round((Date.now() - this.recordStartTime) / 1000));

    this.mediaRecorder.addEventListener('stop', () => {
      if (saveClip && this.audioChunks.length > 0) {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64Audio = e.target.result;
          const attachment = {
            id: 'audio_' + Date.now(),
            type: 'audio',
            name: `Voice Note (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
            mimeType: 'audio/webm;codecs=opus',
            duration: durationSec,
            data: base64Audio
          };
          this.currentNote.attachments.push(attachment);
          this.renderAttachments();
          this.handleContentChange();
        };
        reader.readAsDataURL(audioBlob);
      }
      this.audioChunks = [];
    }, { once: true });

    this.mediaRecorder.stop();
  },

  /**
   * Renders attachments (Images & Audio clips)
   */
  renderAttachments() {
    const images = this.currentNote.attachments.filter(a => a.type === 'image');
    const audios = this.currentNote.attachments.filter(a => a.type === 'audio');

    // Images
    if (images.length > 0) {
      this.elements.imagesSection.classList.remove('hidden');
      this.elements.imagesList.innerHTML = images.map(img => `
        <div class="attached-img-item" data-id="${img.id}">
          <img src="${img.data}" alt="${img.name}">
          <button type="button" class="attached-img-delete" title="Remove image">&times;</button>
        </div>
      `).join('');

      this.elements.imagesList.querySelectorAll('.attached-img-item').forEach(item => {
        const imgId = item.dataset.id;
        const imgData = images.find(i => i.id === imgId);

        // Click to open lightbox
        item.querySelector('img').addEventListener('click', () => {
          if (window.SkribbleApp) window.SkribbleApp.openLightbox(imgData.data);
        });

        // Delete button
        item.querySelector('.attached-img-delete').addEventListener('click', (e) => {
          e.stopPropagation();
          this.currentNote.attachments = this.currentNote.attachments.filter(a => a.id !== imgId);
          this.renderAttachments();
          this.handleContentChange();
        });
      });
    } else {
      this.elements.imagesSection.classList.add('hidden');
      this.elements.imagesList.innerHTML = '';
    }

    // Audio Clips
    if (audios.length > 0) {
      this.elements.voiceSection.classList.remove('hidden');
      this.elements.voiceList.innerHTML = audios.map(aud => `
        <div class="voice-clip-card" data-id="${aud.id}">
          <button type="button" class="voice-play-btn" title="Play / Pause">▶</button>
          <div class="voice-info">
            <div class="voice-name">${aud.name || 'Voice Note'}</div>
            <div class="voice-duration">${aud.duration || 0}s • audio/webm</div>
          </div>
          <button type="button" class="voice-delete-btn" title="Delete voice note">&times;</button>
        </div>
      `).join('');

      this.elements.voiceList.querySelectorAll('.voice-clip-card').forEach(card => {
        const audId = card.dataset.id;
        const audData = audios.find(a => a.id === audId);
        const playBtn = card.querySelector('.voice-play-btn');

        let audioObj = null;

        playBtn.addEventListener('click', () => {
          if (!audioObj) {
            audioObj = new Audio(audData.data);
            audioObj.onended = () => {
              playBtn.textContent = '▶';
              this.activeAudioElement = null;
            };
          }

          if (audioObj.paused) {
            if (this.activeAudioElement && this.activeAudioElement !== audioObj) {
              this.activeAudioElement.pause();
            }
            audioObj.play();
            playBtn.textContent = '⏸';
            this.activeAudioElement = audioObj;
          } else {
            audioObj.pause();
            playBtn.textContent = '▶';
          }
        });

        card.querySelector('.voice-delete-btn').addEventListener('click', () => {
          if (audioObj) audioObj.pause();
          this.currentNote.attachments = this.currentNote.attachments.filter(a => a.id !== audId);
          this.renderAttachments();
          this.handleContentChange();
        });
      });
    } else {
      this.elements.voiceSection.classList.add('hidden');
      this.elements.voiceList.innerHTML = '';
    }
  },

  /**
   * Renders tags
   */
  renderTags() {
    if (!this.currentNote.tags) this.currentNote.tags = [];
    this.elements.tagsList.innerHTML = this.currentNote.tags.map(t => `
      <span class="tag-badge">
        #${t}
        <span class="tag-remove" data-tag="${t}">&times;</span>
      </span>
    `).join('');

    this.elements.tagsList.querySelectorAll('.tag-remove').forEach(span => {
      span.addEventListener('click', () => {
        const t = span.dataset.tag;
        this.currentNote.tags = this.currentNote.tags.filter(x => x !== t);
        this.renderTags();
        this.handleContentChange();
      });
    });
  }
};

window.SkribbleEditor = SkribbleEditor;
