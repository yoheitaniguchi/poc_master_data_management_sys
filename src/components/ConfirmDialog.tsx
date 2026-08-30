import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// Issue #19: window.confirm()はスタイル適用ができず、破壊的操作（CSV取込のUpsert上書き）の
// 警告を視覚的に強調できない問題があったため、ネイティブ<dialog>ベースのモーダルに置き換える。
// キャンセルボタンにautoFocusを当て、誤操作（実行ボタンの誤クリック）を防ぐ既定にしている。
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '実行する',
  cancelLabel = 'キャンセル',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <div className="confirm-dialog__header">
        <span aria-hidden="true" className="confirm-dialog__icon">
          {danger ? '⚠️' : 'ℹ️'}
        </span>
        <h3>{title}</h3>
      </div>
      <p className="confirm-dialog__message">{message}</p>
      <div className="confirm-dialog__actions">
        <button type="button" onClick={onCancel} autoFocus>
          {cancelLabel}
        </button>
        <button type="button" className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
