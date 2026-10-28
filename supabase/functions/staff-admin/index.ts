// Gerencia os acessos de fiscais (código + senha) de uma loja.
//
// Cada fiscal é um usuário de verdade do Supabase Auth, com e-mail interno
// (codigo@prefixo.unyx.app) e perfil na mesma organização de quem o criou. Criar usuário no Auth
// exige a chave de serviço, que só existe aqui no servidor: por isso estas ações passam por esta
// função, e só o proprietário ou administrador da loja pode chamá-la.
//
// Ações (POST JSON { action, ... }):
//   store         -> { prefix }            devolve (e cria, se faltar) o código da loja usado no login
//   create        -> { profile }           { name, job_title?, login_code, password, branch_id?, permissions }
//   set_password  -> { ok }                { profile_id, password }
//   set_active    -> { ok }                { profile_id, active }
//   remove        -> { ok }                { profile_id }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// Telas que um fiscal pode receber. Usuários, filiais, configurações e auditoria ficam de fora.
const STAFF_PERMISSIONS = new Set([
  "dashboard",
  "operations",
  "alerts",
  "schedules",
  "checklists",
  "front_notes",
  "front_forms",
  "employees",
  "customers",
  "pos_sell",
  "pos_cash",
  "pos_products",
  "pos_posters",
  "pos_sales",
  "production_orders",
  "fiscal_documents",
  "deliveries",
  "reports",
  "comms",
  "game",
  "academy",
  "ai",
])

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12)
}

type Admin = ReturnType<typeof createClient>

