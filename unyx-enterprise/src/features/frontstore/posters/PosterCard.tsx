import {
  Archive,
  Copy,
  Download,
  Edit3,
  Megaphone,
  Printer,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateTimeBR } from "@/lib/format"
import {
  formatLabel,
  getPosterTemplate,
  toneLabel,
} from "@/features/frontstore/posters/posterConfig"
import { PosterCanvas } from "@/features/frontstore/posters/PosterCanvas"
import {
  posterToCanvasData,
  scopeLabel,
} from "@/features/frontstore/posters/posterModel"
import type { OperationalPoster } from "@/types/domain"

export function PosterCard({
  poster,
  busy,
  onArchive,
  onDuplicate,
  onEdit,
  onExportPng,
  onPrint,
}: {
  poster: OperationalPoster
  busy?: boolean
  onArchive: (poster: OperationalPoster) => void
  onDuplicate: (poster: OperationalPoster) => void
  onEdit: (poster: OperationalPoster) => void
  onExportPng: (poster: OperationalPoster) => void
  onPrint: (poster: OperationalPoster) => void
}) {
  const template = getPosterTemplate(poster.template_key)

  return (
    <Card className="group overflow-hidden border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base">
            <Megaphone className="size-4 shrink-0 text-slate-500" />
            <span className="truncate">{poster.product_name ?? poster.title}</span>
          </CardTitle>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{toneLabel[poster.tone]}</Badge>
            <Badge variant="secondary">{formatLabel[poster.format]}</Badge>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {scopeLabel(poster)} - {formatDateTimeBR(poster.updated_at || poster.created_at)}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="mx-auto max-w-[260px] rounded-xl bg-slate-50 p-2">
          <PosterCanvas data={posterToCanvasData(poster)} compact />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="outline">{template.name}</Badge>
          {poster.price_text ? <span>{poster.price_text}</span> : null}
          {poster.sale_unit ? <span>/ {poster.sale_unit}</span> : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onPrint(poster)}
          >
            <Printer className="size-4" />
            PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onExportPng(poster)}
          >
            <Download className="size-4" />
            PNG
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onDuplicate(poster)}
          >
            <Copy className="size-4" />
            Duplicar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onEdit(poster)}
          >
            <Edit3 className="size-4" />
            Editar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="col-span-2"
            disabled={busy}
            onClick={() => onArchive(poster)}
          >
            <Archive className="size-4" />
            Arquivar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
