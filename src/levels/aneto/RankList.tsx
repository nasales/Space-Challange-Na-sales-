// Orderable list of the cases: drag and drop (HTML5) plus up / down buttons (keyboard and touch).
import { useState } from 'react'
import { S } from './strings'

export interface RankItem {
  id: string
  label: string
}

interface RankListProps {
  items: RankItem[]
  onChange: (items: RankItem[]) => void
  disabled?: boolean
}

function move(items: RankItem[], from: number, to: number): RankItem[] {
  const next = items.slice()
  const [it] = next.splice(from, 1)
  next.splice(to, 0, it)
  return next
}

export default function RankList({ items, onChange, disabled }: RankListProps) {
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)

  return (
    <ol className="lva-rank" aria-label={S.rankList} data-testid="rank-list">
      {items.map((it, i) => (
        <li
          key={it.id}
          className={
            'lva-rank__item' +
            (dragging === i ? ' lva-rank__item--dragging' : '') +
            (over === i && dragging !== i ? ' lva-rank__item--over' : '')
          }
          draggable={!disabled}
          data-testid={`rank-${it.id}`}
          onDragStart={(e) => {
            setDragging(i)
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', String(i))
          }}
          onDragOver={(e) => {
            if (disabled) return
            e.preventDefault()
            setOver(i)
          }}
          onDragLeave={() => setOver((o) => (o === i ? null : o))}
          onDrop={(e) => {
            e.preventDefault()
            const from = dragging ?? Number(e.dataTransfer.getData('text/plain'))
            if (!disabled && Number.isInteger(from) && from !== i) onChange(move(items, from, i))
            setDragging(null)
            setOver(null)
          }}
          onDragEnd={() => {
            setDragging(null)
            setOver(null)
          }}
        >
          <span className="lva-rank__pos">{i + 1}</span>
          <span className="lva-rank__label">{it.label}</span>
          <span className="lva-rank__buttons">
            <button
              type="button"
              className="lva-rank__btn"
              aria-label={S.moveUp(it.label)}
              disabled={disabled || i === 0}
              onClick={() => onChange(move(items, i, i - 1))}
            >
              ▲
            </button>
            <button
              type="button"
              className="lva-rank__btn"
              aria-label={S.moveDown(it.label)}
              disabled={disabled || i === items.length - 1}
              onClick={() => onChange(move(items, i, i + 1))}
            >
              ▼
            </button>
          </span>
        </li>
      ))}
    </ol>
  )
}
