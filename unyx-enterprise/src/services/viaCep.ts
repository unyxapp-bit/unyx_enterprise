export type ViaCepAddress = {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  ibge: string
  gia: string
  ddd: string
  siafi: string
}

type ViaCepError = {
  erro?: boolean
}

export function normalizeCep(value: string) {
  return value.replace(/\D/g, "").slice(0, 8)
}

export function formatCep(value: string) {
  const digits = normalizeCep(value)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export async function lookupCep(cep: string): Promise<ViaCepAddress> {
  const digits = normalizeCep(cep)
  if (digits.length !== 8) {
    throw new Error("Informe um CEP com 8 digitos.")
  }

  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
  if (!response.ok) {
    throw new Error("Nao foi possivel consultar o CEP agora.")
  }

  const data = (await response.json()) as ViaCepAddress & ViaCepError
  if (data.erro) {
    throw new Error("CEP nao encontrado no ViaCEP.")
  }

  return data
}
