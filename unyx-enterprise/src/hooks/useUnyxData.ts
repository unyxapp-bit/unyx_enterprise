import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { useAuth } from "@/app/providers/auth-context"
import { useAppStore } from "@/store/useAppStore"
import {
  closeCashSession,
  completeSale,
  copySchedulesFromDate,
  createPosCashMovement,
  createProduct,
  allocatePost,
  confirmCashMovement,
  createBranch,
  createCommsPost,
  createCommsPostComment,
  createEmployee,
  createOperationalPost,
  createSchedule,
  createSector,
  createTrainingItem,
  deactivateEmployees,
  deleteSchedule,
  finalizePostAllocation,
  getOrganization,
  getOperationalSettings,
  getSubscription,
  importEmployees,
  importSchedules,
  getCurrentCashSession,
  listAllocationHistory,
  listCashSessions,
  listOrganizationModules,
  listPosCashMovements,
  listProducts,
  listSaleItems,
  listSalePayments,
  listSales,
  openCashSession,
  setupSegmentDefaults,
  updateProduct,
  listAllAuditLogs,
  listAttendanceEvents,
  listAuditLogs,
  listBranches,
  listDashboardRows,
  listEmployees,
  listCashMovements,
  listCommsPosts,
  listCommsPostComments,
  listModules,
  listOperationalPosts,
  listOperationalStatuses,
  listPostAllocations,
  listReportEvents,
  listSchedules,
  listSectors,
  listTrainingItems,
  listTrainingProgress,
  listUserProfiles,
  listInvitations,
  setUserActive,
  setUserBranch,
  removeUserFromOrg,
  createInvitation,
  cancelInvitation,
  markCommsPostRead,
  recordOperationalEvent,
  saveOperationalSettings,
  setTrainingProgress,
  toggleBranchActive,
  toggleOperationalPost,
  toggleSectorActive,
  transferPostAllocation,
  updateBranch,
  updateEmployee,
  updateCurrentUserPassword,
  updateCurrentUserProfile,
  updateOperationalPost,
  updateOrganization,
  updateOrganizationPlan,
  updateSchedule,
  updateSector,
  updateUserRole,
} from "@/services/unyxApi"
import type {
  BulkImportResult,
  CompleteSaleInput,
  EmployeeImportInput,
  ProductInput,
  ScheduleImportInput,
} from "@/services/unyxApi"
import type {
  AttendanceEventType,
  Branch,
  BusinessSegment,
  CashMovementType,
  Invitation,
  OperationalPost,
  OperationalPostType,
  OperationalSettings,
  PaymentMethod,
  PosCashMovementType,
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

export function useOperationalPosts(branchId?: string | null) {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const effectiveBranchId =
    arguments.length > 0 ? branchId ?? null : selectedBranchId

  return useQuery({
    queryKey: ["operational-posts", profile?.organization_id, effectiveBranchId],
    queryFn: () => listOperationalPosts(effectiveBranchId),
    enabled: Boolean(profile),
  })
}

export function usePostAllocations(
  branchId?: string | null,
  activeOnly = true
) {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const effectiveBranchId =
    arguments.length > 0 ? branchId ?? null : selectedBranchId

  return useQuery({
    queryKey: [
      "post-allocations",
      profile?.organization_id,
      effectiveBranchId,
      activeOnly,
    ],
    queryFn: () => listPostAllocations(effectiveBranchId, activeOnly),
    enabled: Boolean(profile),
    refetchInterval: 45_000,
  })
}

export function useAllocationHistory(branchId?: string | null) {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const effectiveBranchId =
    arguments.length > 0 ? branchId ?? null : selectedBranchId

  return useQuery({
    queryKey: ["allocation-history", profile?.organization_id, effectiveBranchId],
    queryFn: () => listAllocationHistory(effectiveBranchId),
    enabled: Boolean(profile),
  })
}

export function useCashMovements(branchId?: string | null) {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const effectiveBranchId =
    arguments.length > 0 ? branchId ?? null : selectedBranchId

  return useQuery({
    queryKey: ["cash-movements", profile?.organization_id, effectiveBranchId],
    queryFn: () => listCashMovements(effectiveBranchId),
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

export function useDeactivateEmployees() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (employeeIds: string[]) => deactivateEmployees(profile, employeeIds),
    onSuccess: async (employees) => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] })
      await queryClient.invalidateQueries({ queryKey: ["employees-all"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] })
      if (employees.length > 0) {
        toast.success(`${employees.length} colaborador(es) excluido(s).`)
      } else {
        toast.success("Nenhum colaborador ativo para excluir.")
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

export function useCreateOperationalPost() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (input: {
      branch_id: string
      sector_id: string | null
      name: string
      type: OperationalPostType
      active?: boolean
    }) => createOperationalPost(profile, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["operational-posts"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] })
      toast.success("Posto operacional criado.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useUpdateOperationalPost() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (input: {
      postId: string
      values: Partial<
        Pick<OperationalPost, "name" | "type" | "sector_id" | "active">
      >
    }) => updateOperationalPost(profile, input.postId, input.values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["operational-posts"] })
      await queryClient.invalidateQueries({ queryKey: ["post-allocations"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] })
      toast.success("Posto operacional atualizado.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useToggleOperationalPost() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()

  return useMutation({
    mutationFn: (input: { postId: string; active: boolean }) =>
      toggleOperationalPost(profile, input.postId, input.active),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["operational-posts"] })
      await queryClient.invalidateQueries({ queryKey: ["post-allocations"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] })
      toast.success(variables.active ? "Posto ativado." : "Posto desativado.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useAllocatePost() {
  const queryClient = useQueryClient()
  useRequiredProfile()

  return useMutation({
    mutationFn: (input: {
      post_id: string
      employee_id: string
      schedule_id?: string | null
      notes?: string | null
    }) => allocatePost(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["post-allocations"] })
      await queryClient.invalidateQueries({ queryKey: ["allocation-history"] })
      await queryClient.invalidateQueries({ queryKey: ["operational-posts"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] })
      toast.success("Colaborador alocado.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useTransferPostAllocation() {
  const queryClient = useQueryClient()
  useRequiredProfile()

  return useMutation({
    mutationFn: (input: {
      allocation_id: string
      next_employee_id: string
      next_schedule_id?: string | null
      notes?: string | null
    }) => transferPostAllocation(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["post-allocations"] })
      await queryClient.invalidateQueries({ queryKey: ["allocation-history"] })
      await queryClient.invalidateQueries({ queryKey: ["attendance-events"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] })
      toast.success("Troca confirmada.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useFinalizePostAllocation() {
  const queryClient = useQueryClient()
  useRequiredProfile()

  return useMutation({
    mutationFn: (input: { allocation_id: string; notes?: string | null }) =>
      finalizePostAllocation(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["post-allocations"] })
      await queryClient.invalidateQueries({ queryKey: ["allocation-history"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] })
      toast.success("Alocacao finalizada.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useConfirmCashMovement() {
  const queryClient = useQueryClient()
  useRequiredProfile()

  return useMutation({
    mutationFn: (input: {
      allocation_id: string
      movement_type: CashMovementType
      notes?: string | null
    }) => confirmCashMovement(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cash-movements"] })
      await queryClient.invalidateQueries({ queryKey: ["attendance-events"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] })
      toast.success("Movimento confirmado.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useSetupSegmentDefaults() {
  const queryClient = useQueryClient()
  useRequiredProfile()

  return useMutation({
    mutationFn: (input: {
      branch_id: string
      sector_names: string[]
      post_definitions: Array<{ name: string; type: string; sector_name: string }>
    }) => setupSegmentDefaults(input),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["sectors"] })
      await queryClient.invalidateQueries({ queryKey: ["operational-posts"] })
      await queryClient.invalidateQueries({ queryKey: ["post-allocations"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success(
        `Configuracao aplicada: ${data.sectors_created} setor(es) e ${data.posts_created} posto(s) criados.`
      )
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

export function useSetUserActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { profileId: string; active: boolean }) =>
      setUserActive(input.profileId, input.active),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["user-profiles"] })
      toast.success(variables.active ? "Usuário ativado." : "Usuário desativado.")
    },
    onError: (error) => { toast.error(error.message) },
  })
}

export function useSetUserBranch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { profileId: string; branchId: string | null }) =>
      setUserBranch(input.profileId, input.branchId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user-profiles"] })
      toast.success("Filial atualizada.")
    },
    onError: (error) => { toast.error(error.message) },
  })
}

export function useRemoveUserFromOrg() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (profileId: string) => removeUserFromOrg(profileId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user-profiles"] })
      toast.success("Usuário removido da organização.")
    },
    onError: (error) => { toast.error(error.message) },
  })
}

export function useInvitations() {
  const { profile } = useAuth()
  return useQuery({
    queryKey: ["invitations", profile?.organization_id],
    queryFn: listInvitations,
    enabled: Boolean(profile),
  })
}

export function useCreateInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { email: string; role: Invitation["role"]; branch_id: string | null }) =>
      createInvitation(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invitations"] })
      toast.success("Convite registrado.")
    },
    onError: (error) => { toast.error(error.message) },
  })
}

