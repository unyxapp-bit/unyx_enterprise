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
          if (queryKey === "operational-status" || queryKey === "schedules") {
            void queryClient.invalidateQueries({ queryKey: ["dashboard"] })
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
