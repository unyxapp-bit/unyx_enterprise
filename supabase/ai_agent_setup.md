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
- A chave da OpenAI nunca fica no React.
- Se `OPENAI_API_KEY` nao estiver configurada, a funcao retorna um fallback local.