export function useCancelInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (invitationId: string) => cancelInvitation(invitationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invitations"] })
      toast.success("Convite cancelado.")
    },
    onError: (error) => { toast.error(error.message) },
  })
}

// ── Unyx POS hooks ────────────────────────────────────────────────────────────

export function useProducts(branchId?: string | null) {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const effectiveBranchId = arguments.length > 0 ? branchId ?? null : selectedBranchId
  return useQuery({
    queryKey: ["pos-products", profile?.organization_id, effectiveBranchId],
    queryFn: () => listProducts(effectiveBranchId),
    enabled: Boolean(profile),
  })
}

export function useCurrentCashSession(branchId?: string | null) {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const effectiveBranchId = (arguments.length > 0 ? branchId ?? null : selectedBranchId) ?? ""
  return useQuery({
    queryKey: ["pos-current-session", profile?.organization_id, effectiveBranchId],
    queryFn: () => getCurrentCashSession(effectiveBranchId),
    enabled: Boolean(profile) && Boolean(effectiveBranchId),
    refetchInterval: 30_000,
  })
}

export function useCashSessions(branchId?: string | null) {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const effectiveBranchId = arguments.length > 0 ? branchId ?? null : selectedBranchId
  return useQuery({
    queryKey: ["pos-sessions", profile?.organization_id, effectiveBranchId],
    queryFn: () => listCashSessions(effectiveBranchId),
    enabled: Boolean(profile),
  })
}

