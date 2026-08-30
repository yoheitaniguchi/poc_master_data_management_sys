import { deleteDB, type IDBPDatabase } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { importCsvFile } from './importCsvFile'
import { createMasterDao, type MasterDao } from '../core/dao/dao'
import { createImportLogDao, type ImportLogDao } from '../core/dao/importLogDao'
import { DB_NAME, openMasterDb } from '../core/dao/openMasterDb'
import { createMemoryStorage } from '../test/memoryStorage'
import type { TableDefinition } from '../core/schema/types'

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
  ],
}

let db: IDBPDatabase
let masterDao: MasterDao
let importLogDao: ImportLogDao

beforeEach(async () => {
  db = await openMasterDb([itemDef], { storage: createMemoryStorage() })
  masterDao = createMasterDao(db, itemDef)
  importLogDao = createImportLogDao(db)
})

afterEach(async () => {
  db.close()
  await deleteDB(DB_NAME)
})

let importIdCounter = 0
function nextImportId(): string {
  importIdCounter++
  return `import-${importIdCounter}`
}

describe('importCsvFile', () => {
  it('全行が正常な場合、すべてUpsert登録されCOMPLETEDのログを1件生成する', async () => {
    const csvText = ['item_code,item_name,item_type,safety_stock', 'A001,ボルト,完成品,10', 'A002,ナット,完成品,20'].join(
      '\n',
    )

    const log = await importCsvFile({
      definition: itemDef,
      fileName: 'item.csv',
      csvText,
      masterDao,
      importLogDao,
      generateImportId: nextImportId,
    })

    expect(log.status).toBe('COMPLETED')
    expect(log.totalRows).toBe(2)
    expect(log.successRows).toBe(2)
    expect(log.errorRows).toBe(0)
    expect(log.errors).toEqual([])

    const records = await masterDao.findAll()
    expect(records).toEqual([
      { item_code: 'A001', item_name: 'ボルト', item_type: '完成品', safety_stock: 10, serial_number: null },
      { item_code: 'A002', item_name: 'ナット', item_type: '完成品', safety_stock: 20, serial_number: null },
    ])
  })

  it('エラー行はスキップし正常な行のみ登録する部分成功（要求仕様書§5.3）でCOMPLETED_WITH_ERRORSになる', async () => {
    const csvText = [
      'item_code,item_name,item_type,safety_stock',
      'A001,ボルト,完成品,10',
      'A002,ナット,資材,20', // item_typeが定数リスト外
      'A003,ワッシャー,完成品,not-a-number', // safety_stockが数値変換不可
    ].join('\n')

    const log = await importCsvFile({
      definition: itemDef,
      fileName: 'item.csv',
      csvText,
      masterDao,
      importLogDao,
      generateImportId: nextImportId,
    })

    expect(log.status).toBe('COMPLETED_WITH_ERRORS')
    expect(log.totalRows).toBe(3)
    expect(log.successRows).toBe(1)
    expect(log.errorRows).toBe(2)
    expect(log.errors).toEqual([
      { rowNumber: 2, columnId: 'item_type', message: '定数リストに含まれない値です: 資材' },
      { rowNumber: 3, columnId: 'safety_stock', message: '数値として解釈できません: not-a-number' },
    ])

    const records = await masterDao.findAll()
    expect(records).toEqual([
      { item_code: 'A001', item_name: 'ボルト', item_type: '完成品', safety_stock: 10, serial_number: null },
    ])
  })

  it('主キーが既存データと一致する行はUpsert（上書き更新）される', async () => {
    await masterDao.upsert({ item_code: 'A001', item_name: '旧品目名', item_type: '完成品', safety_stock: 1 })

    const csvText = ['item_code,item_name,item_type,safety_stock', 'A001,新品目名,完成品,99'].join('\n')

    const log = await importCsvFile({
      definition: itemDef,
      fileName: 'item.csv',
      csvText,
      masterDao,
      importLogDao,
      generateImportId: nextImportId,
    })

    expect(log.status).toBe('COMPLETED')
    expect(log.successRows).toBe(1)
    expect(await masterDao.count()).toBe(1)
    expect(await masterDao.findByKey('A001')).toEqual({
      item_code: 'A001',
      item_name: '新品目名',
      item_type: '完成品',
      safety_stock: 99,
      serial_number: null,
    })
  })

  it('同一CSVファイル内で主キーが重複する場合、2件目以降は重複エラーとしてスキップする', async () => {
    const csvText = [
      'item_code,item_name,item_type,safety_stock',
      'A001,ボルト,完成品,10',
      'A001,別のボルト,完成品,20',
    ].join('\n')

    const log = await importCsvFile({
      definition: itemDef,
      fileName: 'item.csv',
      csvText,
      masterDao,
      importLogDao,
      generateImportId: nextImportId,
    })

    expect(log.successRows).toBe(1)
    expect(log.errorRows).toBe(1)
    expect(log.errors).toEqual([
      { rowNumber: 2, columnId: 'item_code', message: 'CSVファイル内で値が重複しています: A001' },
    ])
    expect(await masterDao.findByKey('A001')).toEqual({
      item_code: 'A001',
      item_name: 'ボルト',
      item_type: '完成品',
      safety_stock: 10,
      serial_number: null,
    })
  })

  it('非primaryKeyのunique列がIndexedDB内の既存データと重複する場合は重複エラーとしてスキップする（Upsert対象にはしない）', async () => {
    await masterDao.upsert({
      item_code: 'A001',
      item_name: 'ボルト',
      item_type: '完成品',
      safety_stock: 10,
      serial_number: 'SN-001',
    })

    const csvText = [
      'item_code,item_name,item_type,safety_stock,serial_number',
      'A002,ナット,完成品,20,SN-001',
    ].join('\n')

    const log = await importCsvFile({
      definition: itemDef,
      fileName: 'item.csv',
      csvText,
      masterDao,
      importLogDao,
      generateImportId: nextImportId,
    })

    expect(log.successRows).toBe(0)
    expect(log.errorRows).toBe(1)
    expect(log.errors).toEqual([
      { rowNumber: 1, columnId: 'serial_number', message: '既存データと値が重複しています: SN-001' },
    ])
    expect(await masterDao.findByKey('A002')).toBeUndefined()
  })

  it('非primaryKeyのunique列が同一CSVファイル内で重複する場合は2件目以降が重複エラーとしてスキップされる', async () => {
    const csvText = [
      'item_code,item_name,item_type,safety_stock,serial_number',
      'A001,ボルト,完成品,10,SN-001',
      'A002,ナット,完成品,20,SN-001',
    ].join('\n')

    const log = await importCsvFile({
      definition: itemDef,
      fileName: 'item.csv',
      csvText,
      masterDao,
      importLogDao,
      generateImportId: nextImportId,
    })

    expect(log.successRows).toBe(1)
    expect(log.errorRows).toBe(1)
    expect(log.errors).toEqual([
      { rowNumber: 2, columnId: 'serial_number', message: 'CSVファイル内で値が重複しています: SN-001' },
    ])
    expect(await masterDao.findByKey('A001')).toMatchObject({ serial_number: 'SN-001' })
    expect(await masterDao.findByKey('A002')).toBeUndefined()
  })

  it('取込ログはRUNNINGとして先に保存され、完了後に最終状態で上書きされる（importIdは一貫している）', async () => {
    const csvText = ['item_code,item_name,item_type,safety_stock', 'A001,ボルト,完成品,10'].join('\n')
    const saveSpy = vi.spyOn(importLogDao, 'save')

    const log = await importCsvFile({
      definition: itemDef,
      fileName: 'item.csv',
      csvText,
      masterDao,
      importLogDao,
      generateImportId: nextImportId,
    })

    // saveは「開始時のRUNNING記録」と「完了時の最終状態への上書き」の2回呼ばれる
    expect(saveSpy).toHaveBeenCalledTimes(2)
    expect(saveSpy.mock.calls[0][0]).toMatchObject({ importId: log.importId, status: 'RUNNING' })
    expect(saveSpy.mock.calls[1][0]).toEqual(log)

    const allLogs = await importLogDao.findAll()
    expect(allLogs).toHaveLength(1)
    expect(allLogs[0]).toEqual(log)
    expect(await importLogDao.findById(log.importId)).toEqual(log)
    expect(log.status).not.toBe('RUNNING')
    expect(log.finishedAt).not.toBeNull()
  })

  it('データ行が0件のCSV（ヘッダーのみ）はCOMPLETEDとして扱う', async () => {
    const csvText = 'item_code,item_name,item_type,safety_stock'

    const log = await importCsvFile({
      definition: itemDef,
      fileName: 'item.csv',
      csvText,
      masterDao,
      importLogDao,
      generateImportId: nextImportId,
    })

    expect(log.status).toBe('COMPLETED')
    expect(log.totalRows).toBe(0)
    expect(log.successRows).toBe(0)
    expect(log.errorRows).toBe(0)
  })

  it('CSVの構文エラー（フィールド数不一致）はパースエラーとして取込ログに記録される', async () => {
    const csvText = [
      'item_code,item_name,item_type,safety_stock,serial_number',
      'A001,ボルト,完成品,10,SN-001,EXTRA_FIELD',
    ].join('\n')

    const log = await importCsvFile({
      definition: itemDef,
      fileName: 'item.csv',
      csvText,
      masterDao,
      importLogDao,
      generateImportId: nextImportId,
    })

    const parseErrors = log.errors.filter((e) => e.message.startsWith('CSVパースエラー'))
    expect(parseErrors.length).toBeGreaterThan(0)
    expect(parseErrors[0].rowNumber).toBe(1)
  })

  it('処理中に例外が発生した場合はFAILEDとして記録する（要求仕様書§5.5）', async () => {
    const failingDao: MasterDao = {
      tableId: itemDef.tableId,
      findAll: () => Promise.resolve([]),
      findByKey: () => Promise.resolve(undefined),
      search: () => Promise.resolve([]),
      count: () => Promise.resolve(0),
      upsert: () => Promise.reject(new Error('DB接続エラー')),
    }
    const csvText = ['item_code,item_name,item_type,safety_stock', 'A001,ボルト,完成品,10'].join('\n')

    const log = await importCsvFile({
      definition: itemDef,
      fileName: 'item.csv',
      csvText,
      masterDao: failingDao,
      importLogDao,
      generateImportId: nextImportId,
    })

    expect(log.status).toBe('FAILED')
    expect(log.errors).toEqual([{ rowNumber: 0, columnId: '', message: 'DB接続エラー' }])
    expect(await importLogDao.findById(log.importId)).toEqual(log)
  })
})
