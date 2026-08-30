import type { MasterRecordValue } from '../schema/types'

export interface CellValidationError {
  columnId: string
  message: string
}

export interface StepResult {
  ok: boolean
  message?: string
}

export interface TypeCheckResult {
  ok: boolean
  message?: string
  /** ok=trueの場合のみ設定される、型変換後の値（空値はnull） */
  value?: MasterRecordValue
}
