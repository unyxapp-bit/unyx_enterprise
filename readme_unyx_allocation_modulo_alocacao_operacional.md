# Unyx Enterprise / Unyx Ops
## README — Módulo de Alocação Operacional

---

# 1. Objetivo do módulo

O Módulo de Alocação Operacional existe para controlar **quem está em qual posto de trabalho agora**.

Ele é essencial para supermercados, atacados, varejo, farmácias, restaurantes e qualquer operação que use:

- PDV
- caixa
- balcão
- atendimento
- self-checkout
- delivery
- recepção
- posto fixo de trabalho

Este módulo transforma o painel operacional em um sistema realmente útil para operações presenciais.

---

# 2. Conceito principal

A escala mostra quem deveria trabalhar.

A alocação mostra onde a pessoa está trabalhando.

## Diferença importante

```txt
Escala = planejamento
Alocação = realidade operacional atual
```

Exemplo:

```txt
Edivaldo está escalado das 06:00 às 16:00.
Edivaldo está alocado no Caixa 03 desde 08:00.
```

---

# 3. Por que este módulo é necessário

Para supermercados e operações com PDV, não basta saber que o colaborador está trabalhando.

É necessário saber:

- qual caixa ele está operando
- se o PDV está coberto
- se existe operador para troca
- se a sangria foi confirmada
- quem substituiu quem
- quem autorizou a troca
- quando o posto ficou descoberto

Sem isso, o sistema fica incompleto para o chão de loja.

---

# 4. Nome do módulo

## Unyx Allocation

Nome interno sugerido:

```txt
Unyx Allocation
```

Função:

```txt
Controle de postos, PDVs, alocação, cobertura, troca e sangria.
```

---

# 5. Como o módulo se encaixa na plataforma

## Core obrigatório atualizado

```txt
1. Unyx Control
   - filiais
   - setores
   - colaboradores
   - configurações

2. Unyx Ops
   - escala
   - status
   - painel operacional
   - ações do dia

3. Unyx Allocation
   - PDVs / postos
   - alocação
   - cobertura
   - troca de posto
   - sangria
   - histórico

4. Unyx Insight
   - relatórios
   - auditoria
   - atrasos
   - faltas
   - cobertura
```

---

# 6. Conceitos do módulo

## 6.1 Posto operacional

É qualquer local ou função fixa onde uma pessoa pode ser alocada.

Exemplos:

- Caixa 01
- Caixa 02
- Caixa 03
- Self-checkout
- Balcão
- Atendimento
- Delivery
- Retirada
- Recepção
- Estoque
- Cozinha

---

## 6.2 Alocação

É o vínculo entre um colaborador e um posto durante um período.

Exemplo:

```txt
Fernanda → Caixa 01 → das 07:40 até 11:20
```

---

## 6.3 Cobertura

Indica se um posto ativo possui colaborador responsável naquele momento.

Exemplo:

```txt
Caixa 01 — Coberto
Caixa 02 — Sem operador
Caixa 03 — Aguardando troca
```

---

## 6.4 Troca de posto

Processo usado quando um colaborador precisa sair e outro precisa assumir o posto.

Exemplo:

```txt
Edivaldo sai do Caixa 03.
Aline assume o Caixa 03.
```

---

## 6.5 Sangria

Evento operacional ligado ao caixa/PDV antes da saída ou troca do operador.

No modo supermercado, a sangria pode ser obrigatória antes do intervalo.

---

# 7. Funções principais

## 7.1 Cadastro de postos / PDVs

Permite cadastrar todos os postos operacionais da filial.

### Exemplos

- Caixa 01
- Caixa 02
- Caixa 03
- Self-checkout
- Balcão de Atendimento
- Delivery
- Retirada

### Campos necessários

```txt
id
organization_id
branch_id
sector_id
name
type
active
created_at
updated_at
```

### Tipos de posto

```txt
cashier
self_checkout
counter
service_desk
delivery
stock
kitchen
reception
other
```

---

