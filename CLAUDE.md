# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start the server (runs on http://localhost:3000)
npm start

# CLI usage - convert PDF to audio files
node cli.js <pdf-file> [options]
node cli.js book.pdf --voice en-GB-SoniaNeural --rate "+20%"
node cli.js book.pdf --start 5 --end 10  # Process specific chunks
node cli.js --list-voices  # List available voices
```

## Architecture

This is a PDF-to-speech application using Microsoft Edge TTS (neural voices). It has two interfaces:

**Web Server (`server.js`):**
- Express server with REST API for PDF upload, text extraction, and TTS generation
- PDF text stored in-memory (`pdfStore` Map) - not persistent across restarts
- Audio files cached in `audio/` directory
- Splits PDF text into ~10,000 character chunks at sentence boundaries

**CLI (`cli.js`):**
- Standalone tool that processes PDFs directly to MP3 files
- Outputs numbered chunk files to `./audio_output/` by default

**Web UI (`public/index.html`):**
- Single-page vanilla JS application
- Drag-and-drop PDF upload with auto-play between sections

## Key Implementation Details

- Uses ES modules (`"type": "module"` in package.json)
- `edge-tts` package provides free neural TTS without API keys
- Text cleaning strips non-ASCII characters and normalizes whitespace (`cleanTextForTTS` / `cleanText` functions)
- Chunks are created by splitting on sentence endings while respecting max character limit
- Audio caching: files named `{pdfId}_chunk_{index}_{voice}.mp3` are reused if they exist

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/voices` | GET | List available voices |
| `/api/upload` | POST | Upload PDF (multipart form) |
| `/api/pdf/:id` | GET | Get PDF info and chunks |
| `/api/pdf/:id/chunk/:index` | GET | Get chunk text |
| `/api/tts` | POST | Generate audio for a chunk |
| `/api/tts/custom` | POST | TTS for custom text |
