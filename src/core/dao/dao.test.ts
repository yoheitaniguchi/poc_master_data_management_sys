import { deleteDB, type IDBPDatabase } from 'idb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMasterDao, type MasterDao } from './dao'
import { DB_NAME, openMasterDb } from './openMasterDb'
import { createMemoryStorage } from '../../test/memoryStorage'
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
    {
      columnId: 'safety_stock',
      columnName: '安全在庫数',
      dataType: 'number',
      notNull: false,
      unique: false,
    },
  ],
}

let db: IDBPDatabase
let dao: MasterDao

beforeEach(async () => {
  ;({ db } = await openMasterDb([itemDef], { storage: createMemoryStorage() }))
  dao = createMasterDao(db, itemDef)
})

afterEach(async () => {
  db.close()
  await deleteDB(DB_NAME)
})

describe('createMasterDao', () => {
  it('upsertで新規追加し、findAll/findByKey/countで取得できる', async () => {
    await dao.upsert({ item_code: 'A001', item_name: '品目A' })
    await dao.upsert({ item_code: 'A002', item_name: '品目B' })

    expect(await dao.findAll()).toEqual([
      { item_code: 'A001', item_name: '品目A' },
      { item_code: 'A002', item_name: '品目B' },
    ])
    expect(await dao.findByKey('A001')).toEqual({ item_code: 'A001', item_name: '品目A' })
    expect(await dao.count()).toBe(2)
  })

  it('主キーが一致する場合はupsertで上書き更新する（要求仕様書§5.2手順5）', async () => {
    await dao.upsert({ item_code: 'A001', item_name: '品目A' })
    await dao.upsert({ item_code: 'A001', item_name: '品目A（改）' })

    expect(await dao.count()).toBe(1)
    expect(await dao.findByKey('A001')).toEqual({ item_code: 'A001', item_name: '品目A（改）' })
  })

  it('searchはstring同士を部分一致でフィルタする', async () => {
    await dao.upsert({ item_code: 'A001', item_name: 'ボルト M6' })
    await dao.upsert({ item_code: 'A002', item_name: 'ナット M6' })
    await dao.upsert({ item_code: 'A003', item_name: 'ワッシャー' })

    expect(await dao.search({ item_name: 'M6' })).toEqual([
      { item_code: 'A001', item_name: 'ボルト M6' },
      { item_code: 'A002', item_name: 'ナット M6' },
    ])
  })

  it('searchはnumber/boolean等の非string列を完全一致でフィルタする', async () => {
    await dao.upsert({ item_code: 'A001', item_name: 'ボルト', safety_stock: 10 })
    await dao.upsert({ item_code: 'A002', item_name: 'ナット', safety_stock: 100 })

    expect(await dao.search({ safety_stock: 10 })).toEqual([
      { item_code: 'A001', item_name: 'ボルト', safety_stock: 10 },
    ])
  })

  it('search条件が空欄の場合は無視する', async () => {
    await dao.upsert({ item_code: 'A001', item_name: 'ボルト' })
    expect(await dao.search({ item_name: '' })).toEqual([{ item_code: 'A001', item_name: 'ボルト' }])
  })

  it('search条件を指定しない場合は全件返す', async () => {
    await dao.upsert({ item_code: 'A001', item_name: 'ボルト' })
    expect(await dao.search({})).toEqual([{ item_code: 'A001', item_name: 'ボルト' }])
  })
})
