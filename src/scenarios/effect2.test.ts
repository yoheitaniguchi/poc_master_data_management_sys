import { deleteDB } from 'idb'
import { afterEach, describe, expect, it } from 'vitest'
import { initMasterDataAccess, type MasterDataAccess } from '../core/dao/masterDataAccess'
import { DB_NAME } from '../core/dao/openMasterDb'
import { importCsvFile } from '../workers/importCsvFile'
import { createMemoryStorage } from '../test/memoryStorage'
import type { TableDefinition } from '../core/schema/types'

// 実際のtable-definitions/m_item.jsonとは異なる、意図的に厳しい制約（item_name maxLength=5等）
// を持つ独自の定義を使う。「制約を緩和する前の状態」を再現するのが目的のため、あえて実ファイルは
// 使わない（effect1.test.tsとは異なり、こちらは実ファイルをそのまま読み込む意味がない）。
const baseItemDef: TableDefinition = {
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
    { columnId: 'item_name', columnName: '品目名', dataType: 'string', maxLength: 5, notNull: true, unique: false },
    {
      columnId: 'item_type',
      columnName: '品目区分',
      dataType: 'string',
      notNull: true,
      unique: false,
      constants: ['完成品', '半製品', '原材料'],
    },
  ],
}

let access: MasterDataAccess | undefined

afterEach(async () => {
  access?.db.close()
  access = undefined
  await deleteDB(DB_NAME)
})

// EFFECT-2「バリデーション・整合性チェックの『値』（長さ、定数リストの中身等）がJSON定義の
// 変更だけで拡張できる」（要求仕様書§1.2）。同一のtable-definitions/m_item.jsonをリロード後の
// アプリ起動時（loadTableDefinitions→initMasterDataAccess）と同様、localStorageを共有した状態で
// 定義だけを差し替えて再初期化し、importCsvFile・validateRow等のコードを一切変更せずに
// 新しい制約でCSV取込が動作することを検証する。
describe('EFFECT-2: バリデーション値の変更のみで新しい制約が反映される（要求仕様書§1.2）', () => {
  it('maxLengthを緩和すると、以前は長さ超過エラーだった値がコード変更なしに取込可能になる', async () => {
    const storage = createMemoryStorage()
    access = await initMasterDataAccess([baseItemDef], { storage })
    const dao = access.daos.get('m_item')!

    const csvText = ['item_code,item_name,item_type', 'A001,超長い品目名です,完成品'].join('\n')

    const logBefore = await importCsvFile({
      definition: baseItemDef,
      fileName: 'item.csv',
      csvText,
      masterDao: dao,
      importLogDao: access.importLogDao,
    })
    expect(logBefore.status).toBe('COMPLETED_WITH_ERRORS')
    expect(logBefore.errors).toEqual([{ rowNumber: 1, columnId: 'item_name', message: '5文字を超えています（実際: 8文字）' }])

    // table-definitions/m_item.json側でmaxLengthの値だけを変更した状況を再現する
    // （src/core/やsrc/workers/のコードは一切変更していない）
    const widenedDef: TableDefinition = {
      ...baseItemDef,
      columns: [baseItemDef.columns[0], { ...baseItemDef.columns[1], maxLength: 100 }, baseItemDef.columns[2]],
    }
    access.db.close()
    access = await initMasterDataAccess([widenedDef], { storage })
    const daoAfter = access.daos.get('m_item')!

    const logAfter = await importCsvFile({
      definition: widenedDef,
      fileName: 'item.csv',
      csvText,
      masterDao: daoAfter,
      importLogDao: access.importLogDao,
    })
    expect(logAfter.status).toBe('COMPLETED')
    expect(await daoAfter.findByKey('A001')).toEqual({
      item_code: 'A001',
      item_name: '超長い品目名です',
      item_type: '完成品',
    })
  })

  it('constantsに値を追加すると、以前は定数リスト外エラーだった値がコード変更なしに取込可能になる', async () => {
    const storage = createMemoryStorage()
    access = await initMasterDataAccess([baseItemDef], { storage })
    const dao = access.daos.get('m_item')!

    const csvText = ['item_code,item_name,item_type', 'A001,ボルト,資材'].join('\n')

    const logBefore = await importCsvFile({
      definition: baseItemDef,
      fileName: 'item.csv',
      csvText,
      masterDao: dao,
      importLogDao: access.importLogDao,
    })
    expect(logBefore.status).toBe('COMPLETED_WITH_ERRORS')
    expect(logBefore.errors).toEqual([
      { rowNumber: 1, columnId: 'item_type', message: '定数リストに含まれない値です: 資材' },
    ])

    // table-definitions/m_item.json側でconstantsに「資材」を追加した状況を再現する
    const expandedDef: TableDefinition = {
      ...baseItemDef,
      columns: [
        baseItemDef.columns[0],
        baseItemDef.columns[1],
        { ...baseItemDef.columns[2], constants: ['完成品', '半製品', '原材料', '資材'] },
      ],
    }
    access.db.close()
    access = await initMasterDataAccess([expandedDef], { storage })
    const daoAfter = access.daos.get('m_item')!

    const logAfter = await importCsvFile({
      definition: expandedDef,
      fileName: 'item.csv',
      csvText,
      masterDao: daoAfter,
      importLogDao: access.importLogDao,
    })
    expect(logAfter.status).toBe('COMPLETED')
    expect(await daoAfter.findByKey('A001')).toEqual({ item_code: 'A001', item_name: 'ボルト', item_type: '資材' })
  })
})
