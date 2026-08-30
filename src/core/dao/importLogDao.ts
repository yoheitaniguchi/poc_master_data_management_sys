import type { IDBPDatabase } from 'idb'
import { IMPORT_LOG_STORE } from './openMasterDb'

export type ImportStatus = 'RUNNING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED'

export interface ImportLogError {
  rowNumber: number
  columnId: string
  message: string
}

// 要求仕様書§5.5: 取込バッチ単位（DONT-7によりレコード単位の変更履歴は対象外）のログ。
export interface ImportLog {
  importId: string
  tableId: string
  fileName: string
  startedAt: string
  finishedAt: string | null
  status: ImportStatus
  totalRows: number
  successRows: number
  errorRows: number
  errors: ImportLogError[]
}

export interface ImportLogDao {
  /** importId一致時は上書き更新。取込開始時のRUNNING記録と完了時の更新の両方に使う */
  save(log: ImportLog): Promise<void>
  findAll(): Promise<ImportLog[]>
  findById(importId: string): Promise<ImportLog | undefined>
}

export function createImportLogDao(db: IDBPDatabase): ImportLogDao {
  return {
    save: async (log) => {
      await db.put(IMPORT_LOG_STORE, log)
    },
    findAll: () => db.getAll(IMPORT_LOG_STORE),
    findById: (importId) => db.get(IMPORT_LOG_STORE, importId),
  }
}
