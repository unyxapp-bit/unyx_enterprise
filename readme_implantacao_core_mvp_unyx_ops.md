# Unyx Enterprise / Unyx Ops
## README — Implantação do Core Funcional do MVP

---

# 1. Objetivo deste documento

Este documento define o próximo passo após a implantação dos Modos Operacionais.

Agora que o sistema já sabe se adaptar por segmento, o foco passa a ser construir o **Core funcional do MVP**.

O objetivo é fazer o Unyx Ops sair da estrutura conceitual e se tornar um sistema utilizável com dados reais.

---

# 2. Visão geral do próximo passo

Depois dos Modos Operacionais, a prioridade correta é implantar a base funcional do produto:

1. Unyx Control mínimo
2. Escala do Dia
3. Painel Operacional conectado
4. Fluxo de Ações Operacionais
5. Auditoria básica
6. Dados de teste

Essa ordem é importante porque o dashboard depende dos cadastros, da escala e dos status operacionais.

---

# 3. Regra principal

Não comece pelas ações do dashboard antes de ter:

- organização
- filial
- setores
- colaboradores
- escala do dia
- configuração operacional

Sem esses dados, o painel não tem base real para funcionar.

---

# 4. Arquitetura da implantação

## Fluxo geral

```txt
Unyx Control
   ↓
Cadastros base
   ↓
Escala do Dia
   ↓
Status Operacional
   ↓
Painel Operacional
   ↓
Ações Operacionais
   ↓
Eventos + Auditoria
```

---

# 5. Módulo 1 — Unyx Control mínimo

## 5.1 Objetivo

Criar a estrutura mínima da empresa dentro do sistema.

O Unyx Control é responsável por organizar:

- empresa
- filial
- setores
- colaboradores
- usuários
- configurações operacionais

Nesta etapa, o foco é o mínimo necessário para alimentar o Unyx Ops.

---

## 5.2 O que implantar agora

### Obrigatório

- Organização
- Filial
- Setores
- Colaboradores
- Modo operacional ativo
- Configurações operacionais básicas

### Pode ficar para depois

- convite de usuários
- permissões avançadas
- múltiplas empresas
- múltiplas filiais avançadas
- cobrança
- planos SaaS reais

---

## 5.3 Tabelas usadas

No Supabase, as tabelas principais são:

- organizations
- branches
- sectors
- employees
- user_profiles
- operational_settings

---

## 5.4 Onde implantar no React

Estrutura recomendada:

```txt
src/
 ├── features/
 │   ├── control/
 │   │   ├── organizations/
 │   │   ├── branches/
 │   │   ├── sectors/
 │   │   ├── employees/
 │   │   └── settings/
```

---

## 5.5 Telas do Unyx Control mínimo

### Tela de Colaboradores

Funções:

- listar colaboradores
- cadastrar colaborador
- editar colaborador
- ativar/desativar colaborador
- vincular setor
- vincular filial
- pesquisar colaborador
- filtrar por setor

### Tela de Setores

Funções:

- listar setores
- cadastrar setor
- editar setor
- ativar/desativar setor
- vincular setor à filial

### Tela de Filiais

Funções:

- listar filiais
- cadastrar filial
- editar filial
- ativar/desativar filial

### Tela de Configurações Operacionais

Funções:

- escolher modo operacional
- definir tolerância de atraso
- definir tolerância de intervalo
- exigir cobertura antes do intervalo
- exigir sangria antes do intervalo
- ativar bloqueio de intervalo em horário de pico
- exigir responsável presente

---

# 6. Módulo 2 — Escala do Dia

## 6.1 Objetivo

Criar a escala planejada da operação.

A escala é a base para o painel identificar:

- quem deveria estar trabalhando
- quem está atrasado
- quem deve sair para intervalo
- quem está de folga
- quem deveria ter retornado

---

## 6.2 Tabela usada

Tabela principal:

- schedules

Campos principais:

- organization_id
- branch_id
- employee_id
- work_date
- start_time
- break_start
- break_end
- end_time
- status
- notes

---

## 6.3 Onde implantar no React