## 7.2 Alocar colaborador em posto

Permite informar onde o colaborador está atuando.

### Exemplo

```txt
Edivaldo → Caixa 03
Início: 08:00
Status: alocado
```

### Campos necessários

```txt
colaborador
posto/PDV
data
hora_inicio
hora_fim
status
responsável pela alocação
observação
```

---

## 7.3 Visualizar cobertura de postos

Mostra todos os postos e sua situação atual.

### Exemplo de visualização

```txt
Caixa 01 — Fernanda — Trabalhando
Caixa 02 — Sem cobertura — Crítico
Caixa 03 — Edivaldo — Deve sair
Self-checkout — Aline — Em atendimento
```

---

## 7.4 Trocar operador de posto

Fluxo para substituir uma pessoa por outra em um mesmo posto.

### Fluxo

```txt
1. Fiscal solicita intervalo
2. Sistema verifica se o operador está alocado em um PDV
3. Sistema exige próximo operador
4. Fiscal confirma troca
5. Sistema encerra alocação antiga
6. Sistema cria nova alocação para o substituto
7. Sistema libera o intervalo
```

---

## 7.5 Confirmar sangria

Permite registrar que a sangria foi feita antes de liberar o operador.

### A sangria deve estar ligada a:

```txt
colaborador
PDV/posto
alocação
horário
responsável
observação
```

### Exemplo

```txt
Edivaldo
Caixa 03
Sangria confirmada às 11:18
Confirmado por: Fiscal Marco
```

---

## 7.6 Histórico de alocação

Permite consultar:

- quem ficou em qual caixa
- horário de início
- horário de saída
- quem substituiu
- quem autorizou
- se houve sangria
- se houve atraso na troca
- se o posto ficou sem cobertura

---

# 8. Status da alocação

Status possíveis:

```txt
alocado
aguardando_troca
em_troca
finalizado
sem_cobertura
```

## Descrição dos status

### alocado

Colaborador está ativo no posto.

### aguardando_troca

Colaborador precisa sair, mas ainda não há substituto confirmado.

### em_troca

Processo de troca está em andamento.

### finalizado

Alocação foi encerrada.

### sem_cobertura

Posto está ativo, mas sem colaborador responsável.

---

# 9. Regras operacionais

## Regra 1 — Posto ativo precisa de cobertura

Se um posto ativo estiver sem colaborador durante horário de operação, o sistema deve gerar alerta.

```txt
PDV ativo + sem alocação atual = alerta crítico
```

---

## Regra 2 — Operador alocado não sai sem substituto

Antes de iniciar intervalo, o sistema deve verificar se existe substituto.

---

## Regra 3 — Sangria pode ser obrigatória

No modo supermercado, a sangria deve ser confirmada antes do intervalo, se a configuração estiver ativa.

---

## Regra 4 — Troca encerra uma alocação e cria outra

Quando um substituto assume o posto:

```txt
1. encerra alocação atual
2. cria nova alocação
3. registra evento
4. registra auditoria
```

---

## Regra 5 — Toda ação gera histórico

Ações importantes devem gerar:

- attendance_events
- audit_logs
- atualização de post_allocations

---

# 10. Tabelas novas necessárias

---

# 10.1 Tabela operational_posts

Representa postos, PDVs ou posições operacionais.

```sql
create type public.operational_post_type as enum (
  'cashier',
  'self_checkout',
  'counter',
  'service_desk',
  'delivery',
  'stock',
  'kitchen',
  'reception',
  'other'
);

create table public.operational_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  sector_id uuid references public.sectors(id) on delete set null,
  name text not null,
  type public.operational_post_type not null default 'other',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(branch_id, name)
);

create index idx_operational_posts_organization on public.operational_posts(organization_id);
create index idx_operational_posts_branch on public.operational_posts(branch_id);
create index idx_operational_posts_sector on public.operational_posts(sector_id);
```

---

# 10.2 Tabela post_allocations

Representa a alocação de um colaborador em um posto.

