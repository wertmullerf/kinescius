import { get } from '@/api/client'
import type { DashboardStats } from '@/types'

export const getDashboardStats = (): Promise<DashboardStats> =>
  get<DashboardStats>('/reportes/dashboard')
