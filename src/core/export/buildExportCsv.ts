import Papa from 'papaparse'
import type { MasterRecord } from '../schema/types'
import type { ExportDefinition } from './types'

// 要求仕様書§5.4: 出力カラム・ヘッダー名・区切り文字・改行コード等の定義に従ってファイルを生成する。
// CSV固有のエスケープ処理はdocs/design.md §4.2の方針通りpapaparseに委ねる。
export function buildExportCsv(definition: ExportDefinition, records: MasterRecord[]): string {
  const { outputColumns, fileFormat } = definition
  const newline = fileFormat.lineEnding === 'CRLF' ? '\r\n' : '\n'

  const rows: string[][] = []
  if (fileFormat.includeHeader) {
    rows.push(outputColumns.map((column) => column.outputHeader))
  }
  for (const record of records) {
    rows.push(outputColumns.map((column) => String(record[column.sourceColumnId] ?? '')))
  }

  return Papa.unparse(rows, { delimiter: fileFormat.delimiter, newline })
}
