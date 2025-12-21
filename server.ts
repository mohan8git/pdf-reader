import express, { Request, Response } from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import * as musicMetadata from 'music-metadata';

const execFileAsync = promisify(execFile);

// Configuration
const PORT = parseInt(process.env.PORT || '3000', 10);

// Auto-detect edge-tts path based on environment
function getEdgeTTSPath(): string {
  const possiblePaths = [
    process.env.EDGE_TTS_PATH, // Custom env var
    '/home/ubuntu/.local/bin/edge-tts', // Ubuntu user install
    '/usr/local/bin/edge-tts', // System install
    '/Users/mohan/Library/Python/3.9/bin/edge-tts', // Mac
    'edge-tts', // In PATH
  ];

  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) return p;
  }

  // Fallback to just 'edge-tts' and hope it's in PATH
  return 'edge-tts';
}

const EDGE_TTS_PATH = getEdgeTTSPath();
console.log(`[Config] Using edge-tts at: ${EDGE_TTS_PATH}`);

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const AUDIO_DIR = path.join(__dirname, 'audio');

// Types
interface PDFData {
  id: string;
  filename: string;
  totalPages: number;
  totalChars: number;
  chunks: string[];
  uploadedAt: Date;
}

interface TTSProgress {
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
}

// In-memory stores
const pdfStore = new Map<string, PDFData>();
const ttsProgress = new Map<string, TTSProgress>();

// Voices
const VOICES = [
  { id: 'en-US-AriaNeural', name: 'Aria (US Female)', locale: 'en-US' },
  { id: 'en-US-GuyNeural', name: 'Guy (US Male)', locale: 'en-US' },
  { id: 'en-US-JennyNeural', name: 'Jenny (US Female)', locale: 'en-US' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia (UK Female)', locale: 'en-GB' },
  { id: 'en-GB-RyanNeural', name: 'Ryan (UK Male)', locale: 'en-GB' },
  { id: 'en-IN-NeerjaNeural', name: 'Neerja (Indian Female)', locale: 'en-IN' },
  { id: 'en-IN-PrabhatNeural', name: 'Prabhat (Indian Male)', locale: 'en-IN' },
  {
    id: 'en-AU-NatashaNeural',
    name: 'Natasha (Australian Female)',
    locale: 'en-AU',
  },
];

// Ensure directories exist
[UPLOAD_DIR, AUDIO_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Helper: TTS using Python edge-tts
async function generateTTS(
  text: string,
  outputPath: string,
  voice = 'en-US-AriaNeural',
  rate = '+0%'
): Promise<void> {
  const tempFile = `/tmp/tts-${Date.now()}.txt`;
  fs.writeFileSync(tempFile, text, 'utf8');

  try {
    const args = [
      '--file',
      tempFile,
      '--write-media',
      outputPath,
      '--voice',
      voice,
    ];
    if (rate && rate !== '+0%') args.push('--rate', rate);
    await execFileAsync(EDGE_TTS_PATH, args, { timeout: 120000 });
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
}

// Helper: Get audio duration
async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const metadata = await musicMetadata.parseFile(filePath);
    return metadata.format.duration || 0;
  } catch {
    return 0;
  }
}

// Helper: Clean text for TTS
function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\s+/g, ' ')
    .replace(/^\d+\s*$/gm, '')
    .trim();
}

// Helper: Split text into chunks
function splitIntoChunks(text: string, maxChars = 10000): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length < maxChars) {
      current += sentence + ' ';
    } else {
      if (current) chunks.push(current.trim());
      current = sentence + ' ';
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// Express app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/audio', express.static(AUDIO_DIR));

// Multer config
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  fileFilter: (_, file, cb) => {
    cb(null, file.mimetype === 'application/pdf');
  },
});

// Routes
app.get('/api/voices', (_, res) => res.json(VOICES));

app.get('/api/health', (_, res) =>
  res.json({ status: 'ok', timestamp: Date.now() })
);

app.post(
  '/api/upload',
  upload.single('pdf'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No PDF uploaded' });

      const buffer = fs.readFileSync(req.file.path);
      const pdfData = await pdfParse(buffer);
      const fullText = cleanText(pdfData.text);
      const chunks = splitIntoChunks(fullText);
      const pdfId = Date.now().toString(36);

      pdfStore.set(pdfId, {
        id: pdfId,
        filename: req.file.originalname,
        totalPages: pdfData.numpages,
        totalChars: fullText.length,
        chunks,
        uploadedAt: new Date(),
      });

      fs.unlinkSync(req.file.path);

      console.log(
        `[Upload] ${req.file.originalname} -> ${pdfId} (${chunks.length} chunks)`
      );

      res.json({
        success: true,
        pdfId,
        filename: req.file.originalname,
        totalPages: pdfData.numpages,
        totalChunks: chunks.length,
        totalChars: fullText.length,
        estimatedMinutes: Math.ceil(fullText.split(/\s+/).length / 150),
      });
    } catch (error: any) {
      console.error('[Upload Error]', error.message);
      res.status(500).json({ error: error.message });
    }
  }
);

