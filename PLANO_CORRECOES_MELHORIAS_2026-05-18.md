# Plano de correcoes e melhorias - Unyx Enterprise

Data: 2026-05-18

## Objetivo

Transformar o app de um MVP operacional amplo em uma plataforma mais confiavel para uso diario, com dados consistentes, fluxos operacionais claros, IA mais ativa e base tecnica mais facil de manter.

## Fase 0 - Ja iniciado

Status: em andamento.

- Corrigir lint da tela de IA.
- Expor no menu os fluxos existentes de Alocacao e Intervalos.
- Criar script `npm test` e registrar Vitest como dependencia de desenvolvimento.
- Adicionar teste para garantir que sangria de caixa seja opcional por padrao.
- Corrigir teste antigo de conversao de horario.
- Aplicar lazy loading nas paginas para reduzir o bundle inicial.
- Atualizar dependencias vulneraveis via `npm audit fix`.

## Fase 1 - Confiabilidade operacional diaria

Prioridade maxima.

- Garantir que sempre exista escala do dia quando a operacao abrir.
- Criar acao de "gerar/copiar escala para hoje" quando o dashboard detectar dia sem escala.
- Consolidar a regra de "quem esta realmente trabalhando" entre Dashboard, Operacoes, IA e Alocacao.
- Criar painel de pendencias operacionais:
  - colaboradores sem entrada;
  - intervalos vencidos;
  - postos sem cobertura;
  - alocados sem escala vinculada;
  - caixas/sessoes abertas;
  - entregas ou producoes atrasadas.
- Melhorar mensagens quando o sistema nao tem dados suficientes, em vez de mostrar zeros sem contexto.

## Fase 2 - Fluxos operacionais

Prioridade alta.

- Decidir se Alocacao e Intervalos continuam como telas separadas ou se viram subabas de Operacoes.
- Padronizar os eventos operacionais:
  - entrada;
  - atraso;
  - intervalo solicitado;
  - intervalo iniciado;
  - intervalo ja feito;
  - retorno;
  - saida;
  - sangria opcional;
  - troca de caixa opcional;
  - ocorrencia.
- Criar testes para os principais fluxos de status.
- Adicionar confirmacoes visuais mais claras apos cada acao.
- Registrar motivo quando uma acao operacional for bloqueada.

## Fase 3 - IA como agente ativo

Prioridade alta depois da Fase 1.

- Criar uma fila de acoes sugeridas pela IA.
- Separar sugestoes em:
  - informativas;
  - requerem aprovacao;
  - executaveis automaticamente.
- Permitir que a IA proponha:
  - alocacao de colaborador;
  - troca de posto;
  - relatorio de atrasos;
  - abertura de ocorrencia;
  - alerta para gestor;
  - checklist recomendado;
  - pendencia de escala.
- Salvar toda decisao da IA com:
  - contexto usado;
  - motivo;
  - usuario que aprovou;
  - acao executada;
  - resultado.
- Criar limite de seguranca: IA nunca deve alterar dados sensiveis sem aprovacao humana.

## Fase 4 - Relatorios e gestao

Prioridade media.

- Relatorio por colaborador.
- Relatorio por filial.
- Relatorio por setor.
- Ranking de atrasos, faltas e ocorrencias.
- Comparativo entre periodos.
- Exportacao CSV/PDF.
- Visao de reincidencia.
- Auditoria mais amigavel para gestor.

## Fase 5 - Manutencao tecnica

Prioridade continua.

- Quebrar arquivos grandes:
  - `unyxApi.ts`;
  - `useUnyxData.ts`;
  - `PosSellPage.tsx`;
  - `PosProductsPage.tsx`;
  - `AllocationPage.tsx`;
  - `DashboardPage.tsx`.
- Criar testes para hooks e RPCs criticos.
- Separar services por dominio:
  - ops;
  - control;
  - pos;
  - insight;
  - ai.
- Melhorar code splitting de bibliotecas pesadas, principalmente graficos.
- Criar pipeline de qualidade com lint, build, tests e audit.

## Proximo bloco recomendado

Status do bloco anterior: concluido em 2026-05-18.

- Detectado dia sem escala no Dashboard e Operacoes.
- Chamada para copiar a ultima escala valida foi criada.
- IA passou a avisar explicitamente quando falta escala do dia.
- Tela Alocacao foi reposicionada como Mapa de postos, evitando duplicacao com Operacao.

Status do bloco de pendencias: em andamento em 2026-05-19.

- Consolidado painel de pendencias operacionais na tela Operacao.
- Removidas acoes de sangria da tela Postos; sangria ficou no fluxo de Operacao.
- Painel agora considera caixas abertos, entregas atrasadas e producao atrasada.
- IA recebeu o mesmo atalho de copiar ultima escala quando nao houver escala do dia.
- Agente bloqueia proposta de alocacao sem escala e orienta criar/copiar a escala primeiro.
- IA agora recebe um resumo consolidado das pendencias da tela Operacao no contexto do agente.

Proximo bloco recomendado:

1. Padronizar os eventos operacionais e cobrir os fluxos principais com testes.
2. Registrar motivo quando uma acao operacional for bloqueada.
3. Melhorar confirmacoes visuais apos entrada, intervalo, retorno, saida e sangria.
4. Ampliar acoes sugeridas da IA a partir das pendencias ja detectadas.

Status do bloco IA/fluxo: concluido em 2026-05-20.

- Criada a tabela `ai_agent_actions` para fila real de acoes sugeridas, prontas, pendentes de aprovacao, executadas, bloqueadas, com falha ou descartadas.
- A Edge Function `ai-agent` passou a salvar cada plano relevante na fila com contexto, motivo, argumentos, resultado e status.
- Tela Unyx AI passou a exibir a fila de acoes, executar/confirmar itens prontos e descartar itens que nao serao usados.
- Acoes operacionais bloqueadas passaram a gerar auditoria com motivo, colaborador, escala e evento solicitado.
- Confirmacoes visuais de eventos operacionais passaram a usar o nome real do evento.
- Testes de fluxo foram ampliados para os status fiscal/PDV `pico`, `apoio_operacional` e `fechamento`.
- Relatorios passaram a filtrar e resumir eventos por filial e setor, mantendo exportacao CSV com essas dimensoes.

Proximo bloco recomendado:

1. Evoluir relatorios por colaborador, filial e setor com visao de reincidencia.
2. Melhorar auditoria gerencial com filtros e detalhes mais legiveis dos motivos.
3. Quebrar `unyxApi.ts` e `useUnyxData.ts` em services/hooks por dominio.
4. Adicionar testes para hooks criticos e chamadas RPC.
