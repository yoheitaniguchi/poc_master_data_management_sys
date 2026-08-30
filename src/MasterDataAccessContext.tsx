import { createContext, useContext } from 'react'
import type { MasterDataAccessState } from './useMasterDataAccess'

const MasterDataAccessContext = createContext<MasterDataAccessState | undefined>(undefined)

export const MasterDataAccessProvider = MasterDataAccessContext.Provider

export function useMasterDataAccessContext(): MasterDataAccessState {
  const context = useContext(MasterDataAccessContext)
  if (!context) {
    throw new Error('useMasterDataAccessContextはMasterDataAccessProviderの内側でのみ使用できます')
  }
  return context
}
