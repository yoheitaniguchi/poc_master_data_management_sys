import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// GitHub Pagesのプロジェクトサイト配信パス。
// `npm run dev`はルート配信、通常のbuild/previewはこのパス配下で配信する（docs/design.md §4.4）。
const GITHUB_PAGES_BASE = '/poc_master_data_management_sys/'

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  // `vite preview`もcommand==='serve'になるため、`command`だけでは`vite dev`と区別できない。
  // `isPreview`で判定しないと、build成果物（GITHUB_PAGES_BASE前提で生成済み）をpreviewが
  // ルート（'/'）で配信しようとしてしまい、アセットが404/フォールバックHTML化する。
  base: command === 'serve' && !isPreview ? '/' : GITHUB_PAGES_BASE,
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setupFakeIndexedDb.ts'],
  },
}))
