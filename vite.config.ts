import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    // Code copy từ app RN dùng `__DEV__` — map sang mode của Vite.
    define: { __DEV__: JSON.stringify(mode !== 'production') },
    server: {
      port: 5180,
      strictPort: true,
      // Proxy cùng origin giống nginx ở prod (xem deploy/nginx.conf):
      // - /sb-fn/*  → Supabase Edge Functions (preflight CORS của function đang lỗi 500)
      // - /r2-put/* → R2 S3 endpoint cho presigned PUT (bucket chưa bật CORS)
      proxy: {
        '/sb-fn': {
          target: `${env.VITE_SUPABASE_URL}/functions/v1`,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/sb-fn/, ''),
        },
        ...(env.R2_S3_ENDPOINT
          ? {
              '/r2-put': {
                target: env.R2_S3_ENDPOINT,
                changeOrigin: true,
                rewrite: (p: string) => p.replace(/^\/r2-put/, ''),
              },
            }
          : {}),
      },
    },
    preview: { port: 4180 },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/@supabase')) return 'supabase'
            if (
              id.includes('node_modules/react-aria') ||
              id.includes('node_modules/@react-aria') ||
              id.includes('node_modules/@react-stately') ||
              id.includes('node_modules/@heroui')
            )
              return 'ui'
          },
        },
      },
    },
  }
})
