import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { useAuth } from "@/app/providers/auth-context"
import { useAppStore } from "@/store/useAppStore"
import {
  copySchedulesFromDate,
  createBranch,
  createCommsPost,
  createCommsPostComment,
  createEmployee,
  createSchedule,
  createSector,
  createTrainingItem,
  deleteSchedule,
  getOrganization,
  getOperationalSettings,
  getSubscription,
  importEmployees,
  importSchedules,
  listOrganizationModules,
  listAllAuditLogs,
  listAttendanceEvents,
  listAuditLogs,
  listBranches,
  listDashboardRows,
  listEmployees,
  listCommsPosts,
  listCommsPostComments,
  listModules,
  listOperationalStatuses,
  listReportEvents,
  listSchedules,
  listSectors,
  listTrainingItems,
  listTrainingProgress,
  listUserProfiles,
  markCommsPostRead,
  recordOperationalEvent,
  saveOperationalSettings,
  setTrainingProgress,
  toggleBranchActive,
  toggleSectorActive,
  updateBranch,
  updateEmployee,
  updateCurrentUserPassword,
  updateCurrentUserProfile,
  updateOrganization,
  updateOrganizationPlan,
  updateSchedule,
  updateSector,
  updateUserRole,
} from "@/services/unyxApi"
import type {
  BulkImportResult,
  EmployeeImportInput,
  ScheduleImportInput,
} from "@/services/unyxApi"
import type {
  AttendanceEventType,
  Branch,
  BusinessSegment,
  OperationalSettings,
  ScheduleStatus,
  SubscriptionPlan,
  TrainingType,
  UserProfile,
} from "@/types/domain"

function useRequiredProfile() {
  const { profile } = useAuth()

  if (!profile) {
    throw new Error("Perfil do usuário ainda não está disponível.")
  }

  return profile
}

export function useOrganization() {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ["organization", profile?.organization_id],
    queryFn: () => getOrganization(profile!.organization_id),
    enabled: Boolean(profile),
  })
}

export function useOperationalSettings(branchId?: string | null) {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const effectiveBranchId =
    arguments.length > 0 ? branchId ?? null : selectedBranchId

  return useQuery({
    queryKey: ["operational-settings", profile?.organization_id, effectiveBranchId],
    queryFn: () => getOperationalSettings(profile!, effectiveBranchId),
    enabled: Boolean(profile),
  })
}

export function useBranches() {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ["branches", profile?.organization_id],
    queryFn: listBranches,
    enabled: Boolean(profile),
  })
}

export function useSectors(branchId?: string | null) {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const effectiveBranchId =
    arguments.length > 0 ? branchId ?? null : selectedBranchId

  return useQuery({
    queryKey: ["sectors", profile?.organization_id, effectiveBranchId],
    queryFn: () => listSectors(effectiveBranchId),
    enabled: Boolean(profile),
  })
}

export function useEmployees(branchId?: string | null) {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const effectiveBranchId =
    arguments.length > 0 ? branchId ?? null : selectedBranchId

  return useQuery({
    queryKey: ["employees", profile?.organization_id, effectiveBranchId],
    queryFn: () => listEmployees(effectiveBranchId),
    enabled: Boolean(profile),
  })
}

export function useSchedules(workDate: string, branchId?: string | null) {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const effectiveBranchId =
    arguments.length > 1 ? branchId ?? null : selectedBranchId

  return useQuery({
    queryKey: ["schedules", profile?.organization_id, effectiveBranchId, workDate],
    queryFn: () => listSchedules(workDate, effectiveBranchId),
    enabled: Boolean(profile),
  })
}

export function useDashboardRows(workDate: string) {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)

  return useQuery({
    queryKey: ["dashboard", profile?.organization_id, selectedBranchId, workDate],
    queryFn: () => listDashboardRows(workDate, selectedBranchId),
    enabled: Boolean(profile),
    refetchInterval: 45_000,
  })
}

export function useOperationalStatuses() {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)

  return useQuery({
    queryKey: ["operational-status", profile?.organization_id, selectedBranchId],
    queryFn: () => listOperationalStatuses(selectedBranchId),
    enabled: Boolean(profile),
    refetchInterval: 45_000,
  })
}

export function useAttendanceEvents() {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)

  return useQuery({
    queryKey: ["attendance-events", profile?.organization_id, selectedBranchId],
    queryFn: () => listAttendanceEvents(selectedBranchId),
    enabled: Boolean(profile),
    refetchInterval: 45_000,
  })
}

export function useCommsPosts() {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)

  return useQuery({
    queryKey: ["comms-posts", profile?.organization_id, selectedBranchId],
    queryFn: () => listCommsPosts(selectedBranchId),
    enabled: Boolean(profile),
  })
}

