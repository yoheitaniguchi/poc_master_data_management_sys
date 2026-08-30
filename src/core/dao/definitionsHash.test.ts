import { describe, expect, it } from 'vitest'
import { computeDefinitionsHash } from './definitionsHash'
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
  ],
}

const partnerDef: TableDefinition = {
  tableId: 'm_partner',
  tableName: '取引先マスタ',
  columns: [
    {
      columnId: 'partner_code',
      columnName: '取引先コード',
      dataType: 'string',
      maxLength: 20,
      notNull: true,
      unique: true,
      primaryKey: true,
    },
  ],
}

describe('computeDefinitionsHash', () => {
  it('同じ定義内容であれば同じハッシュを返す', () => {
    expect(computeDefinitionsHash([itemDef, partnerDef])).toBe(
      computeDefinitionsHash([itemDef, partnerDef]),
    )
  })

  it('配列の順序に依存しない', () => {
    expect(computeDefinitionsHash([itemDef, partnerDef])).toBe(
      computeDefinitionsHash([partnerDef, itemDef]),
    )
  })

  it('定義内容が異なれば異なるハッシュを返す', () => {
    const changed: TableDefinition = { ...itemDef, tableName: '品目マスタ（改）' }
    expect(computeDefinitionsHash([itemDef])).not.toBe(computeDefinitionsHash([changed]))
  })

  it('定義の追加・削除でハッシュが変わる（EFFECT-1のDB再構築トリガー）', () => {
    expect(computeDefinitionsHash([itemDef])).not.toBe(computeDefinitionsHash([itemDef, partnerDef]))
  })

  it('maxLengthの値のみを変更してもハッシュが変わる（EFFECT-2のDB再構築トリガー）', () => {
    const changed: TableDefinition = {
      ...itemDef,
      columns: [{ ...itemDef.columns[0], maxLength: 30 }],
    }
    expect(computeDefinitionsHash([itemDef])).not.toBe(computeDefinitionsHash([changed]))
  })

  it('constantsの値のみを変更してもハッシュが変わる（EFFECT-2のDB再構築トリガー）', () => {
    const withConstants: TableDefinition = {
      ...itemDef,
      columns: [{ ...itemDef.columns[0], constants: ['A', 'B'] }],
    }
    const changedConstants: TableDefinition = {
      ...itemDef,
      columns: [{ ...itemDef.columns[0], constants: ['A', 'C'] }],
    }
    expect(computeDefinitionsHash([withConstants])).not.toBe(computeDefinitionsHash([changedConstants]))
  })
})
