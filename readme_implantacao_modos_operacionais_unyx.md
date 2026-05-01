# Unyx Enterprise / Unyx Ops
## README — Implantação dos Modos Operacionais

---

# 1. Objetivo deste documento

Este README define como implantar os **Modos Operacionais** dentro da plataforma Unyx Enterprise / Unyx Ops.

A ideia principal é que o sistema tenha uma base única, mas consiga se adaptar ao tipo de negócio do cliente.

O sistema não deve ser recriado para cada segmento.

Ele deve funcionar como uma **engine operacional configurável**.

---

# 2. Conceito principal

A Unyx Enterprise não será um sistema diferente para cada cliente.

Ela será uma plataforma única com comportamento adaptável.

## Estrutura correta

```txt
Unyx Enterprise
 └── Unyx Ops
      └── Motor Operacional
           ├── Modo Supermercado
           ├── Modo Atacado / Varejo
           ├── Modo Restaurante
           └── Modo Farmácia
```

---

# 3. O que é um Modo Operacional

Um Modo Operacional é uma configuração que altera a forma como o sistema interpreta a operação.

Ele muda:

- regras de prioridade
- alertas
- layout do painel
- fluxos obrigatórios
- foco dos indicadores
- textos da interface
- ações principais

Mas mantém a mesma base de dados.

---

# 4. Base comum para todos os modos

Todos os modos usam os mesmos conceitos principais:

- organização
- filial
- setor
- colaborador
- escala
- status operacional
- eventos
- alertas
- auditoria

Isso evita duplicação e mantém o produto escalável.

---

# 5. Modos operacionais previstos

## Modos iniciais

1. Supermercado
2. Atacado / Varejo
3. Restaurante
4. Farmácia

---

# 6. Modo Supermercado

## 6.1 Objetivo

Controlar operações de alta intensidade, principalmente frente de caixa.

O foco é evitar:

- filas
- caixas descobertos
- intervalos mal liberados
- sangrias pendentes
- atrasos críticos
- falta de cobertura

---

## 6.2 Perfil da operação

Supermercados possuem operação intensa, com grande impacto quando um operador falta ou atrasa.

O painel precisa dar prioridade para:

- operadores de caixa
- sangria
- troca de caixa
- cobertura
- intervalos

---

## 6.3 Regras principais

### Regra 1 — Operador não sai sem cobertura

Antes de iniciar intervalo, o sistema deve verificar se existe outro colaborador disponível para assumir o posto.

### Regra 2 — Sangria antes do intervalo

Quando o colaborador estiver em setor de caixa, o sistema deve exigir confirmação de sangria antes da liberação.

### Regra 3 — Caixa descoberto é crítico

Se um caixa estiver sem operador durante horário de movimento, o alerta deve ser crítico.

### Regra 4 — Atraso em caixa tem prioridade alta

Atraso de operador de caixa impacta fila diretamente.

### Regra 5 — Retorno atrasado deve aparecer no topo

Se o colaborador passou do tempo previsto de intervalo, o painel deve destacar.

---

## 6.4 Ordem de prioridade

1. Caixa sem operador
2. Retorno de intervalo atrasado
3. Atraso em caixa
4. Falta confirmada
5. Intervalo vencido
6. Deve sair para intervalo
7. Aguardando sangria
8. Troca de caixa
9. Trabalhando
10. Folga

---

## 6.5 UI do painel

O painel do modo supermercado deve ter:

- cards de resumo da frente de caixa
- alerta forte para caixas descobertos
- lista de operadores por prioridade
- status visual por cor
- ações rápidas por colaborador
- painel lateral de alertas críticos

### Cards recomendados

- Operadores escalados
- Trabalhando agora
- Caixas sem cobertura
- Atrasos
- Intervalos em andamento
- Alertas críticos

---

## 6.6 Fluxo operacional

```txt
1. Sistema carrega escala do dia
2. Fiscal confirma entradas
3. Sistema identifica atrasos e faltas
4. Painel ordena prioridades
5. Fiscal solicita intervalo
6. Sistema exige sangria se for caixa
7. Sistema exige cobertura se necessário
8. Intervalo é iniciado
9. Retorno é confirmado
10. Evento e auditoria são registrados
```

---

# 7. Modo Atacado / Varejo

## 7.1 Objetivo

Controlar operação distribuída por setores.

O foco não está apenas em caixa, mas na cobertura de áreas como:

- atendimento
- estoque
- reposição
- vendas
- expedição
- recebimento

---

## 7.2 Perfil da operação

No atacado e varejo, a operação costuma ser mais espalhada.

O painel deve mostrar:

- cobertura por setor
- setores descobertos
- ausência de equipe
- atrasos por área
- movimentação operacional

---

## 7.3 Regras principais

