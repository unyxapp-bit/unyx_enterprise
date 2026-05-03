# Unyx Enterprise
## README — Implantação do Unyx POS

---

# 1. Visão Geral

O **Unyx POS** será o módulo de PDV da plataforma Unyx Enterprise.

Ele nasce para atender empresas que ainda não possuem um sistema próprio de vendas, principalmente pequenos e médios negócios locais.

A proposta não é criar apenas um PDV comum, mas sim um **PDV integrado à operação da empresa**.

---

# 2. Conceito Principal

A maioria dos sistemas de PDV controla apenas a venda.

O Unyx POS deve controlar:

- venda
- caixa
- operador
- posto/PDV
- sangria
- sessão de caixa
- histórico
- integração com operação

Ou seja:

```txt
PDV tradicional = venda isolada
Unyx POS = venda + operação + alocação + auditoria
```

---

# 3. Posicionamento do Módulo

## Nome

# Unyx POS

## Função

Sistema de ponto de venda modular integrado ao Unyx Ops.

## Público inicial

- supermercados pequenos
- mercadinhos
- lojas de varejo
- farmácias pequenas
- restaurantes simples
- conveniências
- atacarejos locais

---

# 4. Objetivo do Unyx POS

Criar uma solução simples, funcional e integrada para empresas que precisam vender, controlar caixa e organizar a operação.

O foco inicial é:

- registrar vendas
- controlar pagamentos
- abrir e fechar caixa
- vincular operador ao PDV
- registrar sangria
- alimentar o dashboard operacional

---

# 5. O que diferencia o Unyx POS

## 5.1 Integração com Unyx Allocation

Quando o operador abre o caixa, o sistema pode automaticamente vincular esse operador a um posto/PDV.

Exemplo:

```txt
Maria abriu o Caixa 02
↓
Maria fica alocada no Caixa 02
↓
O Dashboard mostra Caixa 02 coberto
```

---

## 5.2 Integração com Unyx Ops

O Unyx Ops usa as informações do POS para entender a operação.

Exemplo:

```txt
Caixa 03 está aberto, mas sem operador
↓
Alerta crítico no painel operacional
```

---

## 5.3 Integração com Unyx Insight

Os dados de venda e caixa alimentam relatórios.

Exemplos:

- vendas por operador
- vendas por PDV
- movimentações de caixa
- sangrias realizadas
- horários de maior movimento

---

# 6. Estrutura Modular

O Unyx POS deve ser organizado por módulos internos.

```txt
Unyx POS
 ├── Produtos
 ├── Carrinho
 ├── Vendas
 ├── Pagamentos
 ├── Sessão de Caixa
 ├── Movimentos de Caixa
 ├── Histórico
 └── Integração Operacional
```

---

# 7. Core comum do PDV

Essas funções são comuns para todos os segmentos.

## 7.1 Produtos

Funções:

- cadastrar produto
- editar produto
- pesquisar produto
- buscar por código de barras
- definir preço
- definir categoria
- ativar/desativar produto

---

## 7.2 Carrinho

Funções:

- adicionar produto
- remover produto
- alterar quantidade
- calcular subtotal
- aplicar desconto simples
- limpar venda
- manter venda em andamento

---

## 7.3 Venda

Funções:

- iniciar venda
- adicionar itens
- calcular total
- cancelar venda
- finalizar venda
- salvar histórico

---

## 7.4 Pagamento

Funções:

- pagamento em dinheiro
- pagamento em Pix
- pagamento em cartão
- pagamento misto futuramente
- validar valor pago
- calcular troco
- confirmar pagamento

---

## 7.5 Caixa

Funções:

- abrir caixa
- fechar caixa
- informar valor inicial
- registrar valor final
- registrar sangria
- registrar reforço de troco
- controlar sessão por operador

---

# 8. Módulos por segmento

---

# 8.1 Supermercado

## Foco

Venda rápida, leitura por código de barras, caixa contínuo e sangria.

## Funções importantes

