import { deleteDB, openDB, type IDBPDatabase } from 'idb'
import type { TableDefinition } from '../schema/types'
import { computeDefinitionsHash } from './definitionsHash'

export const DB_NAME = 'master_data_db'
export const IMPORT_LOG_STORE = 'import_logs'
const HASH_STORAGE_KEY = 'masterDataDb:definitionsHash'

export interface OpenMasterDbOptions {
  /** テスト用の差し替え。省略時はグローバルのlocalStorageを使用する */
  storage?: Pick<Storage, 'getItem' | 'setItem'>
}

// docs/design.md §4.3: 定義JSON群のハッシュが前回起動時と異なれば、DBを削除してから
// 定義に従って再作成する（本番相当のマイグレーションは実装しない簡易方針）。
export async function openMasterDb(
  definitions: TableDefinition[],
  options: OpenMasterDbOptions = {},
): Promise<IDBPDatabase> {
  const storage = options.storage ?? localStorage
  const hash = computeDefinitionsHash(definitions)
  const storedHash = storage.getItem(HASH_STORAGE_KEY)

  if (storedHash !== hash) {
    await deleteDB(DB_NAME)
  }

  const db = await openDB(DB_NAME, 1, {
    upgrade(database) {
      for (const definition of definitions) {
        if (database.objectStoreNames.contains(definition.tableId)) continue
        const primaryKeyColumn = definition.columns.find((column) => column.primaryKey)!
        database.createObjectStore(definition.tableId, { keyPath: primaryKeyColumn.columnId })
      }
      if (!database.objectStoreNames.contains(IMPORT_LOG_STORE)) {
        database.createObjectStore(IMPORT_LOG_STORE, { keyPath: 'importId' })
      }
    },
  })

  storage.setItem(HASH_STORAGE_KEY, hash)
  return db
}
