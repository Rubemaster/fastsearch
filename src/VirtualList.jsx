import { useRef, useState, useEffect, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { subscribe, getRowCount, getRow } from './planStore'

const ITEM_HEIGHT = 40

export default function VirtualList() {
  const parentRef = useRef(null)
  const [count, setCount] = useState(0)

  useEffect(() => {
    setCount(getRowCount())
    return subscribe((newCount) => setCount(newCount))
  }, [])

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: useCallback(() => parentRef.current, []),
    estimateSize: useCallback(() => ITEM_HEIGHT + 10, []),
    overscan: 5,
  })

  return (
    <div
      ref={parentRef}
      style={{
        width: '100%',
        height: '500px',
        border: '1px solid #000',
        overflow: 'auto',
        position: 'relative',
        padding: '10px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <Row key={virtualItem.key} index={virtualItem.index} start={virtualItem.start} />
        ))}
      </div>
    </div>
  )
}

function Row({ index, start }) {
  const plan = getRow(index)
  const label = plan ? (plan.display_name || plan.plan_name || plan.name || plan.id || String(index)) : ''

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: `${ITEM_HEIGHT}px`,
        marginBottom: '10px',
        borderBottom: '1px solid #000',
        boxSizing: 'border-box',
        padding: '0 8px',
        display: 'flex',
        alignItems: 'center',
        fontSize: '13px',
        transform: `translateY(${start}px)`,
      }}
    >
      {label}
    </div>
  )
}
