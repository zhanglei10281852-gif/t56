import axios from "axios";
import { message } from "antd";
import { useAuthStore } from "@/store/auth";

function toCamelCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (typeof obj !== "object") return obj;

  const result: Record<string, any> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
        letter.toUpperCase(),
      );
      result[camelKey] = toCamelCase(obj[key]);
    }
  }
  return result;
}

const request = axios.create({
  baseURL: "/api",
  timeout: 15000,
});

request.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

request.interceptors.response.use(
  (response) => {
    const res = response.data;
    if (res.code === 200) {
      return toCamelCase(res.data);
    } else {
      message.error(res.message || "请求失败");
      return Promise.reject(new Error(res.message || "请求失败"));
    }
  },
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    } else {
      message.error(
        error.response?.data?.message || error.message || "网络错误",
      );
    }
    return Promise.reject(error);
  },
);

export default request;
