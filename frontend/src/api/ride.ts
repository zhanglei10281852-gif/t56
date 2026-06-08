import request from '@/utils/request'

export const borrowBike = (stationId: number, userPhone: string) => {
  return request.post('/ride/borrow', { station_id: stationId, user_phone: userPhone })
}

export const returnBike = (bikeCode: string, stationId: number) => {
  return request.post('/ride/return', { bike_code: bikeCode, station_id: stationId })
}

export interface RideRecord {
  id: number
  bikeId: number
  bikeCode: string
  userPhone: string
  startStationId: number
  startStationName: string
  startTime: string
  endStationId: number
  endStationName: string
  endTime: string
  duration: number
  status: string
}

export interface RideRecordsParams {
  page?: number
  pageSize?: number
  user_phone?: string
  status?: string
  start_date?: string
  end_date?: string
}

export interface RideRecordsResult {
  list: RideRecord[]
  total: number
  page: number
  pageSize: number
}

export const getRideRecords = (params?: RideRecordsParams) => {
  return request.get<any, RideRecordsResult>('/ride/records', { params })
}
