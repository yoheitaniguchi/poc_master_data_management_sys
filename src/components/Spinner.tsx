interface SpinnerProps {
  size?: number
}

// Issue #22: 「読み込み中…」等のテキストのみでは処理が進行中か固まっているか
// 判別しづらいため、回転アニメーションで視覚的に処理中であることを示す。
export function Spinner({ size = 16 }: SpinnerProps) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size }}
      role="presentation"
      aria-hidden="true"
    />
  )
}