export function useCommsPostComments(postIds: string[]) {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ["comms-post-comments", profile?.organization_id, postIds.join(",")],
    queryFn: () => listCommsPostComments(postIds),
    enabled: Boolean(profile) && postIds.length > 0,
  })
}

export function useTrainingItems() {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ["training-items", profile?.organization_id],
    queryFn: listTrainingItems,
    enabled: Boolean(profile),
  })
}

export function useTrainingProgress() {
  const profile = useRequiredProfile()

  return useQuery({
    queryKey: ["training-progress", profile.organization_id, profile.id],
    queryFn: () => listTrainingProgress(profile),
  })
}

export function useAuditLogs() {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)

  return useQuery({
    queryKey: ["audit-logs", profile?.organization_id, selectedBranchId],
    queryFn: () => listAuditLogs(selectedBranchId),
    enabled: Boolean(profile),
  })
}

export function useModules() {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ["modules", profile?.organization_id],
    queryFn: listModules,
    enabled: Boolean(profile),
  })
}

export function useSubscription() {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ["subscription", profile?.organization_id],
    queryFn: () => getSubscription(profile!.organization_id),
    enabled: Boolean(profile && ["owner", "admin"].includes(profile.role)),
  })
}

export function useOrganizationModules() {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ["organization-modules", profile?.organization_id],
    queryFn: () => listOrganizationModules(profile!),
    enabled: Boolean(profile),
  })
}

