import { describe, expect, it } from 'vitest'
import { validateExportDefinition } from './validateExportDefinition'
import type { ExportDefinition } from './types'
import type { TableDefinition } from '../schema/types'

const itemDef: TableDefinition = {
  tableId: 'm_item',
  tableName: '品目マスタ',
  columns: [
    {
      columnId: 'item_code',
      columnName: '品目コード',
      dataType: 'string',
      maxLength: 20,
      notNull: true,
      unique: true,
      primaryKey: true,
    },
    {
      columnId: 'item_name',
      columnName: '品目名',
      dataType: 'string',
      maxLength: 100,
      notNull: true,
      unique: false,
    },
  ],
}

const validExportDef: ExportDefinition = {
  exportId: 'item_export_v1',
  exportName: '品目マスタ連携ファイル',
  sourceTableId: 'm_item',
  outputColumns: [
    { sourceColumnId: 'item_code', outputHeader: 'ITEM_CD' },
    { sourceColumnId: 'item_name', outputHeader: 'ITEM_NAME' },
  ],
  fileFormat: { delimiter: ',', encoding: 'UTF-8', includeHeader: true, lineEnding: 'CRLF' },
}

describe('validateExportDefinition', () => {
  it('正しい定義ではエラーを返さない', () => {
    expect(validateExportDefinition(validExportDef, [itemDef])).toEqual([])
  })

  it('sourceTableIdに一致するテーブル定義がない場合はエラーになる', () => {
    const definition: ExportDefinition = { ...validExportDef, sourceTableId: 'm_unknown' }
    const errors = validateExportDefinition(definition, [itemDef])
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('m_unknown')
  })

  it('outputColumnsが空の場合はエラーになる', () => {
    const definition: ExportDefinition = { ...validExportDef, outputColumns: [] }
    const errors = validateExportDefinition(definition, [itemDef])
    expect(errors.some((e) => e.message.includes('outputColumns'))).toBe(true)
  })

  it('sourceColumnIdがテーブル定義に存在しない場合はエラーになる', () => {
    const definition: ExportDefinition = {
      ...validExportDef,
      outputColumns: [{ sourceColumnId: 'not_exist', outputHeader: 'X' }],
    }
    const errors = validateExportDefinition(definition, [itemDef])
    expect(errors.some((e) => e.message.includes('not_exist'))).toBe(true)
  })

  it('encodingがUTF-8以外の場合はエラーになる', () => {
    const definition: ExportDefinition = {
      ...validExportDef,
      fileFormat: { ...validExportDef.fileFormat, encoding: 'Shift_JIS' },
    }
    const errors = validateExportDefinition(definition, [itemDef])
    expect(errors.some((e) => e.message.includes('Shift_JIS'))).toBe(true)
  })

  it('lineEndingがCRLF/LF以外の場合はエラーになる', () => {
    const definition = {
      ...validExportDef,
      fileFormat: { ...validExportDef.fileFormat, lineEnding: 'CR' },
    } as unknown as ExportDefinition
    const errors = validateExportDefinition(definition, [itemDef])
    expect(errors.some((e) => e.message.includes('lineEnding'))).toBe(true)
  })

  it('delimiterが空の場合はエラーになる', () => {
    const definition: ExportDefinition = {
      ...validExportDef,
      fileFormat: { ...validExportDef.fileFormat, delimiter: '' },
    }
    const errors = validateExportDefinition(definition, [itemDef])
    expect(errors.some((e) => e.message.includes('delimiter'))).toBe(true)
  })
})
