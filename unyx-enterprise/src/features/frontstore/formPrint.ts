import { parseQuestion } from "./formQuestions"
import type { ParsedQuestion } from "./formQuestions"
import type { CollaboratorSummary } from "./formSummary"

export interface PrintableForm {
  title: string
  description: string | null
  category: string | null
  scope: string
  questions: string[]
}

export interface PrintableResponse {
  formTitle: string
  scope: string
  author: string
  submittedAt: string
  answers: Record<string, string>
  notes: string | null
  // Ordem das perguntas do formulario original, quando conhecido.
  questions: string[] | null
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const styles = `
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; margin: 0; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 0 0 6px; }
  .meta { color: #444; margin: 0 0 12px; }
  .header { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 14px; }
  .identify { display: flex; gap: 16px; margin-bottom: 14px; }
  .identify div { flex: 1; border-bottom: 1px solid #111; padding-bottom: 2px; min-height: 18px; }
  .question { break-inside: avoid; margin: 0 0 12px; }
  .label { font-weight: 600; margin-bottom: 4px; }
  .optional { font-weight: 400; color: #555; }
  .line { border-bottom: 1px solid #111; height: 20px; }
  .options { display: flex; flex-wrap: wrap; gap: 4px 18px; }
  .box { display: inline-block; width: 11px; height: 11px; border: 1px solid #111; margin-right: 5px; vertical-align: -2px; }
  .answer { border: 1px solid #bbb; border-radius: 4px; padding: 5px 8px; white-space: pre-wrap; min-height: 24px; }
  .response { break-inside: avoid; border: 1px solid #111; border-radius: 4px; padding: 12px; margin-bottom: 16px; }
  .response + .response { page-break-before: auto; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #111; padding: 4px 6px; text-align: left; }
  th { background: #eee; }
  .footer { margin-top: 18px; color: #555; font-size: 10px; }
  @page { margin: 14mm; }
`

function wrapDocument(title: string, body: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(
    title
  )}</title><style>${styles}</style></head><body>${body}</body></html>`
}

function blankField(question: ParsedQuestion) {
  if (question.kind === "choice") {
    return `<div class="options">${question.options
      .map((option) => `<span><span class="box"></span>${escapeHtml(option)}</span>`)
      .join("")}</div>`
  }
  if (question.kind === "rating") {
    return `<div class="options">${[1, 2, 3, 4, 5]
      .map((value) => `<span><span class="box"></span>${value}</span>`)
      .join("")}</div>`
  }
  if (question.kind === "long_text") {
    return '<div class="line"></div><div class="line"></div><div class="line"></div>'
  }
  return '<div class="line"></div>'
}

function formBody(form: PrintableForm) {
  const meta = [form.category, form.scope].filter(Boolean).join(" · ")
  const questions = form.questions
    .map(parseQuestion)
    .map(
      (question, index) => `<div class="question">
        <div class="label">${index + 1}. ${escapeHtml(question.label)}${
          question.required ? "" : ' <span class="optional">(opcional)</span>'
        }</div>
        ${blankField(question)}
      </div>`
    )
    .join("")

  return `<div class="header"><h1>${escapeHtml(form.title)}</h1>
    ${meta ? `<p class="meta">${escapeHtml(meta)}</p>` : ""}
    ${form.description ? `<p class="meta">${escapeHtml(form.description)}</p>` : ""}</div>
    <div class="identify"><div>Data:</div><div>Responsável:</div></div>
    ${questions}
    <div class="question"><div class="label">Observação geral</div>
      <div class="line"></div><div class="line"></div></div>`
}

export function buildFormHtml(form: PrintableForm) {
  return wrapDocument(form.title, formBody(form))
}

function responseBody(response: PrintableResponse) {
  const labels = response.questions
    ? response.questions.map((raw) => parseQuestion(raw).label)
    : Object.keys(response.answers)
  const extra = Object.keys(response.answers).filter((label) => !labels.includes(label))
  const rows = [...labels, ...extra]
    .map(
      (label, index) => `<div class="question">
        <div class="label">${index + 1}. ${escapeHtml(label)}</div>
        <div class="answer">${escapeHtml(response.answers[label] ?? "") || "Não informado"}</div>
      </div>`
    )
    .join("")

  return `<div class="header"><h1>${escapeHtml(response.formTitle)}</h1>
    <p class="meta">${escapeHtml(
      [response.scope, response.author, response.submittedAt].filter(Boolean).join(" · ")
    )}</p></div>
    ${rows}
    ${
      response.notes
        ? `<div class="question"><div class="label">Observação geral</div><div class="answer">${escapeHtml(
            response.notes
          )}</div></div>`
        : ""
    }`
}

export function buildResponsesHtml(
  title: string,
  responses: PrintableResponse[],
  summary: CollaboratorSummary[] = []
) {
  const summaryTable = summary.length
    ? `<h2>Resumo por colaborador</h2><table><thead><tr><th>Colaborador</th><th>Avaliações</th><th>No horário</th><th>Atrasos</th><th>Faltas</th><th>Conformidade</th><th>Nota média</th></tr></thead><tbody>${summary
        .map((row) => {
          const checks = row.conforming + row.nonConforming
          return `<tr><td>${escapeHtml(row.name)}</td><td>${row.evaluations}</td><td>${row.onTime}</td><td>${row.late}</td><td>${row.absent}</td><td>${
            checks ? `${Math.round((row.conforming / checks) * 100)}%` : "-"
          }</td><td>${row.ratingCount ? (row.ratingSum / row.ratingCount).toFixed(1) : "-"}</td></tr>`
        })
        .join("")}</tbody></table>`
    : ""

  const body = `<div class="header"><h1>${escapeHtml(title)}</h1>
    <p class="meta">${responses.length} resposta(s)</p></div>
    ${summaryTable}
    ${responses.map((response) => `<div class="response">${responseBody(response)}</div>`).join("")}`
  return wrapDocument(title, body)
}

export function buildResponseHtml(response: PrintableResponse) {
  return wrapDocument(response.formTitle, responseBody(response))
}

// Imprime em um iframe oculto (evita bloqueio de pop-up).
export function printHtml(html: string) {
  const frame = window.document.createElement("iframe")
  frame.setAttribute("aria-hidden", "true")
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;"
  window.document.body.appendChild(frame)

  const frameWindow = frame.contentWindow
  const frameDocument = frame.contentDocument
  if (!frameWindow || !frameDocument) {
    frame.remove()
    return
  }

  frameDocument.open()
  frameDocument.write(html)
  frameDocument.close()

  const cleanup = () => window.setTimeout(() => frame.remove(), 500)
  frameWindow.addEventListener("afterprint", cleanup)
  window.setTimeout(() => {
    frameWindow.focus()
    frameWindow.print()
  }, 100)
}
