/// <reference lib="webworker" />

import { openDB } from 'idb'
import { DB_NAME } from '../core/dao/openMasterDb'
import { createMasterDao } from '../core/dao/dao'
import { createImportLogDao } from '../core/dao/importLogDao'
import type { ImportLog } from '../core/dao/importLogDao'
import type { TableDefinition } from '../core/schema/types'
import { importCsvFile } from './importCsvFile'

export interface CsvImportRequestMessage {
  type: 'import'
  requestId: string
  definition: TableDefinition
  fileName: string
  file: File
}

export interface CsvImportResultMessage {
  type: 'importResult'
  requestId: string
  log: ImportLog
}

const workerSelf = self as unknown as DedicatedWorkerGlobalScope

// DO-3: CSVファイルの読込・パース・バリデーション・Upsert登録をここ（Web Worker）で行い、
// メインスレッド（UI）をブロックしない。DBスキーマ自体はアプリ起動時にメインスレッドで
// 構築済みの前提とする（docs/design.md §4.3のバージョン管理はlocalStorageに依存しWorkerからは
// 使えないため、Workerでは既存DBに接続するだけにする）。
workerSelf.onmessage = async (event: MessageEvent<CsvImportRequestMessage>) => {
  const { requestId, definition, fileName, file } = event.data

  const db = await openDB(DB_NAME, 1)
  try {
    const masterDao = createMasterDao(db, definition)
    const importLogDao = createImportLogDao(db)
    const csvText = await file.text()

    const log = await importCsvFile({ definition, fileName, csvText, masterDao, importLogDao })

    const response: CsvImportResultMessage = { type: 'importResult', requestId, log }
    workerSelf.postMessage(response)
  } finally {
    db.close()
  }
}
