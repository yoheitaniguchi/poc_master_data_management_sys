import { useEffect, useState } from 'react'
import Papa from 'papaparse'
import { DataAccessGate } from './DataAccessGate'
import { Alert } from '../components/Alert'
import { Spinner } from '../components/Spinner'
import { buildExportCsv } from '../core/export/buildExportCsv'
import type { ExportDefinition } from '../core/export/types'
import type { ExportDefinitionValidationError } from '../core/export/validateExportDefinition'
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

// タブ区切りのようにカンマ以外のdelimiterを使う連携ファイル定義では、拡張子を.csvのまま
// 固定すると実際の区切り文字と食い違いExcel等で正しく開けない事故につながる（ux-reviewer指摘）。
function extensionForDelimiter(delimiter: string): string {
  return delimiter === '\t' ? 'tsv' : 'csv'
}

// ExcelでUTF-8のCSVを開いても文字化けしないようBOMを付与してダウンロードを開始する。
function downloadCsvText(fileName: string, csvBody: string) {
  const blob = new Blob(['﻿' + csvBody], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

// docs/design.md §4.7: CSV取込のヘッダーはcolumnId厳密一致を前提とするため、DO-7のダウンロード
// もcolumnIdをヘッダーに使う（ダウンロードしたCSVをそのまま取込画面へ再投入できるようにする）。
// 画面上の一覧表示（<th>）は人間向けにcolumnNameを使うが、ファイル出力は往復可能な形式を優先する。
function buildAllColumnsCsv(definition: TableDefinition, records: MasterRecord[]): string {
  const headerRow = definition.columns.map((column) => column.columnId)
  const dataRows = records.map((record) => definition.columns.map((column) => record[column.columnId] ?? ''))
  return Papa.unparse([headerRow, ...dataRows])
}

// SCR-2: 登録済みマスタデータを条件検索・一覧表示し、CSVダウンロード（DO-7）・連携ファイル出力
// （DO-8）する画面（DO-6）。DO-7は「今見ている検索結果をそのままCSVに」、DO-8は「決められた
// 連携先フォーマットに変換して出力」という役割分担（要求仕様書§5.4）。
export function SearchExportScreen() {
  return (
    <DataAccessGate>
      {(access, _definitionErrors, exportDefinitions, exportDefinitionErrors) => (
        <SearchExportScreenBody
          access={access}
          exportDefinitions={exportDefinitions}
          exportDefinitionErrors={exportDefinitionErrors}
        />
      )}
    </DataAccessGate>
  )
}

function SearchExportScreenBody({
  access,
  exportDefinitions,
  exportDefinitionErrors,
}: {
  access: MasterDataAccess
  exportDefinitions: ExportDefinition[]
  exportDefinitionErrors: ExportDefinitionValidationError[]
}) {
  const [tableId, setTableId] = useState(access.definitions[0]?.tableId ?? '')
  const [searchInputs, setSearchInputs] = useState<Record<string, string>>({})
  const [records, setRecords] = useState<MasterRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [ignoredColumnNames, setIgnoredColumnNames] = useState<string[]>([])
  const [exportDefinitionId, setExportDefinitionId] = useState('')
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null)

  const definition = access.definitions.find((d) => d.tableId === tableId)
  const dao = definition ? access.daos.get(definition.tableId) : undefined
  const availableExportDefinitions = exportDefinitions.filter((ed) => ed.sourceTableId === tableId)
  const selectedExportDefinition = availableExportDefinitions.find((ed) => ed.exportId === exportDefinitionId)

  useEffect(() => {
    setSearchInputs({})
    setIgnoredColumnNames([])
    setExportDefinitionId('')
    setDownloadMessage(null)
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
    setDownloadMessage(null)
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
    setDownloadMessage(null)
    if (!dao) return
    setIsLoading(true)
    try {
      setRecords(await dao.findAll())
    } finally {
      setIsLoading(false)
    }
  }

  function handleDownloadAllColumns() {
    if (!definition) return
    const fileName = `${definition.tableId}.csv`
    downloadCsvText(fileName, buildAllColumnsCsv(definition, records))
    setDownloadMessage(`ダウンロードを開始しました: ${fileName}`)
  }

  function handleDownloadExport() {
    if (!selectedExportDefinition) return
    const fileName = `${selectedExportDefinition.exportId}.${extensionForDelimiter(selectedExportDefinition.fileFormat.delimiter)}`
    downloadCsvText(fileName, buildExportCsv(selectedExportDefinition, records))
    setDownloadMessage(`ダウンロードを開始しました: ${fileName}`)
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
              <div className="search-fields">
                {definition.columns.map((column) => (
                  <label key={column.columnId} className="search-fields__field">
                    {column.columnName}
                    <input
                      type="text"
                      value={searchInputs[column.columnId] ?? ''}
                      onChange={(event) =>
                        setSearchInputs((prev) => ({ ...prev, [column.columnId]: event.target.value }))
                      }
                    />
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={isLoading}>
                検索
              </button>
              <button type="button" onClick={handleClear} disabled={isLoading}>
                クリア（全件表示）
              </button>
            </div>
          </form>

          {ignoredColumnNames.length > 0 && (
            <Alert variant="warning">
              <p>
                次の項目は入力値を検索条件として解釈できなかったため無視しました:{' '}
                {ignoredColumnNames.join('、')}
              </p>
            </Alert>
          )}

          <p className={isLoading ? 'loading-inline' : undefined}>
            {isLoading ? (
              <>
                <Spinner /> 読み込み中…
              </>
            ) : records.length === 0 ? (
              '該当するデータがありません。検索条件を変更するか、CSV取込画面からデータを登録してください。'
            ) : (
              `${records.length}件`
            )}
          </p>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {definition.columns.map((column) => (
                    <th key={column.columnId} className={column.dataType === 'number' ? 'col-numeric' : undefined}>
                      {column.columnName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((record, index) => (
                  <tr key={index}>
                    {definition.columns.map((column) => (
                      <td key={column.columnId} className={column.dataType === 'number' ? 'col-numeric' : undefined}>
                        {String(record[column.columnId] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <fieldset>
            <legend>CSVダウンロード（上の検索結果を、全カラムそのまま出力）</legend>
            <button
              type="button"
              className="btn-download"
              onClick={handleDownloadAllColumns}
              disabled={isLoading || records.length === 0}
            >
              ダウンロード
            </button>
            {records.length === 0 && <p>※検索結果が0件のためダウンロードできません</p>}
            <p>取込画面（SCR-1）へそのまま再取込できる形式（ヘッダーがcolumnId）で出力します。</p>
          </fieldset>

          <fieldset>
            <legend>連携ファイル定義による出力（上の検索結果を、決められた出力カラム・ヘッダー名に変換して出力）</legend>

            {exportDefinitionErrors.length > 0 && (
              <Alert variant="warning">
                <p>
                  一部の連携ファイル定義にエラーがあるため読み込めませんでした。該当の連携
                  ファイル定義は下の選択肢に表示されません。以下の内容を参考に
                  export-definitions/配下の該当JSONを修正し、ページを再読み込みしてください:
                </p>
                <ul>
                  {exportDefinitionErrors.map((error, index) => (
                    <li key={index}>
                      {error.exportId}: {error.message}
                    </li>
                  ))}
                </ul>
              </Alert>
            )}

            {availableExportDefinitions.length === 0 ? (
              <p>このテーブル（{definition.tableName}）に対応する連携ファイル定義はありません。</p>
            ) : (
              <>
                <label>
                  連携ファイル定義:{' '}
                  <select value={exportDefinitionId} onChange={(event) => setExportDefinitionId(event.target.value)}>
                    <option value="">選択してください</option>
                    {availableExportDefinitions.map((ed) => (
                      <option key={ed.exportId} value={ed.exportId}>
                        {ed.exportName}（{ed.exportId}）
                      </option>
                    ))}
                  </select>
                </label>{' '}
                <button
                  type="button"
                  className="btn-download"
                  disabled={!selectedExportDefinition || records.length === 0}
                  onClick={handleDownloadExport}
                >
                  この定義で出力
                </button>
                {!selectedExportDefinition && <p>※連携ファイル定義を選択してください</p>}
                {selectedExportDefinition && records.length === 0 && <p>※検索結果が0件のため出力できません</p>}
              </>
            )}
          </fieldset>

          {downloadMessage && (
            <Alert variant="success" role="status">
              <p>{downloadMessage}</p>
            </Alert>
          )}
        </>
      )}
    </section>
  )
}
