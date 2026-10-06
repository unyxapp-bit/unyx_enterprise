import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  const missing = [
    !supabaseUrl && "VITE_SUPABASE_URL",
    !supabasePublishableKey && "VITE_SUPABASE_PUBLISHABLE_KEY",
  ].filter(Boolean)

  throw new Error(
    `Supabase nao configurado. Defina ${missing.join(" e ")} em unyx-enterprise/.env.local e reinicie o servidor. Use a chave Publishable, nunca uma Secret.`
  )
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
})
