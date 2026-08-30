import { describe, expect, it } from 'vitest'
import { validateRow } from './validateRow'
import type { UniqueCheckContext } from './checkUnique'
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
      maxLength: 10,
      notNull: true,
      unique: false,
    },
    {
      columnId: 'item_type',
      columnName: '品目区分',
      dataType: 'string',
      notNull: true,
      unique: false,
      constants: ['完成品', '半製品', '原材料'],
    },
    {
      columnId: 'safety_stock',
      columnName: '安全在庫数',
      dataType: 'number',
      notNull: false,
      unique: false,
    },
    {
      columnId: 'serial_number',
      columnName: '製造番号',
      dataType: 'string',
      notNull: false,
      unique: true,
    },
    {
      columnId: 'grade',
      columnName: '等級',
      dataType: 'string',
      maxLength: 2,
      notNull: false,
      unique: false,
      constants: ['A', 'B', 'C'],
    },
  ],
}

const emptyUniqueContexts: Record<string, UniqueCheckContext> = {
  item_code: { seenInFile: new Set(), existingValues: new Set() },
  serial_number: { seenInFile: new Set(), existingValues: new Set() },
}

describe('validateRow', () => {
  it('全カラムが正常な行はrecordを返しerrorsは空になる', () => {
    const result = validateRow({
      definition: itemDef,
      rawRow: { item_code: 'A001', item_name: 'ボルト', item_type: '完成品', safety_stock: '10' },
      uniqueContexts: emptyUniqueContexts,
    })
    expect(result.errors).toEqual([])
    expect(result.record).toEqual({
      item_code: 'A001',
      item_name: 'ボルト',
      item_type: '完成品',
      safety_stock: 10,
      serial_number: null,
      grade: null,
    })
  })

  it('任意項目が空値の場合、nullとして扱いエラーにしない', () => {
    const result = validateRow({
      definition: itemDef,
      rawRow: { item_code: 'A001', item_name: 'ボルト', item_type: '完成品', safety_stock: '' },
      uniqueContexts: emptyUniqueContexts,
    })
    expect(result.errors).toEqual([])
    expect(result.record?.safety_stock).toBeNull()
  })

  it('1つでもエラーがあればrecordはundefinedになり、正常なカラムはrecordに含めない（要求仕様書§5.3の部分成功方針）', () => {
    const result = validateRow({
      definition: itemDef,
      rawRow: { item_code: 'A001', item_name: 'ボルト', item_type: '資材' },
      uniqueContexts: emptyUniqueContexts,
    })
    expect(result.record).toBeUndefined()
    expect(result.errors).toEqual([{ columnId: 'item_type', message: '定数リストに含まれない値です: 資材' }])
  })

  it('型チェック失敗時は後続チェック（NotNull等）を行わずそのカラムのエラーのみ記録する', () => {
    const result = validateRow({
      definition: itemDef,
      rawRow: {
        item_code: 'A001',
        item_name: 'ボルト',
        item_type: '完成品',
        safety_stock: 'not-a-number',
      },
      uniqueContexts: emptyUniqueContexts,
    })
    expect(result.errors).toEqual([
      { columnId: 'safety_stock', message: '数値として解釈できません: not-a-number' },
    ])
  })

  it('複数カラムでエラーがあればすべて記録する', () => {
    const result = validateRow({
      definition: itemDef,
      rawRow: { item_code: '', item_name: '', item_type: '資材' },
      uniqueContexts: emptyUniqueContexts,
    })
    expect(result.errors).toEqual([
      { columnId: 'item_code', message: '必須項目です' },
      { columnId: 'item_name', message: '必須項目です' },
      { columnId: 'item_type', message: '定数リストに含まれない値です: 資材' },
    ])
  })

  it('primaryKeyの値が既存データと一致する場合はUpsert対象としてエラーにしない', () => {
    const uniqueContexts: Record<string, UniqueCheckContext> = {
      item_code: { seenInFile: new Set(), existingValues: new Set(['A001']) },
      serial_number: { seenInFile: new Set(), existingValues: new Set() },
    }
    const result = validateRow({
      definition: itemDef,
      rawRow: { item_code: 'A001', item_name: 'ボルト', item_type: '完成品' },
      uniqueContexts,
    })
    expect(result.errors).toEqual([])
  })

  it('primaryKeyの値が同一CSVファイル内で重複する場合はエラーになる（既存一致とは異なり許容しない）', () => {
    const uniqueContexts: Record<string, UniqueCheckContext> = {
      item_code: { seenInFile: new Set(['A001']), existingValues: new Set() },
      serial_number: { seenInFile: new Set(), existingValues: new Set() },
    }
    const result = validateRow({
      definition: itemDef,
      rawRow: { item_code: 'A001', item_name: 'ボルト', item_type: '完成品' },
      uniqueContexts,
    })
    expect(result.errors).toEqual([
      { columnId: 'item_code', message: 'CSVファイル内で値が重複しています: A001' },
    ])
  })

  it('primaryKey以外のunique列は、既存データと一致してもUpsertとは扱わず重複エラーになる（design.md §5）', () => {
    const uniqueContexts: Record<string, UniqueCheckContext> = {
      item_code: { seenInFile: new Set(), existingValues: new Set() },
      serial_number: { seenInFile: new Set(), existingValues: new Set(['SN-001']) },
    }
    const result = validateRow({
      definition: itemDef,
      rawRow: {
        item_code: 'A002',
        item_name: 'ナット',
        item_type: '完成品',
        serial_number: 'SN-001',
      },
      uniqueContexts,
    })
    expect(result.errors).toEqual([
      { columnId: 'serial_number', message: '既存データと値が重複しています: SN-001' },
    ])
  })

  it('1カラムに長さチェックと定数チェックの両方が違反する値を入れても、長さチェック（③）のエラーのみが報告される（④定数チェックは実行されない）', () => {
    const result = validateRow({
      definition: itemDef,
      rawRow: { item_code: 'A001', item_name: 'ボルト', item_type: '完成品', grade: 'ZZZ' },
      uniqueContexts: emptyUniqueContexts,
    })
    expect(result.errors).toEqual([
      { columnId: 'grade', message: '2文字を超えています（実際: 3文字）' },
    ])
  })

  it('passedUniqueValuesには、行全体が他カラムのエラーで不採用でも、unique列自身が通過した値が入る（Phase 3のファイル内重複検出用）', () => {
    const result = validateRow({
      definition: itemDef,
      // item_typeが不正で行全体は不採用（record=undefined）だが、item_code自体は正常に通過している
      rawRow: { item_code: 'A001', item_name: 'ボルト', item_type: '資材' },
      uniqueContexts: emptyUniqueContexts,
    })
    expect(result.record).toBeUndefined()
    expect(result.passedUniqueValues).toEqual({ item_code: 'A001', serial_number: null })
  })

  it('unique=trueのカラムに対応するuniqueContextが渡されない場合はプログラミングエラーとして例外を投げる', () => {
    expect(() =>
      validateRow({
        definition: itemDef,
        rawRow: { item_code: 'A001', item_name: 'ボルト', item_type: '完成品' },
        uniqueContexts: {},
      }),
    ).toThrow('item_code')
  })
})
