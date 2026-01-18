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
 * 리프레시 토큰
 */
async function getNewToken() {
  try {
    const refreshToken = await AsyncStorage.getItem("refreshToken");
    if (!refreshToken) throw new Error("리프레시 토큰 없음");

    const res = await fetch(
      `${BASE_URL}/api/auth/refresh?refreshToken=${encodeURIComponent(refreshToken)}`,
      {
        method: "POST",
      },
    );

    if (res.ok) {
      const data = await res.json();
      await AsyncStorage.setItem("token", data.accessToken);
      if (data.refreshToken)
        await AsyncStorage.setItem("refreshToken", data.refreshToken);
      return data.accessToken;
    }
    throw new Error("갱신 실패");
  } catch (e) {
    // 리프레시 토큰까지 만료된 경우 강제 로그아웃
    await AsyncStorage.multiRemove(["token", "refreshToken", "userId"]);
    router.replace("/");
    return null;
  }
}

/**
 * 공통 함수
 */
export async function authFetch(url: string, options: any = {}) {
  const token = await AsyncStorage.getItem("token");
  const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;

  const execute = (t: string | null) =>
    fetch(fullUrl, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        Authorization: `Bearer ${t}`,
      },
    });

  let res = await execute(token);

  // 토큰만료 발생 시 처리
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
        return execute(newToken);
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