```sql
create type public.post_allocation_status as enum (
  'alocado',
  'aguardando_troca',
  'em_troca',
  'finalizado',
  'sem_cobertura'
);

create table public.post_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  post_id uuid not null references public.operational_posts(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  schedule_id uuid references public.schedules(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status public.post_allocation_status not null default 'alocado',
  created_by uuid references public.user_profiles(id) on delete set null,
  ended_by uuid references public.user_profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_post_allocations_organization on public.post_allocations(organization_id);
create index idx_post_allocations_branch on public.post_allocations(branch_id);
create index idx_post_allocations_post on public.post_allocations(post_id);
create index idx_post_allocations_employee on public.post_allocations(employee_id);
create index idx_post_allocations_active on public.post_allocations(post_id, status) where ended_at is null;
```

---

# 10.3 Tabela cash_movements

Representa movimentos operacionais relacionados ao caixa/PDV.

```sql
create type public.cash_movement_type as enum (
  'sangria_confirmada',
  'abertura_caixa',
  'fechamento_caixa',
  'troco_reforco'
);

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  post_id uuid not null references public.operational_posts(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  allocation_id uuid references public.post_allocations(id) on delete set null,
  movement_type public.cash_movement_type not null,
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid references public.user_profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_cash_movements_organization on public.cash_movements(organization_id);
create index idx_cash_movements_branch on public.cash_movements(branch_id);
create index idx_cash_movements_post on public.cash_movements(post_id);
create index idx_cash_movements_employee on public.cash_movements(employee_id);
create index idx_cash_movements_time on public.cash_movements(confirmed_at desc);
```

---

# 11. RLS recomendada

As tabelas devem seguir a mesma lógica multi-tenant do restante do sistema.

## operational_posts

```sql
alter table public.operational_posts enable row level security;

create policy "Users can view operational posts from own organization"
on public.operational_posts
for select
using (organization_id = public.current_organization_id());

create policy "Managers can manage operational posts from allowed branch"
on public.operational_posts
for all
using (
  organization_id = public.current_organization_id()
  and public.can_manage_branch(branch_id)
)
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_branch(branch_id)
);
```

## post_allocations

```sql
alter table public.post_allocations enable row level security;

create policy "Users can view post allocations from own organization"
on public.post_allocations
for select
using (organization_id = public.current_organization_id());

create policy "Managers can manage post allocations from allowed branch"
on public.post_allocations
for all
using (
  organization_id = public.current_organization_id()
  and public.can_manage_branch(branch_id)
)
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_branch(branch_id)
);
```

## cash_movements

```sql
alter table public.cash_movements enable row level security;

create policy "Users can view cash movements from own organization"
on public.cash_movements
for select
using (organization_id = public.current_organization_id());

create policy "Managers can create cash movements from allowed branch"
on public.cash_movements
for insert
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_branch(branch_id)
);
```

---

# 12. Como entra no Painel Operacional

O painel operacional deve ganhar uma nova seção:

# Cobertura de Postos

Essa seção mostra:

```txt
Posto | Operador | Status | Ação
```

Exemplo:

```txt
Caixa 01 | Fernanda | Trabalhando | Solicitar intervalo
Caixa 02 | Sem operador | Crítico | Alocar agora
Caixa 03 | Edivaldo | Deve sair | Trocar operador
Self | Aline | Em atendimento | Ver detalhes
```

---

# 13. Cards novos no dashboard

Para modo supermercado ou PDV intenso, adicionar cards:

- PDVs ativos
- PDVs cobertos
- PDVs sem cobertura
- Trocas pendentes
- Sangrias pendentes
- Operadores alocados

---

# 14. Alertas novos

O sistema deve gerar alertas como:

```txt
Caixa 02 está sem cobertura.
Edivaldo precisa de troca no Caixa 03.
Sangria pendente no Caixa 04.
Self-checkout sem responsável.
```

---

# 15. Fluxo ideal para supermercado

