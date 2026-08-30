import { useState } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'poc-master-data-theme'

function resolveCurrentTheme(): Theme {
  const attr = document.documentElement.dataset.theme
  if (attr === 'light' || attr === 'dark') return attr
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Issue #25: 初期表示のテーマはindex.htmlのインラインスクリプトが描画前に
// localStorageから復元済み（<html data-theme>）。未選択の間はtheme.cssの
// prefers-color-scheme指定でOS設定に追従し、トグル操作した時点で明示的に固定する。
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(resolveCurrentTheme)

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    window.localStorage.setItem(STORAGE_KEY, next)
    setTheme(next)
  }

  return (
    <button type="button" className="theme-toggle" onClick={toggle}>
      {theme === 'dark' ? '☀️ ライトモード' : '🌙 ダークモード'}
    </button>
  )
}
