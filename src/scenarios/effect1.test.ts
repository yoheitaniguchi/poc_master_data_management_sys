import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { deleteDB } from 'idb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadTableDefinitions } from '../core/schema/loadTableDefinitions'
import { initMasterDataAccess } from '../core/dao/masterDataAccess'
import { DB_NAME } from '../core/dao/openMasterDb'
import { loadExportDefinitions } from '../core/export/loadExportDefinitions'
import { importCsvFile } from '../workers/importCsvFile'
import { createMemoryStorage } from '../test/memoryStorage'
import type { TableDefinition } from '../core/schema/types'
import type { ExportDefinition } from '../core/export/types'

// public/table-definitions/m_item.json・m_partner.json、public/export-definitions/index.json・
// item_export_v1.jsonを直接読み込む（内容をこのテストファイル内に複製すると、実ファイルを
// 変更してもテストが追随せず陳腐化するため。実際に配置されているファイルそのものを
// loadTableDefinitions/loadExportDefinitionsに渡すことで、常に実態を反映したテストにする）。
// public/配下にあるのはVite規約（publicDir配下のみがdist/にそのままコピーされ、実行時fetch
// 対象になる。docs/design.md §4.9参照）。
const tableDefinitionsDir = fileURLToPath(new URL('../../public/table-definitions/', import.meta.url))
const itemDef: TableDefinition = JSON.parse(readFileSync(`${tableDefinitionsDir}m_item.json`, 'utf-8'))
const partnerDef: TableDefinition = JSON.parse(readFileSync(`${tableDefinitionsDir}m_partner.json`, 'utf-8'))

const exportDefinitionsDir = fileURLToPath(new URL('../../public/export-definitions/', import.meta.url))
const exportIndex = JSON.parse(readFileSync(`${exportDefinitionsDir}index.json`, 'utf-8'))
const itemExportDef: ExportDefinition = JSON.parse(readFileSync(`${exportDefinitionsDir}item_export_v1.json`, 'utf-8'))

// 要求仕様書§7項番3「単一のテーブル定義でしか動かない実装は…不十分」に基づき、m_item/m_partner
// のどちらとも異なるカラム構成（boolean/date型を含む）の3件目を「これから追加する新規テーブル」
// として用意し、EFFECT-1「JSON定義ファイルの追加のみで、新規マスタテーブルをコード修正なしに
// 追加できる」を実証する。
const warehouseDef: TableDefinition = {
  tableId: 'm_warehouse',
  tableName: '倉庫マスタ',
  columns: [
    {
      columnId: 'warehouse_code',
      columnName: '倉庫コード',
      dataType: 'string',
      maxLength: 10,
      notNull: true,
      unique: true,
      primaryKey: true,
    },
    { columnId: 'warehouse_name', columnName: '倉庫名', dataType: 'string', maxLength: 50, notNull: true, unique: false },
    { columnId: 'is_active', columnName: '稼働中フラグ', dataType: 'boolean', notNull: true, unique: false },
    { columnId: 'capacity', columnName: '収容能力', dataType: 'number', notNull: false, unique: false },
    { columnId: 'opened_date', columnName: '開設日', dataType: 'date', notNull: false, unique: false },
  ],
}

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response
}

afterEach(async () => {
  await deleteDB(DB_NAME)
})

describe('EFFECT-1: JSON定義ファイルの追加のみで新規マスタテーブルを追加できる（要求仕様書§1.2）', () => {
  it('table-definitions/index.jsonへのtableId追記＋定義JSON追加だけで、取込・検索・出力の基盤（DAO・Worker）に新テーブルが反映される', async () => {
    // 実在するm_item.json/m_partner.jsonに加え、index.jsonへ新しいtableId（m_warehouse）を
    // 追記し対応する定義JSONを配置した状況を再現する。table-definitions/・export-definitions/
    // 双方へのfetchのみモックし、それ以外はsrc/useMasterDataAccess.tsの起動シーケンス
    // （loadTableDefinitions→initMasterDataAccess→loadExportDefinitions）と全く同じ関数・
    // 同じ順序で呼び出す。画面固有のコードは一切経由しない
    const tableIndex = { tableIds: ['m_item', 'm_partner', 'm_warehouse'] }
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('table-definitions/index.json')) return jsonResponse(tableIndex)
      if (url.endsWith('table-definitions/m_item.json')) return jsonResponse(itemDef)
      if (url.endsWith('table-definitions/m_partner.json')) return jsonResponse(partnerDef)
      if (url.endsWith('table-definitions/m_warehouse.json')) return jsonResponse(warehouseDef)
      if (url.endsWith('export-definitions/index.json')) return jsonResponse(exportIndex)
      if (url.endsWith('export-definitions/item_export_v1.json')) return jsonResponse(itemExportDef)
      throw new Error(`unexpected url: ${url}`)
    })

    const { definitions, errors } = await loadTableDefinitions({ basePath: '/', fetchImpl })
    expect(errors).toEqual([])
    expect(definitions.map((d) => d.tableId).sort()).toEqual(['m_item', 'm_partner', 'm_warehouse'])

    const access = await initMasterDataAccess(definitions, { storage: createMemoryStorage() })

    // 「出力」(DO-8): m_warehouseは連携ファイル定義を持たないが、既存のitem_export_v1
    // （sourceTableId: m_item）の読み込み自体が壊れないこと、m_warehouseに対応する連携
    // ファイル定義が（想定通り）0件であることを確認する
    const { definitions: exportDefinitions, errors: exportErrors } = await loadExportDefinitions({
      basePath: '/',
      fetchImpl,
      tableDefinitions: definitions,
    })
    expect(exportErrors).toEqual([])
    expect(exportDefinitions.map((ed) => ed.exportId)).toEqual(['item_export_v1'])
    expect(exportDefinitions.filter((ed) => ed.sourceTableId === 'm_warehouse')).toEqual([])

    // 「取込画面に新テーブルが反映される」= 新テーブル用のDAOがコード変更なしに自動生成されている
    const warehouseDao = access.daos.get('m_warehouse')
    expect(warehouseDao).toBeDefined()

    // 「取込」: m_item/m_partnerと全く同じimportCsvFile関数で、m_warehouse固有のCSV
    // （boolean/date型を含む、これまでテストしたことのないカラム構成）を取り込める
    const csvText = [
      'warehouse_code,warehouse_name,is_active,capacity,opened_date',
      'W001,東京倉庫,true,1000,2020-04-01',
      'W002,大阪倉庫,false,,',
    ].join('\n')
    const log = await importCsvFile({
      definition: warehouseDef,
      fileName: 'warehouse.csv',
      csvText,
      masterDao: warehouseDao!,
      importLogDao: access.importLogDao,
    })
    expect(log.status).toBe('COMPLETED')
    expect(log.successRows).toBe(2)

    // 「検索」: 同じdao.search()で、m_item/m_partnerでは使われていないboolean型カラムに
    // 対する完全一致検索も、コード変更なしに機能する
    const activeOnly = await warehouseDao!.search({ is_active: true })
    expect(activeOnly).toEqual([
      {
        warehouse_code: 'W001',
        warehouse_name: '東京倉庫',
        is_active: true,
        capacity: 1000,
        opened_date: '2020-04-01',
      },
    ])

    // 「出力」: dao.findAll()で全件取得でき、既存テーブルと同様にCSV出力（SearchExportScreen）の
    // 元データとして使える
    const all = await warehouseDao!.findAll()
    expect(all).toHaveLength(2)

    access.db.close()
  })
})
