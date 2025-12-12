# 📚 PDF Book Reader with Neural TTS

A Node.js application that converts PDF books to high-quality audio using Microsoft's Edge TTS neural voices. **100% Free - No API keys needed!**

## Features

- 🎯 **High-quality neural voices** - Uses Microsoft Edge TTS (same quality as ElevenLabs)
- 🌐 **Web UI** - Beautiful drag-and-drop interface
- 💻 **CLI support** - Command-line tool for batch processing
- 🚀 **Auto-play** - Automatically plays next section
- 📝 **Text preview** - See what's being read
- 🔊 **Multiple voices** - US, UK, Indian, Australian accents
- ⚡ **Speed control** - Adjust playback speed

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Server

```bash
npm start
```

### 3. Open Browser

Go to `http://localhost:3000`

### 4. Upload PDF & Listen!

## CLI Usage

For command-line usage without the web interface:

```bash
# Basic usage
node cli.js your-book.pdf

# With custom voice
node cli.js book.pdf --voice en-GB-SoniaNeural

# With custom speed
node cli.js book.pdf --rate "+20%"

# Process specific chapters (chunks 5-10)
node cli.js book.pdf --start 5 --end 10

# List all available voices
node cli.js --list-voices
```

## Available Voices

| Voice | Gender | Accent |
|-------|--------|--------|
| `en-US-AriaNeural` | Female | US (Recommended) |
| `en-US-GuyNeural` | Male | US |
| `en-US-JennyNeural` | Female | US |
| `en-GB-SoniaNeural` | Female | British |
| `en-GB-RyanNeural` | Male | British |
| `en-IN-NeerjaNeural` | Female | Indian |
| `en-IN-PrabhatNeural` | Male | Indian |
| `en-AU-NatashaNeural` | Female | Australian |

## API Endpoints

If you want to integrate with your own frontend:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/voices` | GET | List available voices |
| `/api/upload` | POST | Upload PDF (multipart form) |
| `/api/pdf/:id` | GET | Get PDF info and chunks |
| `/api/pdf/:id/chunk/:index` | GET | Get chunk text |
| `/api/tts` | POST | Generate audio for a chunk |
| `/api/tts/custom` | POST | TTS for custom text |

## Project Structure

```
pdf-reader/
├── server.js       # Express server with API
├── cli.js          # Command-line interface
├── public/
│   └── index.html  # Web UI
├── uploads/        # Temporary PDF storage
├── audio/          # Generated audio files
└── package.json
```

## Speed Options

| Option | Value |
|--------|-------|
| Very Slow | `-30%` |
| Slow | `-15%` |
| Normal | `+0%` |
| Fast | `+15%` |
| Very Fast | `+30%` |

## Tips

1. **For long books**: Use the CLI with `--start` and `--end` to process in batches
2. **Best voice for fiction**: `en-US-AriaNeural` or `en-GB-SoniaNeural`
3. **Best voice for technical books**: `en-US-GuyNeural`
4. **Speed up listening**: Use `+20%` or `+30%` rate for faster consumption

## Troubleshooting

### "No audio received" error
- The text might be too short or contain special characters
- The server cleans text automatically, but some PDFs have unusual formatting

### Slow generation
- Large chunks take longer to process
- Audio is cached, so replaying is instant

### PDF not parsing correctly
- Some scanned PDFs don't have extractable text
- Try a different PDF or use OCR first

## License

MIT - Use freely for personal projects!

---

Made with ❤️ for book lovers who want to listen instead of read.
