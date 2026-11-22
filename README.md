# Skribble

A personal note-taking web application featuring a deep dark aesthetic with light green accents. Designed as a responsive single-page web app with offline caching and real-time cloud backup.

---

## Features

- **Dark Theme with Light Green Accent**: Built for comfortable reading and focused journaling with clean typography and date headers.
- **Rich Text Formatting**: In-line tools for bold, italic, underline, strikethrough, monospace, and color highlighting.
- **Hyperlinks with Popups**: Inspect and open web links directly via contextual preview cards.
- **Voice Notes**: Record audio notes in WebM/Opus format directly from your browser and listen back anytime.
- **Image Attachments**: Attach photos from your device or paste them from your clipboard.
- **Unified `.skrib` Format**: Each note is stored as a self-contained `.skrib` JSON file encapsulating content, metadata, images, and audio clips.
- **Google Drive Autosave**: Automatically sync notes to your Google Drive via a serverless Google Apps Script webhook owned by your account.
- **Persistent Device Authentication**: Saves your webhook endpoint and passkey locally on your device for seamless subsequent access.
- **Offline Capable**: Includes service worker support and local storage caching.

---

## File Format (`.skrib`)

Notes are exported and stored using the `.skrib` extension. The file format is structured JSON containing:
- `id`: Unique note identifier
- `title`: Note title
- `contentHtml`: Rich text HTML markup
- `plainText`: Plain text excerpt for search and previews
- `createdAt` & `updatedAt`: ISO timestamps
- `tags`: Array of category tags
- `attachments`: List of base64-encoded images and audio recordings

---

## Setup & Cloud Sync

1. Open `index.html` in your web browser or serve it with any local static HTTP server.
2. In Google Apps Script, create a new web app project configured to write `.skrib` files to your Google Drive folder (`Skribble Notes`).
3. Deploy the script as a Web App (Execute as: Me, Access: Anyone).
4. Open the Settings panel inside Skribble, enter your Web App URL and chosen access key, and save.
5. All notes will automatically save locally and push to your Google Drive in real time.

---

## License

MIT License. Copyright (c) 2026 Ruru.
