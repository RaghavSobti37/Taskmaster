import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectRegister: false,
      includeAssets: ['brand-mark.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
      },
      devOptions: {
        enabled: false,
        type: 'module'
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  server: {
    proxy: {
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
  preview: {
    proxy: {
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
})
