/**
 * OperationalPagination - Paginação para colaboradores
 */

import React from "react"

interface OperationalPaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  pageIndex: number
  onPageChange: (pageIndex: number) => void
}

export const OperationalPagination = React.memo(
  ({
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    pageIndex,
    onPageChange,
  }: OperationalPaginationProps) => {
    if (totalPages <= 1) return null

    const showEllipsisAfterFirst = pageIndex > 2
    const showEllipsisBeforeLast = pageIndex < totalPages - 3

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm text-slate-600">
        <span>
          {pageIndex * itemsPerPage + 1}–{Math.min((pageIndex + 1) * itemsPerPage, totalItems)}{" "}
          de {totalItems} colaboradores
        </span>
        <div className="flex items-center gap-1">
          <button
            className="rounded-md border bg-white px-3 py-1.5 text-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onPageChange(pageIndex - 1)}
            disabled={pageIndex === 0}
            aria-label="Página anterior"
          >
            Anterior
          </button>

          {Array.from({ length: totalPages }, (_, i) => {
            const show =
              totalPages <= 7 ||
              i === 0 ||
              i === totalPages - 1 ||
              Math.abs(i - pageIndex) <= 1

            const showEllipsisBefore =
              i === pageIndex - 2 && pageIndex - 2 > 0 && showEllipsisAfterFirst
            const showEllipsisAfter =
              i === pageIndex + 2 && pageIndex + 2 < totalPages - 1 && showEllipsisBeforeLast

            if (showEllipsisBefore || showEllipsisAfter) {
              return (
                <span key={i} className="px-1 text-slate-400">
                  …
                </span>
              )
            }

            if (!show) return null

            return (
              <button
                key={i}
                className={`min-w-[32px] rounded-md border px-2 py-1.5 text-sm transition-colors ${
                  i === pageIndex
                    ? "border-indigo-600 bg-indigo-600 font-semibold text-white"
                    : "bg-white hover:bg-slate-50"
                }`}
                onClick={() => onPageChange(i)}
                aria-current={i === pageIndex ? "page" : undefined}
                aria-label={`Página ${i + 1}`}
              >
                {i + 1}
              </button>
            )
          })}

          <button
            className="rounded-md border bg-white px-3 py-1.5 text-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onPageChange(pageIndex + 1)}
            disabled={pageIndex === totalPages - 1}
            aria-label="Próxima página"
          >
            Próximo
          </button>
        </div>
      </div>
    )
  }
)

OperationalPagination.displayName = "OperationalPagination"
