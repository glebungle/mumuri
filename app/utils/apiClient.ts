// utils/apiClient.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Alert } from "react-native";

const BASE_URL = "https://mumuri.shop";
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

/**
 * 토큰 갱신 시도
 */
async function getNewToken() {
  try {
    const refreshToken = await AsyncStorage.getItem("refreshToken");
    if (!refreshToken) throw new Error("NO_REFRESH_TOKEN");

    const res = await fetch(
      `${BASE_URL}/auth/refresh?refreshToken=${encodeURIComponent(refreshToken)}`,
      { method: "POST", headers: { Accept: "*/*" } },
    );

    if (res.ok) {
      const data = await res.json();
      await AsyncStorage.multiSet([
        ["token", String(data.accessToken)],
        ["refreshToken", String(data.refreshToken)],
      ]);
      return data.accessToken;
    }

    if (res.status === 401) {
      throw new Error("SESSION_EXPIRED");
    }

    throw new Error("SERVER_TEMPORARY_ERROR");
  } catch (e: any) {
    if (e.message === "SESSION_EXPIRED") {
      console.error("❌ 리프레시 토큰 만료: 로그아웃 처리");
      await AsyncStorage.multiRemove([
        "token",
        "refreshToken",
        "userData",
        "coupleId",
        "roomId",
      ]);
      Alert.alert("리프레시 토큰 만료");
      router.replace("/(auth)");
    } else {
      console.warn("⚠️ 일시적 통신 장애: 데이터 보존함", e.message);
    }
    return null;
  }
}

/**
 * 공통 fetch
 */
export async function authFetch(url: string, options: any = {}) {
  const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;

  const execute = async (t: string | null) => {
    const headers: any = {
      ...options.headers,
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    };
    if (!(options.body instanceof FormData))
      headers["Content-Type"] = "application/json";
    if (t) headers["Authorization"] = `Bearer ${t}`;
    return fetch(fullUrl, { ...options, headers });
  };

  let token = await AsyncStorage.getItem("token");
  let res = await execute(token);

  if (res.status === 401) {
    if (isRefreshing) {
      const newToken = await new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      });
      return await execute(newToken as string);
    }

    isRefreshing = true;
    try {
      const newToken = await getNewToken();
      if (newToken) {
        processQueue(null, newToken);
        return await execute(newToken);
      }
      return res;
    } catch (e) {
      processQueue(e, null);
      return res;
    } finally {
      isRefreshing = false;
    }
  }

  return res;
}
