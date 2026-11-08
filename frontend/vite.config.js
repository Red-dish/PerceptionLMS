import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The port must stay 5173: Google sign-in and the API only allow this exact address.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
