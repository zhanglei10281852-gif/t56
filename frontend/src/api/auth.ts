import request from "@/utils/request";

export interface LoginParams {
  username: string;
  password: string;
}

export type UserRole = "admin" | "dispatcher";

export interface LoginResult {
  token: string;
  userInfo: {
    id: number;
    username: string;
    realName: string;
    role: UserRole;
    district: string | null;
  };
}

export const login = (params: LoginParams) => {
  return request.post<any, LoginResult>("/auth/login", params);
};

export const getProfile = () => {
  return request.get<any, any>("/auth/profile");
};

export const logout = () => {
  return request.post("/auth/logout");
};
