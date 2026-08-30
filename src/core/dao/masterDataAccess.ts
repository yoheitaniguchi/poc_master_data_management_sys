import type { IDBPDatabase } from 'idb'
import type { TableDefinition } from '../schema/types'
import { openMasterDb, type OpenMasterDbOptions } from './openMasterDb'
import { createMasterDao, type MasterDao } from './dao'
import { createImportLogDao, type ImportLogDao } from './importLogDao'

export interface MasterDataAccess {
  db: IDBPDatabase
  definitions: TableDefinition[]
  daos: ReadonlyMap<string, MasterDao>
  importLogDao: ImportLogDao
}

// DO-2: 検証済みのテーブル定義一覧からIndexedDBスキーマとテーブルごとのDAOを実行時に構築する。
export async function initMasterDataAccess(
  definitions: TableDefinition[],
  options: OpenMasterDbOptions = {},
): Promise<MasterDataAccess> {
  const db = await openMasterDb(definitions, options)
  const daos = new Map(definitions.map((definition) => [definition.tableId, createMasterDao(db, definition)]))
  return { db, definitions, daos, importLogDao: createImportLogDao(db) }
}
