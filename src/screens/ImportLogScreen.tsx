import { useEffect, useState } from 'react'
import { DataAccessGate } from './DataAccessGate'
import type { MasterDataAccess } from '../core/dao/masterDataAccess'
import type { ImportLog } from '../core/dao/importLogDao'

const statusLabel: Record<ImportLog['status'], string> = {
  RUNNING: '実行中',
  COMPLETED: '全件成功',
  COMPLETED_WITH_ERRORS: '一部エラーあり',
  FAILED: '処理失敗',
}

// SCR-3: 取込バッチ単位の実行ログを一覧表示し、選択した1件のエラー明細を確認する画面（DO-9）。
export function ImportLogScreen() {
  return <DataAccessGate>{(access) => <ImportLogScreenBody access={access} />}</DataAccessGate>
}

function ImportLogScreenBody({ access }: { access: MasterDataAccess }) {
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null)

  async function refresh() {
    setIsLoading(true)
    try {
      const all = await access.importLogDao.findAll()
      all.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
      setLogs(all)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [access])

  const tableNameOf = (tableId: string) => access.definitions.find((d) => d.tableId === tableId)?.tableName ?? tableId
  const selectedLog = logs.find((log) => log.importId === selectedImportId) ?? null

  return (
    <section>
      <h2>取込実行ログ</h2>
      <button type="button" onClick={refresh} disabled={isLoading}>
        更新
      </button>
      <p>{isLoading ? '読み込み中…' : `${logs.length}件`}</p>

      <table>
        <thead>
          <tr>
            <th>実行日時</th>
            <th>テーブル</th>
            <th>ファイル名</th>
            <th>ステータス</th>
            <th>件数（成功/エラー/合計）</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.importId}>
              <td>{log.startedAt}</td>
              <td>{tableNameOf(log.tableId)}</td>
              <td>{log.fileName}</td>
              <td>{statusLabel[log.status]}</td>
              <td>
                {log.successRows}/{log.errorRows}/{log.totalRows}
              </td>
              <td>
                <button type="button" onClick={() => setSelectedImportId(log.importId)}>
                  エラー明細を見る
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedLog && (
        <div>
          <h3>
            エラー明細: {selectedLog.fileName}（{tableNameOf(selectedLog.tableId)}）
          </h3>
          {selectedLog.errors.length === 0 ? (
            <p>エラーはありません。</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>行番号</th>
                  <th>カラム</th>
                  <th>内容</th>
                </tr>
              </thead>
              <tbody>
                {selectedLog.errors.map((error, index) => (
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
      )}
    </section>
  )
}
