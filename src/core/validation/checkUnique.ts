import type { MasterRecordValue } from '../schema/types'
import type { StepResult } from './types'

export interface UniqueCheckContext {
  /** 同一CSVファイル内で、このカラムについてこれまでに検証を通過した値の集合 */
  seenInFile: ReadonlySet<MasterRecordValue>
  /** IndexedDB内の既存レコードにおける、このカラムの値の集合 */
  existingValues: ReadonlySet<MasterRecordValue>
}

export interface CheckUniqueOptions {
  /**
   * primaryKeyカラムの場合はtrue。既存データとの一致はUpsert対象として扱い、
   * 重複エラーにしない（要求仕様書§5.2手順5・§5.3、docs/design.md §5）
   */
  treatExistingMatchAsUpsert?: boolean
}

// 要求仕様書§5.2手順5「ユニーク制約チェック」: (a)CSVファイル内での重複、(b)IndexedDB内の既存
// データとの重複、の両方をチェックする。値の集合構築（DBの実データ読み出し等）はI/Oを伴うため
// Phase 3（CSV取込Web Worker）側の責務とし、本関数は集合を受け取って判定するだけの純粋関数とする。
export function checkUnique(
  value: MasterRecordValue,
  unique: boolean,
  context: UniqueCheckContext,
  options: CheckUniqueOptions = {},
): StepResult {
  if (!unique) return { ok: true }
  if (value === null) return { ok: true }

  if (context.seenInFile.has(value)) {
    return { ok: false, message: `CSVファイル内で値が重複しています: ${String(value)}` }
  }
  if (!options.treatExistingMatchAsUpsert && context.existingValues.has(value)) {
    return { ok: false, message: `既存データと値が重複しています: ${String(value)}` }
  }
  return { ok: true }
}
