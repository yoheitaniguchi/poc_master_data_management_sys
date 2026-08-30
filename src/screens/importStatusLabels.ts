import type { ImportLog } from '../core/dao/importLogDao'

// SCR-1（結果表示）とSCR-3（ログ一覧）の両方で使う共通の日本語ラベル。
// 別々に定義すると片方だけ文言修正された場合に表記が食い違うため、ここに集約する。
export const importStatusLabel: Record<ImportLog['status'], string> = {
  RUNNING: '実行中',
  COMPLETED: '全件成功',
  COMPLETED_WITH_ERRORS: '一部エラーあり',
  FAILED: '処理失敗',
}
