// Vercel REST API deployment script (bypasses DNS issue)
import https from 'https';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN = process.env.VERCEL_TOKEN || '';
const PROJECT_NAME = 'agent-risk-panel';
const TEAM_SLUG = null; // personal account

function apiRequest(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: '76.76.21.112',
      path: apiPath,
      method,
      headers: {
        'Host': 'api.vercel.com',
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': 'application/json',
      }
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch (e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function collectFiles(dir, base = '') {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.vercel', 'dist', '.env', '.env.local'].includes(entry.name)) continue;
    if (entry.name.startsWith('.') && entry.name !== '.gitignore') continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, relPath));
    } else {
      const content = fs.readFileSync(fullPath);
      files.push({
        file: relPath,
        data: content.toString('base64'),
        encoding: 'base64',
        sha: crypto.createHash('sha1').update(content).digest('hex'),
        size: content.length,
      });
    }
  }
  return files;
}

async function deploy() {
  console.log('🚀 Starting deployment to Vercel...\n');

  // Step 1: Check if project exists
  console.log('1. Checking for existing project...');
  const listRes = await apiRequest('GET', '/v9/projects?limit=100');
  const existing = listRes.body.projects?.find(p => p.name === PROJECT_NAME);

  let projectId;
  if (existing) {
    projectId = existing.id;
    console.log(`   Found existing project: ${PROJECT_NAME} (${projectId})`);
  } else {
    // Create project
    console.log(`   Creating new project: ${PROJECT_NAME}`);
    const createRes = await apiRequest('POST', '/v10/projects', {
      name: PROJECT_NAME,
      framework: null,
    });
    if (createRes.status >= 400) {
      console.error('   Failed to create project:', JSON.stringify(createRes.body));
      process.exit(1);
    }
    projectId = createRes.body.id;
    console.log(`   Created project: ${PROJECT_NAME} (${projectId})`);
  }

  // Step 2: Collect files
  console.log('\n2. Collecting project files...');
  const files = collectFiles(__dirname);
  // Exclude the deploy script itself and dns-patch
  const filtered = files.filter(f => !['deploy.mjs', 'dns-patch.cjs'].includes(f.file));
  console.log(`   Found ${filtered.length} files`);

  // Step 3: Create deployment
  console.log('\n3. Creating deployment...');
  const deployBody = {
    name: PROJECT_NAME,
    files: filtered.map(f => ({
      file: f.file,
      data: f.data,
      encoding: 'base64',
    })),
    projectSettings: {
      framework: null,
      buildCommand: 'npm run build',
      outputDirectory: null,
      installCommand: 'npm install',
    },
    target: 'production',
  };

  const deployRes = await apiRequest('POST', `/v13/deployments?projectId=${projectId}`, deployBody);

  if (deployRes.status >= 400) {
    console.error('   Deployment failed:', JSON.stringify(deployRes.body, null, 2));
    process.exit(1);
  }

  const deployment = deployRes.body;
  console.log(`   Deployment created: ${deployment.id}`);
  console.log(`   Status: ${deployment.readyState || deployment.status}`);

  // Step 4: Wait for deployment to be ready
  console.log('\n4. Waiting for deployment to be ready...');
  let ready = false;
  let attempts = 0;
  let deployUrl = deployment.url;

  while (!ready && attempts < 30) {
    await new Promise(r => setTimeout(r, 5000));
    attempts++;
    const checkRes = await apiRequest('GET', `/v13/deployments/${deployment.id}`);
    const state = checkRes.body.readyState || checkRes.body.status;
    deployUrl = checkRes.body.url || deployUrl;
    process.stdout.write(`   [${attempts}] State: ${state}\r`);

    if (state === 'READY') {
      ready = true;
    } else if (state === 'ERROR' || state === 'CANCELED') {
      console.error(`\n   Deployment failed with state: ${state}`);
      console.error('   Error:', JSON.stringify(checkRes.body.errorMessage || checkRes.body.error));
      process.exit(1);
    }
  }

  if (!ready) {
    console.log('\n   Timed out waiting. Check Vercel dashboard for status.');
  }

  console.log(`\n\n✅ Deployment complete!`);
  console.log(`🌐 URL: https://${deployUrl}`);
  console.log(`\n⚠️  Next: Add OPENAI_API_KEY env var in Vercel dashboard:`);
  console.log(`   https://vercel.com/${PROJECT_NAME}/settings/environment-variables`);
}

deploy().catch(console.error);
