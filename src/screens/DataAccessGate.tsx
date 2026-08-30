import type { ReactNode } from 'react'
import { useMasterDataAccessContext } from '../MasterDataAccessContext'
import { Alert } from '../components/Alert'
import { Spinner } from '../components/Spinner'
import type { MasterDataAccess } from '../core/dao/masterDataAccess'
import type { DefinitionValidationError } from '../core/schema/validateDefinition'
import type { ExportDefinition } from '../core/export/types'
import type { ExportDefinitionValidationError } from '../core/export/validateExportDefinition'

interface DataAccessGateProps {
  children: (
    access: MasterDataAccess,
    definitionErrors: DefinitionValidationError[],
    exportDefinitions: ExportDefinition[],
    exportDefinitionErrors: ExportDefinitionValidationError[],
  ) => ReactNode
}

// docs/design.md §4.8: アプリ起動時のDBスキーマ構築（table-definitions/*.jsonのfetchと
// IndexedDBスキーマ構築）が完了する前に各画面の操作をさせないためのガード。
export function DataAccessGate({ children }: DataAccessGateProps) {
  const state = useMasterDataAccessContext()

  if (state.status === 'loading') {
    return (
      <p role="status" className="loading-inline">
        <Spinner /> マスタ定義を読み込んでいます…
      </p>
    )
  }

  if (state.status === 'error') {
    return (
      <Alert variant="error">
        <p>アプリの初期化に失敗しました: {state.message}</p>
        <p>
          下の「再読み込み」を試してください。繰り返し発生する場合は、開発チームに
          table-definitions/配下の定義JSONの内容を確認してください。
        </p>
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
          再読み込み
        </button>
      </Alert>
    )
  }

  return (
    <>
      {state.definitionErrors.length > 0 && (
        <Alert variant="warning">
          <p>
            一部のテーブル定義にエラーがあるため読み込めませんでした。該当テーブルは
            取込・検索・出力画面の選択肢に表示されません。以下の内容を参考に
            table-definitions/配下の該当JSONを修正し、ページを再読み込みしてください:
          </p>
          <ul>
            {state.definitionErrors.map((error, index) => (
              <li key={index}>
                {error.tableId}: {error.message}
              </li>
            ))}
          </ul>
        </Alert>
      )}
      {children(state.access, state.definitionErrors, state.exportDefinitions, state.exportDefinitionErrors)}
    </>
  )
}
