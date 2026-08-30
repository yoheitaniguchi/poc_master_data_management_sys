import { describe, expect, it, vi } from 'vitest'
import { loadExportDefinitions } from './loadExportDefinitions'
import type { ExportDefinition, ExportDefinitionIndex } from './types'
import type { TableDefinition } from '../schema/types'

const itemDef: TableDefinition = {
  tableId: 'm_item',
  tableName: '品目マスタ',
  columns: [
    {
      columnId: 'item_code',
      columnName: '品目コード',
      dataType: 'string',
      notNull: true,
      unique: true,
      primaryKey: true,
    },
  ],
}

const validExportDef: ExportDefinition = {
  exportId: 'item_export_v1',
  exportName: '品目マスタ連携ファイル',
  sourceTableId: 'm_item',
  outputColumns: [{ sourceColumnId: 'item_code', outputHeader: 'ITEM_CD' }],
  fileFormat: { delimiter: ',', encoding: 'UTF-8', includeHeader: true, lineEnding: 'CRLF' },
}

const invalidExportDef: ExportDefinition = {
  ...validExportDef,
  exportId: 'broken_export',
  sourceTableId: 'm_unknown',
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response
}

describe('loadExportDefinitions', () => {
  it('index.jsonのexportIdsに従い定義を取得し、有効な定義のみを返す', async () => {
    const index: ExportDefinitionIndex = { exportIds: ['item_export_v1', 'broken_export'] }
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('index.json')) return jsonResponse(index)
      if (url.endsWith('item_export_v1.json')) return jsonResponse(validExportDef)
      if (url.endsWith('broken_export.json')) return jsonResponse(invalidExportDef)
      throw new Error(`unexpected url: ${url}`)
    })

    const result = await loadExportDefinitions({ basePath: '/base/', fetchImpl, tableDefinitions: [itemDef] })

    expect(result.definitions).toEqual([validExportDef])
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].exportId).toBe('broken_export')
  })

  it('index.jsonの取得に失敗した場合はアプリを止めず空の一覧として返す（DO-8はDO-6/7への付加機能のため）', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(null, false, 404))
    const result = await loadExportDefinitions({ fetchImpl, tableDefinitions: [itemDef] })
    expect(result.definitions).toEqual([])
    expect(result.errors).toHaveLength(1)
  })
})
