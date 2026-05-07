# 📊 Análise Profunda - Painel Operacional
## Melhorias e Implementações Recomendadas

---

## 🔴 REFATORAÇÃO & MODULARIZAÇÃO (ALTA PRIORIDADE)

### 1. **Componente é MONOLÍTICO (1400+ linhas)**
- **Problema**: OperationsPage contém toda a lógica, estado e UI
- **Impacto**: Difícil de testar, manter e reutilizar
- **Solução**:

```
src/features/operational/
  ├── OperationsPage.tsx (container)
  ├── components/
  │   ├── OperationalGrid.tsx (cards de colaboradores)
  │   ├── OperationalTabs.tsx (abas)
  │   ├── TimelinePanel.tsx (timeline colapsável)
  │   ├── dialogs/
  │   │   ├── EntryDialog.tsx
  │   │   ├── BreakDialog.tsx
  │   │   ├── ReturnPromptDialog.tsx
  │   │   └── OccurrenceDialog.tsx
  │   ├── EmployeeCard.tsx (cartão individual)
  │   └── Pagination.tsx
  ├── hooks/
  │   ├── useOperationalState.ts (estado centralizado)
  │   ├── useBreakConfirmation.ts (lógica de intervalo)
  │   ├── useEmployeeActions.ts (ações do colaborador)
  │   └── useClock.ts (relógio)
  └── utils/
      ├── operationalCalculations.ts
      ├── statusHelpers.ts
      └── formatters.ts
```

### 2. **Estado Fragmentado em 11 useState**
- **Problema**: `occurrenceSchedule`, `breakConfirmSchedule`, `returnPromptSchedule`, etc.
- **Solução**: Usar Zustand ou Context para gerenciar estado global:

```typescript
// hooks/useOperationalState.ts
interface OperationalDialogState {
  entry: { schedule: ScheduleWithRelations | null; post_id: string | null }
  break: { schedule: ScheduleWithRelations | null; mode: "question" | "late_input"; lateTime: string }
  return: { schedule: ScheduleWithRelations | null; dismissedIds: Set<string> }
  occurrence: { schedule: ScheduleWithRelations | null; note: string; error: string | null }
}

// Usar um único source of truth
```

### 3. **Lógica de Helper Functions Espalhada**
- `timeToMinutes()`, `formatDuration()`, `addNoteMarker()`, etc. estão no componente
- **Solução**: Mover para `utils/operationalCalculations.ts`

---

## 🟠 PERFORMANCE & OTIMIZAÇÃO

### 4. **useMemo Excessivo Sem Memo em Subcomponentes**
- **Problema**: Calcula `sortedSchedules`, `emTurno`, `aChegar` mas não memoriza componentes filhos
- **Solução**: Envolver `EmployeeCard` em `React.memo`:

```typescript
const EmployeeCard = React.memo(({ schedule, /* props */ }) => {
  // ...
}, (prev, next) => {
  // Custom comparison
  return prev.schedule.id === next.schedule.id && 
         prev.currentStatus === next.currentStatus
})
```

### 5. **Clock setInterval Desatualizado a Cada 30s**
- **Problema**: Atualiza TODO o componente, não apenas progresso
- **Solução**: Extrair progresso para subcomponente separado ou usar `useLayoutEffect` com refs

```typescript
// hooks/useClock.ts
export function useClock(onTick?: (minutes: number) => void) {
  const [now, setNow] = useState(nowMinutes)
  
  useEffect(() => {
    const id = setInterval(() => {
      const minutes = nowMinutes()
      setNow(minutes)
      onTick?.(minutes)
    }, 30_000)
    return () => clearInterval(id)
  }, [onTick])
  
  return now
}
```

### 6. **Paginação Manual com slice()**
- **Problema**: Pagina manualmente 12 por página
- **Solução**: Usar `react-window` ou `react-virtual` para virtualized scrolling (500+ colaboradores?)

### 7. **Recalcula `postsBySector` a cada render**
- **Problema**: Mapa complexo que não precisa recalcular se `activePosts` não mudou
- **Solução**: `useMemo` já presente, mas considerar normalizar dados no backend

