# Unyx AI Agent

Edge Function: `ai-agent`

## Secrets

Configure a chave da OpenAI somente no Supabase:

```bash
npm run supabase:secrets:set
```

Use `supabase/.env.local` como base local. Ele deve seguir `supabase/.env.example` e nao deve ser commitado.

`OPENAI_MODEL` e opcional. Se nao for definido, a funcao usa `gpt-5.4-mini`, que e o padrao recomendado aqui por custo e disponibilidade.

`AI_PROVIDER_MODE` controla quando a funcao chama a OpenAI:

- `local` ou vazio: padrao atual; usa regras locais e consultas diretas no Supabase, sem gastar limite da OpenAI.
- `openai` ou `auto`: usa a OpenAI quando a resposta nao for uma acao local ou consulta direta.
- `off`: equivalente a local, mantendo tudo sem chamada externa.

## Login e link

```bash
npm run supabase:login
npm run supabase:link -- <project-ref>
```

## Deploy

```bash
npm run supabase:functions:deploy
```

O deploy usa `--use-api`, entao nao depende do Docker para publicar a Edge Function.

## Como funciona

- O frontend chama `supabase.functions.invoke("ai-agent")`.
- A funcao valida o JWT do usuario.
- A funcao respeita permissao `ai` e escopo de filial.
- A funcao busca dados operacionais no Supabase com RLS.
- O contexto do agente e compacto e inclui, quando disponivel:
  - estrutura da organizacao: filiais, setores e configuracoes operacionais;
  - operacao do dia: dashboard, status, escalas, eventos de presenca, colaboradores, postos e alocacoes;
  - suporte de loja: checklists, anotacoes, formularios, respostas, cartazes e comunicados;
  - entregas e clientes: pedidos recentes, prioridades, status, clientes recentes e bloqueados;
  - PDV e retaguarda: caixas, vendas do dia, pedidos de producao, documentos fiscais, produtos com estoque baixo e categorias;
  - gestao: treinamentos ativos e auditoria recente.
- O modelo recebe resumos, contagens e amostras recentes para evitar estourar limite de tokens; a funcao mantem dados completos suficientes para relatorios e acoes locais.
- Perguntas com horario ou posto/caixa, como "quem entra hoje as 11:20?" ou "quem esta no caixa 101?", ativam uma consulta direta em `schedules`, `operational_posts`, `post_allocations` e `cash_sessions`; essa resposta nao depende da amostra enviada ao modelo.
- Por padrao, o agente roda em modo local para evitar limite/custo de API; a OpenAI so e chamada se `AI_PROVIDER_MODE` for configurado como `openai` ou `auto`.
- A intencao `analyze` gera riscos, recomendacoes e proxima acao.
- A intencao `resolve` gera um plano assistido para prioridade alta/critica.
- A intencao `act` executa ferramentas permitidas pelo backend.
- A ferramenta `generate_delay_report` gera relatorio de atrasos automaticamente.
- A ferramenta `allocate_post` prepara uma alocacao e so grava apos confirmacao humana.
- Cada execucao salva um snapshot em `ai_agent_snapshots`.
- Ao abrir a tela, o app carrega o ultimo snapshot da organizacao/filial e usa realtime para refletir novas execucoes em outros computadores.
- O botao "Aplicar como tarefa" registra o plano como anotacao operacional em revisao.
- A chave da OpenAI nunca fica no React.
- Se `OPENAI_API_KEY` nao estiver configurada, a funcao retorna um fallback local.
