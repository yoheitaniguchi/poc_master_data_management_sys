import type { TableDefinition } from '../schema/types'
import type { ExportDefinition } from './types'

export interface ExportDefinitionValidationError {
  exportId: string
  message: string
}

const SUPPORTED_ENCODING = 'UTF-8'
const SUPPORTED_LINE_ENDINGS = new Set(['CRLF', 'LF'])

// 要求仕様書§5.4: 連携ファイル定義JSON自体の妥当性を検証する。sourceTableId・
// outputColumns[].sourceColumnIdがマスタテーブル定義側に実在するかは、DONT-1が禁止する
// 「マスタデータ間の参照整合性チェック」ではなく、定義JSON同士の静的な整合性チェックである
// （Phase 1のvalidateTableDefinitionと同種の、設定ミスを起動時に検出する仕組み）。
export function validateExportDefinition(
  definition: ExportDefinition,
  tableDefinitions: TableDefinition[],
): ExportDefinitionValidationError[] {
  const errors: ExportDefinitionValidationError[] = []

  const sourceTable = tableDefinitions.find((table) => table.tableId === definition.sourceTableId)
  if (!sourceTable) {
    errors.push({
      exportId: definition.exportId,
      message: `sourceTableId「${definition.sourceTableId}」に一致するテーブル定義がありません`,
    })
    return errors
  }

  if (definition.outputColumns.length === 0) {
    errors.push({ exportId: definition.exportId, message: 'outputColumnsが1件も指定されていません' })
  }

  const sourceColumnIds = new Set(sourceTable.columns.map((column) => column.columnId))
  for (const outputColumn of definition.outputColumns) {
    if (!sourceColumnIds.has(outputColumn.sourceColumnId)) {
      errors.push({
        exportId: definition.exportId,
        message: `sourceColumnId「${outputColumn.sourceColumnId}」はテーブル「${definition.sourceTableId}」に存在しません`,
      })
    }
  }

  if (definition.fileFormat.encoding !== SUPPORTED_ENCODING) {
    errors.push({
      exportId: definition.exportId,
      message: `encoding「${definition.fileFormat.encoding}」は本PoCでは未対応です（${SUPPORTED_ENCODING}のみ対応）`,
    })
  }

  if (!SUPPORTED_LINE_ENDINGS.has(definition.fileFormat.lineEnding)) {
    errors.push({
      exportId: definition.exportId,
      message: `lineEnding「${definition.fileFormat.lineEnding}」はCRLFまたはLFのみ指定できます`,
    })
  }

  if (definition.fileFormat.delimiter.length === 0) {
    errors.push({ exportId: definition.exportId, message: 'delimiterが空です' })
  }

  return errors
}