### Regra 1 — Setor descoberto é prioridade

Se um setor ficar sem colaborador, o alerta deve subir no painel.

### Regra 2 — Falta pesa mais que atraso leve

Em operação distribuída, ausência total pode ser mais grave que atraso pequeno.

### Regra 3 — Filtro por setor é essencial

O gerente precisa enxergar a operação por área.

### Regra 4 — Realocação é ação importante

O sistema deve permitir registrar ou sugerir deslocamento entre setores futuramente.

---

## 7.4 Ordem de prioridade

1. Setor sem equipe
2. Falta confirmada
3. Equipe abaixo do mínimo
4. Atraso grave
5. Intervalo vencido
6. Deve sair para intervalo
7. Trabalhando
8. Folga

---

## 7.5 UI do painel

O painel do modo Atacado / Varejo deve ter:

- agrupamento por setor
- cards por área
- status de cobertura
- visão de equipe mínima
- filtros por filial e setor

### Cards recomendados

- Setores ativos
- Setores descobertos
- Colaboradores presentes
- Faltas
- Atrasos
- Alertas por setor

---

## 7.6 Fluxo operacional

```txt
1. Sistema carrega escala por setor
2. Gerente visualiza cobertura por área
3. Sistema identifica setores descobertos
4. Gerente registra entrada, falta ou atraso
5. Sistema atualiza status do setor
6. Gerente decide realocação
7. Eventos ficam registrados
```

---

# 8. Modo Restaurante

## 8.1 Objetivo

Controlar equipe por turno e horários de pico.

O foco é garantir que a operação esteja completa nos momentos críticos.

---

## 8.2 Perfil da operação

Restaurantes possuem períodos críticos:

- almoço
- jantar
- delivery
- finais de semana
- eventos

A falta de uma pessoa em horário de pico pode comprometer toda a operação.

---

## 8.3 Regras principais

### Regra 1 — Equipe mínima por turno

Cada turno deve ter um número mínimo de pessoas por função.

### Regra 2 — Intervalo bloqueado em horário de pico

Durante horários configurados como pico, o sistema deve evitar ou bloquear início de intervalo.

### Regra 3 — Atraso em pico é crítico

Atraso no horário de pico deve ter prioridade maior.

### Regra 4 — Função crítica deve ser destacada

Cozinheiro, caixa, atendente e entregador podem ter peso diferente dependendo do restaurante.

---

## 8.4 Ordem de prioridade

1. Falta em turno crítico
2. Equipe abaixo do mínimo
3. Atraso em horário de pico
4. Função crítica ausente
5. Intervalo bloqueado
6. Deve sair
7. Trabalhando
8. Folga

---

## 8.5 UI do painel

O painel do modo Restaurante deve ter:

- visão por turno
- alerta de horário de pico
- equipe mínima por função
- status da cozinha, salão e delivery
- indicadores de cobertura por período

### Cards recomendados

- Turno atual
- Equipe presente
- Equipe mínima
- Funções críticas
- Próximo pico
- Alertas do turno

---

## 8.6 Fluxo operacional

```txt
1. Sistema identifica turno atual
2. Sistema valida equipe mínima
3. Sistema verifica horário de pico
4. Gerente acompanha presença
5. Intervalos são controlados pelo pico
6. Falhas críticas são destacadas
7. Eventos são registrados
```

---

# 9. Modo Farmácia

## 9.1 Objetivo

Controlar atendimento e presença de responsáveis obrigatórios.

O foco é garantir operação segura, responsável e rastreável.

---

## 9.2 Perfil da operação

Farmácias precisam de controle maior sobre:

- atendimento
- farmacêutico responsável
- horário de funcionamento
- ausência de profissional obrigatório
- rastreabilidade

---

## 9.3 Regras principais

### Regra 1 — Responsável obrigatório presente

Se o profissional responsável não estiver presente, o sistema deve gerar alerta crítico.

### Regra 2 — Atraso do responsável tem peso alto

O atraso de um colaborador comum pode ser moderado, mas atraso do responsável deve ser crítico.

### Regra 3 — Auditoria reforçada

Eventos críticos devem ser registrados com mais detalhes.

### Regra 4 — Setores sensíveis devem ter destaque

Atendimento, balcão e responsável técnico devem ser áreas prioritárias.

---

## 9.4 Ordem de prioridade

1. Responsável obrigatório ausente
2. Responsável atrasado
3. Atendimento descoberto
4. Falta confirmada
5. Atraso grave
6. Intervalo vencido
7. Trabalhando
8. Folga

---

## 9.5 UI do painel

O painel do modo Farmácia deve ter:

- card do responsável presente
- alertas de conformidade
- cobertura de atendimento
- histórico de eventos críticos
- painel limpo e objetivo

