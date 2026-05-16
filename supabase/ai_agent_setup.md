# Unyx AI Agent

Edge Function: `ai-agent`

## Secrets

Configure a chave da OpenAI somente no Supabase:

```bash
npm run supabase:secrets:set
```

Use `supabase/.env.local` como base local. Ele deve seguir `supabase/.env.example` e nao deve ser commitado.

`OPENAI_MODEL` e opcional. Se nao for definido, a funcao usa `gpt-5.4-mini`, que e o padrao recomendado aqui por custo e disponibilidade.

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
