# Unyx AI Agent

Edge Function: `ai-agent`

## Secrets

Configure a chave da OpenAI somente no Supabase:

```bash
supabase secrets set OPENAI_API_KEY="sua_chave_openai"
supabase secrets set OPENAI_MODEL="gpt-5.5"
```

`OPENAI_MODEL` e opcional. Se nao for definido, a funcao usa `gpt-5.5`.

## Deploy

```bash
supabase functions deploy ai-agent
```

## Como funciona

- O frontend chama `supabase.functions.invoke("ai-agent")`.
- A funcao valida o JWT do usuario.
- A funcao respeita permissao `ai` e escopo de filial.
- A funcao busca dados operacionais no Supabase com RLS.
- A chave da OpenAI nunca fica no React.
- Se `OPENAI_API_KEY` nao estiver configurada, a funcao retorna um fallback local.