export function usePosCashMovements(sessionId: string | null | undefined) {
  const { profile } = useAuth()
  return useQuery({
    queryKey: ["pos-cash-movements", sessionId],
    queryFn: () => listPosCashMovements(sessionId!),
    enabled: Boolean(profile) && Boolean(sessionId),
  })
}

export function useSales(branchId?: string | null, date?: string | null) {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const effectiveBranchId = arguments.length > 0 ? branchId ?? null : selectedBranchId
  return useQuery({
    queryKey: ["pos-sales", profile?.organization_id, effectiveBranchId, date],
    queryFn: () => listSales(effectiveBranchId, date),
    enabled: Boolean(profile),
  })
}

export function useSaleItems(saleId: string | null | undefined) {
  const { profile } = useAuth()
  return useQuery({
    queryKey: ["pos-sale-items", saleId],
    queryFn: () => listSaleItems(saleId!),
    enabled: Boolean(profile) && Boolean(saleId),
  })
}

export function useSalePayments(saleId: string | null | undefined) {
  const { profile } = useAuth()
  return useQuery({
    queryKey: ["pos-sale-payments", saleId],
    queryFn: () => listSalePayments(saleId!),
    enabled: Boolean(profile) && Boolean(saleId),
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()
  return useMutation({
    mutationFn: (input: ProductInput) => createProduct(profile, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pos-products"] })
      toast.success("Produto cadastrado.")
    },
    onError: (error) => { toast.error(error.message) },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  const profile = useRequiredProfile()
  return useMutation({
    mutationFn: (input: { productId: string; values: Partial<ProductInput & { active: boolean }> }) =>
      updateProduct(profile, input.productId, input.values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pos-products"] })
      toast.success("Produto atualizado.")
    },
    onError: (error) => { toast.error(error.message) },
  })
}

export function useOpenCashSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      branch_id: string
      post_id: string | null
      employee_id: string | null
      initial_amount: number
      notes: string | null
    }) => openCashSession(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pos-current-session"] })
      await queryClient.invalidateQueries({ queryKey: ["pos-sessions"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      toast.success("Caixa aberto.")
    },
    onError: (error) => { toast.error(error.message) },
  })
}

export function useCloseCashSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { session_id: string; final_amount: number; notes: string | null }) =>
      closeCashSession(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pos-current-session"] })
      await queryClient.invalidateQueries({ queryKey: ["pos-sessions"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      toast.success("Caixa fechado.")
    },
    onError: (error) => { toast.error(error.message) },
  })
}

export function useCompleteSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CompleteSaleInput) => completeSale(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pos-sales"] })
      await queryClient.invalidateQueries({ queryKey: ["pos-current-session"] })
      await queryClient.invalidateQueries({ queryKey: ["pos-cash-movements"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      toast.success("Venda finalizada.")
    },
    onError: (error) => { toast.error(error.message) },
  })
}

export function useCreatePosCashMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      session_id: string
      movement_type: PosCashMovementType
      amount: number
      notes: string | null
    }) => createPosCashMovement(input),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["pos-cash-movements"] })
      await queryClient.invalidateQueries({ queryKey: ["pos-current-session"] })
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] })
      const labels: Record<string, string> = {
        sangria: "Sangria registrada.",
        cash_in: "Entrada registrada.",
        cash_out: "Saída registrada.",
        change_reinforcement: "Reforço de troco registrado.",
        adjustment: "Ajuste registrado.",
      }
      toast.success(labels[variables.movement_type] ?? "Movimento registrado.")
    },
    onError: (error) => { toast.error(error.message) },
  })
}

// suppress unused import warning
void (undefined as unknown as PaymentMethod)
