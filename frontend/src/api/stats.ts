import request from "@/utils/request";

export interface OverviewStats {
  stations: {
    totalStations: number;
    totalDocks: number;
    totalAvailableBikes: number;
    totalEmptyDocks: number;
  };
  bikes: {
    totalBikes: number;
    inStationBikes: number;
    ridingBikes: number;
    dispatchingBikes: number;
    repairingBikes: number;
  };
  todayRides: {
    todayRides: number;
    todayUsers: number;
  };
  todayDispatches: {
    todayDispatches: number;
    totalDispatchedBikes: number;
  };
}

export const getOverviewStats = () => {
  return request.get<any, OverviewStats>("/stats/overview");
};

export interface HourlyRideData {
  hour: string;
  count: number;
}

export const getHourlyRides = (date?: string) => {
  return request.get<any, HourlyRideData[]>("/stats/rides/hourly", {
    params: { date },
  });
};

export interface DailyRideData {
  date: string;
  count: number;
}

export const getDailyRides = (days?: number) => {
  return request.get<any, DailyRideData[]>("/stats/rides/daily", {
    params: { days },
  });
};

export interface StationRideRank {
  id: number;
  stationCode: string;
  stationName: string;
  district: string;
  count: number;
}

export const getStationRideRank = (top?: number, type?: string) => {
  return request.get<any, StationRideRank[]>("/stats/rides/stations", {
    params: { top, type },
  });
};

export interface DistrictDailyData {
  date: string;
  [key: string]: string | number;
}

export const getDistrictDailyRides = (days?: number) => {
  return request.get<any, DistrictDailyData[]>("/stats/district/daily", {
    params: { days },
  });
};

export interface FillRateDistribution {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface FillRateResult {
  stations: any[];
  distribution: FillRateDistribution[];
}

export const getStationFillRate = () => {
  return request.get<any, FillRateResult>("/stats/stations/fill-rate");
};

export interface DispatchCompletionData {
  date: string;
  total: number;
  completed: number;
  rate: string;
}

export const getDispatchCompletionRate = (days?: number) => {
  return request.get<any, DispatchCompletionData[]>(
    "/stats/dispatch/completion-rate",
    { params: { days } },
  );
};

export interface FaultTypeData {
  faultType: string;
  count: number;
}

export const getFaultTypes = (days?: number) => {
  return request.get<any, FaultTypeData[]>("/stats/fault/types", {
    params: { days },
  });
};
