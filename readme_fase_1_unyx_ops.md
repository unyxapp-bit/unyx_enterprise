# Unyx Enterprise / Unyx Ops
## README — Plano de Criação da Fase 1

---

# 1. Visão da Fase 1

A Fase 1 tem como objetivo transformar a ideia da Unyx Enterprise em uma base real de produto SaaS B2B.

Nesta etapa, o foco não é criar todos os módulos futuros, mas sim construir a fundação profissional do primeiro produto comercial:

# Unyx Ops

O Unyx Ops será o módulo inicial da plataforma Unyx Enterprise, focado em gestão operacional em tempo real para:

- lojas de varejo
- supermercados
- restaurantes
- farmácias

A proposta principal é resolver o caos operacional diário do chão de loja, permitindo que gerentes, supervisores e fiscais acompanhem a operação em tempo real.

---

# 2. Objetivo Principal

Construir a primeira versão funcional da plataforma com:

- arquitetura SaaS multi-tenant
- frontend web desktop-first
- estrutura modular em React + TypeScript + Vite
- integração com Supabase
- dashboard operacional Bento UI
- controle de colaboradores
- controle de escalas
- controle de status operacional
- base para auditoria
- preparação para módulos premium futuros

---

# 3. Stack Tecnológica da Fase 1

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS v4
- shadcn/ui
- React Router
- TanStack Query
- Zustand
- Recharts

## Backend

- Supabase
- PostgreSQL
- Supabase Auth
- Row Level Security
- Supabase Realtime
- Supabase Storage futuramente
- Edge Functions futuramente

---

# 4. Posicionamento Técnico

A plataforma será criada com foco em:

## Desktop-First

O sistema será pensado primeiro para telas grandes, pois o uso principal será em ambiente de trabalho, por gerentes, fiscais, supervisores e líderes operacionais.

## Web App / PWA

A primeira versão será uma aplicação web moderna, com possibilidade futura de instalação como PWA.

## Modularidade

Cada área importante do sistema será organizada em módulos independentes para facilitar manutenção, expansão e escalabilidade.

## Multi-Tenant

A arquitetura será preparada para atender várias empresas, filiais e usuários sem misturar dados entre clientes.

---

# 5. Estrutura Comercial da Plataforma

## Marca Principal

# Unyx Enterprise

Representa o ecossistema empresarial completo.

## Produto Inicial

# Unyx Ops

Primeiro produto SaaS da plataforma.

## Modelo de Venda

SaaS B2B híbrido:

- entrada acessível
- expansão por módulos premium
- possibilidade de cobrança por empresa, filial ou pacote

---

# 6. Arquitetura Multi-Tenant

A plataforma será organizada em níveis:

## Organização

Representa a empresa contratante.

Exemplos:

- Supermercado Silva
- Rede Farma Vida
- Restaurante Central
- Loja Mega Center

## Filial

Representa uma unidade física da organização.

Exemplos:

- Loja Centro
- Filial Shopping
- Unidade Delivery

## Setor

Representa áreas operacionais dentro da filial.

Exemplos:

- frente de caixa
- atendimento
- cozinha
- salão
- estoque
- farmácia
- delivery

## Usuários

Pessoas que acessam o sistema.

Exemplos:

- dono
- administrador
- gerente
- supervisor
- fiscal
- colaborador

## Colaboradores

Funcionários acompanhados pela operação.

Importante:

Nem todo colaborador precisa ter login.

Um operador pode estar na escala sem acessar o sistema.

---

# 7. Estrutura Inicial de Pastas

A estrutura base do projeto React será:

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
 │   ├── dashboard/
 │   ├── employees/
 │   ├── schedules/
 │   ├── operational/
 │   ├── auth/
 │   ├── branches/
 │   └── settings/
 │
 ├── hooks/
 │
 ├── lib/
 │   ├── supabase.ts
 │   └── queryClient.ts
 │
 ├── services/
 │   ├── supabase/
 │   └── api/
 │
 ├── store/
 │
 ├── types/
 │
 └── utils/
