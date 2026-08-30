import Papa from 'papaparse'
import type { MasterDao } from '../core/dao/dao'
import type { ImportLog, ImportLogDao, ImportLogError } from '../core/dao/importLogDao'
import type { MasterRecordValue, TableDefinition } from '../core/schema/types'
import type { UniqueCheckContext } from '../core/validation/checkUnique'
import { validateRow } from '../core/validation/validateRow'

export interface ImportCsvFileOptions {
  definition: TableDefinition
  fileName: string
  csvText: string
  masterDao: MasterDao
  importLogDao: ImportLogDao
  /** テスト用: importIdを決定的な値に差し替える。省略時はcrypto.randomUUID() */
  generateImportId?: () => string
}

// 要求仕様書§5.3: CSVをパースし、§5.2の順序でバリデーションした上でエラー行はスキップし、
// 正常な行のみUpsert登録する（部分成功を許容、All or Nothingにしない）。取込ログを1件生成する。
export async function importCsvFile(options: ImportCsvFileOptions): Promise<ImportLog> {
  const { definition, fileName, csvText, masterDao, importLogDao } = options
  const importId = (options.generateImportId ?? (() => crypto.randomUUID()))()
  const startedAt = new Date().toISOString()

  const baseLog: ImportLog = {
    importId,
    tableId: definition.tableId,
    fileName,
    startedAt,
    finishedAt: null,
    status: 'RUNNING',
    totalRows: 0,
    successRows: 0,
    errorRows: 0,
    errors: [],
  }
  await importLogDao.save(baseLog)

  try {
    const finalLog = await runImport(definition, csvText, masterDao, baseLog)
    await importLogDao.save(finalLog)
    return finalLog
  } catch (error) {
    const failedLog: ImportLog = {
      ...baseLog,
      finishedAt: new Date().toISOString(),
      status: 'FAILED',
      errors: [
        {
          rowNumber: 0,
          columnId: '',
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    }
    await importLogDao.save(failedLog)
    return failedLog
  }
}

async function runImport(
  definition: TableDefinition,
  csvText: string,
  masterDao: MasterDao,
  baseLog: ImportLog,
): Promise<ImportLog> {
  const parseResult = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const uniqueColumnIds = definition.columns.filter((column) => column.unique).map((column) => column.columnId)
  const existingRecords = await masterDao.findAll()
  const seenInFile: Record<string, Set<MasterRecordValue>> = {}
  const existingValues: Record<string, Set<MasterRecordValue>> = {}
  for (const columnId of uniqueColumnIds) {
    seenInFile[columnId] = new Set()
    existingValues[columnId] = new Set(existingRecords.map((record) => record[columnId]))
  }

  const errors: ImportLogError[] = []
  let successRows = 0
  const rows = parseResult.data

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i]
    const rowNumber = i + 1 // ヘッダー行を除く、データ行としての1始まり番号

    const uniqueContexts: Record<string, UniqueCheckContext> = {}
    for (const columnId of uniqueColumnIds) {
      uniqueContexts[columnId] = {
        seenInFile: seenInFile[columnId],
        existingValues: existingValues[columnId],
      }
    }

    const result = validateRow({ definition, rawRow, uniqueContexts })

    for (const columnId of uniqueColumnIds) {
      const value = result.passedUniqueValues[columnId]
      if (value !== undefined) {
        seenInFile[columnId].add(value)
      }
    }

    if (result.record) {
      await masterDao.upsert(result.record)
      successRows++
    } else {
      for (const error of result.errors) {
        errors.push({ rowNumber, columnId: error.columnId, message: error.message })
      }
    }
  }

  const totalRows = rows.length
  const errorRows = totalRows - successRows

  return {
    ...baseLog,
    finishedAt: new Date().toISOString(),
    status: errorRows === 0 ? 'COMPLETED' : 'COMPLETED_WITH_ERRORS',
    totalRows,
    successRows,
    errorRows,
    errors,
  }
}
