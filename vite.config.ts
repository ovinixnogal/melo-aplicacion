import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'MELO - Gestión de Créditos',
        short_name: 'MELO',
        description: 'Plataforma oficial de gestión crediticia y financiera.',
        theme_color: '#C5FF41',
        background_color: '#0F172A',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    include: [
      'react-is',
      'react',
      'react-dom',
      'react-router-dom',
      'react-hook-form',
      'recharts',
    ],
  },
  build: {
    commonjsOptions: {
      include: [/react-is/, /node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-is') || id.includes('recharts') || id.includes('react-router')) {
              return 'vendor-charts';
            }
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            return 'vendor';
          }
        },
      },
    },
  },
})