```txt
src/
 ├── features/
 │   ├── ops/
 │   │   ├── schedules/
 │   │   │   ├── pages/
 │   │   │   ├── components/
 │   │   │   ├── hooks/
 │   │   │   ├── services/
 │   │   │   └── types.ts
```

---

## 6.4 Tela Escala do Dia

Funções obrigatórias:

- selecionar data
- selecionar filial
- listar colaboradores escalados
- adicionar colaborador à escala
- definir entrada
- definir saída para intervalo
- definir retorno
- definir saída final
- marcar folga
- editar escala
- remover escala
- filtrar por setor

---

## 6.5 Fluxo da Escala

```txt
1. Usuário escolhe a filial
2. Usuário escolhe a data
3. Sistema lista colaboradores ativos
4. Usuário cadastra horários
5. Sistema salva em schedules
6. Dashboard passa a usar esses dados
```

---

## 6.6 Regras importantes

### Regra 1 — Um colaborador só pode ter uma escala por dia

Usar a constraint:

```sql
unique(employee_id, work_date)
```

### Regra 2 — Folga não precisa de horários

Se status for `day_off`, os horários podem ficar vazios.

### Regra 3 — Escala incompleta deve ser destacada

Se faltar entrada, intervalo ou saída, a interface deve avisar.

---

# 7. Módulo 3 — Painel Operacional conectado

## 7.1 Objetivo

Transformar o dashboard visual em um painel real, alimentado pelo Supabase.

Ele deve mostrar a operação do dia com base em:

- escala
- colaboradores
- status operacional
- eventos
- modo operacional
- regras de prioridade

---

## 7.2 Tabelas usadas

- schedules
- employees
- sectors
- branches
- operational_status
- attendance_events
- operational_settings

---

## 7.3 Onde implantar no React

```txt
src/
 ├── features/
 │   ├── ops/
 │   │   ├── dashboard/
 │   │   │   ├── pages/
 │   │   │   ├── components/
 │   │   │   ├── hooks/
 │   │   │   ├── services/
 │   │   │   └── types.ts
```

---

## 7.4 Componentes recomendados

```txt
DashboardPage.tsx
DashboardHeader.tsx
OperationalSummaryCards.tsx
OperationalEmployeeList.tsx
OperationalEmployeeCard.tsx
CriticalAlertsPanel.tsx
ModeAwareDashboard.tsx
StatusBadge.tsx
PriorityBadge.tsx
```

---

## 7.5 Funções do painel

O painel deve:

- buscar escala do dia
- buscar status atual
- buscar configurações do modo operacional
- aplicar prioridade por modo
- ordenar colaboradores por urgência
- exibir cards adaptados ao segmento
- exibir alertas ativos
- exibir ações rápidas

---

## 7.6 Lógica principal

```txt
1. Buscar configurações operacionais
2. Identificar o modo ativo
3. Buscar escala do dia
4. Buscar status operacional
5. Combinar colaborador + escala + status
6. Calcular prioridade
7. Ordenar lista
8. Renderizar painel adaptado
```

---

## 7.7 Exemplo de comportamento

### Supermercado

O dashboard prioriza:

- caixa sem cobertura
- atraso em caixa
- sangria pendente
- intervalo vencido

### Atacado / Varejo

O dashboard prioriza:

- setor descoberto
- falta
- equipe abaixo do mínimo

### Restaurante

O dashboard prioriza:

- equipe mínima
- horário de pico
- função crítica ausente

### Farmácia

O dashboard prioriza:

- responsável ausente
- conformidade
- atendimento descoberto

---

# 8. Módulo 4 — Fluxo de Ações Operacionais

## 8.1 Objetivo

Permitir que o usuário execute ações reais no dia a dia da operação.

Cada ação deve atualizar o status e registrar histórico.

---

## 8.2 Ações obrigatórias

### Confirmar entrada

Quando o colaborador chega.

Gera:

- evento `entrada_confirmada`
- status `trabalhando`
- auditoria

---

### Registrar atraso

Quando o colaborador não chegou no horário.

Gera:

- evento `atraso_detectado`
- status `alerta_critico` ou `trabalhando`, dependendo da regra
- auditoria

---

### Registrar falta

Quando o colaborador não comparece.

