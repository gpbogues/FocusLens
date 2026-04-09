import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy all /api/* requests to the EC2 backend, stripping the /api prefix
      '/api': {
        target: 'http://100.27.212.225:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy) => {
          // EC2 backend sets Secure cookies, but dev runs on HTTP localhost,
          // so the browser silently drops them. Strip Secure + relax SameSite here.
          proxy.on('proxyRes', (proxyRes) => {
            const cookies = proxyRes.headers['set-cookie'];
            if (cookies) {
              proxyRes.headers['set-cookie'] = cookies.map(c =>
                c.replace(/;\s*Secure/gi, '').replace(/SameSite=Strict/gi, 'SameSite=Lax')
              );
            }
          });
        },
      },
    },
  },
})
