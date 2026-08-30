import type { DataType } from '../schema/types'
import type { StepResult } from './types'

// 要求仕様書§5.1・§5.2手順3「長さチェック」: dataTypeがstringの場合、maxLengthを超えていないか。
export function checkLength(rawValue: string, dataType: DataType, maxLength: number | undefined): StepResult {
  if (dataType !== 'string' || maxLength === undefined) return { ok: true }
  if (rawValue.length > maxLength) {
    return { ok: false, message: `${maxLength}文字を超えています（実際: ${rawValue.length}文字）` }
  }
  return { ok: true }
}
