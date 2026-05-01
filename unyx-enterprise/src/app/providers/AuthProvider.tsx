import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import type { ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"

import { AuthContext } from "@/app/providers/auth-context"
import { supabase } from "@/lib/supabase"
import { getCurrentProfile } from "@/services/unyxApi"
import type { UserProfile } from "@/types/domain"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  const loadProfileForSession = useCallback(async (nextSession: Session | null) => {
    if (!nextSession) {
      setProfile(null)
      return
    }

    setProfileLoading(true)

    try {
      setProfile(await getCurrentProfile())
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!mounted) return
      if (error) throw error

      setSession(data.session)
      await loadProfileForSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      void loadProfileForSession(nextSession)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfileForSession])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      setSession(data.session)
      await loadProfileForSession(data.session)
    },
    [loadProfileForSession]
  )

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setSession(null)
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    await loadProfileForSession(session)
  }, [loadProfileForSession, session])

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      profileLoading,
      signIn,
      signOut,
      refreshProfile,
    }),
    [loading, profile, profileLoading, refreshProfile, session, signIn, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
