import { createContext, useContext } from "react"
import type { Session } from "@supabase/supabase-js"

import type { UserProfile } from "@/types/domain"

export interface SignUpResult {
  needsEmailConfirmation: boolean
}

export interface AuthContextValue {
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  profileLoading: boolean
  profileError: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.")
  }

  return context
}
