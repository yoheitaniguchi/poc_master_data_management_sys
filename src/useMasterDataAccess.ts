import { useEffect, useState } from 'react'
import { initMasterDataAccess, type MasterDataAccess } from './core/dao/masterDataAccess'
import { loadTableDefinitions } from './core/schema/loadTableDefinitions'
import type { DefinitionValidationError } from './core/schema/validateDefinition'
import { loadExportDefinitions } from './core/export/loadExportDefinitions'
import type { ExportDefinition } from './core/export/types'
import type { ExportDefinitionValidationError } from './core/export/validateExportDefinition'

export type MasterDataAccessState =
  | { status: 'loading' }
  | {
      status: 'ready'
      access: MasterDataAccess
      definitionErrors: DefinitionValidationError[]
      exportDefinitions: ExportDefinition[]
      exportDefinitionErrors: ExportDefinitionValidationError[]
    }
  | { status: 'error'; message: string }

// DO-1/DO-2: アプリ起動時にtable-definitions/*.jsonをfetchし、IndexedDBスキーマ・DAOを
// 動的構築する。画面（App.tsx以下）はこのフックの結果（Context経由）を介してのみDAOへ
// アクセスし、初期化完了前（status='loading'）はCSV取込等の操作を行えないようにする
// （docs/design.md §4.8: Web Workerは起動時のスキーマ構築完了を前提とするため）。
// DO-8: 連携ファイル定義（export-definitions/*.json）もテーブル定義と同じタイミングで
// 読み込む。sourceTableId/sourceColumnIdの妥当性検証にテーブル定義が必要なため、
// テーブル定義の読み込み完了後に行う。
export function useMasterDataAccess(): MasterDataAccessState {
  const [state, setState] = useState<MasterDataAccessState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const basePath = import.meta.env.BASE_URL
        const { definitions, errors } = await loadTableDefinitions({ basePath })
        const access = await initMasterDataAccess(definitions)
        const { definitions: exportDefinitions, errors: exportDefinitionErrors } = await loadExportDefinitions({
          basePath,
          tableDefinitions: definitions,
        })
        if (!cancelled) {
          setState({
            status: 'ready',
            access,
            definitionErrors: errors,
            exportDefinitions,
            exportDefinitionErrors,
          })
        }
      } catch (error) {
        if (!cancelled) {
          setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
        }
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
