# Unyx Enterprise
## Especificação dos 3 Módulos Core

---

# Visão Geral

A primeira versão comercial da Unyx Enterprise será baseada em 3 módulos centrais:

1. Unyx Ops
2. Unyx Control
3. Unyx Insight

Esses módulos formam a base do produto SaaS B2B.

O objetivo é entregar controle operacional imediato, organização empresarial e visão gerencial simples.

---

# 1. Unyx Ops
## Módulo Principal — Operação em Tempo Real

---

# 1.1 Objetivo

O Unyx Ops é o coração do sistema.

Ele controla a operação do dia em tempo real, mostrando para o gerente, supervisor ou fiscal o que está acontecendo agora.

O foco é reduzir caos, atraso, filas, falta de cobertura e decisões improvisadas.

---

# 1.2 Problema que resolve

O gerente possui uma escala planejada, mas a operação real muda o tempo todo.

Problemas comuns:

- colaborador atrasa
- colaborador falta
- intervalo passa do horário
- caixa fica sem cobertura
- sangria atrasa
- troca de posto demora
- fiscal não sabe quem liberar primeiro
- gerente só percebe o problema quando a fila já cresceu

O Unyx Ops transforma essa operação em um painel vivo.

---

# 1.3 Usuários principais

- fiscal de caixa
- supervisor
- gerente de loja
- líder de setor
- administrador da operação

---

# 1.4 Telas do Unyx Ops

## 1.4.1 Dashboard Operacional

### Função

Tela principal do sistema.

Mostra a situação da operação em tempo real.

### Deve exibir

- total de colaboradores escalados
- colaboradores trabalhando
- colaboradores atrasados
- colaboradores em intervalo
- colaboradores que devem sair
- faltas
- alertas críticos
- risco de falta de cobertura
- status por setor

### Componentes

- cards de resumo
- grid Bento UI
- lista de colaboradores por prioridade
- painel de alertas
- timeline resumida
- filtros por filial, setor e data

---

## 1.4.2 Operação do Dia

### Função

Tela para executar ações operacionais.

### Ações

- confirmar entrada
- registrar atraso
- registrar falta
- solicitar intervalo
- confirmar sangria
- confirmar troca de caixa ou posto
- iniciar intervalo
- confirmar retorno
- finalizar jornada
- registrar ocorrência

---

## 1.4.3 Status dos Colaboradores

### Função

Mostrar cada colaborador com seu estado operacional atual.

### Status principais

- Trabalhando
- Deve Sair
- Aguardando Sangria
- Troca de Caixa
- Em Intervalo
- Voltou
- Folga
- Alerta Crítico

---

## 1.4.4 Alertas Operacionais

### Função

Centralizar problemas que precisam de atenção.

### Tipos de alerta

- atraso
- falta
- intervalo vencido
- colaborador sem cobertura
- setor descoberto
- retorno atrasado
- sangria pendente
- risco de fila

---

# 1.5 Regras do Unyx Ops

## Regra 1 — Prioridade operacional

A lista deve ordenar automaticamente quem precisa de ação primeiro.

Ordem recomendada:

1. Alerta crítico
2. Atraso grave
3. Falta confirmada
4. Intervalo vencido
5. Deve sair
6. Aguardando sangria
7. Troca de caixa
8. Em intervalo
9. Trabalhando
10. Folga

---

## Regra 2 — Intervalo não deve começar sem cobertura

Antes de iniciar intervalo, o sistema deve verificar se existe cobertura ou próximo operador.

---

## Regra 3 — Sangria antes do intervalo

Para operadores de caixa, o fluxo pode exigir confirmação de sangria antes de liberar o intervalo.

---

## Regra 4 — Tudo vira evento

Toda ação operacional deve gerar um registro em `attendance_events`.

---

## Regra 5 — Tudo importante vira auditoria

Ações relevantes devem gerar registro em `audit_logs`.

---

# 1.6 Dados principais

Tabelas envolvidas:

- schedules
- employees
- operational_status
- attendance_events
- audit_logs
- branches
- sectors

---

# 1.7 Prioridade de implementação

## MVP obrigatório

- dashboard operacional
- lista de colaboradores do dia
- status operacional
- ações básicas
- alertas simples

## Depois

- regras avançadas de cobertura
- tempo real com Supabase Realtime
- timeline completa
- automações de prioridade

---

# 2. Unyx Control
## Módulo de Estrutura, Cadastro e Permissões

