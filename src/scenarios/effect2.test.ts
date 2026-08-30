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
  it('maxLengthを緩和すると、以前は長さ超過エラーだった値がコード変更なしに取込可能になる（ただし既存データはdocs/design.md §4.3の方針により失われる）', async () => {
    const storage = createMemoryStorage()
    access = await initMasterDataAccess([baseItemDef], { storage })
    const dao = access.daos.get('m_item')!

    // 制約変更前の時点で、既に正常に登録済みのレコードを1件用意しておく（制約変更後に
    // このレコードがどうなるかを後段で確認するため）
    await dao.upsert({ item_code: 'X999', item_name: '既存品', item_type: '完成品' })

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

    // docs/design.md §4.3: 定義JSON群のハッシュが変わるとDBは削除・再作成されるため、
    // 制約変更とは無関係だった既存レコード（X999）もろとも失われる。EFFECT-2は
    // 「新しい制約でCSV取込が動作すること」を保証するものであり、既存データの保持を
    // 保証するものではない（App.tsxがrebuilt通知バナーでユーザーに警告する副作用）。
    expect(await daoAfter.findByKey('X999')).toBeUndefined()
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

  it('制約変更前に登録済みだったレコードは、docs/design.md §4.3のDB再作成により失われる', async () => {
    const storage = createMemoryStorage()
    access = await initMasterDataAccess([baseItemDef], { storage })
    const dao = access.daos.get('m_item')!
    await dao.upsert({ item_code: 'X999', item_name: '既存品', item_type: '完成品' })
    expect(await dao.findByKey('X999')).toBeDefined()

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

    expect(access.rebuilt).toBe(true)
    expect(await access.daos.get('m_item')!.findByKey('X999')).toBeUndefined()
  })
})
