import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import type { ReactNode } from "react"

import { useAuth } from "@/app/providers/auth-context"
import { supabase } from "@/lib/supabase"

const tableQueryKeyMap: Record<string, string> = {
  branches: "branches",
  sectors: "sectors",
  employees: "employees",
  schedules: "schedules",
  attendance_events: "attendance-events",
  operational_status: "operational-status",
  operational_posts: "operational-posts",
  post_allocations: "post-allocations",
  cash_movements: "cash-movements",
  customers: "customers",
  products: "pos-products",
  product_categories: "pos-categories",
  product_variants: "pos-product-variants",
  cash_sessions: "pos-sessions",
  sales: "pos-sales",
  audit_logs: "audit-logs",
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!profile) return

    let channel = supabase.channel(`unyx-ops-${profile.organization_id}`)

    for (const [table, queryKey] of Object.entries(tableQueryKeyMap)) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `organization_id=eq.${profile.organization_id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: [queryKey] })
          if (
            queryKey === "operational-status" ||
            queryKey === "schedules" ||
            queryKey === "operational-posts" ||
            queryKey === "post-allocations" ||
            queryKey === "pos-sales"
          ) {
            void queryClient.invalidateQueries({ queryKey: ["dashboard"] })
          }
          if (queryKey === "pos-sessions") {
            void queryClient.invalidateQueries({ queryKey: ["pos-current-session"] })
          }
        }
      )
    }

    channel.subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [profile, queryClient])

  return children
}
