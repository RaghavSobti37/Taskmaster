import fs from 'fs'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'

const publicDir = path.resolve(__dirname, 'public')
const iconsDir = path.join(publicDir, 'icons')
const brandIconAssets = fs.existsSync(iconsDir)
  ? fs.readdirSync(iconsDir).filter((f) => /\.(png|json)$/i.test(f)).map((f) => `icons/${f}`)
  : []
const agentationStub = path.resolve(__dirname, 'src/components/dev/agentationStub.js')
// Repo lives under OneDrive on this machine — sync retouches mtimes on src/ and public/ after every save.
const isOneDriveWorkspace = /OneDrive/i.test(__dirname)

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const agentationEnabled =
    mode === 'development' && env.VITE_ENABLE_AGENTATION === 'true'
  // Strangler: VITE_NEST_ATTENDANCE / VITE_NEST_TASKS → NestJS :5001
  const nestProxy = (envKey, overrideKey, fallbackPort = '5001') =>
    env[overrideKey]
    || (env[envKey] === 'true' ? `http://127.0.0.1:${fallbackPort}` : 'http://127.0.0.1:5000')
  const attendanceProxyTarget = nestProxy('VITE_NEST_ATTENDANCE', 'VITE_ATTENDANCE_PROXY')
  const tasksProxyTarget = nestProxy('VITE_NEST_TASKS', 'VITE_TASKS_PROXY')

  return {
  define: {
    __AGENTATION_ENABLED__: JSON.stringify(agentationEnabled),
  },
  plugins: [
    react(),
    tailwindcss(),
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
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
      },
      devOptions: {
        enabled: false,
        type: 'module'
      }
    }),
    ...(mode === 'production'
      ? [
          visualizer({
            filename: 'dist/bundle-analysis.html',
            open: false,
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared"),
      ...(mode === 'production' ? { agentation: agentationStub } : {}),
    },
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
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
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
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