async function ensurePrefix(admin: Admin, organizationId: string) {
  const { data: org, error } = await admin
    .from("organizations")
    .select("name, trade_name, staff_login_prefix")
    .eq("id", organizationId)
    .single()
  if (error || !org) throw new HttpError(500, "Não foi possível ler a loja.")
  if (org.staff_login_prefix) return org.staff_login_prefix as string

  const base = slug(org.trade_name || org.name || "") || "loja"
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${Math.floor(10 + Math.random() * 90)}`
    const { data: taken } = await admin
      .from("organizations")
      .select("id")
      .ilike("staff_login_prefix", candidate)
      .maybeSingle()
    if (taken) continue
    const { error: saveError } = await admin
      .from("organizations")
      .update({ staff_login_prefix: candidate })
      .eq("id", organizationId)
      .is("staff_login_prefix", null)
    if (!saveError) {
      const { data: saved } = await admin
        .from("organizations")
        .select("staff_login_prefix")
        .eq("id", organizationId)
        .single()
      if (saved?.staff_login_prefix) return saved.staff_login_prefix as string
    }
  }
  throw new HttpError(500, "Não foi possível gerar o código da loja. Tente de novo.")
}

async function staffTarget(admin: Admin, organizationId: string, callerId: string, profileId: string) {
  const { data, error } = await admin
    .from("user_profiles")
    .select("id, auth_user_id, organization_id, login_code")
    .eq("id", profileId)
    .maybeSingle()
  if (error || !data || data.organization_id !== organizationId || !data.login_code) {
    throw new HttpError(404, "Fiscal não encontrado.")
  }
  if (data.id === callerId) throw new HttpError(400, "Você não pode alterar o seu próprio acesso por aqui.")
  return data as { id: string; auth_user_id: string; organization_id: string; login_code: string }
}

function checkPassword(password: string) {
  if (password.length < 6) throw new HttpError(400, "A senha precisa ter pelo menos 6 caracteres.")
  if (password.length > 72) throw new HttpError(400, "A senha é longa demais (máximo 72 caracteres).")
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405)

  try {
    const url = Deno.env.get("SUPABASE_URL")
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!url || !anonKey || !serviceKey) throw new HttpError(500, "Função sem configuração do Supabase.")

    const authorization = req.headers.get("Authorization") ?? ""
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) throw new HttpError(401, "Sessão inválida. Entre de novo.")

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: caller } = await admin
      .from("user_profiles")
      .select("id, organization_id, role, active")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle()
    if (!caller || !caller.active || !["owner", "admin"].includes(caller.role)) {
      throw new HttpError(403, "Só o proprietário ou o administrador pode gerenciar os fiscais.")
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const action = text(body.action)
    const organizationId = caller.organization_id as string

    if (action === "store") {
      return json({ prefix: await ensurePrefix(admin, organizationId) })
    }

    if (action === "create") {
      const name = text(body.name)
      const jobTitle = text(body.job_title)
      const code = text(body.login_code).toLowerCase()
      const password = typeof body.password === "string" ? body.password : ""
      const branchId = text(body.branch_id) || null
      const permissions = Array.isArray(body.permissions)
        ? [...new Set(body.permissions.filter((item): item is string => typeof item === "string"))]
        : []

      if (name.length < 2) throw new HttpError(400, "Informe o nome do fiscal.")
      if (!/^[a-z0-9]{2,20}$/.test(code)) {
        throw new HttpError(400, "O código de acesso deve ter de 2 a 20 letras ou números, sem espaços.")
      }
      checkPassword(password)
      if (permissions.length === 0) throw new HttpError(400, "Libere pelo menos uma tela para o fiscal.")
      if (permissions.some((item) => !STAFF_PERMISSIONS.has(item))) {
        throw new HttpError(400, "Uma das telas escolhidas não pode ser liberada para fiscais.")
      }

      const { data: sameCode } = await admin
        .from("user_profiles")
        .select("id")
        .eq("organization_id", organizationId)
        .ilike("login_code", code)
        .maybeSingle()
      if (sameCode) throw new HttpError(409, "Já existe um fiscal com esse código de acesso.")

      if (branchId) {
        const { data: branch } = await admin
          .from("branches")
          .select("id")
          .eq("id", branchId)
          .eq("organization_id", organizationId)
          .maybeSingle()
        if (!branch) throw new HttpError(400, "Filial inválida.")
      }

      const prefix = await ensurePrefix(admin, organizationId)
      const email = `${code}@${prefix}.unyx.app`
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, staff: true },
      })
      if (createError || !created.user) {
        const duplicated = /already|registered|exists/i.test(createError?.message ?? "")
        throw new HttpError(
          duplicated ? 409 : 400,
          duplicated ? "Já existe um fiscal com esse código de acesso." : (createError?.message ?? "Não foi possível criar o acesso.")
        )
      }

      const { data: profile, error: profileError } = await admin
        .from("user_profiles")
        .insert({
          auth_user_id: created.user.id,
          organization_id: organizationId,
          branch_id: branchId,
          name,
          email,
          role: "operator",
          active: true,
          custom_permissions: permissions,
          login_code: code,
          job_title: jobTitle || null,
        })
        .select("*, branches(name)")
        .single()
      if (profileError || !profile) {
        // Não deixa um login órfão sem perfil.
        await admin.auth.admin.deleteUser(created.user.id)
        throw new HttpError(400, profileError?.message ?? "Não foi possível criar o perfil do fiscal.")
      }
      return json({ profile, prefix })
    }

    if (action === "set_password") {
      const password = typeof body.password === "string" ? body.password : ""
      checkPassword(password)
      const target = await staffTarget(admin, organizationId, caller.id, text(body.profile_id))
      const { error } = await admin.auth.admin.updateUserById(target.auth_user_id, { password })
      if (error) throw new HttpError(400, error.message)
      return json({ ok: true })
    }

    if (action === "set_active") {
      const active = body.active === true
      const target = await staffTarget(admin, organizationId, caller.id, text(body.profile_id))
      const { error: banError } = await admin.auth.admin.updateUserById(target.auth_user_id, {
        ban_duration: active ? "none" : "876000h",
      })
      if (banError) throw new HttpError(400, banError.message)
      const { error } = await admin.from("user_profiles").update({ active }).eq("id", target.id)
      if (error) throw new HttpError(400, error.message)
      return json({ ok: true })
    }

    if (action === "remove") {
      const target = await staffTarget(admin, organizationId, caller.id, text(body.profile_id))
      const { error: profileError } = await admin.from("user_profiles").delete().eq("id", target.id)
      if (profileError) {
        throw new HttpError(
          400,
          "Não foi possível remover: este fiscal tem registros no sistema. Desative o acesso em vez de remover."
        )
      }
      await admin.auth.admin.deleteUser(target.auth_user_id)
      return json({ ok: true })
    }

    throw new HttpError(400, "Ação desconhecida.")
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status)
    console.error("staff-admin", error)
    return json({ error: "Erro inesperado. Tente de novo." }, 500)
  }
})