---

# 2.1 Objetivo

O Unyx Control organiza a base da empresa dentro da plataforma.

Ele permite configurar quem usa o sistema, onde trabalha, quais filiais existem, quais setores existem e quais regras operacionais serão aplicadas.

---

# 2.2 Problema que resolve

Sem estrutura, o sistema vira bagunça.

Problemas comuns:

- colaboradores sem setor
- filiais misturadas
- usuários com permissões erradas
- gerente vendo dados de local que não deveria
- operação sem regras padrão
- dificuldade para escalar para várias lojas

O Unyx Control garante ordem e segurança.

---

# 2.3 Usuários principais

- dono
- administrador
- gerente
- gestor da operação

---

# 2.4 Telas do Unyx Control

## 2.4.1 Organização

### Função

Gerenciar dados da empresa contratante.

### Campos

- nome da empresa
- nome fantasia
- CNPJ ou documento
- segmento
- plano
- status

---

## 2.4.2 Filiais

### Função

Gerenciar unidades da organização.

### Funções

- listar filiais
- criar filial
- editar filial
- ativar/desativar filial
- definir cidade e estado
- visualizar quantidade de colaboradores

---

## 2.4.3 Setores

### Função

Gerenciar áreas operacionais dentro de cada filial.

### Exemplos

- Frente de caixa
- Atendimento
- Estoque
- Cozinha
- Farmácia
- Delivery
- Padaria
- Açougue
- Hortifruti

### Funções

- criar setor
- editar setor
- ativar/desativar setor
- vincular setor à filial

---

## 2.4.4 Colaboradores

### Função

Gerenciar pessoas acompanhadas pela operação.

### Funções

- cadastrar colaborador
- editar colaborador
- ativar/desativar
- definir setor
- definir filial
- definir função
- adicionar observações

### Observação importante

Colaborador não precisa ter login.

---

## 2.4.5 Usuários e Permissões

### Função

Gerenciar quem acessa o sistema.

### Perfis

- Owner
- Admin
- Gerente de filial
- Supervisor
- Operador
- Colaborador

### Funções

- convidar usuário
- alterar perfil
- vincular usuário à filial
- ativar/desativar acesso
- limitar permissões

---

## 2.4.6 Configurações Operacionais

### Função

Definir regras da operação.

### Configurações possíveis

- tolerância de atraso
- tolerância de intervalo
- tempo máximo de intervalo
- exigir sangria antes do intervalo
- exigir cobertura antes de liberar operador
- setores obrigatórios
- regras por filial

---

# 2.5 Regras do Unyx Control

## Regra 1 — Todo dado pertence a uma organização

Toda tabela operacional deve ter `organization_id`.

---

## Regra 2 — Dados de filial devem ter branch_id

Sempre que o dado pertence a uma loja, ele deve ter `branch_id`.

---

## Regra 3 — Permissão depende do papel

Usuários devem ver e alterar apenas o que seu cargo permite.

---

## Regra 4 — Colaborador pode existir sem login

Isso simplifica o uso no varejo.

---

## Regra 5 — Filial pode ter regras próprias

No futuro, uma filial pode ter tolerâncias diferentes de outra.

---

# 2.6 Dados principais

Tabelas envolvidas:

- organizations
- branches
- sectors
- user_profiles
- employees
- subscriptions
- organization_modules
- modules

---

# 2.7 Prioridade de implementação

## MVP obrigatório

- filiais
- setores
- colaboradores
- usuário logado
- permissões básicas

## Depois

- convite de usuários
- permissões avançadas
- regras operacionais por filial
- planos e assinatura

---

# 3. Unyx Insight
## Módulo de Relatórios e Visão Gerencial

---

# 3.1 Objetivo

O Unyx Insight transforma os dados da operação em informações simples para tomada de decisão.

Ele ajuda o gerente ou dono a entender padrões, problemas recorrentes e pontos de atenção.

---

# 3.2 Problema que resolve

Sem relatório, a operação fica baseada em sensação.

Problemas comuns:

- gerente acha que sabe quem atrasa mais, mas não tem dados
- setores problemáticos não ficam evidentes
- faltas e atrasos não são organizados
- histórico fica espalhado em mensagens
- não existe visão semanal ou mensal

O Unyx Insight transforma eventos em visão.

---

# 3.3 Usuários principais

- dono
- gerente
- administrador
- supervisor

---

# 3.4 Telas do Unyx Insight

