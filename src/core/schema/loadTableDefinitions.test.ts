import { describe, expect, it, vi } from 'vitest'
import { loadTableDefinitions } from './loadTableDefinitions'
import type { TableDefinition, TableDefinitionIndex } from './types'

const validDefinition: TableDefinition = {
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
  ],
}

const invalidDefinition: TableDefinition = {
  tableId: 'm_broken',
  tableName: '壊れたマスタ',
  columns: [
    {
      columnId: 'code',
      columnName: 'コード',
      dataType: 'string',
      notNull: false,
      unique: true,
      primaryKey: true,
    },
  ],
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response
}

describe('loadTableDefinitions', () => {
  it('index.jsonのtableIdsに従い定義を取得し、有効な定義のみを返す', async () => {
    const index: TableDefinitionIndex = { tableIds: ['m_item', 'm_broken'] }
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('index.json')) return jsonResponse(index)
      if (url.endsWith('m_item.json')) return jsonResponse(validDefinition)
      if (url.endsWith('m_broken.json')) return jsonResponse(invalidDefinition)
      throw new Error(`unexpected url: ${url}`)
    })

    const result = await loadTableDefinitions({ basePath: '/base/', fetchImpl })

    expect(result.definitions).toEqual([validDefinition])
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].tableId).toBe('m_broken')
    expect(fetchImpl).toHaveBeenCalledWith('/base/table-definitions/index.json')
    expect(fetchImpl).toHaveBeenCalledWith('/base/table-definitions/m_item.json')
  })

  it('index.jsonの取得に失敗した場合は例外を投げる', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(null, false, 404))
    await expect(loadTableDefinitions({ fetchImpl })).rejects.toThrow('index.json')
  })

  it('個別の定義JSONの取得に失敗した場合はエラーとして記録し処理を続行する', async () => {
    const index: TableDefinitionIndex = { tableIds: ['m_item', 'm_missing'] }
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('index.json')) return jsonResponse(index)
      if (url.endsWith('m_item.json')) return jsonResponse(validDefinition)
      return jsonResponse(null, false, 404)
    })

    const result = await loadTableDefinitions({ fetchImpl })

    expect(result.definitions).toEqual([validDefinition])
    expect(result.errors).toEqual([
      { tableId: 'm_missing', message: '定義JSONの取得に失敗しました（status: 404）' },
    ])
  })
})
