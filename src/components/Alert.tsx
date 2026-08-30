import type { ReactNode } from 'react'

type AlertVariant = 'error' | 'warning' | 'success' | 'info'

interface AlertProps {
  variant: AlertVariant
  role?: 'alert' | 'status'
  children: ReactNode
}

const icons: Record<AlertVariant, string> = {
  error: '⛔',
  warning: '⚠️',
  success: '✅',
  info: 'ℹ️',
}

// Issue #24: role="alert"/role="status"はスクリーンリーダー向けの意味付けのみで、
// 画面上の見た目ではエラー・警告・成功・情報の区別がつかなかったため、種別ごとに
// 色とアイコンで視覚的に区別する共通コンポーネント。既存のrole属性はそのまま維持する。
export function Alert({ variant, role = 'alert', children }: AlertProps) {
  return (
    <div className={`alert alert--${variant}`} role={role}>
      <span aria-hidden="true" className="alert__icon">
        {icons[variant]}
      </span>
      <div className="alert__body">{children}</div>
    </div>
  )
}
