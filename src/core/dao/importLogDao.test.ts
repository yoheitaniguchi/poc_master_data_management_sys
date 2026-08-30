import { deleteDB, type IDBPDatabase } from 'idb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createImportLogDao, type ImportLog, type ImportLogDao } from './importLogDao'
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
      notNull: true,
      unique: true,
      primaryKey: true,
    },
  ],
}

const sampleLog: ImportLog = {
  importId: 'import-1',
  tableId: 'm_item',
  fileName: 'item_master.csv',
  startedAt: '2026-08-30T10:00:00Z',
  finishedAt: '2026-08-30T10:00:03Z',
  status: 'COMPLETED_WITH_ERRORS',
  totalRows: 2,
  successRows: 1,
  errorRows: 1,
  errors: [{ rowNumber: 2, columnId: 'item_type', message: '定数リストに含まれない値です' }],
}

let db: IDBPDatabase
let dao: ImportLogDao

beforeEach(async () => {
  ;({ db } = await openMasterDb([itemDef], { storage: createMemoryStorage() }))
  dao = createImportLogDao(db)
})

afterEach(async () => {
  db.close()
  await deleteDB(DB_NAME)
})

describe('createImportLogDao', () => {
  it('saveで登録した取込ログをfindAll/findByIdで取得できる', async () => {
    await dao.save(sampleLog)

    expect(await dao.findAll()).toEqual([sampleLog])
    expect(await dao.findById('import-1')).toEqual(sampleLog)
    expect(await dao.findById('not-exist')).toBeUndefined()
  })

  it('同じimportIdでsaveすると上書き更新される（RUNNING→COMPLETED等の状態更新用途）', async () => {
    await dao.save({ ...sampleLog, status: 'RUNNING', finishedAt: null, errors: [] })
    await dao.save(sampleLog)

    expect(await dao.findAll()).toHaveLength(1)
    expect(await dao.findById('import-1')).toEqual(sampleLog)
  })
})
