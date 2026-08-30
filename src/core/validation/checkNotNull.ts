import type { StepResult } from './types'

// 要求仕様書§5.1・§5.2手順2「NotNullチェック」: notNull=trueのカラムで値が空でないか。
export function checkNotNull(rawValue: string, notNull: boolean): StepResult {
  if (!notNull) return { ok: true }
  if (rawValue === '') return { ok: false, message: '必須項目です' }
  return { ok: true }
}
