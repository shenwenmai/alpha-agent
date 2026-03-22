/**
 * 用 OpenAI Whisper API 转写已下载的音频文件
 * Usage: node scripts/whisper-transcribe.mjs <audio-file-path> [video-title]
 */
import fs from 'fs';
import path from 'path';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const audioPath = process.argv[2];
const videoTitle = process.argv[3] || 'untitled';

if (!audioPath) {
  console.error('Usage: node scripts/whisper-transcribe.mjs <audio-file> [title]');
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY');
  process.exit(1);
}

async function transcribe() {
  const fileSize = fs.statSync(audioPath).size;
  console.log(`🎙️ Transcribing: ${audioPath}`);
  console.log(`   File size: ${(fileSize / 1024 / 1024).toFixed(1)} MB`);

  if (fileSize > 25 * 1024 * 1024) {
    console.error('   ❌ File > 25MB, Whisper API limit exceeded');
    process.exit(1);
  }

  const ext = path.extname(audioPath).slice(1) || 'webm';
  const mimeMap = { webm: 'audio/webm', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav' };

  const audioBuffer = fs.readFileSync(audioPath);
  const blob = new Blob([audioBuffer], { type: mimeMap[ext] || 'audio/webm' });

  const formData = new FormData();
  formData.append('file', blob, `audio.${ext}`);
  formData.append('model', 'whisper-1');
  formData.append('language', 'zh');
  formData.append('response_format', 'verbose_json');

  console.log('   Calling Whisper API...');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`   ❌ Whisper API error ${res.status}:`, err.slice(0, 500));
    process.exit(1);
  }

  const data = await res.json();
  console.log(`   ✅ Done! ${data.text?.length || 0} chars transcribed`);

  // Save result
  const outputPath = path.join(path.dirname(audioPath), 'transcript_test.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    title: videoTitle,
    language: data.language,
    duration: data.duration,
    text: data.text,
    segments: data.segments?.map(s => ({
      start: Math.round(s.start * 10) / 10,
      end: Math.round(s.end * 10) / 10,
      text: s.text,
    })),
  }, null, 2), 'utf-8');

  console.log(`📄 Saved: ${outputPath}`);
  console.log(`\n--- First 800 chars ---`);
  console.log(data.text.slice(0, 800));
}

transcribe().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
