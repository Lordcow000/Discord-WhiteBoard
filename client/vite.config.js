import {defineConfig} from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  envDir: '../',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      // 1. ADD THIS CLUSTER TO ROUTE WEBSOCKETS TO YOUR EXPRESS BACKEND
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true, // This enables WebSocket tunneling
      },
    },
    hmr: {
      clientPort: 443,
    },
    allowedHosts: true
  },
});