- leitura rápida de código de barras
- busca de produto por nome
- venda de múltiplos itens
- sangria integrada
- cancelamento rápido
- operador vinculado ao PDV
- caixa sem cobertura como alerta operacional

## Fluxo principal

```txt
1. Operador abre caixa
2. Sistema cria sessão
3. Operador passa produtos
4. Sistema calcula total
5. Cliente paga
6. Venda é finalizada
7. Caixa continua aberto
8. Sangria pode ser registrada
9. Fechamento ocorre no fim do turno
```

---

# 8.2 Varejo / Loja

## Foco

Venda assistida, cliente e desconto.

## Funções importantes

- busca de produto
- cliente opcional
- desconto por item ou venda
- pagamento parcelado futuramente
- histórico de compras
- vendedor responsável

## Fluxo principal

```txt
1. Vendedor inicia atendimento
2. Produtos são adicionados
3. Cliente pode ser vinculado
4. Desconto pode ser aplicado
5. Pagamento é confirmado
6. Venda é finalizada
```

---

# 8.3 Restaurante

## Foco

Pedido, mesa, comanda e cozinha.

## Funções importantes

- pedido por mesa
- comanda
- status do pedido
- envio para cozinha futuramente
- pagamento por mesa
- fechamento de comanda

## Fluxo principal

```txt
1. Atendente abre mesa/comanda
2. Itens são adicionados
3. Pedido é enviado para preparo
4. Mesa continua aberta
5. Cliente pede fechamento
6. Pagamento é registrado
7. Comanda é encerrada
```

---

# 8.4 Farmácia

## Foco

Atendimento assistido, balcão e responsabilidade.

## Funções importantes

- venda assistida
- atendente responsável
- cliente opcional
- produtos controlados futuramente
- presença do responsável técnico no painel
- histórico de atendimento

## Fluxo principal

```txt
1. Atendente inicia venda
2. Produto é buscado
3. Cliente pode ser vinculado
4. Pagamento é registrado
5. Venda é finalizada
6. Histórico fica salvo
```

---

# 9. O que entra no MVP do Unyx POS

A primeira versão deve ser simples e funcional.

## MVP obrigatório

- cadastro de produtos
- tela de PDV
- carrinho
- finalização de venda
- formas de pagamento básicas
- abertura de caixa
- fechamento de caixa
- sangria simples
- histórico de vendas
- vínculo com operador
- vínculo com PDV/posto

---

# 10. O que não entra no MVP

Para evitar complexidade excessiva, deixar para depois:

- NFC-e / emissão fiscal
- integração com SEFAZ
- integração com balança
- TEF/cartão integrado
- controle fiscal avançado
- estoque completo
- compras e fornecedores
- preço por tabela
- promoção avançada
- delivery completo
- comanda avançada
- integração com ERP externo

Nesta fase, o foco é validar operação e venda básica.

---

# 11. Banco de dados — tabelas principais

---

# 11.1 products

Tabela de produtos.

```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  name text not null,
  barcode text,
  sku text,
  category text,
  unit text not null default 'un',
  price numeric(12,2) not null default 0,
  cost_price numeric(12,2),
  stock_quantity numeric(12,3) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_products_organization on public.products(organization_id);
create index idx_products_branch on public.products(branch_id);
create index idx_products_barcode on public.products(barcode);
create index idx_products_name on public.products(name);
```

---

# 11.2 cash_sessions

Representa uma abertura de caixa por operador e posto.

```sql
create type public.cash_session_status as enum (
  'open',
  'closed',
  'cancelled'
);

create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  post_id uuid references public.operational_posts(id) on delete set null,
  user_profile_id uuid references public.user_profiles(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  initial_amount numeric(12,2) not null default 0,
  expected_amount numeric(12,2) not null default 0,
  final_amount numeric(12,2),
  difference_amount numeric(12,2),
  status public.cash_session_status not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_cash_sessions_organization on public.cash_sessions(organization_id);
create index idx_cash_sessions_branch on public.cash_sessions(branch_id);
create index idx_cash_sessions_post on public.cash_sessions(post_id);
create index idx_cash_sessions_status on public.cash_sessions(status);
```

