import request from '@/utils/request'

export interface DispatchTask {
  id: number
  taskCode: string
  fromStationId: number
  toStationId: number
  fromStationCode: string
  fromStationName: string
  fromDistrict: string
  toStationCode: string
  toStationName: string
  toDistrict: string
  bikeCount: number
  dispatchVehiclePlate: string
  scheduledTime: string
  actualStartTime: string
  actualEndTime: string
  status: string
  dispatcherId: number
  dispatcherName: string
  remark: string
  createdAt: string
}

export interface DispatchTaskListParams {
  page?: number
  pageSize?: number
  status?: string
  district?: string
}

export interface DispatchTaskListResult {
  list: DispatchTask[]
  total: number
  page: number
  pageSize: number
}

export const getDispatchTaskList = (params?: DispatchTaskListParams) => {
  return request.get<any, DispatchTaskListResult>('/dispatch/tasks', { params })
}

export const getDispatchTaskDetail = (id: number) => {
  return request.get<any, DispatchTask>(`/dispatch/tasks/${id}`)
}

export interface CreateDispatchTaskParams {
  from_station_id: number
  to_station_id: number
  bike_count: number
  dispatch_vehicle_plate?: string
  scheduled_time?: string
  remark?: string
}

export const createDispatchTask = (params: CreateDispatchTaskParams) => {
  return request.post('/dispatch/tasks', params)
}

export const updateDispatchTaskStatus = (id: number, status: string) => {
  return request.put(`/dispatch/tasks/${id}/status`, { status })
}

export const deleteDispatchTask = (id: number) => {
  return request.delete(`/dispatch/tasks/${id}`)
}