Gera:

- evento `falta_detectada`
- status `alerta_critico`
- auditoria

---

### Solicitar intervalo

Quando o colaborador deve sair.

Gera:

- evento `intervalo_solicitado`
- status `aguardando_sangria` ou `troca_de_caixa`
- auditoria

---

### Confirmar sangria

Especialmente no modo supermercado.

Gera:

- evento `sangria_confirmada`
- status `troca_de_caixa`
- auditoria

---

### Confirmar troca de caixa/posto

Gera:

- evento `troca_caixa_confirmada`
- status pronto para iniciar intervalo
- auditoria

---

### Iniciar intervalo

Gera:

- evento `intervalo_iniciado`
- status `em_intervalo`
- auditoria

---

### Confirmar retorno

Gera:

- evento `retorno_confirmado`
- status `voltou` ou `trabalhando`
- auditoria

---

### Finalizar jornada

Gera:

- evento `saida_confirmada`
- status de jornada finalizada
- auditoria

---

### Registrar ocorrência

Gera:

- evento `ocorrencia_registrada`
- observação
- auditoria

---

# 9. Onde implantar ações no React

Estrutura recomendada:

```txt
src/
 ├── features/
 │   ├── ops/
 │   │   ├── operation-day/
 │   │   │   ├── components/
 │   │   │   │   ├── OperationalActionsPanel.tsx
 │   │   │   │   ├── ActionButton.tsx
 │   │   │   │   └── ActionConfirmDialog.tsx
 │   │   │   ├── hooks/
 │   │   │   │   └── useOperationalActions.ts
 │   │   │   ├── services/
 │   │   │   │   └── operationalActionsService.ts
 │   │   │   └── types.ts
```

---

# 10. Serviço de ações operacionais

O arquivo `operationalActionsService.ts` deve centralizar as operações no Supabase.

Responsabilidades:

- inserir em `attendance_events`
- atualizar `operational_status`
- inserir em `audit_logs`

---

# 11. Padrão de execução de ação

Toda ação deve seguir este fluxo:

```txt
1. Validar permissão
2. Validar regra operacional
3. Criar attendance_event
4. Atualizar operational_status
5. Criar audit_log
6. Atualizar dashboard
```

---

# 12. Módulo 5 — Auditoria básica

## 12.1 Objetivo

Registrar o histórico das ações relevantes.

A auditoria garante:

- rastreabilidade
- segurança gerencial
- histórico confiável
- apoio em análise futura

---

## 12.2 Tabela usada

- audit_logs

Campos principais:

- organization_id
- branch_id
- user_id
- action
- entity_type
- entity_id
- old_value
- new_value
- created_at

---

## 12.3 Onde implantar no React

```txt
src/
 ├── features/
 │   ├── insight/
 │   │   ├── audit/
 │   │   │   ├── AuditPage.tsx
 │   │   │   ├── AuditTable.tsx
 │   │   │   ├── useAuditLogs.ts
 │   │   │   └── auditService.ts
```

---

## 12.4 Tela de Auditoria simples

Funções:

- listar ações
- filtrar por data
- filtrar por colaborador
- filtrar por usuário
- filtrar por tipo de ação
- visualizar detalhes

---

# 13. Módulo 6 — Dados de teste

## 13.1 Objetivo

Criar um ambiente fake para testar o produto antes de cliente real.

---

## 13.2 Cenário mínimo

Criar:

- 1 organização
- 1 filial
- 3 setores
- 15 colaboradores
- escala completa do dia
- 3 atrasos simulados
- 2 intervalos em andamento
- 2 alertas críticos
- 1 colaborador de folga

---

## 13.3 Setores sugeridos para supermercado

- Frente de Caixa
- Reposição
- Atendimento

---

## 13.4 Status simulados

- trabalhando
- deve_sair
- aguardando_sangria
- troca_de_caixa
- em_intervalo
- voltou
- folga
- alerta_critico

---

# 14. Ordem prática de implantação no código

## Etapa 1 — Estrutura de pastas

Criar:

```txt
src/features/control/
src/features/ops/
src/features/insight/
```

---

## Etapa 2 — Supabase client

Garantir que existe:

