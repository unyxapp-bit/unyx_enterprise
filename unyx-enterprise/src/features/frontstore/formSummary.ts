import { parseQuestion } from "./formQuestions"

export interface CollaboratorSummary {
  name: string
  evaluations: number
  onTime: number
  late: number
  absent: number
  conforming: number
  nonConforming: number
  ratingSum: number
  ratingCount: number
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
}

export function summarizeByCollaborator(
  responses: { form_id: string; answers: Record<string, string> }[],
  questionsByFormId: Map<string, string[]>
) {
  const rows = new Map<string, CollaboratorSummary>()

  for (const response of responses) {
    const questions = (questionsByFormId.get(response.form_id) ?? []).map(parseQuestion)
    const collaboratorQuestion = questions.find(
      (question) =>
        question.kind === "employee" || normalize(question.label).startsWith("colaborador")
    )
    const name = collaboratorQuestion
      ? (response.answers[collaboratorQuestion.label] ?? "").trim()
      : ""
    if (!name) continue

    const row = rows.get(name) ?? {
      name,
      evaluations: 0,
      onTime: 0,
      late: 0,
      absent: 0,
      conforming: 0,
      nonConforming: 0,
      ratingSum: 0,
      ratingCount: 0,
    }
    row.evaluations += 1

    for (const question of questions) {
      const answer = normalize((response.answers[question.label] ?? "").trim())
      if (!answer) continue

      if (question.kind === "rating") {
        const value = Number(answer)
        if (value >= 1 && value <= 5) {
          row.ratingSum += value
          row.ratingCount += 1
        }
      } else if (question.kind === "choice") {
        const options = question.options.map(normalize)
        if (normalize(question.label).includes("pontualidade")) {
          if (answer.startsWith("no horario")) row.onTime += 1
          else if (answer.startsWith("atraso")) row.late += 1
          else if (answer.startsWith("falta")) row.absent += 1
        } else if (options.includes("conforme") && options.includes("nao conforme")) {
          if (answer === "conforme") row.conforming += 1
          else if (answer === "nao conforme") row.nonConforming += 1
        }
      }
    }
    rows.set(name, row)
  }

  return [...rows.values()].sort(
    (left, right) =>
      right.nonConforming + right.late + right.absent -
        (left.nonConforming + left.late + left.absent) ||
      left.name.localeCompare(right.name, "pt-BR")
  )
}
