import { useEffect, useState } from 'react'
import { DataAccessGate } from './DataAccessGate'
import { importStatusLabel } from './importStatusLabels'
import type { MasterDataAccess } from '../core/dao/masterDataAccess'
import type { ImportLog } from '../core/dao/importLogDao'

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
      <p>
        {isLoading
          ? '読み込み中…'
          : logs.length === 0
            ? 'まだ取込ログはありません。CSV取込画面から取込を実行してください。'
            : `${logs.length}件`}
      </p>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>実行日時</th>
              <th>テーブル</th>
              <th>ファイル名</th>
              <th>ステータス</th>
              <th className="col-numeric">件数（成功/エラー/合計）</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.importId}>
                <td>{log.startedAt}</td>
                <td>{tableNameOf(log.tableId)}</td>
                <td>{log.fileName}</td>
                <td>{importStatusLabel[log.status]}</td>
                <td className="col-numeric">
                  {log.successRows}/{log.errorRows}/{log.totalRows}
                </td>
                <td>
                  <button type="button" onClick={() => setSelectedImportId(log.importId)}>
                    詳細を見る
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedLog && (
        <div>
          <h3>
            取込詳細: {selectedLog.fileName}（{tableNameOf(selectedLog.tableId)}）
          </h3>
          {selectedLog.errors.length === 0 ? (
            <p>エラーはありません。</p>
          ) : (
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
                  {selectedLog.errors.map((error, index) => (
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
        </div>
      )}
    </section>
  )
}
