# Padroes de tela - Unyx Enterprise

Lista do que foi padronizado na tela de **Formularios** e nos componentes
compartilhados. Use como checklist ao revisar as demais telas.

Legenda: [x] aplicado em Formularios · [ ] pendente nas outras telas.

## Componentes compartilhados

### 1. Seletores: `Select` e `Combobox`
Arquivo: `src/components/ui/select.tsx`

- Defeito: `<select>` e `<datalist>` nativos sao desenhados pelo navegador
  (lista branca, sem tema escuro, diferente em cada tela).
- Padrao: `Select` (lista fechada) e `Combobox` (texto livre com sugestoes).
- Opcao com valor vazio (`""`) funciona normalmente (ex.: "Toda empresa").
- Como achar pendencias: `grep -rn "<select\|datalist" src`
- [x] Formularios, Anotacoes · [ ] demais telas (21 arquivos ainda usam `<select>`).

### 2. Cabecalho de pagina: `PageHeader large`
Arquivo: `src/components/shared/PageHeader.tsx`

- Defeito do cabecalho antigo: titulo pequeno, descricao na mesma linha e
  cortada com "...", botao de acao colado ao texto.
- Padrao `large`: titulo maior, descricao embaixo, acao a direita.
- Uso: `<PageHeader large title=... description=... action=... />`
- [x] Formularios, Anotacoes, Dashboard, Alertas, Editor de cartazes, Checklists, Mapa de caixas, Escalas, Configurações, Filiais e Setores, Clientes, Colaboradores, Usuários · [ ] demais telas (23).

### 3. Cards de estatistica compactos
- Sem altura minima, icone `size-7`, numero `text-base`, descricao no `title`
  (tooltip). 4 colunas a partir de `lg`, 2 no celular.
- Conteudo alinhado a esquerda.
- Como achar pendencias: cards com `min-h-20` / `size-9`.
- [x] Formularios · [ ] Dashboard e demais telas.

### 4. Abas de visao centralizadas
- Barra de abas (Responder / Modelos / Respostas) com `mx-auto`.
- [x] Formularios · [ ] telas com abas semelhantes.

### 5. Tratamento de erro: `ErrorBoundary`
Arquivo: `src/components/shared/ErrorBoundary.tsx`

- Defeito: um erro ao renderizar (ou falha ao carregar uma tela lazy) deixava a
  pagina em branco, sem mensagem.
- Padrao: mensagem de erro com "Tentar novamente" e "Recarregar pagina".
  Envolve o app inteiro (`main.tsx`) e as rotas (`AppRouter.tsx`, volta a
  renderizar ao trocar de rota).
- [x] Global.

## Formularios (comportamento)

6. Construtor de perguntas em lista (texto, tipo, obrigatoria, subir, descer,
   remover), no lugar de uma caixa com uma pergunta por linha.
7. Tipos de pergunta: texto curto, texto longo, horario, data, escolha, nota de
   1 a 5 e colaborador (seletor do cadastro de funcionarios).
   Guardados no proprio texto: `Rotulo ::tipo[=op1|op2][?]` (sem migracao).
   Codigo: `src/features/frontstore/formQuestions.ts`.
8. Validacao ao salvar: ao menos uma pergunta, sem perguntas repetidas, escolha
   com pelo menos duas opcoes.
9. Modelos prontos: "Controle de frente de loja" e "Autoavaliacao de conduta".
10. Resumo por colaborador na aba Respostas (pontualidade, conformidade, nota
    media). Codigo: `src/features/frontstore/formSummary.ts`.
11. Resposta: escolhas e notas como botoes; campos opcionais marcados.

## Ambiente

12. `.env.local` nao pode ter BOM (UTF-8 com marca). O BOM vira parte do nome da
    primeira variavel e o app abre em branco com "Supabase nao configurado".
    Salvar em UTF-8 sem BOM.
13. Ao reiniciar o servidor de desenvolvimento, abrir a porta nova que o Vite
    mostrar; uma aba na porta antiga fica em branco.

## Acentuacao dos textos

14. Textos visiveis ao usuario passam a ter acento ("Formulários", "Descrição",
    "Não conforme"). Aplicado em: Formularios, `select.tsx`, `ErrorBoundary.tsx`
    e nos modelos de `formQuestions.ts`.
    - [x] Formularios, Anotacoes, Dashboard, Alertas, Editor de cartazes, Checklists, Mapa de caixas, Escalas, Configurações, Filiais e Setores, Clientes, Colaboradores, Usuários (+ `modeUiConfig.ts`) · [ ] demais telas.
    - NAO acentuar listas de palavras-chave usadas para detectar/classificar
      texto (ex.: `["descricao", "observacao"]`, `["satisfacao", "avaliacao"]`):
      elas comparam com texto normalizado (sem acento) e deixariam de casar.
    - Respostas e formularios ja salvos com texto sem acento continuam validos;
      o resumo por colaborador compara ignorando acento.
    - Cuidado ao editar arquivos pelo PowerShell (`Get-Content`/`Set-Content`):
      pode corromper os acentos (ex.: "NÃ£o"). Use o editor ou Python em UTF-8.

## Filtros no cabecalho

15. Com o cabecalho `large`, o cabecalho fica so com o titulo, a descricao e a
    acao principal (ex.: "Nova anotacao"). Filtros e busca vao para uma barra
    logo abaixo, no corpo da pagina.
    - [x] Anotacoes · [ ] demais telas que colocam filtros no cabecalho.

## Tema escuro

16. Todo bloco com cor fixa (ex.: `bg-amber-50 text-amber-950`) precisa de
    variantes `dark:` para fundo, borda e texto, inclusive em botoes `outline`
    dentro dele (senao herdam texto escuro sobre fundo escuro).
    - [x] `MissingSchedulesPrompt` (aviso "Nao ha escala cadastrada"), Alertas, Checklists, Mapa de caixas, Escalas, Configurações, Filiais e Setores, Clientes, Colaboradores, Usuários.
    - [ ] Procurar outros blocos `bg-*-50` sem `dark:`:
      `grep -rn "bg-\(amber\|rose\|red\|sky\|emerald\)-50" src | grep -v "dark:"`

## Paineis sempre escuros

17. Paineis que ficam escuros nos dois temas (ex.: editor de cartazes) usam
    `<Select tone="dark" ... />`, que aplica o visual escuro no campo e na lista.
    `Select` aceita `style` por opcao (ex.: mostrar cada fonte com sua propria fonte).
18. Nomes de template/arquivo (ex.: "Proximo Vencimento") NAO recebem acento: casam
    com os arquivos em `public/templates`.

## Datas e horas

19. Datas e horas ficam no padrao brasileiro (dd/mm/aaaa, 24h) independente do idioma
    do navegador. Use sempre `<Input type="date|time|datetime-local" />` de
    `@/components/ui/input`: ele renderiza mascara BR com botao de calendario, e o
    `value`/`event.target.value` continuam em ISO. Nunca use `<input type="date">` cru.
