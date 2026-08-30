/// <reference lib="webworker" />

import { openDB, type IDBPDatabase } from 'idb'
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

// DB接続やファイル読込自体が失敗した場合（import_logsへ書き込むためのDB接続すら得られない
// 場合を含む）に返す。importCsvFile内部の失敗はImportLog.status='FAILED'として正常応答する
// ため、この型が使われるのはそれより手前の失敗のみ。
export interface CsvImportErrorMessage {
  type: 'importError'
  requestId: string
  message: string
}

const workerSelf = self as unknown as DedicatedWorkerGlobalScope

// DO-3: CSVファイルの読込・パース・バリデーション・Upsert登録をここ（Web Worker）で行い、
// メインスレッド（UI）をブロックしない。DBスキーマ自体はアプリ起動時にメインスレッドで
// 構築済みの前提とする（docs/design.md §4.3のバージョン管理はlocalStorageに依存しWorkerからは
// 使えないため、Workerでは既存DBに接続するだけにする）。
workerSelf.onmessage = async (event: MessageEvent<CsvImportRequestMessage>) => {
  const { requestId, definition, fileName, file } = event.data

  let db: IDBPDatabase | undefined
  try {
    db = await openDB(DB_NAME, 1)
    const masterDao = createMasterDao(db, definition)
    const importLogDao = createImportLogDao(db)
    const csvText = await file.text()

    const log = await importCsvFile({ definition, fileName, csvText, masterDao, importLogDao })

    const response: CsvImportResultMessage = { type: 'importResult', requestId, log }
    workerSelf.postMessage(response)
  } catch (error) {
    // openDB・file.text()の失敗はimportCsvFileの外側のため、ここで捕捉しないと
    // メインスレッドへ一切応答が返らず処理が無応答のまま止まってしまう。
    const response: CsvImportErrorMessage = {
      type: 'importError',
      requestId,
      message: error instanceof Error ? error.message : String(error),
    }
    workerSelf.postMessage(response)
  } finally {
    db?.close()
  }
}
