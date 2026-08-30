import type { StepResult } from './types'

// 要求仕様書§5.1・§5.2手順4「定数チェック」: constantsが定義されている場合、値がリストに含まれるか。
// 空値の許容・拒否はNotNullチェック（手順2）の責務のため、ここでは空値を無条件で通す。
export function checkConstants(rawValue: string, constants: string[] | undefined): StepResult {
  if (!constants || constants.length === 0) return { ok: true }
  if (rawValue === '') return { ok: true }
  if (!constants.includes(rawValue)) {
    return { ok: false, message: `定数リストに含まれない値です: ${rawValue}` }
  }
  return { ok: true }
}
