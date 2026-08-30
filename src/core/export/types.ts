export interface ExportOutputColumn {
  sourceColumnId: string
  outputHeader: string
}

export type LineEnding = 'CRLF' | 'LF'

export interface ExportFileFormat {
  delimiter: string
  /** 本PoCではUTF-8のみ対応（要求仕様書§5.4のフィールドとして保持するが、他エンコーディングへの変換は行わない） */
  encoding: string
  includeHeader: boolean
  lineEnding: LineEnding
}

export interface ExportDefinition {
  exportId: string
  exportName: string
  sourceTableId: string
  outputColumns: ExportOutputColumn[]
  fileFormat: ExportFileFormat
}

export interface ExportDefinitionIndex {
  exportIds: string[]
}
