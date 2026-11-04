# Plano: planos, módulos e cobrança, de ponta a ponta

Status: **rascunho para decisão** (nada implementado). Data: 2026-11-03.

Este plano parte do que já existe: tabelas de módulos e de assinatura, e a tela "Plano e módulos" em Configurações.

## Situação atual (levantada no código)

- Existem as tabelas `modules` (11 módulos), `organization_modules` (quais estão ligados por empresa) e `subscriptions` (plano e status).
- Planos: `starter`, `growth`, `enterprise`. Status: `trial`, `active`, `past_due`, `cancelled`, `suspended`.
- Limites gravados na assinatura: Starter 1 filial / 30 colaboradores; Growth 5 / 150; Enterprise sem limite. Hoje ficam fixos dentro da função SQL `update_organization_plan`.
- No primeiro acesso, todos os módulos ativos nascem ligados para a empresa.
- Em Configurações → "Plano e módulos", proprietário/administrador troca de plano com um clique ("para testar"). Isso cria assinatura com 14 dias de teste, **sem pagamento**.
- Menu e rotas dependem só do papel/permissões do usuário. Não leem `organization_modules` nem o plano.
- Limites de filiais/colaboradores aparecem na tela, mas não achei regra no banco que impeça ultrapassar.
- Não há integração com meio de pagamento nem tela de compra.
- O PDV (venda, caixa, cartazes, fiscal) não tem módulo cadastrado em `modules`.

## Visão geral

Um só lugar responde "o que esta empresa pode usar?", e isso vale em todas as camadas:

```
Pagamento -> Assinatura (status) -> Direitos (módulos + limites) -> Banco (bloqueia) -> App (esconde e explica)
```

## Fase 0 — Decisões (antes de codar)

1. **Matriz plano x módulo e preços.** Criar o módulo "Unyx POS" e decidir em qual plano entra.
2. **Meio de pagamento.** Sugestão: Asaas (Pix, boleto e cartão recorrente, bom webhook). Alternativas: Mercado Pago, Stripe.
3. **Teste grátis:** duração (hoje 14 dias) e o que acontece quando acaba.
4. **Inadimplência:** dias de tolerância; bloqueio total ou só leitura.
5. **Empresas já existentes:** o que fazer com elas (ver Fase 7).

## Fase 1 — Modelo de dados (Supabase)

- **Catálogo de planos:** tabela `plans` com preço, ciclo e limites (hoje fixos em função SQL).
- **Matriz de acesso:** tabela `plan_modules` (plano -> módulo -> nível `basic` ou `full`). Hoje os níveis existem só como texto em `src/lib/coreModules.ts`.
- **Direitos por empresa:** `organization_modules` vira ajuste manual (liberar/bloquear um módulo para uma empresa), somado ao que o plano dá.
- **Função de leitura única:** `org_entitlements(org)` devolve módulos liberados, limites, status e dias de teste restantes. App e banco usam a mesma função.
- **Assinatura:** manter `subscriptions` e acrescentar `gateway_customer_id`, `gateway_subscription_id`, `cancel_at_period_end`, `grace_until`.
- **Cobrança:** `billing_events` (eventos do gateway, id único para idempotência) e `invoices` (histórico de faturas).
- **Falha de segurança a fechar:** `update_organization_plan` hoje deixa qualquer proprietário/administrador trocar de plano de graça. Com cobrança, remover ou restringir ao servidor. Só o webhook do gateway altera o plano.

## Fase 2 — Bloqueio no banco

O bloqueio só no app é contornável chamando a API direto.

- **Limites:** gatilhos em `branches` e `employees` que recusam criar além do limite do plano, com mensagem clara.
- **Módulos:** políticas de segurança por linha nas tabelas de cada módulo, via `has_module(org, 'unyx_x')`. Começar pelos módulos pagos (entregas, comms, game, academy, ai, insight).
- **Status da assinatura:**
  - `suspended` / `cancelled`: empresa somente leitura.
  - `past_due`: continua funcionando até `grace_until`.
  - Só a escrita depende do status; a leitura nunca é bloqueada (o cliente não perde acesso aos próprios dados).

## Fase 3 — Aplicação (front-end)

- **Hook `useEntitlements()`** chamando `org_entitlements`; alimenta tudo abaixo.
- **Mapa rota -> módulo** em `src/app/layout/navConfig.ts`:

  | Rotas | Módulo |
  |---|---|
  | dashboard, alertas, escalas, anotações | `unyx_ops` |
  | mapa de postos | `unyx_allocation` |
  | checklists | `unyx_checklists` |
  | clientes | `unyx_customers` |
  | entregas | `unyx_deliveries` |
  | relatórios, auditoria | `unyx_insight` |
  | filiais, colaboradores, usuários, configurações | `unyx_control` |
  | PDV, caixa, cartazes, fiscal | `unyx_pos` (novo) |
  | comms, game, academy, ai | módulo de mesmo nome |

