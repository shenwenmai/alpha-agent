import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';
import dotenv from 'dotenv';

// 开发环境加载 .env
dotenv.config();

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const ALLOWED_MODELS = ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o-mini'];

// 开发时模拟 Vercel serverless /api/chat
function devApiProxy(): Plugin {
  return {
    name: 'dev-api-proxy',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'OPENAI_API_KEY not set in .env' }));
          return;
        }

        let body = '';
        for await (const chunk of req) body += chunk;
        try {
          const { messages, systemPrompt, temperature = 0.7, model: reqModel, maxTokens: reqMax } = JSON.parse(body);
          const model = ALLOWED_MODELS.includes(reqModel) ? reqModel : 'gpt-4.1-mini';
          const maxTokens = Math.min(Math.max(reqMax || 300, 50), 1000);

          const openaiRes = await fetch(OPENAI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model,
              messages: [{ role: 'system', content: systemPrompt }, ...messages],
              temperature,
              max_tokens: maxTokens,
            }),
          });

          const data = await openaiRes.json();
          if (!openaiRes.ok) {
            res.statusCode = openaiRes.status;
            res.end(JSON.stringify({ error: `OpenAI ${openaiRes.status}`, detail: JSON.stringify(data).slice(0, 200) }));
            return;
          }

          const choice = data.choices?.[0];
          const usage = data.usage || {};
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            text: choice?.message?.content || '',
            usage: { inputTokens: usage.prompt_tokens || 0, outputTokens: usage.completion_tokens || 0 },
            model,
          }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

export default defineConfig(({mode}) => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      devApiProxy(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        includeAssets: ['apple-touch-icon.png', 'icon-base.svg'],
        manifest: {
          name: '资金管家',
          short_name: '资金管家',
          description: '博弈操作系统·情绪转折点',
          theme_color: '#0A0A0A',
          background_color: '#0A0A0A',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-ui': ['lucide-react'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