### Cards recomendados

- Responsável presente
- Atendimento ativo
- Alertas críticos
- Atrasos
- Ocorrências
- Cobertura da filial

---

## 9.6 Fluxo operacional

```txt
1. Sistema carrega escala
2. Sistema verifica responsável obrigatório
3. Painel mostra conformidade da operação
4. Atrasos e faltas são destacados
5. Eventos críticos são registrados
6. Auditoria fica disponível para consulta
```

---

# 10. Onde implantar no banco de dados

A implantação começa no Supabase.

A primeira alteração recomendada é garantir que a tabela `organizations` tenha o campo `segment`.

## Campo recomendado

```sql
segment public.business_segment not null default 'other'
```

## Enum recomendado

```sql
create type public.business_segment as enum (
  'retail_store',
  'supermarket',
  'restaurant',
  'pharmacy',
  'other'
);
```

---

# 11. Tabela de configurações operacionais

Para evoluir o sistema, é recomendado criar uma tabela específica de regras por organização e filial.

## Tabela sugerida

```sql
create table public.operational_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  mode public.business_segment not null default 'other',
  late_tolerance_minutes integer not null default 15,
  break_tolerance_minutes integer not null default 10,
  require_cashier_cash_count boolean not null default false,
  require_coverage_before_break boolean not null default true,
  block_break_on_peak_hours boolean not null default false,
  require_responsible_presence boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

# 12. Configurações por modo

## Supermercado

```txt
mode = supermarket
require_cashier_cash_count = true
require_coverage_before_break = true
block_break_on_peak_hours = false
require_responsible_presence = false
```

## Atacado / Varejo

```txt
mode = retail_store
require_cashier_cash_count = false
require_coverage_before_break = true
block_break_on_peak_hours = false
require_responsible_presence = false
```

## Restaurante

```txt
mode = restaurant
require_cashier_cash_count = false
require_coverage_before_break = true
block_break_on_peak_hours = true
require_responsible_presence = false
```

## Farmácia

```txt
mode = pharmacy
require_cashier_cash_count = false
require_coverage_before_break = true
block_break_on_peak_hours = false
require_responsible_presence = true
```

---

# 13. Onde implantar no frontend

A implantação no React deve ser feita dentro da camada de lógica operacional.

Estrutura recomendada:

```txt
src/
 ├── features/
 │   ├── ops/
 │   │   ├── dashboard/
 │   │   ├── operation-day/
 │   │   ├── alerts/
 │   │   ├── status/
 │   │   └── modes/
 │   │       ├── operationalModes.ts
 │   │       ├── priorityRules.ts
 │   │       ├── modeLabels.ts
 │   │       └── modeUiConfig.ts
```

---

# 14. Arquivo operationalModes.ts

Responsável por definir os modos existentes.

```ts
export type OperationalMode =
  | 'supermarket'
  | 'retail_store'
  | 'restaurant'
  | 'pharmacy'
  | 'other'

export const operationalModeNames: Record<OperationalMode, string> = {
  supermarket: 'Supermercado',
  retail_store: 'Atacado / Varejo',
  restaurant: 'Restaurante',
  pharmacy: 'Farmácia',
  other: 'Outro',
}
```

---

# 15. Arquivo priorityRules.ts

Responsável por calcular a prioridade de cada colaborador no painel.

```ts
import type { OperationalMode } from './operationalModes'

export type OperationalStatus =
  | 'trabalhando'
  | 'deve_sair'
  | 'aguardando_sangria'
  | 'troca_de_caixa'
  | 'em_intervalo'
  | 'voltou'
  | 'folga'
  | 'alerta_critico'
  | 'atrasado'
  | 'falta'

const supermarketPriority: Record<OperationalStatus, number> = {
  alerta_critico: 100,
  falta: 95,
  atrasado: 90,
  em_intervalo: 70,
  deve_sair: 60,
  aguardando_sangria: 55,
  troca_de_caixa: 50,
  trabalhando: 20,
  voltou: 15,
  folga: 0,
}

const retailPriority: Record<OperationalStatus, number> = {
  alerta_critico: 100,
  falta: 90,
  atrasado: 70,
  em_intervalo: 60,
  deve_sair: 50,
  aguardando_sangria: 30,
  troca_de_caixa: 30,
  trabalhando: 20,
  voltou: 15,
  folga: 0,
}

export function getPriorityByMode(
  mode: OperationalMode,
  status: OperationalStatus,
): number {
  if (mode === 'supermarket') return supermarketPriority[status]
  if (mode === 'retail_store') return retailPriority[status]

  return retailPriority[status]
}
```

---

# 16. Arquivo modeUiConfig.ts

Responsável por mudar textos, cards e foco do painel conforme o modo.

```ts
import type { OperationalMode } from './operationalModes'

