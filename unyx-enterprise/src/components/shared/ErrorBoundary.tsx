import { Component } from "react"
import type { ErrorInfo, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { StateBlock } from "@/components/shared/StateBlock"

interface ErrorBoundaryProps {
  children: ReactNode
  // Quando muda (ex.: a rota), o erro e descartado e a tela tenta renderizar de novo.
  resetKey?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack)
  }

  componentDidUpdate(previous: ErrorBoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[color:var(--bg-app)] p-6">
        <StateBlock
          type="error"
          title="Algo deu errado nesta tela"
          description={error.message || "Erro inesperado ao carregar a tela."}
          className="w-full max-w-lg"
        />
        <div className="flex gap-2">
          <Button type="button" onClick={() => this.setState({ error: null })}>
            Tentar novamente
          </Button>
          <Button type="button" variant="outline" onClick={() => window.location.reload()}>
            Recarregar página
          </Button>
        </div>
      </main>
    )
  }
}
