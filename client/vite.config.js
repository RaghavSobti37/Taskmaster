import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'

const require = createRequire(import.meta.url)
const {
  CANONICAL_STAGING_API_URL,
  isProductionRenderApiHost,
} = require('./scripts/generateVercelConfig.cjs')

const publicDir = path.resolve(__dirname, 'public')
const iconsDir = path.join(publicDir, 'icons')
const brandIconAssets = fs.existsSync(iconsDir)
  ? fs.readdirSync(iconsDir).filter((f) => /\.(png|json)$/i.test(f)).map((f) => `icons/${f}`)
  : []
const agentationStub = path.resolve(__dirname, 'src/components/dev/agentationStub.js')
// Repo lives under OneDrive on this machine — sync retouches mtimes on src/ and public/ after every save.
const isOneDriveWorkspace = /OneDrive/i.test(__dirname)

const sanitizePreviewViteApiUrl = () => {
  if (process.env.VERCEL !== '1' || process.env.VERCEL_ENV !== 'preview') return
  const current = String(process.env.VITE_API_URL || '').trim()
  if (!current) return
  try {
    const host = new URL(current).hostname.toLowerCase()
    if (!isProductionRenderApiHost(host)) return
    console.warn(
      `[vite] Preview build overriding production VITE_API_URL (${current}) → ${CANONICAL_STAGING_API_URL}`,
    )
    process.env.VITE_API_URL = CANONICAL_STAGING_API_URL
  } catch {
    /* ignore invalid VITE_API_URL */
  }
}

/** Vercel CLI injects Production env into `vercel dev` — committed .env.development wins locally. */
const LOCAL_DEV_ENV_OVERRIDE_KEYS = [
  'VITE_API_URL',
  'VITE_CLERK_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
]

