// openMasterDbのstorageオプション用の最小スタブ。テストごとに独立したインスタンスを使うことで
// localStorageの実体を共有せず、テスト間のハッシュ値汚染を防ぐ。
export function createMemoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const store = new Map<string, string>()
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
  }
}