```txt
1. Cadastra PDVs/postos
2. Cadastra colaboradores
3. Cria escala do dia
4. Aloca colaborador no PDV
5. Painel mostra cobertura
6. Fiscal solicita intervalo
7. Sistema exige sangria
8. Sistema exige substituto
9. Troca é confirmada
10. Colaborador sai para intervalo
11. Histórico fica salvo
```

---

# 16. Fluxo de alocação inicial

```txt
1. Fiscal abre tela de alocação
2. Seleciona filial
3. Seleciona posto/PDV
4. Seleciona colaborador disponível
5. Confirma início
6. Sistema cria post_allocation
7. Painel passa a exibir posto como coberto
```

---

# 17. Fluxo de troca de operador

```txt
1. Fiscal escolhe operador atual
2. Clica em Trocar operador
3. Sistema lista colaboradores disponíveis
4. Fiscal escolhe substituto
5. Sistema encerra alocação atual
6. Sistema cria nova alocação
7. Sistema registra attendance_event
8. Sistema registra audit_log
9. Painel atualiza cobertura
```

---

# 18. Fluxo de sangria

```txt
1. Fiscal solicita intervalo do operador
2. Sistema verifica se o posto exige sangria
3. Se exigir, botão de iniciar intervalo fica bloqueado
4. Fiscal confirma sangria
5. Sistema registra cash_movement
6. Sistema libera próxima etapa do fluxo
```

---

# 19. Onde implantar no React

Estrutura recomendada:

```txt
src/
 ├── features/
 │   ├── allocation/
 │   │   ├── posts/
 │   │   │   ├── pages/
 │   │   │   │   └── OperationalPostsPage.tsx
 │   │   │   ├── components/
 │   │   │   │   ├── OperationalPostsTable.tsx
 │   │   │   │   └── OperationalPostForm.tsx
 │   │   │   ├── hooks/
 │   │   │   │   └── useOperationalPosts.ts
 │   │   │   ├── services/
 │   │   │   │   └── operationalPostsService.ts
 │   │   │   └── types.ts
 │   │   │
 │   │   ├── allocations/
 │   │   │   ├── pages/
 │   │   │   │   └── AllocationsPage.tsx
 │   │   │   ├── components/
 │   │   │   │   ├── AllocationBoard.tsx
 │   │   │   │   ├── AllocationCard.tsx
 │   │   │   │   ├── AllocateEmployeeDialog.tsx
 │   │   │   │   └── TransferAllocationDialog.tsx
 │   │   │   ├── hooks/
 │   │   │   │   ├── usePostAllocations.ts
 │   │   │   │   └── useAllocationActions.ts
 │   │   │   ├── services/
 │   │   │   │   └── allocationsService.ts
 │   │   │   └── types.ts
 │   │   │
 │   │   └── cash/
 │   │       ├── components/
 │   │       │   └── ConfirmCashMovementDialog.tsx
 │   │       ├── hooks/
 │   │       │   └── useCashMovements.ts
 │   │       ├── services/
 │   │       │   └── cashMovementsService.ts
 │   │       └── types.ts
```

---

# 20. Telas necessárias

## 20.1 Tela de Postos / PDVs

Rota sugerida:

```txt
/allocation/posts
```

Funções:

- listar postos
- criar posto
- editar posto
- ativar/desativar posto
- filtrar por setor
- filtrar por tipo

---

## 20.2 Tela de Alocação

Rota sugerida:

```txt
/allocation
```

Funções:

- visualizar postos
- visualizar operador atual
- alocar colaborador
- trocar operador
- finalizar alocação
- visualizar posto sem cobertura

---

## 20.3 Componente de Cobertura no Dashboard

Local:

```txt
src/features/ops/dashboard/components/PostCoveragePanel.tsx
```

Funções:

- mostrar cobertura de postos
- destacar postos críticos
- abrir ação rápida
- abrir detalhes do posto

---

## 20.4 Tela de Histórico de Alocação

Rota sugerida:

```txt
/allocation/history
```

