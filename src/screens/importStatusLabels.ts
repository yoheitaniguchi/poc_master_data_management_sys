import type { ImportLog } from '../core/dao/importLogDao'

// SCR-1（結果表示）とSCR-3（ログ一覧）の両方で使う共通の日本語ラベル。
// 別々に定義すると片方だけ文言修正された場合に表記が食い違うため、ここに集約する。
export const importStatusLabel: Record<ImportLog['status'], string> = {
  RUNNING: '実行中',
  COMPLETED: '全件成功',
  COMPLETED_WITH_ERRORS: '一部エラーあり',
  FAILED: '処理失敗',
}

// Issue #24: 取込結果（ImportResultSummary）をAlertコンポーネントで種別ごとに色分けするための対応表。
export const importStatusVariant: Record<ImportLog['status'], 'info' | 'success' | 'warning' | 'error'> = {
  RUNNING: 'info',
  COMPLETED: 'success',
  COMPLETED_WITH_ERRORS: 'warning',
  FAILED: 'error',
}
