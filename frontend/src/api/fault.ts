import request from '@/utils/request'

export interface FaultReport {
  id: number
  reportCode: string
  bikeId: number
  bikeCode: string
  bikeType: string
  faultType: string
  description: string
  reporterPhone: string
  reportTime: string
  status: string
  maintenanceStaff: string
  maintenanceResult: string
  maintenanceTime: string
  stationName?: string
  stationCode?: string
}

export interface FaultReportListParams {
  page?: number
  pageSize?: number
  status?: string
  fault_type?: string
  keyword?: string
}

export interface FaultReportListResult {
  list: FaultReport[]
  total: number
  page: number
  pageSize: number
}

export const getFaultReportList = (params?: FaultReportListParams) => {
  return request.get<any, FaultReportListResult>('/fault/reports', { params })
}

export const getFaultReportDetail = (id: number) => {
  return request.get<any, FaultReport>(`/fault/reports/${id}`)
}

export interface CreateFaultReportParams {
  bike_code: string
  fault_type: string
  description?: string
  reporter_phone?: string
}

export const createFaultReport = (params: CreateFaultReportParams) => {
  return request.post('/fault/reports', params)
}

export const handleFaultMaintenance = (id: number, action: string, staff?: string, result?: string) => {
  return request.put(`/fault/reports/${id}/maintenance`, {
    action,
    maintenance_staff: staff,
    maintenance_result: result,
  })
}
