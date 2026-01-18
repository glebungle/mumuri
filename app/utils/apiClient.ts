import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

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
 * 1. 토큰 갱신 로직
 */
async function getNewToken() {
  try {
    const refreshToken = await AsyncStorage.getItem("refreshToken");
    if (!refreshToken) throw new Error("REFRESH_TOKEN_NOT_FOUND");

    console.log("🔄 [apiClient] 토큰 갱신 시도...");

    const res = await fetch(
      `${BASE_URL}/auth/refresh?refreshToken=${encodeURIComponent(refreshToken)}`,
      {
        method: "POST",
        headers: { Accept: "*/*" },
      },
    );

    if (res.ok) {
      const data = await res.json();
      await AsyncStorage.multiSet([
        ["token", String(data.accessToken)],
        ["refreshToken", String(data.refreshToken)],
      ]);
      console.log("✅ [apiClient] 토큰 갱신 성공");
      return data.accessToken;
    }

    throw new Error("REFRESH_FAILED");
  } catch (e) {
    console.error("❌ [apiClient] 세션 만료, 로그아웃 처리");
    await AsyncStorage.multiRemove([
      "token",
      "refreshToken",
      "userId",
      "coupleId",
      "userData",
      "roomId",
    ]);
    router.replace("/(auth)");
    return null;
  }
}

/**
 * 2. 공통 인증 Fetch 함수
 */
export async function authFetch(url: string, options: any = {}) {
  const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;

  const execute = async (t: string | null) => {
    const headers: any = {
      ...options.headers,
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Expires: "0",
    };

    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    if (t) {
      headers["Authorization"] = `Bearer ${t}`;
    }

    return fetch(fullUrl, { ...options, headers });
  };

  let token = await AsyncStorage.getItem("token");

  if (!token && !isRefreshing) {
    isRefreshing = true;
    try {
      token = await getNewToken();
      processQueue(null, token);
    } catch (e) {
      processQueue(e, null);
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }

  if (isRefreshing && !token) {
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    })
      .then((newToken) => execute(newToken as string))
      .catch((err) => Promise.reject(err));
  }

  let res = await execute(token);

  if (res.status === 401) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((newToken) => execute(newToken as string))
        .catch((err) => Promise.reject(err));
    }

    isRefreshing = true;

    try {
      const newToken = await getNewToken();
      if (newToken) {
        processQueue(null, newToken);
        return await execute(newToken);
      }
    } catch (e) {
      processQueue(e, null);
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }

  return res;
}
