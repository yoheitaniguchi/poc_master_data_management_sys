import { useEffect, useState } from 'react'
import { initMasterDataAccess, type MasterDataAccess } from './core/dao/masterDataAccess'
import { loadTableDefinitions } from './core/schema/loadTableDefinitions'
import type { DefinitionValidationError } from './core/schema/validateDefinition'

export type MasterDataAccessState =
  | { status: 'loading' }
  | { status: 'ready'; access: MasterDataAccess; definitionErrors: DefinitionValidationError[] }
  | { status: 'error'; message: string }

// DO-1/DO-2: アプリ起動時にtable-definitions/*.jsonをfetchし、IndexedDBスキーマ・DAOを
// 動的構築する。画面（App.tsx以下）はこのフックの結果（Context経由）を介してのみDAOへ
// アクセスし、初期化完了前（status='loading'）はCSV取込等の操作を行えないようにする
// （docs/design.md §4.8: Web Workerは起動時のスキーマ構築完了を前提とするため）。
export function useMasterDataAccess(): MasterDataAccessState {
  const [state, setState] = useState<MasterDataAccessState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const { definitions, errors } = await loadTableDefinitions({ basePath: import.meta.env.BASE_URL })
        const access = await initMasterDataAccess(definitions)
        if (!cancelled) {
          setState({ status: 'ready', access, definitionErrors: errors })
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