## 3.4.1 Resumo Gerencial

### Função

Mostrar visão geral do período.

### Indicadores

- total de atrasos
- total de faltas
- total de intervalos vencidos
- total de ocorrências
- média de atraso
- setores com mais alertas

---

## 3.4.2 Relatório de Atrasos

### Função

Analisar atrasos por colaborador, setor e período.

### Deve mostrar

- colaborador
- quantidade de atrasos
- minutos totais de atraso
- média de atraso
- datas dos atrasos

---

## 3.4.3 Relatório de Faltas

### Função

Listar faltas registradas.

### Deve mostrar

- colaborador
- data
- setor
- filial
- observação
- responsável pelo registro

---

## 3.4.4 Relatório de Intervalos

### Função

Acompanhar intervalos iniciados, retornos e atrasos de retorno.

### Deve mostrar

- colaborador
- horário planejado
- horário real
- tempo de intervalo
- atraso de retorno

---

## 3.4.5 Ranking Operacional

### Função

Mostrar colaboradores ou setores com maior incidência de eventos.

### Rankings possíveis

- mais atrasos
- mais faltas
- mais ocorrências
- mais retornos atrasados
- setores com mais alertas

---

## 3.4.6 Auditoria Visual

### Função

Permitir consultar histórico de ações.

### Filtros

- data
- filial
- setor
- colaborador
- usuário
- tipo de evento

---

# 3.5 Regras do Unyx Insight

## Regra 1 — Relatório deve ser simples

Na primeira versão, evitar gráficos complexos.

Começar com cards, tabelas e filtros.

---

## Regra 2 — Toda métrica vem de evento

Os relatórios devem ser baseados em `attendance_events` e `audit_logs`.

---

## Regra 3 — Filtrar por período é obrigatório

Todo relatório deve permitir filtro por data.

---

## Regra 4 — Comparação por setor é valiosa

Setores ajudam o gerente a identificar onde está o problema.

---

# 3.6 Dados principais

Tabelas envolvidas:

- attendance_events
- audit_logs
- employees
- schedules
- operational_status
- branches
- sectors

---

# 3.7 Prioridade de implementação

## MVP obrigatório

- resumo gerencial simples
- relatório de atrasos
- relatório de faltas
- filtro por período

## Depois

- gráficos
- ranking
- exportação CSV/PDF
- comparação entre filiais
- indicadores por mês

---

# 4. Divisão dos Módulos por Plano

---

# Plano Starter

Inclui:

- Unyx Ops básico
- Unyx Control básico

Ideal para:

- pequenos negócios
- uma filial
- poucos colaboradores

---

# Plano Growth

Inclui:

- Unyx Ops completo
- Unyx Control completo
- Unyx Insight básico

Ideal para:

- empresas médias
- mais de uma filial
- operação com supervisores

---

# Plano Enterprise

Inclui:

- Unyx Ops completo
- Unyx Control completo
- Unyx Insight completo
- módulos futuros
- suporte prioritário
- configurações avançadas

Ideal para:

- grandes redes
- multi-filiais
- operação complexa

---

# 5. Organização no Código

Estrutura sugerida:

```txt
src/
 ├── features/
 │   ├── ops/
 │   │   ├── dashboard/
 │   │   ├── operation-day/
 │   │   ├── alerts/
 │   │   └── status/
 │   │
 │   ├── control/
 │   │   ├── branches/
 │   │   ├── sectors/
 │   │   ├── employees/
 │   │   ├── users/
 │   │   └── settings/
 │   │
 │   └── insight/
 │       ├── overview/
 │       ├── delays/
 │       ├── absences/
 │       ├── breaks/
 │       └── audit/
```

---

# 6. Prioridade Real de Construção

## Primeiro

Construir Unyx Control mínimo:

- filial
- setor
- colaborador

Sem isso, o Unyx Ops não tem dados.

---

## Segundo

Construir Unyx Ops:

- escala
- dashboard
- status
- ações

Esse é o valor principal do produto.

---

## Terceiro

Construir Unyx Insight básico:

- atrasos
- faltas
- histórico

Isso ajuda na venda e demonstra valor gerencial.

---

# 7. Resumo Estratégico

## Unyx Ops

Mostra o agora.

## Unyx Control

Organiza a empresa.

## Unyx Insight

Explica o que aconteceu.

Juntos, os três formam o núcleo comercial da Unyx Enterprise.

---

# Unyx Enterprise
## Core Modules Specification

