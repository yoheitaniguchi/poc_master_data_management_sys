import type { DataType } from '../schema/types'
import type { TypeCheckResult } from './types'

// 要求仕様書§5.2 手順1「型チェック」: dataTypeに従い値が変換可能か。
// 空値の許容・拒否はNotNullチェック（手順2）の責務のため、ここでは空値を無条件で通す。
export function checkType(rawValue: string, dataType: DataType): TypeCheckResult {
  if (rawValue === '') {
    return { ok: true, value: null }
  }

  switch (dataType) {
    case 'string':
      return { ok: true, value: rawValue }

    case 'number': {
      // Number()は空白のみの文字列を0に変換してしまう（例: Number(' ') === 0）ため、
      // 空文字列と同様に扱われないよう明示的に弾く。
      if (rawValue.trim() === '') {
        return { ok: false, message: `数値として解釈できません: ${rawValue}` }
      }
      const numericValue = Number(rawValue)
      if (Number.isNaN(numericValue)) {
        return { ok: false, message: `数値として解釈できません: ${rawValue}` }
      }
      return { ok: true, value: numericValue }
    }

    case 'boolean': {
      if (rawValue === 'true') return { ok: true, value: true }
      if (rawValue === 'false') return { ok: true, value: false }
      return { ok: false, message: `真偽値として解釈できません（true/falseのみ許容）: ${rawValue}` }
    }

    case 'date': {
      if (Number.isNaN(Date.parse(rawValue))) {
        return { ok: false, message: `日付として解釈できません: ${rawValue}` }
      }
      return { ok: true, value: rawValue }
    }
  }
}
