import type { ReactNode } from 'react'
import { useMasterDataAccessContext } from '../MasterDataAccessContext'
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
    return <p role="status">マスタ定義を読み込んでいます…</p>
  }

  if (state.status === 'error') {
    return (
      <div role="alert">
        <p>アプリの初期化に失敗しました: {state.message}</p>
        <button type="button" onClick={() => window.location.reload()}>
          再読み込み
        </button>
      </div>
    )
  }

  return (
    <>
      {state.definitionErrors.length > 0 && (
        <div role="alert" className="definition-error-banner">
          <p>
            一部のテーブル定義にエラーがあるため読み込めませんでした（定義JSONを確認してください）。
            該当テーブルは取込・検索・出力画面の選択肢に表示されません:
          </p>
          <ul>
            {state.definitionErrors.map((error, index) => (
              <li key={index}>
                {error.tableId}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {children(state.access, state.definitionErrors, state.exportDefinitions, state.exportDefinitionErrors)}
    </>
  )
}