---

## 🟡 UX/UI MELHORIAS

### 8. **Falta Busca/Filtro por Nome de Colaborador**
- **Implementação**: Input de busca no header
```tsx
<input
  type="search"
  placeholder="Buscar colaborador..."
  value={searchText}
  onChange={(e) => setSearchText(e.target.value)}
/>
```

### 9. **Sem Sorted by Field (Nome, Horário, Status)**
- **Implementação**: Botões para mudar ordenação
```tsx
<Button
  variant={sortBy === 'priority' ? 'default' : 'outline'}
  size="sm"
  onClick={() => setSortBy('priority')}
>
  Por prioridade
</Button>
```

### 10. **Cards Sem Ações de Teclado (Accessibility)**
- **Problema**: Só clica com mouse
- **Solução**: Adicionar `onKeyDown` para Enter/Space
```tsx
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    handleEntryConfirm()
  }
}}
```

### 11. **Falta Confirmação de Risco Alto**
- **Exemplo**: Registrar saída sem confirmar que todos dados foram finalizados
- **Solução**: Dialog adicional com checklist
```tsx
<Dialog title="Confirmar Saída">
  <Checkbox>Finalizou tarefas pendentes?</Checkbox>
  <Checkbox>Equipamentos foram retornados?</Checkbox>
</Dialog>
```

### 12. **Cores de Status Pouco Intuitivas**
- **Melhoria**: Usar SVG icons dentro do avatar + cor
```tsx
// Ao invés só de cor
<Avatar className={statusColor}>
  {isCafe ? '☕' : '⏱️'}
  {getInitials(name)}
</Avatar>
```

### 13. **Falta "Undo" para Ações Acidentais**
- **Solução**: Toast com "Desfazer" por 5 segundos
```tsx
recordEvent.mutateAsync(data).then(() => {
  showToast('Entrada confirmada', { action: 'Desfazer' })
})
```

### 14. **Timeline Sem Filtro**
- **Melhoria**: Filtrar eventos por tipo ou colaborador
```tsx
<select value={timelineFilter} onChange={...}>
  <option>Todos os eventos</option>
  <option>Entradas/Saídas</option>
  <option>Intervalos</option>
  <option>Ocorrências</option>
</select>
```

---

## 🟢 FEATURES NOVAS

### 15. **Sistema de Alertas em Tempo Real**
- **Feature**: Notificações quando:
  - Colaborador fica atrasado (>30min)
  - Intervalo vence
  - Setor vazio (sem ninguém)
  
```typescript
// hooks/useOperationalAlerts.ts
useEffect(() => {
  const overdue = schedules.filter(s => {
    const status = statusByScheduleId.get(s.id)
    return status?.delay_minutes > 30
  })
  if (overdue.length > 0) {
    triggerAlert(`${overdue.length} colaboradores atrasados`)
  }
}, [schedules])
```

### 16. **Dashboard de Métricas (KPIs)**
- **Adicionar widget**:
  - Ocupação do turno (%)
  - Média de tempo de intervalo
  - Taxa de atraso
  - Colaboradores por setor

```tsx
<Card>
  <h3>Ocupação</h3>
  <ProgressBar value={emTurno.length / aChegar.length * 100} />
  <p>{emTurno.length} de {aChegar.length} confirmados</p>
</Card>
```

### 17. **Relatório Rápido por Email/PDF**
- **Feature**: Botão para exportar operação do dia
```tsx
<Button onClick={() => generateOperationalReport(date)}>
  <Download /> Exportar PDF
</Button>
```

### 18. **Alocação Automática de Postos**
- **Smart Feature**: Sugerir melhor posto baseado em:
  - Postos livres
  - Histórico de preferência
  - Cargo/skill set
  
```tsx
// Ao invés de listar todos, sugerir "Recomendado"
<Button variant="default">
  ☆ Caixa 1 (Recomendado)
</Button>
```

### 19. **Modo "Offline" com Sincronização**
- **Feature**: Continuar registrando entradas sem internet
```typescript
const recordEvent = useRecordOperationalEvent()
// Automaticamente enfileira e sincroniza depois
```

