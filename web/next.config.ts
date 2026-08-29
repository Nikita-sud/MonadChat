import type { NextConfig } from 'next'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const nextConfig: NextConfig = {
  // В репозитории два package-lock.json (контракты в корне, фронт здесь),
  // и Next выбирал корнем родительскую папку. Фиксируем явно, чтобы сборка
  // на Vercel собирала именно этот проект.
  turbopack: { root: dirname(fileURLToPath(import.meta.url)) },
}

export default nextConfig