---

# 11.3 sales

Representa a venda.

```sql
create type public.sale_status as enum (
  'draft',
  'completed',
  'cancelled',
  'refunded'
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  cash_session_id uuid references public.cash_sessions(id) on delete set null,
  post_id uuid references public.operational_posts(id) on delete set null,
  user_profile_id uuid references public.user_profiles(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  customer_name text,
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  status public.sale_status not null default 'draft',
  sold_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_sales_organization on public.sales(organization_id);
create index idx_sales_branch on public.sales(branch_id);
create index idx_sales_session on public.sales(cash_session_id);
create index idx_sales_sold_at on public.sales(sold_at desc);
```

---

# 11.4 sale_items

Itens da venda.

```sql
create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity numeric(12,3) not null default 1,
  unit_price numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index idx_sale_items_sale on public.sale_items(sale_id);
create index idx_sale_items_product on public.sale_items(product_id);
```

---

# 11.5 sale_payments

Pagamentos da venda.

```sql
create type public.payment_method as enum (
  'cash',
  'pix',
  'debit_card',
  'credit_card',
  'voucher',
  'other'
);

create type public.payment_status as enum (
  'pending',
  'confirmed',
  'cancelled'
);

create table public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  method public.payment_method not null,
  amount numeric(12,2) not null,
  change_amount numeric(12,2) not null default 0,
  status public.payment_status not null default 'confirmed',
  paid_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index idx_sale_payments_sale on public.sale_payments(sale_id);
create index idx_sale_payments_method on public.sale_payments(method);
```

---

# 11.6 pos_cash_movements

Movimentos do caixa dentro do POS.

```sql
create type public.pos_cash_movement_type as enum (
  'sale_cash_in',
  'cash_out',
  'cash_in',
  'sangria',
  'change_reinforcement',
  'adjustment'
);

create table public.pos_cash_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  cash_session_id uuid not null references public.cash_sessions(id) on delete cascade,
  post_id uuid references public.operational_posts(id) on delete set null,
  movement_type public.pos_cash_movement_type not null,
  amount numeric(12,2) not null,
  created_by uuid references public.user_profiles(id) on delete set null,
  occurred_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index idx_pos_cash_movements_session on public.pos_cash_movements(cash_session_id);
create index idx_pos_cash_movements_type on public.pos_cash_movements(movement_type);
```

---

# 12. Relação com tabelas existentes

O Unyx POS se conecta com:

- organizations
- branches
- sectors
- employees
- user_profiles
- operational_posts
- post_allocations
- attendance_events
- audit_logs

---

# 13. Fluxo completo do PDV

## 13.1 Abertura de caixa

```txt
1. Usuário faz login
2. Seleciona filial
3. Seleciona PDV/posto
4. Informa valor inicial
5. Sistema cria cash_session
6. Sistema pode criar alocação do operador no posto
7. Dashboard mostra PDV coberto
```

---

## 13.2 Venda

```txt
1. Operador inicia venda
2. Adiciona produto por código ou busca
3. Carrinho calcula subtotal
4. Desconto opcional é aplicado
5. Operador vai para pagamento
6. Pagamento é confirmado
7. Venda é marcada como completed
8. Itens são gravados em sale_items
9. Pagamentos são gravados em sale_payments
10. Movimento de caixa é registrado se for dinheiro
```

---

## 13.3 Sangria

```txt
1. Operador ou fiscal solicita sangria
2. Informa valor e observação
3. Sistema registra pos_cash_movements
4. Sistema também pode registrar cash_movements operacional
5. Auditoria é criada
```

---

## 13.4 Fechamento de caixa

```txt
1. Operador informa valor final
2. Sistema calcula valor esperado
3. Sistema calcula diferença
4. Caixa é marcado como closed
5. Dashboard remove alocação ou mantém conforme regra
6. Auditoria é registrada
```

---

# 14. Telas necessárias

## 14.1 Produtos

Rota:

```txt
/pos/products
```

Funções:

- listar produtos
- cadastrar produto
- editar produto
- ativar/desativar produto
- buscar por nome
- buscar por código de barras

