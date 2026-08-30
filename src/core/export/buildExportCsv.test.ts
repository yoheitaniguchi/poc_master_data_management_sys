import { describe, expect, it } from 'vitest'
import { buildExportCsv } from './buildExportCsv'
import type { ExportDefinition } from './types'
import type { MasterRecord } from '../schema/types'

const exportDef: ExportDefinition = {
  exportId: 'item_export_v1',
  exportName: '品目マスタ連携ファイル',
  sourceTableId: 'm_item',
  outputColumns: [
    { sourceColumnId: 'item_code', outputHeader: 'ITEM_CD' },
    { sourceColumnId: 'item_name', outputHeader: 'ITEM_NAME' },
    { sourceColumnId: 'item_type', outputHeader: 'ITEM_TYPE' },
  ],
  fileFormat: { delimiter: ',', encoding: 'UTF-8', includeHeader: true, lineEnding: 'CRLF' },
}

const records: MasterRecord[] = [
  { item_code: 'A001', item_name: 'ボルト', item_type: '完成品', safety_stock: 10 },
  { item_code: 'A002', item_name: 'ナット', item_type: '完成品', safety_stock: null },
]

describe('buildExportCsv', () => {
  it('outputColumnsの順序でoutputHeaderをヘッダーとして出力する', () => {
    const csv = buildExportCsv(exportDef, records)
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('ITEM_CD,ITEM_NAME,ITEM_TYPE')
    expect(lines[1]).toBe('A001,ボルト,完成品')
    expect(lines[2]).toBe('A002,ナット,完成品')
  })

  it('outputColumnsに含まれないカラム（safety_stock）は出力しない', () => {
    const csv = buildExportCsv(exportDef, records)
    expect(csv).not.toContain('10')
  })

  it('includeHeader=falseの場合はヘッダー行を出力しない', () => {
    const definition: ExportDefinition = {
      ...exportDef,
      fileFormat: { ...exportDef.fileFormat, includeHeader: false },
    }
    const csv = buildExportCsv(definition, records)
    expect(csv.startsWith('A001')).toBe(true)
  })

  it('lineEnding=LFの場合はLF区切りで出力する', () => {
    const definition: ExportDefinition = {
      ...exportDef,
      fileFormat: { ...exportDef.fileFormat, lineEnding: 'LF' },
    }
    const csv = buildExportCsv(definition, records)
    expect(csv).not.toContain('\r\n')
    expect(csv.split('\n')).toHaveLength(3)
  })

  it('delimiterを変更すると区切り文字が変わる', () => {
    const definition: ExportDefinition = {
      ...exportDef,
      fileFormat: { ...exportDef.fileFormat, delimiter: '\t' },
    }
    const csv = buildExportCsv(definition, records)
    expect(csv.split('\r\n')[0]).toBe('ITEM_CD\tITEM_NAME\tITEM_TYPE')
  })

  it('レコードが0件でもヘッダー行のみ出力する', () => {
    const csv = buildExportCsv(exportDef, [])
    expect(csv).toBe('ITEM_CD,ITEM_NAME,ITEM_TYPE')
  })
})
