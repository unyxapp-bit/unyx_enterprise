import { describe, expect, it } from "vitest"

import { frontStoreTemplate } from "./formQuestions"
import { summarizeByCollaborator } from "./formSummary"

const forms = new Map([["f1", frontStoreTemplate.questions]])

describe("summarizeByCollaborator", () => {
  it("aggregates punctuality, conformity and rating per collaborator", () => {
    const rows = summarizeByCollaborator(
      [
        {
          form_id: "f1",
          answers: {
            "Colaborador avaliado": "Ana",
            Pontualidade: "Atraso ate 10 min",
            "Coopera e respeita colegas": "Nao conforme",
            "Posto limpo, organizado e seguro": "Conforme",
            "Agilidade com qualidade": "4",
          },
        },
        {
          form_id: "f1",
          answers: {
            "Colaborador avaliado": "Ana",
            Pontualidade: "No horario",
            "Coopera e respeita colegas": "N/A",
            "Agilidade com qualidade": "2",
          },
        },
        { form_id: "f1", answers: { Pontualidade: "Falta" } },
      ],
      forms
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      name: "Ana",
      evaluations: 2,
      onTime: 1,
      late: 1,
      absent: 0,
      conforming: 1,
      nonConforming: 1,
      ratingSum: 6,
      ratingCount: 2,
    })
  })
})
