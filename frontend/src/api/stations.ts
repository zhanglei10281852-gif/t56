import request from '@/utils/request'

export interface Station {
  id: number
  stationCode: string
  stationName: string
  latitude: number
  longitude: number
  district: string
  totalDocks: number
  availableBikes: number
  emptyDocks: number
  fillRate: string
  statusLevel: 'normal' | 'surplus' | 'shortage'
  status?: number
}

export interface StationListParams {
  district?: string
  page?: number
  pageSize?: number
  keyword?: string
}

export interface StationListResult {
  list: Station[]
  total: number
  page: number
  pageSize: number
}

export const getStationList = (params?: StationListParams) => {
  return request.get<any, StationListResult>('/stations', { params })
}

export const getStationDetail = (id: number) => {
  return request.get<any, Station & { bikes: any[] }>(`/stations/${id}`)
}

export interface CreateStationParams {
  station_name: string
  latitude: number
  longitude: number
  district: string
  total_docks: number
  available_bikes?: number
}

export const createStation = (params: CreateStationParams) => {
  return request.post('/stations', params)
}

export const updateStation = (id: number, params: Partial<CreateStationParams>) => {
  return request.put(`/stations/${id}`, params)
}

export const deleteStation = (id: number) => {
  return request.delete(`/stations/${id}`)
}

export interface DispatchSuggestion {
  id: number
  stationCode: string
  stationName: string
  district: string
  totalDocks: number
  availableBikes: number
  emptyDocks: number
  fillRate: string
  targetBikes: number
  adjustCount: number
}

export interface DispatchSuggestionsResult {
  surplusStations: DispatchSuggestion[]
  shortageStations: DispatchSuggestion[]
  totalNeedDispatch: number
}

export const getDispatchSuggestions = () => {
  return request.get<any, DispatchSuggestionsResult>('/stations/dispatch/suggestions')
}
