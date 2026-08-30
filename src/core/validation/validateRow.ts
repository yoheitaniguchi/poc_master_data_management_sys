import type { MasterRecord, TableDefinition } from '../schema/types'
import { checkType } from './checkType'
import { checkNotNull } from './checkNotNull'
import { checkLength } from './checkLength'
import { checkConstants } from './checkConstants'
import { checkUnique, type UniqueCheckContext } from './checkUnique'
import type { CellValidationError } from './types'

export interface ValidateRowOptions {
  definition: TableDefinition
  /** CSV1行分の生セル値（columnId→文字列）。列が存在しない場合は空文字として扱う */
  rawRow: Record<string, string | undefined>
  /** unique=trueの全カラムについて必須。値集合の構築はPhase 3（CSV取込Worker）側の責務 */
  uniqueContexts: Record<string, UniqueCheckContext>
}

export interface ValidateRowResult {
  /** 全チェック通過時のみ値が入る（1つでもエラーがあればundefined、要求仕様書§5.3の部分成功方針） */
  record: MasterRecord | undefined
  errors: CellValidationError[]
  /**
   * unique=trueのカラムのうち、そのカラム自身の①〜⑤チェックを通過した値。行全体が他カラムの
   * エラーで不採用（record=undefined）になった場合でも、CSVファイル内重複検出のためには
   * 「このカラムのこの値は既に出現した」という事実は引き続き必要になるため、recordとは別に公開する
   * （呼び出し側＝Phase 3のCSV取込Workerが、次の行を検証する前にseenInFileへ反映する）
   */
  passedUniqueValues: Partial<MasterRecord>
}

// 要求仕様書§5.2の順序（①型→②NotNull→③長さ→④定数→⑤ユニーク）でCSV1行を検証する。
// 1カラムでいずれかのチェックに失敗したら、そのカラムはそこで判定を打ち切り次のカラムへ進む
// （後続チェックは前段の結果を前提にしているため）。
export function validateRow(options: ValidateRowOptions): ValidateRowResult {
  const { definition, rawRow, uniqueContexts } = options
  const errors: CellValidationError[] = []
  const record: MasterRecord = {}
  const passedUniqueValues: Partial<MasterRecord> = {}
  const primaryKeyColumnId = definition.columns.find((column) => column.primaryKey)?.columnId

  for (const column of definition.columns) {
    const rawValue = rawRow[column.columnId] ?? ''

    const typeResult = checkType(rawValue, column.dataType)
    if (!typeResult.ok) {
      errors.push({ columnId: column.columnId, message: typeResult.message! })
      continue
    }

    const notNullResult = checkNotNull(rawValue, column.notNull)
    if (!notNullResult.ok) {
      errors.push({ columnId: column.columnId, message: notNullResult.message! })
      continue
    }

    const lengthResult = checkLength(rawValue, column.dataType, column.maxLength)
    if (!lengthResult.ok) {
      errors.push({ columnId: column.columnId, message: lengthResult.message! })
      continue
    }

    const constantsResult = checkConstants(rawValue, column.constants)
    if (!constantsResult.ok) {
      errors.push({ columnId: column.columnId, message: constantsResult.message! })
      continue
    }

    if (column.unique) {
      const uniqueContext = uniqueContexts[column.columnId]
      if (!uniqueContext) {
        throw new Error(`unique=trueのカラム「${column.columnId}」のuniqueContextが指定されていません`)
      }
      const uniqueResult = checkUnique(typeResult.value ?? null, column.unique, uniqueContext, {
        treatExistingMatchAsUpsert: column.columnId === primaryKeyColumnId,
      })
      if (!uniqueResult.ok) {
        errors.push({ columnId: column.columnId, message: uniqueResult.message! })
        continue
      }
    }

    record[column.columnId] = typeResult.value ?? null
    if (column.unique) {
      passedUniqueValues[column.columnId] = typeResult.value ?? null
    }
  }

  return { record: errors.length === 0 ? record : undefined, errors, passedUniqueValues }
}
