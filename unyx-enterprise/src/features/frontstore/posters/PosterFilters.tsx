import { Filter, RotateCcw, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  fieldClass,
  formatLabel,
  posterTemplates,
  toneLabel,
} from "@/features/frontstore/posters/posterConfig"
import type {
  Branch,
  OperationalPosterFormat,
  OperationalPosterTone,
  Sector,
} from "@/types/domain"

export type PosterFiltersState = {
  search: string
  branchId: string
  sectorId: string
  format: string
  tone: string
  templateKey: string
}

export function PosterFilters({
  filters,
  branches,
  sectors,
  total,
  visible,
  onChange,
  onClear,
}: {
  filters: PosterFiltersState
  branches: Branch[]
  sectors: Sector[]
  total: number
  visible: number
  onChange: (filters: PosterFiltersState) => void
  onClear: () => void
}) {
  return (
    <div className="rounded-xl border bg-white p-3 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Filter className="size-4" />
          </span>
          <div>
            <div className="text-sm font-semibold">Biblioteca de cartazes</div>
            <div className="text-xs text-muted-foreground">
              {visible} de {total} cartaz(es) visiveis
            </div>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClear}>
          <RotateCcw className="size-4" />
          Limpar
        </Button>
      </div>

      <div className="grid gap-2 lg:grid-cols-[minmax(180px,1.3fr)_repeat(5,minmax(130px,1fr))]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-8"
            placeholder="Buscar produto, preco ou texto"
            value={filters.search}
            onChange={(event) =>
              onChange({ ...filters, search: event.target.value })
            }
          />
        </label>
        <select
          className={fieldClass}
          value={filters.branchId}
          onChange={(event) =>
            onChange({ ...filters, branchId: event.target.value, sectorId: "all" })
          }
        >
          <option value="all">Todas filiais</option>
          <option value="global">Toda empresa</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
        <select
          className={fieldClass}
          value={filters.sectorId}
          onChange={(event) => onChange({ ...filters, sectorId: event.target.value })}
        >
          <option value="all">Todos setores</option>
          <option value="global">Sem setor</option>
          {sectors.map((sector) => (
            <option key={sector.id} value={sector.id}>
              {sector.name}
            </option>
          ))}
        </select>
        <select
          className={fieldClass}
          value={filters.format}
          onChange={(event) => onChange({ ...filters, format: event.target.value })}
        >
          <option value="all">Todos papeis</option>
          {(Object.keys(formatLabel) as OperationalPosterFormat[]).map((format) => (
            <option key={format} value={format}>
              {formatLabel[format]}
            </option>
          ))}
        </select>
        <select
          className={fieldClass}
          value={filters.tone}
          onChange={(event) => onChange({ ...filters, tone: event.target.value })}
        >
          <option value="all">Todos tons</option>
          {(Object.keys(toneLabel) as OperationalPosterTone[]).map((tone) => (
            <option key={tone} value={tone}>
              {toneLabel[tone]}
            </option>
          ))}
        </select>
        <select
          className={fieldClass}
          value={filters.templateKey}
          onChange={(event) =>
            onChange({ ...filters, templateKey: event.target.value })
          }
        >
          <option value="all">Todos modelos</option>
          <option value="blank">Em branco</option>
          {posterTemplates
            .filter((template) => template.key !== "blank")
            .map((template) => (
              <option key={template.key} value={template.key}>
                {template.name}
              </option>
            ))}
        </select>
      </div>
    </div>
  )
}
