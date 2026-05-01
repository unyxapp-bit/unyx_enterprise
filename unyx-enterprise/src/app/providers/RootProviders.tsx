import { QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

import { AuthProvider } from "@/app/providers/AuthProvider"
import { RealtimeProvider } from "@/app/providers/RealtimeProvider"
import { queryClient } from "@/lib/queryClient"

export function RootProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RealtimeProvider>{children}</RealtimeProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
