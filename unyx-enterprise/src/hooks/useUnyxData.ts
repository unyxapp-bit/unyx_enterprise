import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { useAuth } from "@/app/providers/auth-context"
import { useAppStore } from "@/store/useAppStore"
import {
  createBranch,
  createEmployee,
  createSchedule,
  createSector,
  deleteSchedule,
  getOrganization,
  getSubscription,
  listAttendanceEvents,
  listAuditLogs,
  listBranches,
  listDashboardRows,
  listEmployees,
  listModules,
  listOperationalStatuses,
  listSchedules,
  listSectors,
  recordOperationalEvent,
  updateEmployee,
  updateOrganization,
  updateSchedule,
} from "@/services/unyxApi"
import type {
  AttendanceEventType,
  BusinessSegment,
  ScheduleStatus,
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
  const effectiveBranchId = branchId ?? selectedBranchId

  return useQuery({
    queryKey: ["sectors", profile?.organization_id, effectiveBranchId],
    queryFn: () => listSectors(effectiveBranchId),
    enabled: Boolean(profile),
  })
}

export function useEmployees(branchId?: string | null) {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const effectiveBranchId = branchId ?? selectedBranchId

  return useQuery({
    queryKey: ["employees", profile?.organization_id, effectiveBranchId],
    queryFn: () => listEmployees(effectiveBranchId),
    enabled: Boolean(profile),
  })
}

export function useSchedules(workDate: string, branchId?: string | null) {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const effectiveBranchId = branchId ?? selectedBranchId

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
    enabled: Boolean(profile),
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
      notes: string | null
    }) => createEmployee(profile, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] })
      toast.success("Colaborador cadastrado com sucesso.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient()

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
        notes?: string | null
      }
    }) => updateEmployee(input.employeeId, input.values),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] })
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
      toast.success("Escala cadastrada com sucesso.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient()

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
    }) => updateSchedule(input.scheduleId, input.values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["schedules"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Escala atualizada com sucesso.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (scheduleId: string) => deleteSchedule(scheduleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["schedules"] })
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] })
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
    }) => updateOrganization(profile.organization_id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["organization"] })
      toast.success("Dados da empresa atualizados.")
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
}
