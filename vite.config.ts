import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pagesのプロジェクトサイト配信パス。
// `npm run dev`はルート配信、通常のbuild/previewはこのパス配下で配信する（docs/design.md §4.4）。
const GITHUB_PAGES_BASE = '/poc_master_data_management_sys/'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : GITHUB_PAGES_BASE,
  plugins: [react()],
}))