---

## 14.2 PDV

Rota:

```txt
/pos/sell
```

Funções:

- campo principal para código de barras
- busca rápida de produto
- carrinho lateral
- alterar quantidade
- remover item
- desconto simples
- finalizar venda

---

## 14.3 Pagamento

Rota ou modal:

```txt
/pos/payment
```

Funções:

- escolher forma de pagamento
- informar valor pago
- calcular troco
- confirmar pagamento
- finalizar venda

---

## 14.4 Abertura de Caixa

Rota:

```txt
/pos/open-cash
```

Funções:

- selecionar PDV
- informar valor inicial
- abrir sessão
- vincular operador

---

## 14.5 Fechamento de Caixa

Rota:

```txt
/pos/close-cash
```

Funções:

- mostrar vendas do caixa
- mostrar dinheiro esperado
- informar valor contado
- calcular diferença
- fechar sessão

---

## 14.6 Movimentos de Caixa

Rota:

```txt
/pos/cash-movements
```

Funções:

- sangria
- reforço de troco
- entrada manual
- saída manual
- histórico do caixa

---

## 14.7 Histórico de Vendas

Rota:

```txt
/pos/sales
```

Funções:

- listar vendas
- filtrar por data
- filtrar por operador
- filtrar por PDV
- ver detalhes da venda
- cancelar venda futuramente

---

# 15. Estrutura no React

```txt
src/
 ├── features/
 │   ├── pos/
 │   │   ├── products/
 │   │   │   ├── pages/
 │   │   │   ├── components/
 │   │   │   ├── hooks/
 │   │   │   ├── services/
 │   │   │   └── types.ts
 │   │   │
 │   │   ├── sales/
 │   │   │   ├── pages/
 │   │   │   ├── components/
 │   │   │   ├── hooks/
 │   │   │   ├── services/
 │   │   │   └── types.ts
 │   │   │
 │   │   ├── cash/
 │   │   │   ├── pages/
 │   │   │   ├── components/
 │   │   │   ├── hooks/
 │   │   │   ├── services/
 │   │   │   └── types.ts
 │   │   │
 │   │   └── shared/
 │   │       ├── PosLayout.tsx
 │   │       ├── ProductSearch.tsx
 │   │       ├── CartPanel.tsx
 │   │       └── PaymentDialog.tsx
```

---

# 16. Serviços necessários

## productsService.ts

Funções:

```txt
getProducts()
getProductByBarcode()
createProduct()
updateProduct()
deactivateProduct()
```

## salesService.ts

Funções:

```txt
createDraftSale()
addSaleItem()
removeSaleItem()
updateSaleItemQuantity()
completeSale()
cancelSale()
getSalesHistory()
```

## paymentsService.ts

Funções:

```txt
createPayment()
confirmPayment()
getPaymentsBySale()
```

## cashSessionsService.ts

Funções:

```txt
openCashSession()
closeCashSession()
getCurrentCashSession()
getCashSessionsByDate()
```

## posCashMovementsService.ts

Funções:

```txt
createCashMovement()
createSangria()
createChangeReinforcement()
getCashMovementsBySession()
```

---

# 17. Hooks necessários

```txt
useProducts
useProductSearch
useCart
useCurrentSale
useCompleteSale
useCashSession
useOpenCashSession
useCloseCashSession
usePosCashMovements
useSalesHistory
```

---

# 18. Integração com Allocation

## Ao abrir caixa

O sistema deve verificar:

```txt
Existe PDV selecionado?
Existe operador logado?
Existe sessão aberta?
```

Se tudo estiver correto:

```txt
criar cash_session
criar ou atualizar post_allocation
marcar PDV como coberto
```

---

# 19. Integração com Ops

O Dashboard operacional deve mostrar:

- PDVs abertos
- PDVs sem operador
- operadores em caixa
- sangrias pendentes
- caixas em fechamento

---

# 20. Integração com Insight

Relatórios iniciais:

- vendas por dia
- vendas por operador
- vendas por PDV
- total por forma de pagamento
- sangrias por operador
- diferenças de caixa