### 20. **Modo "Kiosk" para Entrada via QR Code**
- **Feature**: Colaborador escaneia QR → entrada automática
```tsx
<QRCodeScanner onScan={(employeeId) => {
  fireAction(getSchedule(employeeId), 'entrada_confirmada')
}} />
```

---

## 🔵 CODE QUALITY & MANUTENIBILIDADE

### 21. **Sem Testes Unitários**
- **Implementar**: Testes para helpers e hooks
```typescript
// __tests__/timeToMinutes.test.ts
describe('timeToMinutes', () => {
  it('converts 14:30 to 870', () => {
    expect(timeToMinutes('14:30')).toBe(870)
  })
})
```

### 22. **Sem Error Boundaries**
- **Solução**: Envolver componente com ErrorBoundary
```tsx
<ErrorBoundary fallback={<ErrorState />}>
  <OperationsPage />
</ErrorBoundary>
```

### 23. **Status Magic Strings** (aguardando_evento, trabalhando, etc)
- **Solução**: Enum ou constantes
```typescript
enum OperationalStatus {
  WAITING = 'aguardando_evento',
  WORKING = 'trabalhando',
  ON_BREAK = 'em_intervalo',
  // ...
}
```

### 24. **Types Não Completos**
- **Melhoria**: Usar `z.ZodType` para runtime validation
```typescript
const ScheduleSchema = z.object({
  id: z.string(),
  employee_id: z.string(),
  // ...
})
```

### 25. **Sem Logging/Observabilidade**
- **Implementar**: Rastrear ações do usuário
```typescript
recordEvent.mutateAsync(data).then(() => {
  logEvent('employee_entry_confirmed', { employeeId, postId })
})
```

---

## 🟣 ACCESSIBILITY (A11Y)

### 26. **Falta aria-labels em Botões**
- **Fix**: Adicionar descrição para screen readers
```tsx
<button
  aria-label="Atualizar status operacional"
  onClick={...}
>
  <RefreshCw />
</button>
```

### 27. **Cores Sem Suficiente Contraste**
- **Check**: Usar ferramenta como WebAIM
- **Melhoria**: Adicionar ícones além de cores

### 28. **Sem Suporte a Navegação por Teclado (Tab)**
- **Fix**: Adicionar `tabIndex={0}` aos cards interativos
```tsx
<div
  role="button"
  tabIndex={0}
  onKeyDown={...}
/>
```

### 29. **Diálogos Sem Focus Trap**
- **Solução**: Usar library como `focus-trap-react`
```tsx
<FocusTrap>
  <Dialog open={...}>...</Dialog>
</FocusTrap>
```

---

## 🔐 SEGURANÇA

### 30. **Sem Validação de Permissões no Frontend**
- **Problema**: Usuário pode tentar ações sem permissão
- **Solução**: Validar com `usePermissions()` hook
```typescript
const { canConfirmEntry, canAllocatePost } = usePermissions()

if (!canConfirmEntry) {
  return <div>Sem permissão</div>
}
```

### 31. **Dados Sensíveis em localStorage (possível)**
- **Review**: Garantir que senhas/tokens não ficam em localStorage

### 32. **Sem Rate Limiting**
- **Proteção**: Limite de requisições por minuto
```typescript
const recordEvent = useRecordOperationalEvent({
  rateLimit: { maxPerMinute: 10 }
})
```

---

## 📊 OBSERVABILIDADE & ANALYTICS

### 33. **Sem Tracking de Tempo de Ação**
- **Implementar**: Medir tempo de entrada até alocação
```typescript
const entryStartTime = useRef(Date.now())

const handleEntryConfirm = async () => {
  const duration = Date.now() - entryStartTime.current
  analytics.track('entry_confirmed', { duration })
}
```

### 34. **Sem Error Tracking**
- **Solução**: Integrar Sentry
```typescript
import * as Sentry from "@sentry/react"

recordEvent.mutate(data, {
  onError: (error) => {
    Sentry.captureException(error)
  }
})
```

