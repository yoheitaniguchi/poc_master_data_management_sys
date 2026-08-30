import { useEffect, useState } from 'react'
import Papa from 'papaparse'
import { DataAccessGate } from './DataAccessGate'
import type { MasterDataAccess } from '../core/dao/masterDataAccess'
import type { MasterRecord, MasterRecordValue, TableDefinition } from '../core/schema/types'

function parseSearchValue(dataType: TableDefinition['columns'][number]['dataType'], raw: string): MasterRecordValue | undefined {
  switch (dataType) {
    case 'string':
    case 'date':
      return raw
    case 'number': {
      const numericValue = Number(raw)
      return Number.isNaN(numericValue) ? undefined : numericValue
    }
    case 'boolean':
      if (raw === 'true') return true
      if (raw === 'false') return false
      return undefined
  }
}

// docs/design.md §4.7: CSV取込のヘッダーはcolumnId厳密一致を前提とするため、DO-7のダウンロード
// もcolumnIdをヘッダーに使う（ダウンロードしたCSVをそのまま取込画面へ再投入できるようにする）。
// 画面上の一覧表示（<th>）は人間向けにcolumnNameを使うが、ファイル出力は往復可能な形式を優先する。
function downloadCsv(fileName: string, definition: TableDefinition, records: MasterRecord[]) {
  const headerRow = definition.columns.map((column) => column.columnId)
  const dataRows = records.map((record) => definition.columns.map((column) => record[column.columnId] ?? ''))
  const csvBody = Papa.unparse([headerRow, ...dataRows])
  // Excelで文字化けしないようUTF-8 BOMを付与する
  const blob = new Blob(['﻿' + csvBody], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

// SCR-2: 登録済みマスタデータを条件検索・一覧表示し、CSVダウンロードする画面（DO-6, DO-7）。
export function SearchExportScreen() {
  return <DataAccessGate>{(access) => <SearchExportScreenBody access={access} />}</DataAccessGate>
}

function SearchExportScreenBody({ access }: { access: MasterDataAccess }) {
  const [tableId, setTableId] = useState(access.definitions[0]?.tableId ?? '')
  const [searchInputs, setSearchInputs] = useState<Record<string, string>>({})
  const [records, setRecords] = useState<MasterRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [ignoredColumnNames, setIgnoredColumnNames] = useState<string[]>([])

  const definition = access.definitions.find((d) => d.tableId === tableId)
  const dao = definition ? access.daos.get(definition.tableId) : undefined

  useEffect(() => {
    setSearchInputs({})
    setIgnoredColumnNames([])
    if (!dao) {
      setRecords([])
      return
    }
    setIsLoading(true)
    dao
      .findAll()
      .then(setRecords)
      .finally(() => setIsLoading(false))
  }, [dao])

  async function handleSearch() {
    if (!dao || !definition) return
    const criteria: Partial<MasterRecord> = {}
    const ignored: string[] = []
    for (const column of definition.columns) {
      const raw = searchInputs[column.columnId] ?? ''
      if (raw === '') continue
      const value = parseSearchValue(column.dataType, raw)
      if (value === undefined) {
        // 数値/真偽値に変換できない入力（例: 数値カラムに文字列）はこの条件のみ無視して検索を続ける
        ignored.push(column.columnName)
        continue
      }
      criteria[column.columnId] = value
    }
    setIgnoredColumnNames(ignored)
    setIsLoading(true)
    try {
      setRecords(await dao.search(criteria))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleClear() {
    setSearchInputs({})
    setIgnoredColumnNames([])
    if (!dao) return
    setIsLoading(true)
    try {
      setRecords(await dao.findAll())
    } finally {
      setIsLoading(false)
    }
  }

  if (access.definitions.length === 0) {
    return <p>検索可能なテーブル定義がありません。table-definitions/を確認してください。</p>
  }

  return (
    <section>
      <h2>マスタ検索・出力</h2>

      <div>
        <label>
          テーブル:{' '}
          <select
            value={tableId}
            onChange={(event) => setTableId(event.target.value)}
            disabled={isLoading}
          >
            {access.definitions.map((d) => (
              <option key={d.tableId} value={d.tableId}>
                {d.tableName}（{d.tableId}）
              </option>
            ))}
          </select>
        </label>
      </div>

      {definition && (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              handleSearch()
            }}
          >
            <fieldset>
              <legend>検索条件（未入力の項目は無視されます。文字列は部分一致、それ以外は完全一致）</legend>
              {definition.columns.map((column) => (
                <label key={column.columnId} style={{ marginRight: '1em' }}>
                  {column.columnName}:{' '}
                  <input
                    type="text"
                    value={searchInputs[column.columnId] ?? ''}
                    onChange={(event) =>
                      setSearchInputs((prev) => ({ ...prev, [column.columnId]: event.target.value }))
                    }
                  />
                </label>
              ))}
            </fieldset>
            <button type="submit" disabled={isLoading}>
              検索
            </button>{' '}
            <button type="button" onClick={handleClear} disabled={isLoading}>
              クリア（全件表示）
            </button>{' '}
            <button
              type="button"
              onClick={() => downloadCsv(`${definition.tableId}.csv`, definition, records)}
              disabled={isLoading || records.length === 0}
            >
              CSVダウンロード（全カラム。取込画面へそのまま再取込可能な形式）
            </button>
          </form>

          {ignoredColumnNames.length > 0 && (
            <p role="alert">
              次の項目は入力値を検索条件として解釈できなかったため無視しました:{' '}
              {ignoredColumnNames.join('、')}
            </p>
          )}

          <p>
            {isLoading
              ? '読み込み中…'
              : records.length === 0
                ? '該当するデータがありません。検索条件を変更するか、CSV取込画面からデータを登録してください。'
                : `${records.length}件`}
          </p>

          <table>
            <thead>
              <tr>
                {definition.columns.map((column) => (
                  <th key={column.columnId}>{column.columnName}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => (
                <tr key={index}>
                  {definition.columns.map((column) => (
                    <td key={column.columnId}>{String(record[column.columnId] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