const applyLocalDevEnvOverrides = (mode, env) => {
  if (mode !== 'development') return env
  const devFile = loadEnv('development', __dirname, '')
  for (const key of LOCAL_DEV_ENV_OVERRIDE_KEYS) {
    const value = String(devFile[key] || '').trim()
    if (!value) continue
    env[key] = value
    process.env[key] = value
  }
  return env
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  sanitizePreviewViteApiUrl()
  const env = applyLocalDevEnvOverrides(mode, loadEnv(mode, __dirname, ''))
  const clerkPk = env.VITE_CLERK_PUBLISHABLE_KEY || env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ''
  const vercelProduction = process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production'
  const apiUrl = (env.VITE_API_URL || '').trim()
  const prodApiPattern = new RegExp(`${['taskmaster', 'jfw0'].join('-')}\\.onrender\\.com|coreknot-api\\.onrender\\.com`, 'i')
  if (mode === 'development' && prodApiPattern.test(apiUrl)) {
    throw new Error(
      'Local Vite dev must not use production VITE_API_URL. ' +
      'Set client/.env.development VITE_API_URL=http://localhost:5000, unset shell/vercel production env, then restart vite.',
    )
  }
  if (mode === 'development' && clerkPk.startsWith('pk_live_')) {
    throw new Error(
      'Clerk pk_live_ in local development. Use pk_test_ from client/.env.development. ' +
      'vercel dev injects Production env — use npm run dev for local work.',
    )
  }
  if (vercelProduction && clerkPk.startsWith('pk_test_')) {
    throw new Error(
      'Clerk production build uses pk_test_ (development). Create a Clerk production instance, '
      + 'set pk_live_ on Vercel, then redeploy. See scripts/push-clerk-production-env.mjs',
    )
  }
  const agentationEnabled =
    mode === 'development' && env.VITE_ENABLE_AGENTATION === 'true'
  // Strangler: VITE_NEST_ATTENDANCE / VITE_NEST_TASKS → NestJS :5001
  const nestProxy = (envKey, overrideKey, fallbackPort = '5001') =>
    env[overrideKey]
    || (env[envKey] === 'true' ? `http://127.0.0.1:${fallbackPort}` : 'http://127.0.0.1:5000')
  const attendanceProxyTarget = nestProxy('VITE_NEST_ATTENDANCE', 'VITE_ATTENDANCE_PROXY')
  const tasksProxyTarget = nestProxy('VITE_NEST_TASKS', 'VITE_TASKS_PROXY')
  const posthogRegion = String(env.VITE_POSTHOG_HOST || '').toLowerCase().includes('eu') ? 'eu' : 'us'
  const posthogApiTarget = `https://${posthogRegion}.i.posthog.com`
  const posthogAssetsTarget = `https://${posthogRegion}-assets.i.posthog.com`
  const isAuthBuild = mode === 'auth'
  // ponytail: COEP blocks Razorpay checkout iframe — only enable for OPFS local-first dev
  const isolatedForOpfs = env.VITE_LOCAL_FIRST === 'true'
  const crossOriginDevHeaders = {
    'Cross-Origin-Opener-Policy': isolatedForOpfs ? 'same-origin' : 'same-origin-allow-popups',
    ...(isolatedForOpfs ? { 'Cross-Origin-Embedder-Policy': 'credentialless' } : {}),
  }

  return {
  // ponytail: Vercel/Clerk docs often set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY — expose alongside VITE_
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  define: {
    __AGENTATION_ENABLED__: JSON.stringify(agentationEnabled),
  },
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
    // ponytail: react-icons/fa is huge — on-demand optimize can 504 and break lazy chunks (e.g. ArtistPathProfileSlider)
    include: ['react-icons/fa', 'react-icons/si'],
  },
  plugins: [
    react(),
    tailwindcss(),
    // ponytail: auth host is sign-in only — no PWA/SW (precache pulled 300+ app chunks on /login)
    ...(isAuthBuild
      ? []
      : [
          VitePWA({
            registerType: 'prompt',
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.js',
            injectRegister: false,
            includeAssets: [
              'brand-mark.svg',
              'favicon.svg',
              'favicon.ico',
              'safari-pinned-tab.svg',
              'manifest.json',
              ...brandIconAssets,
            ],
            manifest: false,
            injectManifest: {
              globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
              maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
            },
            devOptions: {
              enabled: false,
              type: 'module',
            },
          }),
        ]),
    ...(mode === 'production' && !isAuthBuild
      ? [
          visualizer({
            filename: 'dist/bundle-analysis.html',
            open: false,
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
    ...(isAuthBuild
      ? [
          {
            name: 'auth-dist-finalize',
            closeBundle() {
              const distDir = path.resolve(__dirname, 'dist')
              const authHtml = path.join(distDir, 'index-auth.html')
              const indexHtml = path.join(distDir, 'index.html')
              if (fs.existsSync(authHtml)) {
                fs.copyFileSync(authHtml, indexHtml)
                fs.unlinkSync(authHtml)
              }
              const swPath = path.join(distDir, 'sw.js')
              if (fs.existsSync(swPath)) fs.unlinkSync(swPath)
              for (const name of fs.readdirSync(distDir)) {
                if (name.startsWith('workbox-') && name.endsWith('.js')) {
                  fs.unlinkSync(path.join(distDir, name))
                }
              }
            },
          },
        ]
      : []),
  ],
  resolve: {
    // ponytail: workspace hoists react-dom under client/ — dedupe for Rolldown resolution
    dedupe: ['react', 'react-dom'],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared"),
      ...(mode === 'production' ? { agentation: agentationStub } : {}),
    },
  },
  server: {
    headers: crossOriginDevHeaders,
    // OneDrive on Windows rewrites mtimes on synced files (public/ and src/) → spurious full reloads.
    watch: {
      // Collapse OneDrive double-touch / sync churn into a single reload per real save.
      awaitWriteFinish: {
        stabilityThreshold: isOneDriveWorkspace ? 750 : 200,
        pollInterval: 100,
      },
      ignored: [
        '**/vercel.json',
        '**/vercel.json.example',
        '**/public/icons/**',
        '**/public/manifest.json',
        '**/public/favicon.ico',
        '**/public/safari-pinned-tab.svg',
        '**/.cursor/**',
        '**/.specify/**',
        '**/docs/**',
        '**/dist/**',
        '**/bundle-analysis.html',
      ],
    },
    proxy: {
      // Strangler: VITE_NEST_ATTENDANCE=true or VITE_ATTENDANCE_PROXY=http://127.0.0.1:5001
      '/api/attendance': {
        target: attendanceProxyTarget,
        changeOrigin: true,
        cookieDomainRewrite: '',
      },
      '^/api/tasks/.+/activity': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        cookieDomainRewrite: '',
      },
      '/api/tasks': {
        target: tasksProxyTarget,
        changeOrigin: true,
        cookieDomainRewrite: '',
      },
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        cookieDomainRewrite: '',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const existing = req.headers['x-forwarded-for'];
            const clientIp = req.socket?.remoteAddress;
            if (clientIp && !existing) {
              proxyReq.setHeader('X-Forwarded-For', clientIp);
            }
          });
        },
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const existing = req.headers['x-forwarded-for'];
            const clientIp = req.socket?.remoteAddress;
            if (clientIp && !existing) {
              proxyReq.setHeader('X-Forwarded-For', clientIp);
            }
          });
        },
      },
      '/ph/static': {
        target: posthogAssetsTarget,
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/ph/, ''),
      },
      '/ph/array': {
        target: posthogAssetsTarget,
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/ph/, ''),
      },
      '/ph': {
        target: posthogApiTarget,
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/ph/, ''),
      },
    },
  },
  preview: {
    headers: crossOriginDevHeaders,
    proxy: {
      // Strangler: VITE_NEST_ATTENDANCE=true or VITE_ATTENDANCE_PROXY=http://127.0.0.1:5001
      '/api/attendance': {
        target: attendanceProxyTarget,
        changeOrigin: true,
        cookieDomainRewrite: '',
      },
      '^/api/tasks/.+/activity': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        cookieDomainRewrite: '',
      },
      '/api/tasks': {
        target: tasksProxyTarget,
        changeOrigin: true,
        cookieDomainRewrite: '',
      },
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        cookieDomainRewrite: '',
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    modulePreload: {
      polyfill: true,
      resolveDependencies: (_filename, deps) =>
        deps.filter(
          (dep) =>
            !/mermaid|recharts|quill|xyflow|framer-motion|cytoscape|wardley|@xyflow/i.test(dep)
        ),
    },
    rollupOptions: {
      input: isAuthBuild
        ? path.resolve(__dirname, 'index-auth.html')
        : path.resolve(__dirname, 'index.html'),
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/.test(id)) {
            return 'react';
          }
          if (id.includes('@tanstack/react-query')) return 'query';
          if (id.includes('axios')) return 'axios';
          if (id.includes('lucide-react')) return 'lucide';
          if (id.includes('socket.io-client')) return 'socket';
          if (id.includes('recharts')) return 'recharts';
          if (id.includes('react-quill') || /[\\/]quill[\\/]/.test(id)) return 'quill';
          if (id.includes('framer-motion')) return 'framer-motion';
          if (id.includes('@xyflow')) return 'xyflow';
          if (id.includes('mermaid')) return 'mermaid';
          return undefined;
        },
      },
    },
  }
}})