export function useCreateCommsPost() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (input: {
      branch_id: string | null
      sector_id: string | null
      title: string
      content: string
      pinned: boolean
    }) => createCommsPost(profile, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["comms-posts"] })
      toast.success("Comunicado publicado.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useMarkCommsPostRead() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (postId: string) => markCommsPostRead(profile, postId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["comms-posts"] })
      toast.success("Leitura confirmada.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useCreateCommsPostComment() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (input: { postId: string; content: string }) =>
      createCommsPostComment(profile, input.postId, input.content),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["comms-post-comments"] })
      toast.success("Comentario publicado.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useCreateTrainingItem() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (input: {
      title: string
      type: TrainingType
      content_url: string | null
      duration_minutes: number | null
    }) => createTrainingItem(profile, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["training-items"] })
      toast.success("Treinamento cadastrado.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useSetTrainingProgress() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (input: { trainingId: string; completed: boolean }) =>
      setTrainingProgress(profile, input.trainingId, input.completed),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["training-progress"] })
      toast.success("Progresso atualizado.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useCreateBranch() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (input: {
      name: string
      city: string | null
      state: string | null
      address: string | null
    }) => createBranch(profile, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["branches"] })
      toast.success("Filial criada com sucesso.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useCreateSector() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (input: {
      branch_id: string
      name: string
      description: string | null
    }) => createSector(profile, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sectors"] })
      toast.success("Setor criado com sucesso.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (input: {
      employeeId: string
      values: {
        active?: boolean
        branch_id?: string
        sector_id?: string | null
        name?: string
        role?: string | null
        phone?: string | null
        document?: string | null
        notes?: string | null
      }
    }) => updateEmployee(profile, input.employeeId, input.values),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] })
      await queryClient.invalidateQueries({ queryKey: ["employees-all"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] })
      if (variables.values.active === false) {
        toast.success("Colaborador desativado.")
      } else if (variables.values.active === true) {
        toast.success("Colaborador ativado.")
      } else {
        toast.success("Colaborador atualizado com sucesso.")
      }
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useCreateSchedule() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (input: {
      branch_id: string
      employee_id: string
      work_date: string
      start_time: string | null
      break_start: string | null
      break_end: string | null
      end_time: string | null
      status: ScheduleStatus
      notes: string | null
    }) => createSchedule(profile, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["schedules"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] })
      toast.success("Escala cadastrada com sucesso.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (input: {
      scheduleId: string
      values: {
        start_time?: string | null
        break_start?: string | null
        break_end?: string | null
        end_time?: string | null
        status?: ScheduleStatus
        notes?: string | null
      }
    }) => updateSchedule(profile, input.scheduleId, input.values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["schedules"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] })
      toast.success("Escala atualizada com sucesso.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (scheduleId: string) => deleteSchedule(profile, scheduleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["schedules"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] })
      toast.success("Escala removida.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useRecordOperationalEvent() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (input: {
      branch_id: string
      employee_id: string
      schedule_id: string
      event_type: AttendanceEventType
      delay_minutes?: number
      notes?: string | null
    }) => recordOperationalEvent(profile, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["operational-status"] })
      await queryClient.invalidateQueries({ queryKey: ["attendance-events"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Evento registrado.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (input: {
      name: string
      trade_name: string | null
      document: string | null
      segment: BusinessSegment
    }) => updateOrganization(profile, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["organization"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] })
      toast.success("Dados da empresa atualizados.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useUpdateOrganizationPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (plan: SubscriptionPlan) => updateOrganizationPlan(plan),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["organization"] })
      await queryClient.invalidateQueries({ queryKey: ["subscription"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] })
      toast.success("Plano da organizacao atualizado.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useUpdateCurrentUserProfile() {
  const queryClient = useQueryClient()
  const { refreshProfile } = useAuth()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (input: {
      name: string
      email: string
      branch_id: string | null
    }) => updateCurrentUserProfile(profile, input),
    onSuccess: async () => {
      await refreshProfile()
      await queryClient.invalidateQueries({ queryKey: ["user-profiles"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] })
      toast.success("Seu perfil foi atualizado.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useUpdateCurrentUserPassword() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (password: string) => updateCurrentUserPassword(profile, password),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] })
      toast.success("Senha atualizada com sucesso.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useSaveOperationalSettings() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (input: {
      branch_id: string | null
      mode: BusinessSegment
      late_tolerance_minutes: number
      break_tolerance_minutes: number
      require_cashier_cash_count: boolean
      require_coverage_before_break: boolean
      block_break_on_peak_hours: boolean
      require_responsible_presence: boolean
    }) => saveOperationalSettings(profile, input),
    onSuccess: async (settings: OperationalSettings) => {
      await queryClient.invalidateQueries({ queryKey: ["operational-settings"] })
      await queryClient.invalidateQueries({ queryKey: ["organization"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] })
      toast.success(
        settings.branch_id
          ? "Modo operacional da filial salvo."
          : "Modo operacional da organizacao salvo."
      )
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useAllEmployees() {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ["employees-all", profile?.organization_id],
    queryFn: () => listEmployees(null),
    enabled: Boolean(profile),
  })
}

export function useAllAuditLogs() {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)

  return useQuery({
    queryKey: ["audit-logs-all", profile?.organization_id, selectedBranchId],
    queryFn: () => listAllAuditLogs(selectedBranchId),
    enabled: Boolean(profile),
  })
}

export function useReportEvents() {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)

  return useQuery({
    queryKey: ["report-events", profile?.organization_id, selectedBranchId],
    queryFn: () => listReportEvents(selectedBranchId),
    enabled: Boolean(profile),
  })
}

export function useUpdateBranch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      branchId: string
      values: Pick<Branch, "name" | "city" | "state" | "address">
    }) => updateBranch(input.branchId, input.values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["branches"] })
      toast.success("Filial atualizada com sucesso.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useToggleBranchActive() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (input: { branchId: string; active: boolean }) =>
      toggleBranchActive(profile, input.branchId, input.active),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["branches"] })
      toast.success(variables.active ? "Filial ativada." : "Filial desativada.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useUpdateSector() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      sectorId: string
      values: { name: string; description: string | null }
    }) => updateSector(input.sectorId, input.values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sectors"] })
      toast.success("Setor atualizado com sucesso.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useToggleSectorActive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { sectorId: string; active: boolean }) =>
      toggleSectorActive(input.sectorId, input.active),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["sectors"] })
      toast.success(variables.active ? "Setor ativado." : "Setor desativado.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useUserProfiles() {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ["user-profiles", profile?.organization_id],
    queryFn: listUserProfiles,
    enabled: Boolean(profile),
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { profileId: string; role: UserProfile["role"] }) =>
      updateUserRole(input.profileId, input.role),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user-profiles"] })
      toast.success("Papel atualizado com sucesso.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useCopySchedules() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (input: {
      sourceDate: string
      targetDate: string
      branchId?: string | null
    }) =>
      copySchedulesFromDate(
        profile,
        input.sourceDate,
        input.targetDate,
        input.branchId
      ),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["schedules"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] })
      toast.success(`${data.length} escala(s) copiada(s) com sucesso.`)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (input: {
      branch_id: string
      sector_id: string | null
      name: string
      role: string | null
      phone: string | null
      document: string | null
      notes: string | null
    }) => createEmployee(profile, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] })
      await queryClient.invalidateQueries({ queryKey: ["employees-all"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] })
      toast.success("Colaborador cadastrado com sucesso.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useImportEmployees() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation<BulkImportResult, Error, EmployeeImportInput[]>({
    mutationFn: (rows) => importEmployees(profile, rows),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] })
      await queryClient.invalidateQueries({ queryKey: ["employees-all"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] })
      toast.success(
        `${result.created} colaborador(es) importado(s). ${result.skipped} ignorado(s).`
      )
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useImportSchedules() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation<BulkImportResult, Error, ScheduleImportInput[]>({
    mutationFn: (rows) => importSchedules(profile, rows),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["schedules"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] })
      toast.success(
        `${result.created} escala(s) importada(s). ${result.skipped} ignorada(s).`
      )
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}
