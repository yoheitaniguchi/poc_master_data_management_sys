import { useState } from 'react'
import { DataAccessGate } from './DataAccessGate'
import { importStatusLabel } from './importStatusLabels'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { MasterDataAccess } from '../core/dao/masterDataAccess'
import type { ImportLog } from '../core/dao/importLogDao'
import type { TableDefinition } from '../core/schema/types'
import type {
  CsvImportErrorMessage,
  CsvImportRequestMessage,
  CsvImportResultMessage,
} from '../workers/csvImport.worker'

type ImportOutcome = { kind: 'result'; log: ImportLog } | { kind: 'error'; message: string }

function runCsvImport(definition: TableDefinition, file: File): Promise<ImportOutcome> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('../workers/csvImport.worker.ts', import.meta.url), {
      type: 'module',
    })
    const requestId = crypto.randomUUID()

    const finish = (outcome: ImportOutcome) => {
      worker.terminate()
      resolve(outcome)
    }

    worker.onmessage = (event: MessageEvent<CsvImportResultMessage | CsvImportErrorMessage>) => {
      const message = event.data
      if (message.requestId !== requestId) return
      if (message.type === 'importResult') {
        finish({ kind: 'result', log: message.log })
      } else {
        finish({ kind: 'error', message: message.message })
      }
    }
    worker.onerror = (event) => {
      finish({ kind: 'error', message: event.message || '取込処理でエラーが発生しました' })
    }

    const request: CsvImportRequestMessage = {
      type: 'import',
      requestId,
      definition,
      fileName: file.name,
      file,
    }
    worker.postMessage(request)
  })
}

// SCR-1: CSVファイルを選択し取込を実行する画面（DO-5）。
export function ImportScreen() {
  return <DataAccessGate>{(access) => <ImportScreenBody access={access} />}</DataAccessGate>
}

function ImportScreenBody({ access }: { access: MasterDataAccess }) {
  const [tableId, setTableId] = useState(access.definitions[0]?.tableId ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const definition = access.definitions.find((d) => d.tableId === tableId)
  const primaryKeyColumn = definition?.columns.find((column) => column.primaryKey)

  async function executeImport() {
    if (!definition || !file) return
    setShowConfirm(false)
    setIsRunning(true)
    setOutcome(null)
    const result = await runCsvImport(definition, file)
    setOutcome(result)
    setIsRunning(false)
  }

  if (access.definitions.length === 0) {
    return <p>取込可能なテーブル定義がありません。table-definitions/を確認してください。</p>
  }

  return (
    <section>
      <h2>CSV取込</h2>

      <div>
        <label>
          取込先テーブル:{' '}
          <select
            value={tableId}
            onChange={(event) => {
              setTableId(event.target.value)
              setFile(null)
              setOutcome(null)
            }}
            disabled={isRunning}
          >
            {access.definitions.map((d) => (
              <option key={d.tableId} value={d.tableId}>
                {d.tableName}（{d.tableId}）
              </option>
            ))}
          </select>
        </label>
        {definition && (
          <p>
            想定するCSVヘッダー（1行目）: {definition.columns.map((c) => c.columnId).join(',')}
          </p>
        )}
      </div>

      <div>
        <label>
          CSVファイル:{' '}
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={isRunning}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null)
              setOutcome(null)
            }}
          />
        </label>
      </div>

      <button
        type="button"
        className="btn-danger"
        onClick={() => setShowConfirm(true)}
        disabled={!definition || !file || isRunning}
      >
        {isRunning ? '取込実行中…' : '取込実行'}
      </button>

      <ConfirmDialog
        open={showConfirm}
        title="CSV取込の確認"
        message={
          `「${definition?.tableName ?? ''}」にCSVを取り込みます。\n` +
          `主キー「${primaryKeyColumn?.columnName ?? ''}」が一致する既存データは上書きされ、この操作は元に戻せません。\n` +
          `実行しますか？`
        }
        confirmLabel="取込を実行する"
        danger
        onConfirm={executeImport}
        onCancel={() => setShowConfirm(false)}
      />

      {isRunning && <p role="status">取込を実行しています…（メイン画面の操作は継続できます）</p>}

      {outcome?.kind === 'error' && <p role="alert">取込処理でエラーが発生しました: {outcome.message}</p>}

      {outcome?.kind === 'result' && <ImportResultSummary log={outcome.log} />}
    </section>
  )
}

function ImportResultSummary({ log }: { log: ImportLog }) {
  return (
    <div role="status">
      <h3>取込結果: {importStatusLabel[log.status]}</h3>
      <ul>
        <li>対象ファイル: {log.fileName}</li>
        <li>件数: 合計{log.totalRows}件 / 成功{log.successRows}件 / エラー{log.errorRows}件</li>
      </ul>
      {log.errors.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>行番号</th>
              <th>カラム</th>
              <th>内容</th>
            </tr>
          </thead>
          <tbody>
            {log.errors.map((error, index) => (
              <tr key={index}>
                <td>{error.rowNumber || '-'}</td>
                <td>{error.columnId || '-'}</td>
                <td>{error.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