app.get('/api/pdf/:pdfId', (req: Request, res: Response) => {
  const pdf = pdfStore.get(req.params.pdfId);
  if (!pdf) return res.status(404).json({ error: 'PDF not found' });

  res.json({
    id: pdf.id,
    filename: pdf.filename,
    totalPages: pdf.totalPages,
    totalChunks: pdf.chunks.length,
    totalChars: pdf.totalChars,
    chunks: pdf.chunks.map((chunk, i) => ({
      index: i,
      preview: chunk.substring(0, 100) + '...',
      chars: chunk.length,
    })),
  });
});

app.get('/api/pdf/:pdfId/chunks', (req: Request, res: Response) => {
  const pdf = pdfStore.get(req.params.pdfId);
  if (!pdf) return res.status(404).json({ error: 'PDF not found' });

  res.json({
    id: pdf.id,
    filename: pdf.filename,
    chunks: pdf.chunks.map((text, index) => ({
      index,
      text,
      wordCount: text.split(/\s+/).filter((w) => w.length > 0).length,
    })),
  });
});

app.get('/api/pdf/:pdfId/chunk/:chunkIndex', (req: Request, res: Response) => {
  const pdf = pdfStore.get(req.params.pdfId);
  if (!pdf) return res.status(404).json({ error: 'PDF not found' });

  const index = parseInt(req.params.chunkIndex);
  if (index < 0 || index >= pdf.chunks.length) {
    return res.status(400).json({ error: 'Invalid chunk index' });
  }

  res.json({ index, text: pdf.chunks[index], totalChunks: pdf.chunks.length });
});

app.post('/api/tts', async (req: Request, res: Response) => {
  try {
    const {
      pdfId,
      chunkIndex,
      voice = 'en-US-AriaNeural',
      rate = '+0%',
    } = req.body;

    const pdf = pdfStore.get(pdfId);
    if (!pdf) return res.status(404).json({ error: 'PDF not found' });

    const index = parseInt(chunkIndex);
    if (index < 0 || index >= pdf.chunks.length) {
      return res.status(400).json({ error: 'Invalid chunk index' });
    }

    const text = pdf.chunks[index];
    if (text.length < 10)
      return res.status(400).json({ error: 'Chunk too short' });

    const audioFilename = `${pdfId}_chunk_${index}_${voice.replace(
      /[^a-zA-Z0-9]/g,
      ''
    )}.mp3`;
    const audioPath = path.join(AUDIO_DIR, audioFilename);

    // Return cached if exists
    if (fs.existsSync(audioPath)) {
      const duration = await getAudioDuration(audioPath);
      return res.json({
        success: true,
        audioUrl: `/audio/${audioFilename}`,
        duration,
        cached: true,
      });
    }

    // Update progress
    const progressKey = `${pdfId}_${index}`;
    ttsProgress.set(progressKey, {
      status: 'processing',
      progress: 50,
      message: 'Generating audio...',
    });

    console.log(`[TTS] Generating chunk ${index} for ${pdfId}`);
    await generateTTS(text, audioPath, voice, rate);

    const duration = await getAudioDuration(audioPath);
    ttsProgress.set(progressKey, {
      status: 'completed',
      progress: 100,
      message: 'Done',
    });

    res.json({
      success: true,
      audioUrl: `/audio/${audioFilename}`,
      duration,
      cached: false,
    });
  } catch (error: any) {
    console.error('[TTS Error]', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get(
  '/api/tts/progress/:pdfId/:chunkIndex',
  (req: Request, res: Response) => {
    const key = `${req.params.pdfId}_${req.params.chunkIndex}`;
    const progress = ttsProgress.get(key) || {
      status: 'pending',
      progress: 0,
      message: 'Waiting...',
    };
    res.json(progress);
  }
);

app.post('/api/tts/custom', async (req: Request, res: Response) => {
  try {
    const { text, voice = 'en-US-AriaNeural', rate = '+0%' } = req.body;
    if (!text || text.length < 2)
      return res.status(400).json({ error: 'Text required' });

    const audioFilename = `custom_${Date.now()}.mp3`;
    const audioPath = path.join(AUDIO_DIR, audioFilename);

    await generateTTS(cleanText(text), audioPath, voice, rate);
    const duration = await getAudioDuration(audioPath);

    res.json({ success: true, audioUrl: `/audio/${audioFilename}`, duration });
  } catch (error: any) {
    console.error('[TTS Error]', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Start server - listen on 0.0.0.0 so mobile devices can connect
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  PDF Audio Server running on http://192.168.1.12:${PORT}

  Endpoints:
    POST /api/upload      - Upload PDF
    GET  /api/pdf/:id     - Get PDF info
    GET  /api/pdf/:id/chunks - Get all chunks
    POST /api/tts         - Generate audio
    GET  /api/voices      - List voices
  `);
});
