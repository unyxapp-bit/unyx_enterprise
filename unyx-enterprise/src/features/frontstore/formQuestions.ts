// Cada pergunta continua sendo uma string em operational_forms.questions (sem migração).
// Formato: "Rotulo ::tipo[=op1|op2][?]". Sem "::" vale a detecção legada por palavra-chave.

export type QuestionKind =
  | "auto"
  | "text"
  | "long_text"
  | "time"
  | "date"
  | "choice"
  | "rating"
  | "employee"

export interface ParsedQuestion {
  raw: string
  label: string
  kind: QuestionKind
  options: string[]
  required: boolean
}

export const questionKindLabels: Record<QuestionKind, string> = {
  auto: "Automático",
  text: "Texto curto",
  long_text: "Texto longo",
  time: "Horário",
  date: "Data",
  choice: "Escolha",
  rating: "Nota de 1 a 5",
  employee: "Colaborador (cadastro)",
}

export const RATING_VALUES = ["1", "2", "3", "4", "5"]

const kindKeys = new Set<string>(Object.keys(questionKindLabels))
const SEPARATOR = " ::"

export function parseQuestion(raw: string): ParsedQuestion {
  const index = raw.lastIndexOf(SEPARATOR)
  if (index === -1) {
    return { raw, label: raw, kind: "auto", options: [], required: true }
  }

  let spec = raw.slice(index + SEPARATOR.length).trim()
  const required = !spec.endsWith("?")
  if (!required) spec = spec.slice(0, -1)

  const [kindPart, ...optionParts] = spec.split("=")
  const kind = kindPart.trim()
  if (!kindKeys.has(kind)) {
    return { raw, label: raw, kind: "auto", options: [], required: true }
  }

  const options = optionParts
    .join("=")
    .split("|")
    .map((option) => option.trim())
    .filter(Boolean)

  return {
    raw,
    label: raw.slice(0, index).trim(),
    kind: kind as QuestionKind,
    options: kind === "choice" ? options : [],
    required,
  }
}

export function serializeQuestion(
  question: Pick<ParsedQuestion, "label" | "kind" | "options" | "required">
) {
  const label = question.label.trim()
  if (question.kind === "auto" && question.required) return label
  const options =
    question.kind === "choice" && question.options.length
      ? `=${question.options.join("|")}`
      : ""
  return `${label}${SEPARATOR}${question.kind}${options}${question.required ? "" : "?"}`
}

export interface FormTemplate {
  key: string
  name: string
  title: string
  category: string
  description: string
  questions: string[]
}

const conformity = "Conforme|Não conforme|N/A"
const frequency = "Sim|Às vezes|Não"

// Referência: código de boas práticas individuais da frente de loja (não é regra fixa;
// o gestor ajusta perguntas e opções no construtor depois de aplicar o modelo).
export const frontStoreTemplate: FormTemplate = {
  key: "front-store-control",
  name: "Controle de frente de loja",
  title: "Controle de frente de loja",
  category: "Operacional",
  description:
    "Observação do líder sobre pontualidade, postura, atendimento, disciplina, equipe e apresentação.",
  questions: [
    "Colaborador avaliado ::employee",
    "Posto / função ::choice=Caixa|Empacotador|Fiscal de loja|Atendimento|Outro",
    "Horário previsto de entrada ::time",
    "Horário real de chegada ::time",
    "Pontualidade ::choice=No horário|Atraso até 10 min|Atraso acima de 10 min|Falta",
    `Sem uso pessoal do celular no posto ::choice=${conformity}`,
    `Foco no atendimento, sem conversas paralelas ::choice=${conformity}`,
    `Permanece no posto e segue a rendição nas pausas ::choice=${conformity}`,
    `Educação, paciência e atenção com o cliente ::choice=${conformity}`,
    `Age para evitar fila e ajuda quem precisa ::choice=${conformity}`,
    `Comunica problemas, erros e divergências ::choice=${conformity}`,
    `Segue procedimentos financeiros e de acesso (caixa) ::choice=${conformity}`,
    `Coopera e respeita colegas ::choice=${conformity}`,
    `Uniforme, crachá e higiene pessoal ::choice=${conformity}`,
    `Posto limpo, organizado e seguro ::choice=${conformity}`,
    "Agilidade com qualidade ::rating",
    "Ocorrência ou orientação dada ::long_text?",
  ],
}

export const selfAssessmentTemplate: FormTemplate = {
  key: "front-store-self-assessment",
  name: "Autoavaliação de conduta",
  title: "Autoavaliação de conduta - frente de loja",
  category: "RH",
  description: "Checklist individual para reuniões de equipe, treinamentos e autoavaliação.",
  questions: [
    "Colaborador ::employee",
    `Chego no horário e pronto para iniciar ::choice=${frequency}`,
    `Evito o uso pessoal do celular durante o trabalho ::choice=${frequency}`,
    `Mantenho o foco no atendimento e nas tarefas do meu posto ::choice=${frequency}`,
    `Trato clientes e colegas com educação e respeito ::choice=${frequency}`,
    `Evito conversas paralelas que prejudiquem o serviço ::choice=${frequency}`,
    `Comunico problemas, erros e divergências na hora ::choice=${frequency}`,
    `Cumpro os procedimentos financeiros e operacionais ::choice=${frequency}`,
    `Não abandono o posto sem seguir a rendição ::choice=${frequency}`,
    `Ajudo a equipe quando necessário ::choice=${frequency}`,
    `Mantenho o posto limpo, organizado e seguro ::choice=${frequency}`,
    `Aceito orientações e procuro corrigir minhas falhas ::choice=${frequency}`,
    `Termino o turno comunicando as pendências ::choice=${frequency}`,
    "Onde posso melhorar? ::long_text?",
  ],
}

export const formTemplates = [frontStoreTemplate, selfAssessmentTemplate]
