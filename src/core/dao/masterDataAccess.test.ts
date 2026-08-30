import { deleteDB } from 'idb'
import { afterEach, describe, expect, it } from 'vitest'
import { initMasterDataAccess, type MasterDataAccess } from './masterDataAccess'
import { DB_NAME } from './openMasterDb'
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
      notNull: true,
      unique: true,
      primaryKey: true,
    },
  ],
}

let access: MasterDataAccess | undefined

afterEach(async () => {
  access?.db.close()
  access = undefined
  await deleteDB(DB_NAME)
})

describe('initMasterDataAccess', () => {
  it('テーブル定義ごとにDAOを構築し、import_logs用DAOも提供する（EFFECT-1: 定義追加だけでDAOが増える）', async () => {
    access = await initMasterDataAccess([itemDef, partnerDef], {
      storage: createMemoryStorage(),
    })

    expect(Array.from(access.daos.keys()).sort()).toEqual(['m_item', 'm_partner'])
    expect(access.importLogDao).toBeDefined()

    const itemDao = access.daos.get('m_item')!
    await itemDao.upsert({ item_code: 'A001' })
    expect(await itemDao.findAll()).toEqual([{ item_code: 'A001' }])
  })
})