Funções:

- ver histórico por data
- filtrar por posto
- filtrar por colaborador
- filtrar por filial
- ver trocas realizadas

---

# 21. Serviços necessários

## operationalPostsService.ts

Funções:

```txt
getOperationalPosts()
createOperationalPost()
updateOperationalPost()
deactivateOperationalPost()
```

## allocationsService.ts

Funções:

```txt
getCurrentAllocations()
createAllocation()
transferAllocation()
finishAllocation()
markPostWithoutCoverage()
```

## cashMovementsService.ts

Funções:

```txt
confirmCashMovement()
getCashMovementsByAllocation()
getPendingCashMovements()
```

---

# 22. Hooks necessários

## useOperationalPosts

Busca e gerencia postos.

## usePostAllocations

Busca alocações atuais.

## useAllocationActions

Executa ações:

- alocar
- trocar
- finalizar
- marcar sem cobertura

## useCashMovements

Gerencia sangrias e movimentos de caixa.

---

# 23. Integração com Unyx Ops

O Unyx Ops deve consultar também:

- operational_posts
- post_allocations
- cash_movements

Para mostrar:

- cobertura real dos PDVs
- operadores alocados
- caixas descobertos
- sangrias pendentes
- trocas pendentes

---

# 24. Integração com ações operacionais

Quando o usuário clicar em **Solicitar intervalo**, o sistema deve verificar:

```txt
1. O colaborador está alocado em algum posto?
2. O posto é caixa/PDV?
3. A configuração exige sangria?
4. Existe substituto disponível?
5. A troca foi confirmada?
```

Só depois disso o intervalo deve ser iniciado.

---

# 25. Ordem correta de implantação

```txt
1. Criar tabelas no Supabase
2. Criar RLS
3. Criar tela de Postos / PDVs
4. Criar tela de Alocação
5. Criar serviços e hooks
6. Integrar cobertura no Dashboard
7. Integrar sangria no fluxo de intervalo
8. Integrar troca de operador
9. Criar histórico de alocação
10. Criar dados de teste
```

---

# 26. Ordem dentro do produto

A implantação do MVP agora deve seguir:

```txt
Colaboradores
↓
Setores
↓
PDVs/Postos
↓
Escala
↓
Alocação
↓
Dashboard
↓
Ações operacionais
↓
Auditoria
```

---

# 27. Dados de teste recomendados

Criar:

- 1 filial
- setor Frente de Caixa
- setor Atendimento
- 8 caixas comuns
- 1 self-checkout
- 15 colaboradores
- 10 colaboradores alocados
- 2 caixas sem cobertura
- 1 troca pendente
- 1 sangria pendente

---

# 28. Critério de sucesso do módulo

O módulo estará pronto quando for possível:

1. Cadastrar PDVs/postos.
2. Alocar colaborador em um posto.
3. Ver cobertura atual no dashboard.
4. Identificar posto sem operador.
5. Trocar operador de um posto.
6. Confirmar sangria vinculada ao PDV.
7. Liberar intervalo após sangria e troca.
8. Consultar histórico de alocação.
9. Registrar eventos e auditoria.

---

# 29. O que não fazer agora

Não implementar ainda:

- integração com sistema real de PDV
- leitura automática do caixa
- importação de dados do ERP
- cálculo financeiro de sangria
- conferência de valores
- fechamento fiscal

Nesta fase, a sangria será apenas confirmação operacional.

---

# 30. Resumo final

O Módulo de Alocação Operacional é essencial para tornar o Unyx Ops realmente útil em supermercados e operações com PDV.

Ele responde a pergunta:

```txt
Quem está em qual posto agora?
```

E permite agir sobre:

- cobertura
- troca
- intervalo
- sangria
- posto descoberto
- auditoria operacional

Esse módulo deve ser implantado antes do dashboard final, porque ele adiciona a camada de realidade que supermercados e varejos precisam.

---

# Unyx Enterprise / Unyx Allocation
## Operational Allocation Module

