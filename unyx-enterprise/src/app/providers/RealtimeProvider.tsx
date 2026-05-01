import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import type { ReactNode } from "react"

import { useAuth } from "@/app/providers/auth-context"
import { supabase } from "@/lib/supabase"

const realtimeTables = [
  "branches",
  "sectors",
  "employees",
  "schedules",
  "attendance_events",
  "operational_status",
  "audit_logs",
]

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!profile) return

    let channel = supabase.channel(`unyx-ops-${profile.organization_id}`)

    for (const table of realtimeTables) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `organization_id=eq.${profile.organization_id}`,
        },
        () => {
          void queryClient.invalidateQueries()
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