### 35. **Sem Feedback de Usuário**
- **Feature**: Widget para reportar bugs/sugestões
```tsx
<FloatingFeedbackWidget />
```

---

## 🔧 IMPLEMENTAÇÕES TÉCNICAS ESPECÍFICAS

### 36. **Melhorar Dialog de Intervalo Complexo**
- **Problema**: Lógica complexa em renderização inline (TERNÁRIOS ANINHADOS!)
- **Solução**: Extrair para componentes:
```tsx
{isLate && breakDialogMode === "question" ? (
  <BreakLateQuestion ... />
) : isLate && breakDialogMode === "late_input" ? (
  <BreakLateInput ... />
) : (
  <BreakOnTime ... />
)}

// Virar:
<BreakDialog mode={breakDialogMode} isLate={isLate} ... />
```

### 37. **Sincronizar Relogio com Servidor**
- **Problema**: Relógio local pode desincronizar
- **Solução**: Sincronizar com `server_time` a cada 5 minutos

### 38. **Cache de Postos Inteligente**
- **Melhoria**: Cache com SWR/React Query
```typescript
const operationalPosts = useOperationalPosts(undefined, {
  staleTime: 5 * 60 * 1000, // 5 minutos
})
```

### 39. **Suporte a Múltiplas Filiais/Setores**
- **Implementar**: Setor multi-seleção (checkboxes)
```tsx
<div>
  {sectors.map(s => (
    <Checkbox
      key={s.id}
      checked={selectedSectors.has(s.id)}
      onChange={(checked) => {
        // update selectedSectors
      }}
    />
  ))}
</div>
```

### 40. **Geolocalização para Entrada**
- **Feature (avançada)**: Confirmar entrada apenas se no local
```typescript
const handleEntryWithGeo = async () => {
  const position = await navigator.geolocation.getCurrentPosition(...)
  if (isWithinBranchRadius(position, branchCoordinates)) {
    await fireAction(...)
  } else {
    showError('Você não está no local do trabalho')
  }
}
```

---

## 📋 RESUMO DE PRIORIDADES

| Priority | Categoria | Items |
|----------|-----------|-------|
| 🔴 CRÍTICO | Modularização | 1, 2, 3 |
| 🔴 CRÍTICO | Performance | 4, 5 |
| 🟠 ALTO | UX/UI | 8, 9, 10, 11, 13 |
| 🟠 ALTO | Features | 15 (Alertas), 17 (Relatório) |
| 🟡 MÉDIO | Code Quality | 21, 22, 23, 24, 25 |
| 🟡 MÉDIO | A11y | 26, 27, 28 |
| 🟢 BAIXO | Features Avançadas | 20, 40 |

---

## 🎯 ROTEIRO DE IMPLEMENTAÇÃO

### **Fase 1 (Sprint 1-2): Refatoração Base**
- [ ] Dividir monolítico em componentes
- [ ] Extrair estado para hook customizado
- [ ] Mover helpers para utils
- [ ] Implementar testes básicos

### **Fase 2 (Sprint 3): Performance**
- [ ] Adicionar React.memo nos cards
- [ ] Implementar virtualized scrolling
- [ ] Otimizar re-renders

### **Fase 3 (Sprint 4): UX Melhorias**
- [ ] Busca por nome
- [ ] Filtro/sort configurável
- [ ] Sistema de alertas
- [ ] Keyboard navigation

### **Fase 4 (Sprint 5+): Features Novas**
- [ ] Dashboard de KPIs
- [ ] Exportação de relatório
- [ ] Alocação automática de postos
- [ ] Geolocalização

---

## 📈 MÉTRICAS DE SUCESSO

- **Performance**: TTI < 2s, FCP < 1.5s
- **Acessibilidade**: Lighthouse a11y score > 95
- **Usabilidade**: Entrada média < 30 segundos
- **Confiabilidade**: 99.9% uptime, 0% data loss
- **Satisfação**: NPS > 80

---

**Última atualização**: Maio 2026
**Status**: ✅ Análise completa
