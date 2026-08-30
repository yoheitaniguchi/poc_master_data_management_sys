import { describe, expect, it } from 'vitest'
import { validateTableDefinition } from './validateDefinition'
import type { TableDefinition } from './types'

const baseDefinition: TableDefinition = {
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

describe('validateTableDefinition', () => {
  it('正しい定義ではエラーを返さない', () => {
    expect(validateTableDefinition(baseDefinition)).toEqual([])
  })

  it('primaryKeyカラムが存在しない場合はエラーになる', () => {
    const definition: TableDefinition = {
      ...baseDefinition,
      columns: baseDefinition.columns.map((c) => ({ ...c, primaryKey: false })),
    }
    const errors = validateTableDefinition(definition)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('ちょうど1つ')
  })

  it('primaryKeyカラムが複数存在する場合はエラーになる', () => {
    const definition: TableDefinition = {
      ...baseDefinition,
      columns: baseDefinition.columns.map((c) => ({ ...c, primaryKey: true })),
    }
    const errors = validateTableDefinition(definition)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('現在2件')
  })

  it('primaryKeyカラムにnotNull=falseが指定されている場合はエラーになる', () => {
    const definition: TableDefinition = {
      ...baseDefinition,
      columns: [
        { ...baseDefinition.columns[0], notNull: false },
        baseDefinition.columns[1],
      ],
    }
    const errors = validateTableDefinition(definition)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('notNull=false')
  })

  it('primaryKeyカラムにunique=falseが指定されている場合はエラーになる', () => {
    const definition: TableDefinition = {
      ...baseDefinition,
      columns: [
        { ...baseDefinition.columns[0], unique: false },
        baseDefinition.columns[1],
      ],
    }
    const errors = validateTableDefinition(definition)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('unique=false')
  })

  it('columnIdが重複している場合はエラーになる', () => {
    const definition: TableDefinition = {
      ...baseDefinition,
      columns: [...baseDefinition.columns, { ...baseDefinition.columns[1] }],
    }
    const errors = validateTableDefinition(definition)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('重複')
  })
})