```

---

# 8. Descrição das Pastas

## app/

Contém a estrutura principal da aplicação.

### app/layout/

Layouts globais do sistema.

Exemplo:

- AppLayout
- AuthLayout
- DashboardLayout

### app/routes/

Configuração das rotas com React Router.

### app/providers/

Providers globais.

Exemplos:

- QueryClientProvider
- ThemeProvider futuramente
- AuthProvider futuramente

---

## components/

Componentes reutilizáveis do sistema.

### components/ui/

Componentes gerados pelo shadcn/ui.

Exemplos:

- Button
- Card
- Badge
- Input
- Dialog

### components/bento/

Componentes visuais no padrão Bento UI.

Exemplos:

- BentoCard
- BentoGrid
- MetricCard
- StatusCard

### components/shared/

Componentes reutilizáveis gerais.

Exemplos:

- LoadingState
- EmptyState
- ErrorState
- PageHeader

---

## features/

Contém os módulos funcionais da aplicação.

Cada módulo terá seus próprios componentes, hooks, serviços e tipos.

---

# 9. Módulos da Fase 1

A Fase 1 será composta pelos seguintes módulos principais:

---

# 9.1 Módulo Dashboard

## Objetivo

Criar o centro de comando operacional do sistema.

## Funções principais

- exibir visão geral da operação
- mostrar colaboradores em tempo real
- destacar atrasos
- destacar intervalos
- destacar alertas críticos
- ordenar colaboradores por prioridade
- exibir status por cor e categoria

## Componentes previstos

- DashboardPage
- DashboardHeader
- OperationalSummaryCards
- OperationalStatusGrid
- CriticalAlertsCard
- TodayScheduleCard
- DelayRankingCard

---

# 9.2 Módulo Colaboradores

## Objetivo

Cadastrar e gerenciar colaboradores da operação.

## Funções principais

- listar colaboradores
- cadastrar colaborador
- editar colaborador
- ativar/desativar colaborador
- vincular colaborador a setor
- vincular colaborador a filial

## Componentes previstos

- EmployeesPage
- EmployeesTable
- EmployeeForm
- EmployeeDetailsDrawer
- EmployeeStatusBadge

---

# 9.3 Módulo Escalas

## Objetivo

Controlar a escala planejada dos colaboradores.

## Funções principais

- cadastrar escala diária
- definir entrada
- definir intervalo
- definir retorno
- definir saída
- marcar folga
- visualizar escala do dia
- preparar base para importação futura

## Componentes previstos

- SchedulesPage
- ScheduleDayView
- ScheduleTable
- ScheduleForm
- ScheduleStatusBadge

---

# 9.4 Módulo Operacional

## Objetivo

Controlar as ações reais do dia.

## Funções principais

- confirmar entrada
- registrar atraso
- registrar falta
- solicitar intervalo
- confirmar sangria
- confirmar troca de posto
- iniciar intervalo
- confirmar retorno
- finalizar jornada
- registrar ocorrência

## Componentes previstos

- OperationalActionsPanel
- EmployeeOperationalCard
- StatusActionButton
- EventTimeline
- OperationFlowModal

---

# 9.5 Módulo Autenticação

## Objetivo

Permitir acesso seguro ao sistema.

## Funções principais

- login
- logout
- leitura do usuário atual
- perfil vinculado à organização
- controle básico de permissões

## Componentes previstos

- LoginPage
- AuthGuard
- UserMenu
- ProtectedRoute

---

# 9.6 Módulo Filiais e Setores

## Objetivo

Criar a base organizacional da empresa.

## Funções principais

- listar filiais
- cadastrar filial
- cadastrar setores
- vincular setores à filial
- filtrar dados por filial

## Componentes previstos

- BranchesPage
- BranchForm
- SectorsPage
- SectorForm
- BranchSelector

---

# 9.7 Módulo Configurações

## Objetivo

Permitir ajustes iniciais do sistema.

## Funções principais

- dados da organização
- tolerância de atraso
- tolerância de intervalo
- preferências visuais
- permissões básicas

## Componentes previstos

- SettingsPage
- OrganizationSettings
- OperationalRulesSettings
- UserPermissionsSettings

---

# 10. Banco de Dados da Fase 1

O banco será criado no Supabase com as seguintes tabelas iniciais:

- organizations
- branches
- sectors
- user_profiles
- employees
- schedules
- attendance_events
- operational_status
- audit_logs
- modules
- organization_modules
- subscriptions

---

# 11. Regras Operacionais Iniciais

## Status principais

- trabalhando
- deve_sair
- aguardando_sangria
- troca_de_caixa
- em_intervalo
- voltou
- folga
- alerta_critico

## Eventos principais

- entrada_confirmada
- atraso_detectado
- falta_detectada
- intervalo_solicitado
- sangria_confirmada
- troca_caixa_confirmada
- intervalo_iniciado
- retorno_confirmado
- saida_confirmada
- ocorrencia_registrada

---

# 12. Fluxo Operacional MVP

## Fluxo básico do dia

1. O sistema carrega a escala do dia.
2. O gerente ou fiscal visualiza quem deveria estar trabalhando.
3. O sistema identifica atrasos ou faltas.
4. O dashboard ordena os colaboradores por prioridade.
5. O fiscal solicita intervalo para quem deve sair.
6. O sistema exige confirmação de sangria quando necessário.
7. O fiscal confirma troca de posto ou caixa.
8. O colaborador entra em intervalo.
9. O retorno é confirmado.
10. Tudo fica registrado em eventos e auditoria.

---

# 13. Prioridades de Desenvolvimento

## Etapa 1 — Setup do Projeto

- criar projeto React + TypeScript + Vite
- instalar Tailwind CSS v4
- configurar shadcn/ui
- instalar Supabase
- instalar React Router
- instalar TanStack Query
- instalar Zustand
- instalar Recharts

---

## Etapa 2 — Base Visual

- criar AppLayout
- criar estrutura Bento UI
- criar Dashboard inicial
- criar cards de métricas
- criar header do sistema
- criar navegação lateral futuramente

---

## Etapa 3 — Supabase

- criar schema SQL
- configurar Auth
- criar tabelas principais
- ativar RLS
- criar dados de teste
- validar consultas no SQL Editor

---

## Etapa 4 — Integração Frontend + Supabase

- criar client Supabase
- criar hooks de leitura
- buscar dashboard operacional
- listar colaboradores
- listar escalas
- listar status atuais
- tratar loading, erro e vazio

---

## Etapa 5 — Dashboard Vivo

- conectar cards aos dados reais
- exibir colaboradores por status
- calcular totais
- ordenar prioridade
- destacar alertas críticos
- preparar atualização em tempo real

---

## Etapa 6 — Operações do Dia

- criar botões de ação
- registrar eventos
- atualizar status operacional
- salvar auditoria
- criar timeline de eventos

---

## Etapa 7 — Validação do MVP

- testar fluxo completo com dados fictícios
- simular atrasos
- simular intervalo
- simular retorno
- simular falta
- validar segurança por organização
- ajustar layout para uso real

---

# 14. Telas da Fase 1

## Telas obrigatórias

- Login
- Dashboard Operacional
- Colaboradores
- Escalas
- Operação do Dia
- Filiais / Setores
- Configurações

## Telas futuras

- Relatórios
- Auditoria avançada
- Comunicação interna
- Gamificação
- Treinamentos
- IA operacional

---

# 15. Design System Inicial

## Estilo visual

- clean
- claro
- moderno
- corporativo
- Bento UI
- foco em leitura rápida
- baixa fadiga visual

## Cores iniciais sugeridas

- fundo claro em tons de slate
- cards brancos
- textos escuros
- alertas por status
- badges visuais

## Componentes principais

- cards Bento
- badges de status
- botões de ação
- tabelas limpas
- painéis de resumo
- timeline operacional

---

# 16. Entregáveis da Fase 1

Ao final da Fase 1, o projeto deve ter:

- projeto React criado
- Tailwind funcionando
- shadcn/ui configurado
- layout principal criado
- dashboard visual inicial
- Supabase configurado
- banco multi-tenant criado
- dados de teste inseridos
- dashboard buscando dados reais
- colaboradores listados
- escala do dia funcionando
- eventos operacionais sendo registrados
- status operacional sendo atualizado
- base de auditoria criada

---

# 17. O que NÃO entra na Fase 1

Para evitar excesso de complexidade, a Fase 1 não terá:

- feed corporativo
- comunidades internas
- gamificação
- treinamentos em vídeo
- IA operacional avançada
- app mobile nativo
- relatórios complexos
- integrações com ERP
- cobrança automática real

Esses itens ficam para fases futuras.

---

# 18. Módulos Futuros

## Unyx Comms

Comunicação interna:

- feed
- avisos
- comunicados
- comunidades por setor

## Unyx Academy

Capacitação:

- vídeos
- áudios
- trilhas
- onboarding

## Unyx Game

Gamificação:

- ranking
- conquistas
- recompensas
- metas

## Unyx AI

Inteligência operacional:

- previsão de gargalos
- sugestão de cobertura
- análise de atrasos
- alertas preventivos

---

# 19. Critério de Sucesso da Fase 1

A Fase 1 será considerada bem-sucedida quando for possível:

1. Entrar no sistema.
2. Visualizar uma empresa e filial.
3. Cadastrar colaboradores.
4. Cadastrar escala do dia.
5. Ver o dashboard operacional.
6. Identificar atrasos e faltas.
7. Registrar eventos do dia.
8. Atualizar status operacional.
9. Consultar histórico básico.
10. Demonstrar o sistema para um possível cliente.

---

# 20. Próximo Passo Imediato

Depois deste README, o próximo passo técnico será organizar o projeto React com a estrutura oficial de pastas e criar os primeiros arquivos base:

- AppLayout
- router
- supabase client
- query client
- DashboardPage
- componentes Bento iniciais

A partir disso, o desenvolvimento segue para conexão com Supabase e criação do dashboard vivo.

---

# Unyx Enterprise
## Fase 1 — Fundação do Produto SaaS