- **Menu e Início:** módulo não liberado aparece com cadeado (não some), para estimular a compra. Acesso rápido e cartões do Início respeitam isso.
- **Rotas:** novo `RequireModule` ao lado do `RequirePermission`. Módulo não liberado abre página "Disponível no plano X" com botão "Ver planos".
- **Limites na tela:** nos cadastros de filial e colaborador, mostrar "18 de 30 colaboradores"; no limite, trocar o botão por "Aumentar plano".
- **Faixas de aviso:** "Faltam 3 dias de teste", "Pagamento em atraso, regularize até dd/mm".

## Fase 4 — Cobrança (gateway)

Tudo que usa chave secreta roda em Supabase Edge Functions, nunca no navegador.

- `create-checkout`: cria cliente e assinatura no gateway, devolve a URL de pagamento.
- `billing-webhook`: recebe eventos (pago, atrasado, cancelado, estornado), valida a assinatura do webhook, grava em `billing_events` (idempotente) e atualiza `subscriptions` e `plan`.
- `change-plan` e `cancel-subscription`: upgrade, downgrade e cancelamento no fim do ciclo.
- **Downgrade:** só permitir se a empresa estiver dentro dos limites do plano menor; mostrar a lista do que precisa ser desativado.
- **Inadimplência:** cron diário move `past_due` para `suspended` quando `grace_until` vence e dispara e-mail de aviso.
- Segredos e URL do webhook configurados no Supabase, com sandbox e produção separados.

## Fase 5 — Telas de assinatura

Em Configurações, o card "Plano e módulos" deixa de ser seletor de teste e passa a ter:

- Plano atual, status, próxima cobrança e dias de teste.
- Uso contra limites (filiais, colaboradores) com barra de progresso.
- Comparativo de planos e botão "Assinar" / "Mudar de plano" (leva ao checkout).
- Histórico de faturas e botão de cancelar.
- Escolha de plano no onboarding (primeiro acesso), já com teste grátis.

Visível só para proprietário e administrador, como hoje.

## Fase 6 — Administração interna

Jeito de liberar módulo ou estender teste para um cliente sem passar pelo gateway (cortesia, negociação, suporte). Pode ser uma tela restrita ou, no começo, um script SQL documentado. Toda alteração manual gera registro de auditoria.

## Fase 7 — Migração e lançamento

- **Empresas existentes:** sugestão de "plano de legado" com todos os módulos por um prazo (por exemplo 60 dias), com aviso antes de começar a cobrar.
- **Ordem segura de ligar:**
  1. Criar tabelas e funções, sem bloquear nada.
  2. Gravar direitos para todas as empresas.
  3. Ligar o bloqueio no app (só esconde).
  4. Ligar o bloqueio no banco.
  5. Ligar a cobrança.
- **Chave de desligamento** do bloqueio, para uso se algo der errado em produção.
- Fora do código, mas necessário: termos de uso, política de cobrança e emissão da nota fiscal da mensalidade.

## Fase 8 — Testes

- **Banco:** gatilhos de limite e políticas por módulo.
- **Webhook:** eventos simulados (pago, atrasado, cancelado, duplicado, fora de ordem) no sandbox.
- **E2E:** módulo bloqueado mostra a página de upgrade; limite recusa o 31º colaborador; empresa suspensa fica somente leitura; upgrade libera as telas.
- Fluxo completo manual com cartão e Pix de teste.

## Ordem sugerida e tamanho

| Etapa | Fases | Esforço | Entrega visível |
|---|---|---|---|
| A | 0, 1 | Médio | Nada ainda; base pronta |
| B | 3 (menu, rotas, limites) | Médio | Planos passam a valer na tela |
| C | 2 | Médio | Bloqueio real, à prova de contorno |
| D | 4, 5 | Grande | Cobrança funcionando |
| E | 6, 7, 8 | Médio | Operação e lançamento |

As etapas A a C já dão valor sem gateway: dá para vender manualmente enquanto a cobrança automática não fica pronta.

## Riscos principais

- **Bloquear cliente pagante por erro** (webhook perdido ou fora de ordem). Mitigação: eventos idempotentes, tolerância antes de suspender e chave de desligamento.
- **Esquecer alguma tabela nas políticas por módulo.** Mitigação: lista por módulo e teste automatizado.
- **Downgrade que deixa a empresa acima do limite.** Mitigação: validação da Fase 4.

## Pendente: decisões do dono do produto

1. **Gateway:** Asaas, Mercado Pago ou Stripe?
2. **Matriz e preços:** o que entra em cada plano, incluindo o módulo PDV, e quanto custa cada um (podem ser valores provisórios).
3. **Teste grátis:** 14 dias como hoje? Bloqueio ao fim: total ou somente leitura?
4. **Empresas existentes:** aceita 60 dias de plano de legado?

Com essas respostas, o trabalho começa pela etapa A.
