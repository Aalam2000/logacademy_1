// Сборка фронтенда — Vite (с 2026-09-28 вместо Create React App, см.
// README.md → «Сборка фронтенда: Vite»).
//
// Совместимость, сохранённая намеренно:
//  - переменные окружения по-прежнему REACT_APP_* (envPrefix) — прод-compose,
//    .env.dev/.env.prod и build-arg REACT_APP_API_URL не менялись; в коде
//    читать через import.meta.env.REACT_APP_*, НЕ process.env;
//  - прод-сборка кладётся в build/ (как у CRA) — nginx и Dockerfile ждут её там;
//  - dev-сервер на 0.0.0.0:3000 с опросом файлов (Docker Desktop на Windows
//    не всегда доносит fs-события через bind-mount).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envPrefix: 'REACT_APP_',
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    watch: { usePolling: true, interval: 300 },
  },
  preview: { host: '0.0.0.0', port: 3000 },
  build: { outDir: 'build' },
});
