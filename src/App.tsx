import { useState } from 'react'
import { MasterDataAccessProvider } from './MasterDataAccessContext'
import { useMasterDataAccess } from './useMasterDataAccess'
import { ImportScreen } from './screens/ImportScreen'
import { SearchExportScreen } from './screens/SearchExportScreen'
import { ImportLogScreen } from './screens/ImportLogScreen'

type Tab = 'import' | 'search' | 'log'

const tabs: { id: Tab; label: string }[] = [
  { id: 'import', label: 'CSV取込' },
  { id: 'search', label: 'マスタ検索・出力' },
  { id: 'log', label: '取込実行ログ' },
]

export function App() {
  const state = useMasterDataAccess()
  const [activeTab, setActiveTab] = useState<Tab>('import')

  return (
    <MasterDataAccessProvider value={state}>
      <main>
        <h1>マスタ管理システム PoC</h1>
        <nav>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              disabled={activeTab === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'import' && <ImportScreen />}
        {activeTab === 'search' && <SearchExportScreen />}
        {activeTab === 'log' && <ImportLogScreen />}
      </main>
    </MasterDataAccessProvider>
  )
}
