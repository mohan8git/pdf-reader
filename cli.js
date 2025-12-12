#!/usr/bin/env node

/**
 * PDF Book Reader - CLI Version
 * Usage: node cli.js <pdf-file> [options]
 */

import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { ttsSave, getVoices } from 'edge-tts';

// Parse CLI arguments
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
📚 PDF Book Reader - CLI

Usage:
  node cli.js <pdf-file> [options]

Options:
  --voice <voice>     Voice to use (default: en-US-AriaNeural)
  --rate <rate>       Speed: -30% to +50% (default: +0%)
  --start <num>       Start from chunk number
  --end <num>         End at chunk number
  --list-voices       List all available voices
  --output <dir>      Output directory (default: ./audio_output)
  --chunk-size <num>  Characters per chunk (default: 10000)

Examples:
  node cli.js book.pdf
  node cli.js book.pdf --voice en-GB-SoniaNeural --rate "+20%"
  node cli.js book.pdf --start 1 --end 5
  node cli.js --list-voices

Available Voices:
  en-US-AriaNeural       (US Female - Recommended)
  en-US-GuyNeural        (US Male)
  en-US-JennyNeural      (US Female)
  en-GB-SoniaNeural      (UK Female)
  en-GB-RyanNeural       (UK Male)
  en-IN-NeerjaNeural     (Indian Female)
  en-IN-PrabhatNeural    (Indian Male)
  en-AU-NatashaNeural    (Australian Female)
`);
    process.exit(0);
}

// List voices
if (args.includes('--list-voices')) {
    const voices = await getVoices();
    
    console.log('\n🎤 Available English Voices:\n');
    
    const englishVoices = voices.filter(v => v.Locale.startsWith('en-'));
    englishVoices.sort((a, b) => a.Locale.localeCompare(b.Locale));
    
    for (const voice of englishVoices) {
        console.log(`  ${voice.ShortName.padEnd(30)} ${voice.Gender.padEnd(8)} ${voice.Locale}`);
    }
    console.log('');
    process.exit(0);
}

// Get options
function getArg(name, defaultValue) {
    const index = args.indexOf(name);
    if (index === -1) return defaultValue;
    return args[index + 1] || defaultValue;
}

const pdfFile = args.find(a => !a.startsWith('--'));
const voice = getArg('--voice', 'en-US-AriaNeural');
const rate = getArg('--rate', '+0%');
const startChunk = parseInt(getArg('--start', '1')) - 1;
const endChunk = getArg('--end', null);
const outputDir = getArg('--output', './audio_output');
const chunkSize = parseInt(getArg('--chunk-size', '10000'));

// Validate PDF file
if (!pdfFile || !fs.existsSync(pdfFile)) {
    console.error('❌ Error: PDF file not found:', pdfFile);
    process.exit(1);
}

// Create output directory
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Helper: Clean text
function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '')
        .replace(/[^\x20-\x7E\n]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Helper: Split into chunks
function splitIntoChunks(text, maxChars) {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const chunks = [];
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

// Main
console.log(`
╔════════════════════════════════════════════════╗
║      📚 PDF Book Reader - CLI                  ║
╚════════════════════════════════════════════════╝
`);

// Read PDF
console.log('📖 Reading PDF:', pdfFile);
const dataBuffer = fs.readFileSync(pdfFile);
const pdfData = await pdfParse(dataBuffer);

const text = cleanText(pdfData.text);
const chunks = splitIntoChunks(text, chunkSize);

console.log(`   Pages: ${pdfData.numpages}`);
console.log(`   Characters: ${text.length.toLocaleString()}`);
console.log(`   Chunks: ${chunks.length}`);
console.log(`   Voice: ${voice}`);
console.log(`   Speed: ${rate}`);
console.log('');

// Determine range
const start = Math.max(0, startChunk);
const end = endChunk ? Math.min(parseInt(endChunk), chunks.length) : chunks.length;

console.log(`🔊 Generating audio for chunks ${start + 1} to ${end}...\n`);

// Generate audio
for (let i = start; i < end; i++) {
    const chunk = chunks[i];
    const outputFile = path.join(outputDir, `chunk_${String(i + 1).padStart(3, '0')}.mp3`);

    process.stdout.write(`   Chunk ${i + 1}/${chunks.length}... `);

    try {
        await ttsSave(chunk, outputFile, { voice, rate });
        console.log('✅');
    } catch (error) {
        console.log('❌', error.message);
    }
}

console.log(`
✅ Done! Audio files saved to: ${outputDir}/

To play:
  - Use any audio player
  - Files are named chunk_001.mp3, chunk_002.mp3, etc.
`);
