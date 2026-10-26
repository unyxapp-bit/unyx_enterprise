import { describe, expect, it } from "vitest"

import {
  formTemplates,
  parseQuestion,
  serializeQuestion,
} from "./formQuestions"

describe("formQuestions", () => {
  it("keeps legacy questions untouched", () => {
    expect(parseQuestion("Nome completo")).toEqual({
      raw: "Nome completo",
      label: "Nome completo",
      kind: "auto",
      options: [],
      required: true,
    })
  })

  it("parses choice options and optional flag", () => {
    const parsed = parseQuestion("Pontualidade ::choice=No horario|Atraso|Falta")
    expect(parsed).toMatchObject({
      label: "Pontualidade",
      kind: "choice",
      options: ["No horario", "Atraso", "Falta"],
      required: true,
    })
    expect(parseQuestion("Obs ::long_text?")).toMatchObject({
      kind: "long_text",
      required: false,
    })
  })

  it("ignores unknown kinds", () => {
    expect(parseQuestion("Algo ::inexistente").kind).toBe("auto")
  })

  it("round-trips every template question", () => {
    for (const template of formTemplates) {
      for (const raw of template.questions) {
        expect(serializeQuestion(parseQuestion(raw))).toBe(raw)
      }
      const labels = template.questions.map((raw) => parseQuestion(raw).label)
      expect(new Set(labels).size).toBe(labels.length)
    }
  })
})