---

# 21. Regras importantes

## Regra 1 — Não vender sem caixa aberto

O operador só pode vender se existir uma sessão de caixa aberta.

## Regra 2 — Uma sessão aberta por operador/posto

Evitar que o mesmo operador tenha vários caixas abertos ao mesmo tempo.

## Regra 3 — Venda finalizada não deve ser alterada

Depois de `completed`, qualquer mudança deve ser cancelamento ou ajuste registrado.

## Regra 4 — Toda venda precisa de pagamento confirmado

A venda só muda para `completed` quando o pagamento for confirmado.

## Regra 5 — Movimentos de dinheiro entram no caixa

Pagamento em dinheiro, sangria e reforço alteram o esperado do caixa.

## Regra 6 — Tudo importante gera auditoria

Abrir caixa, fechar caixa, sangria, cancelamento e venda finalizada devem gerar `audit_logs`.

---

# 22. Ordem correta de implantação

```txt
1. Criar tabelas SQL do POS
2. Criar RLS
3. Criar tela de produtos
4. Criar abertura de caixa
5. Criar tela de PDV com carrinho local
6. Criar finalização de venda
7. Criar pagamentos
8. Criar fechamento de caixa
9. Criar sangria/reforço
10. Integrar com Allocation
11. Integrar com Dashboard Ops
12. Criar histórico de vendas
13. Criar relatórios simples no Insight
```

---

# 23. Ordem dentro do MVP total

Com o POS, a ordem geral da plataforma fica:

```txt
Unyx Control
↓
Unyx Allocation
↓
Unyx POS
↓
Unyx Ops
↓
Unyx Insight
```

Motivo:

- Control cria empresa, filial, usuário e colaborador
- Allocation cria PDV/posto
- POS usa PDV/posto para abrir caixa
- Ops acompanha a operação
- Insight analisa os resultados

---

# 24. Dados de teste recomendados

Criar:

- 1 organização
- 1 filial
- setor Frente de Caixa
- 4 PDVs
- 4 operadores
- 20 produtos
- 1 caixa aberto
- 5 vendas simuladas
- 1 sangria
- 1 fechamento de caixa

---

# 25. Critério de sucesso do MVP POS

O Unyx POS estará funcional quando for possível:

1. Cadastrar produtos.
2. Abrir caixa em um PDV.
3. Vincular operador ao caixa.
4. Adicionar produtos ao carrinho.
5. Finalizar venda.
6. Registrar pagamento.
7. Calcular troco em dinheiro.
8. Registrar sangria.
9. Fechar caixa.
10. Ver histórico de vendas.
11. Ver PDV coberto no Dashboard Operacional.
12. Ver relatório simples no Insight.

---

# 26. Evolução futura

Depois do MVP:

## Fase 2 do POS

- pagamento misto
- cancelamento com motivo
- desconto com permissão
- impressão de recibo
- leitura por scanner físico
- atalhos de teclado

## Fase 3 do POS

- estoque básico
- relatório financeiro
- cadastro de clientes
- promoções simples
- venda suspensa

## Fase 4 do POS

- NFC-e
- integração fiscal
- TEF
- integração com balança
- integração com ERP

---

# 27. Atenção importante sobre fiscal

O Unyx POS no MVP não deve prometer emissão fiscal.

Nesta fase, ele será um PDV operacional e gerencial.

A parte fiscal deve ser tratada como módulo futuro, porque envolve:

- SEFAZ
- certificado digital
- NFC-e
- regras estaduais
- contingência
- cancelamento fiscal
- inutilização

---

# 28. Resumo final

O Unyx POS deve nascer simples, mas muito bem integrado.

Ele não será apenas uma tela de venda.

Ele será o ponto onde operação, caixa, operador e painel se conectam.

```txt
Venda acontece no POS
Operador aparece no Allocation
Status aparece no Ops
Resultado aparece no Insight
```

Esse é o diferencial real da Unyx Enterprise.

---

# Unyx Enterprise
## Unyx POS Implementation Guide

