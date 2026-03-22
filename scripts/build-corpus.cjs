const fs = require('fs');
const path = require('path');

const SAMPLES_DIR = 'C:\\Users\\keepe\\Desktop\\B角色训练过程样本\\clean_samples';
const P6_PATH = 'C:\\Users\\keepe\\Desktop\\B角色训练过程样本\\p6_real_corpus_fixed.json';
const P11_SOURCE = 'C:\\Users\\keepe\\Desktop\\B角色训练过程样本\\p11_source_extraction.md';
const P11_GREY = 'C:\\Users\\keepe\\Desktop\\B角色训练过程样本\\p11_grey_control_extraction.md';
const OUTPUT = path.join(__dirname, '..', 'data', 'corpus.json');

const corpus = [];

function extractSection(content, header) {
  const escaped = header.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp('[【]' + escaped + '[】]\\n([\\s\\S]*?)(?=\\n──|\\n═|$)');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

// 1. Parse clean_samples
console.log('Parsing clean_samples...');
const sampleFiles = fs.readdirSync(SAMPLES_DIR).filter(function(f) { return f.endsWith('.md'); }).sort();

for (const file of sampleFiles) {
  const content = fs.readFileSync(path.join(SAMPLES_DIR, file), 'utf-8');
  const numMatch = file.match(/sample_(\d+)/);
  const num = numMatch ? numMatch[1] : file;

  const rawText = extractSection(content, '原始语料');
  const emotionSection = extractSection(content, '情绪状态');
  const cogSummary = extractSection(content, '认知结构摘要');
  const bAdvice = extractSection(content, 'B角干预切入建议');
  const vocabSection = extractSection(content, '词条提取');

  const intensityMatch = emotionSection.match(/情绪强度[：:]\s*(\d+)/);
  const dominantMatch = emotionSection.match(/主导情绪[：:]\s*(.+)/);

  const terms = [];
  const termMatches = vocabSection.match(/词条[：:]\s*(.+)/g);
  if (termMatches) {
    termMatches.forEach(function(t) { terms.push(t.replace(/词条[：:]\s*/, '').trim()); });
  }

  // Danger signals
  const dangerSignals = [];
  const checks = content.match(/☑\s*(.+)/g);
  if (checks) {
    checks.forEach(function(c) { dangerSignals.push(c.replace('☑ ', '').trim()); });
  }

  if (rawText) {
    corpus.push({
      id: 'clean_' + num,
      text: rawText,
      type: 'clean_sample',
      emotion: {
        dominant: dominantMatch ? dominantMatch[1].trim() : '',
        intensity: intensityMatch ? parseInt(intensityMatch[1]) : 0,
      },
      cognitive_summary: cogSummary,
      b_role_advice: bAdvice,
      danger_signals: dangerSignals,
      vocabulary: terms,
      metadata: { source_file: file },
    });
  }
}
console.log('  Parsed ' + sampleFiles.length + ' files -> ' + corpus.length + ' entries');

// 2. Parse p6_real_corpus_fixed.json
console.log('Parsing p6_real_corpus...');
const p6Start = corpus.length;
try {
  const p6Data = JSON.parse(fs.readFileSync(P6_PATH, 'utf-8'));
  p6Data.forEach(function(entry, idx) {
    corpus.push({
      id: 'p6_' + String(idx + 1).padStart(3, '0'),
      text: entry.input || entry.user_input || '',
      type: 'p6_corpus',
      metadata: {
        idealResponse: entry.idealResponse || entry.output || '',
        emotion: entry.emotion || '',
        stage: entry.stage || '',
        user_type: entry.user_type || '',
        danger_signals: entry.danger_signals || [],
      },
    });
  });
  console.log('  Parsed ' + (corpus.length - p6Start) + ' p6 entries');
} catch (e) {
  console.error('  Failed to parse p6:', e.message);
}

// 3. Parse p11 knowledge documents
console.log('Parsing p11 knowledge docs...');
const knowledgeStart = corpus.length;

function splitByHeadings(content, source) {
  var chunks = [];
  var lines = content.split('\n');
  var currentChunk = '';
  var currentTitle = '';
  var idx = 0;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (/^#{1,3}\s+/.test(line)) {
      if (currentChunk.trim()) {
        chunks.push({
          id: source + '_' + String(++idx).padStart(3, '0'),
          text: (currentTitle + '\n' + currentChunk).trim(),
          type: 'knowledge',
          metadata: { source: source, title: currentTitle },
        });
      }
      currentTitle = line.replace(/^#+\s+/, '').trim();
      currentChunk = '';
    } else {
      currentChunk += line + '\n';
    }
  }
  if (currentChunk.trim()) {
    chunks.push({
      id: source + '_' + String(++idx).padStart(3, '0'),
      text: (currentTitle + '\n' + currentChunk).trim(),
      type: 'knowledge',
      metadata: { source: source, title: currentTitle },
    });
  }
  return chunks;
}

try {
  var src = fs.readFileSync(P11_SOURCE, 'utf-8');
  corpus.push.apply(corpus, splitByHeadings(src, 'p11_source'));
} catch (e) {
  console.error('  p11_source error:', e.message);
}

try {
  var grey = fs.readFileSync(P11_GREY, 'utf-8');
  corpus.push.apply(corpus, splitByHeadings(grey, 'p11_grey'));
} catch (e) {
  console.error('  p11_grey error:', e.message);
}
console.log('  Parsed ' + (corpus.length - knowledgeStart) + ' knowledge chunks');

// 4. Write output
fs.writeFileSync(OUTPUT, JSON.stringify(corpus, null, 2), 'utf-8');
var sizeKB = Math.round(fs.statSync(OUTPUT).size / 1024);
console.log('\nDone! Total: ' + corpus.length + ' entries -> ' + OUTPUT + ' (' + sizeKB + ' KB)');
console.log('  clean_samples: ' + corpus.filter(function(e) { return e.type === 'clean_sample'; }).length);
console.log('  p6_corpus: ' + corpus.filter(function(e) { return e.type === 'p6_corpus'; }).length);
console.log('  knowledge: ' + corpus.filter(function(e) { return e.type === 'knowledge'; }).length);