export const modeUiConfig = {
  supermarket: {
    title: 'Operação de Frente de Caixa',
    mainFocus: 'Cobertura de caixas e intervalos',
    cards: [
      'Operadores escalados',
      'Caixas sem cobertura',
      'Atrasos',
      'Intervalos',
      'Alertas críticos',
    ],
  },

  retail_store: {
    title: 'Operação por Setores',
    mainFocus: 'Cobertura e presença por área',
    cards: [
      'Setores ativos',
      'Setores descobertos',
      'Presentes',
      'Faltas',
      'Alertas por setor',
    ],
  },

  restaurant: {
    title: 'Operação por Turno',
    mainFocus: 'Equipe mínima e horários de pico',
    cards: [
      'Turno atual',
      'Equipe presente',
      'Equipe mínima',
      'Próximo pico',
      'Alertas do turno',
    ],
  },

  pharmacy: {
    title: 'Operação e Responsabilidade',
    mainFocus: 'Presença obrigatória e atendimento',
    cards: [
      'Responsável presente',
      'Atendimento ativo',
      'Alertas críticos',
      'Atrasos',
      'Ocorrências',
    ],
  },

  other: {
    title: 'Operação em Tempo Real',
    mainFocus: 'Controle operacional diário',
    cards: [
      'Colaboradores ativos',
      'Atrasos',
      'Intervalos',
      'Alertas críticos',
    ],
  },
} satisfies Record<OperationalMode, {
  title: string
  mainFocus: string
  cards: string[]
}>
```

---

# 17. Como usar no Dashboard

O dashboard deve carregar o modo da organização ou filial e adaptar a interface.

Exemplo:

```tsx
import { modeUiConfig } from '../modes/modeUiConfig'

const mode = 'supermarket'
const config = modeUiConfig[mode]

export function DashboardHeader() {
  return (
    <header>
      <h1>{config.title}</h1>
      <p>{config.mainFocus}</p>
    </header>
  )
}
```

---

# 18. Como aplicar prioridade no Dashboard

Exemplo:

```ts
const orderedEmployees = employees.sort((a, b) => {
  const priorityA = getPriorityByMode(mode, a.status)
  const priorityB = getPriorityByMode(mode, b.status)

  return priorityB - priorityA
})
```

---

# 19. Onde implantar no Supabase

## Etapa 1

Confirmar se o enum `business_segment` existe.

## Etapa 2

Adicionar ou validar o campo `segment` na tabela `organizations`.

## Etapa 3

Criar a tabela `operational_settings`.

## Etapa 4

Criar uma configuração padrão quando uma organização for criada.

## Etapa 5

Usar o modo da organização no frontend.

---

# 20. Onde implantar no React

## Etapa 1

Criar pasta:

```txt
src/features/ops/modes/
```

## Etapa 2

Criar arquivos:

```txt
operationalModes.ts
priorityRules.ts
modeUiConfig.ts
```

## Etapa 3

No dashboard, buscar o segmento da organização.

## Etapa 4

Aplicar textos e cards conforme `modeUiConfig`.

## Etapa 5

Ordenar colaboradores usando `getPriorityByMode`.

## Etapa 6

Depois, aplicar regras nos botões de ação.

---

# 21. Ordem recomendada de implantação

## Primeiro

Implantar apenas o modo supermercado.

Motivo:

- dor mais clara
- fluxo mais forte
- uso mais fácil de validar
- maior impacto visual no dashboard

## Segundo

Criar base genérica para os modos.

## Terceiro

Ativar modo Atacado / Varejo.

## Quarto

Ativar modo Restaurante.

## Quinto

Ativar modo Farmácia.

---

# 22. Implementação mínima inicial

Para a primeira versão, implementar apenas:

- campo `segment` na organização
- configuração visual por modo
- prioridade por modo
- cards adaptáveis
- textos adaptáveis

Não implementar ainda:

- IA
- regras automáticas complexas
- bloqueios rígidos
- integração externa

---

# 23. Critério de sucesso

A implantação dos modos será considerada correta quando:

1. A organização possuir um segmento definido.
2. O dashboard mudar conforme o segmento.
3. A ordem de prioridade mudar conforme o segmento.
4. Os cards exibidos fizerem sentido para o negócio.
5. O usuário sentir que o sistema foi feito para a operação dele.

---

# 24. Resumo final

## Base única

A estrutura principal é a mesma para todos.

## Modo operacional

Altera a experiência conforme o segmento.

## Dashboard adaptável

Mostra o que importa para cada negócio.

## Produto escalável

Permite vender para mercados diferentes sem recriar o sistema.

---

# Unyx Enterprise
## Implantação dos Modos Operacionais

