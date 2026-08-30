import { useState } from 'react'
import { DataAccessGate } from './DataAccessGate'
import { importStatusLabel, importStatusVariant } from './importStatusLabels'
import { Alert } from '../components/Alert'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Spinner } from '../components/Spinner'
import type { MasterDataAccess } from '../core/dao/masterDataAccess'
import type { ImportLog } from '../core/dao/importLogDao'
import type { TableDefinition } from '../core/schema/types'
import type {
  CsvImportErrorMessage,
  CsvImportRequestMessage,
  CsvImportResultMessage,
} from '../workers/csvImport.worker'

type ImportOutcome = { kind: 'result'; log: ImportLog } | { kind: 'error'; message: string }

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

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
  const [isDragOver, setIsDragOver] = useState(false)

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
          <>
            <p>
              想定するCSVヘッダー（1行目）:{' '}
              {definition.columns.map((c, index) => (
                <span key={c.columnId}>
                  {index > 0 && ', '}
                  {c.columnId}
                  {c.notNull && (
                    <span className="required-mark" title="必須項目（NotNull制約あり）">
                      *
                    </span>
                  )}
                </span>
              ))}
            </p>
            {definition.columns.some((c) => c.notNull) && (
              <p className="field-hint">※「*」は必須項目（NotNull制約あり）です。未入力の行はエラーになります。</p>
            )}
          </>
        )}
      </div>

      <div>
        <p className="field-label">CSVファイル:</p>
        <div
          className={isDragOver ? 'dropzone dropzone--active' : 'dropzone'}
          onDragOver={(event) => {
            event.preventDefault()
            if (!isRunning) setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragOver(false)
            if (isRunning) return
            const dropped = event.dataTransfer.files?.[0] ?? null
            if (dropped) {
              setFile(dropped)
              setOutcome(null)
            }
          }}
        >
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={isRunning}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null)
              setOutcome(null)
            }}
          />
          <p className="dropzone__hint">ここにCSVファイルをドラッグ&ドロップすることもできます</p>
          {file && (
            <p className="dropzone__file">
              選択中のファイル: {file.name}（{formatFileSize(file.size)}）
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        className="btn-danger"
        onClick={() => setShowConfirm(true)}
        disabled={!definition || !file || isRunning}
      >
        {isRunning ? (
          <span className="loading-inline">
            <Spinner /> 取込実行中…
          </span>
        ) : (
          '取込実行'
        )}
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

      {isRunning && (
        <p role="status" className="loading-inline">
          <Spinner /> 取込を実行しています…（メイン画面の操作は継続できます）
        </p>
      )}

      {outcome?.kind === 'error' && (
        <Alert variant="error">
          <p>取込処理でエラーが発生しました: {outcome.message}</p>
          <p>
            CSVファイルの文字コード（UTF-8推奨）・ヘッダー行の内容、取込先テーブルの選択が
            正しいか確認し、再度お試しください。
          </p>
        </Alert>
      )}

      {outcome?.kind === 'result' && <ImportResultSummary log={outcome.log} />}
    </section>
  )
}

function ImportResultSummary({ log }: { log: ImportLog }) {
  return (
    <Alert variant={importStatusVariant[log.status]} role="status">
      <h3>取込結果: {importStatusLabel[log.status]}</h3>
      <ul>
        <li>対象ファイル: {log.fileName}</li>
        <li>件数: 合計{log.totalRows}件 / 成功{log.successRows}件 / エラー{log.errorRows}件</li>
      </ul>
      {log.errors.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="col-numeric">行番号</th>
                <th>カラム</th>
                <th>内容</th>
              </tr>
            </thead>
            <tbody>
              {log.errors.map((error, index) => (
                <tr key={index}>
                  <td className="col-numeric">{error.rowNumber || '-'}</td>
                  <td>{error.columnId || '-'}</td>
                  <td>{error.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Alert>
  )
}