```txt
src/lib/supabase.ts
```

---

## Etapa 3 — React Query

Garantir que existe:

```txt
src/lib/queryClient.ts
```

---

## Etapa 4 — Control mínimo

Criar telas e serviços para:

- branches
- sectors
- employees
- operational_settings

---

## Etapa 5 — Escala do Dia

Criar:

- SchedulePage
- ScheduleForm
- ScheduleTable
- useSchedules
- schedulesService

---

## Etapa 6 — Dashboard conectado

Criar:

- DashboardPage
- useOperationalDashboard
- dashboardService
- cards por modo
- lista ordenada por prioridade

---

## Etapa 7 — Ações operacionais

Criar:

- OperationalActionsPanel
- useOperationalActions
- operationalActionsService

---

## Etapa 8 — Auditoria simples

Criar:

- AuditPage
- AuditTable
- useAuditLogs

---

## Etapa 9 — Dados de teste

Inserir seed SQL e validar no painel.

---

# 15. Estrutura final recomendada

```txt
src/
 ├── app/
 │   ├── layout/
 │   ├── routes/
 │   └── providers/
 │
 ├── components/
 │   ├── ui/
 │   ├── bento/
 │   └── shared/
 │
 ├── features/
 │   ├── control/
 │   │   ├── branches/
 │   │   ├── sectors/
 │   │   ├── employees/
 │   │   └── settings/
 │   │
 │   ├── ops/
 │   │   ├── dashboard/
 │   │   ├── schedules/
 │   │   ├── operation-day/
 │   │   ├── alerts/
 │   │   ├── status/
 │   │   └── modes/
 │   │
 │   └── insight/
 │       ├── audit/
 │       ├── delays/
 │       └── overview/
 │
 ├── hooks/
 ├── lib/
 ├── services/
 ├── store/
 ├── types/
 └── utils/
```

---

# 16. Rotas recomendadas

```txt
/login
/dashboard
/operation-day
/employees
/schedules
/branches
/sectors
/settings
/audit
```

---

# 17. Ordem de telas para construir

## Primeiro

1. Colaboradores
2. Setores
3. Filiais

## Segundo

4. Escala do Dia

## Terceiro

5. Dashboard Operacional

## Quarto

6. Operação do Dia

## Quinto

7. Auditoria

---

# 18. Critério de sucesso do Core MVP

O Core MVP estará implantado quando for possível:

1. Cadastrar uma filial.
2. Cadastrar setores.
3. Cadastrar colaboradores.
4. Criar uma escala do dia.
5. Ver os colaboradores no dashboard.
6. Ver status operacional.
7. Aplicar prioridade por modo operacional.
8. Executar uma ação operacional.
9. Registrar evento.
10. Atualizar status.
11. Registrar auditoria.
12. Testar o fluxo completo com dados fake.

---

# 19. O que não fazer agora

Não implementar ainda:

- gamificação
- feed corporativo
- IA
- Academy
- integração com ERP
- app mobile
- cobrança real
- relatórios avançados
- múltiplos clientes reais

Esses itens ficam para depois do Core MVP validado.

---

# 20. Próximo passo imediato

O próximo passo prático é começar pelo **Unyx Control mínimo**.

## Primeira tela recomendada

# Tela de Colaboradores

Motivo:

Sem colaboradores, não existe escala.

Sem escala, não existe dashboard.

Sem dashboard, não existe operação.

---

# 21. Sequência imediata recomendada

```txt
1. Criar EmployeesPage
2. Criar EmployeesTable
3. Criar EmployeeForm
4. Criar employeesService
5. Criar useEmployees
6. Conectar com Supabase
7. Testar cadastro/listagem
8. Repetir padrão para Setores e Filiais
```

---

# Conclusão

Após implantar os Modos Operacionais, o produto precisa ganhar vida com dados reais.

A prioridade agora é construir o Core MVP na ordem correta:

```txt
Control → Escala → Dashboard → Ações → Auditoria → Teste
```

Essa é a base para transformar o Unyx Ops em um produto apresentável, validável e vendável.

---

# Unyx Enterprise / Unyx Ops
## Core MVP Implementation Guide

