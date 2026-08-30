import { useState } from 'react'
import { MasterDataAccessProvider } from './MasterDataAccessContext'
import { useMasterDataAccess } from './useMasterDataAccess'
import { ImportScreen } from './screens/ImportScreen'
import { SearchExportScreen } from './screens/SearchExportScreen'
import { ImportLogScreen } from './screens/ImportLogScreen'
import { Alert } from './components/Alert'

type Tab = 'import' | 'search' | 'log'

const tabs: { id: Tab; label: string }[] = [
  { id: 'import', label: 'CSV取込' },
  { id: 'search', label: 'マスタ検索・出力' },
  { id: 'log', label: '取込実行ログ' },
]

export function App() {
  const state = useMasterDataAccess()
  const [activeTab, setActiveTab] = useState<Tab>('import')
  const [dismissedRebuiltNotice, setDismissedRebuiltNotice] = useState(false)

  const showRebuiltNotice = state.status === 'ready' && state.access.rebuilt && !dismissedRebuiltNotice

  return (
    <MasterDataAccessProvider value={state}>
      <main className="app-shell">
        <h1>マスタ管理システム PoC</h1>

        {showRebuiltNotice && (
          <Alert variant="warning">
            <p>
              テーブル定義の変更を検知したため、既存のマスタデータをすべて削除して再作成しました
              （PoCの簡易方針。docs/design.md §4.3。取込済みだったデータは失われています）。
            </p>
            <button type="button" onClick={() => setDismissedRebuiltNotice(true)}>
              閉じる
            </button>
          </Alert>
        )}

        <nav className="tab-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'tab-button tab-button--active' : 'tab-button'}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/*
          ImportScreenのみ、タブを離れても条件付きレンダリングでアンマウントせずhiddenで
          表示だけ切り替える。Worker完了イベントを受け取るコンポーネントローカルstateを
          持つため、アンマウントすると取込結果を二度と表示できなくなる問題があった
          （ux-reviewer指摘）。SearchExportScreen/ImportLogScreenは逆に、タブへ再訪問する
          たびに最新のIndexedDBの内容をfindAll()し直す必要があるため（マウント時にのみ
          fetchするuseEffectを持つ）、従来通り条件付きレンダリングでアンマウント・
          再マウントさせることで「訪問するたびに最新化される」動作を維持する。
        */}
        <div hidden={activeTab !== 'import'}>
          <ImportScreen />
        </div>
        {activeTab === 'search' && <SearchExportScreen />}
        {activeTab === 'log' && <ImportLogScreen />}
      </main>
    </MasterDataAccessProvider>
  )
}
