import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

import { BreakdownNameCell } from '~/components/customers/usage/sections/BreakdownNameCell'
import { PresentationBreakdownRow } from '~/components/customers/usage/usageDetailsHelpers'
import { Typography } from '~/components/designSystem/Typography'

// Threshold above which we switch breakdowns from inline Table rendering to a
// virtualized list. 50 covers the common case (per-charge breakdowns) without
// any visual change; the virtualized path only kicks in for charges with
// thousands of breakdowns where the QA team reported slow rendering.
export const VIRTUALIZATION_THRESHOLD = 50

// Estimated row height used by the virtualizer (matches the 48px non-pricing-
// unit row size; with chips wrapping the virtualizer's measureElement adjusts).
const BREAKDOWN_ROW_HEIGHT = 48

// Max height of the scrollable viewport for the breakdown list — keeps the
// drawer from growing unbounded for very large charges. The user can still
// scroll through all rows inside the list.
const MAX_VIRTUAL_LIST_HEIGHT = 480

type VirtualizedBreakdownRowsProps = {
  rows: PresentationBreakdownRow[]
}

export const VirtualizedBreakdownRows = ({ rows }: VirtualizedBreakdownRowsProps) => {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => BREAKDOWN_ROW_HEIGHT,
    measureElement: (element) => element.getBoundingClientRect().height,
    overscan: 8,
  })

  if (rows.length === 0) return null

  return (
    <div ref={parentRef} className="overflow-auto" style={{ maxHeight: MAX_VIRTUAL_LIST_HEIGHT }}>
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index]

          return (
            <div
              key={row.id}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              className="flex w-full items-center justify-between border-b border-grey-200 px-4 py-3"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <BreakdownNameCell presentationBy={row.presentationBy} />
              <Typography variant="body" color="grey600" className="shrink-0 pl-4">
                {row.breakdownUnits}
              </Typography>
            </div>
          )
        })}
      </div>
    </div>
  )
}
