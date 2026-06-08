import request from '@/utils/request'

export interface Bike {
  id: number
  bikeCode: string
  bikeType: string
  status: string
  stationId: number | null
  stationName?: string
  stationCode?: string
  district?: string
  rideCount: number
  lastMaintenanceDate: string
}

export interface BikeListParams {
  station_id?: number
  status?: string
  bike_type?: string
  page?: number
  pageSize?: number
  keyword?: string
}

export interface BikeListResult {
  list: Bike[]
  total: number
  page: number
  pageSize: number
}

export const getBikeList = (params?: BikeListParams) => {
  return request.get<any, BikeListResult>('/bikes', { params })
}

export const getBikeDetail = (id: number) => {
  return request.get<any, Bike & { recentRides: any[] }>(`/bikes/${id}`)
}
