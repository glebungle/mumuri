import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

const BASE_URL = "https://mumuri.shop";

// 토큰 갱신 상태 관리 및 대기열
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
 * 1. 리프레시 토큰
 */
async function getNewToken() {
  try {
    const refreshToken = await AsyncStorage.getItem("refreshToken");
    if (!refreshToken) throw new Error("Refresh token not found");

    console.log("🔄 토큰 갱신 시도 중...");

    const res = await fetch(
      `${BASE_URL}/auth/refresh?refreshToken=${encodeURIComponent(refreshToken)}`,
      {
        method: "POST",
        headers: {
          Accept: "*/*",
        },
      },
    );

    if (res.ok) {
      const data = await res.json();
      const newAccessToken = data.accessToken;
      const newRefreshToken = data.refreshToken;

      // 200 OK 시 두 토큰 모두 저장소에 갱신
      const storageItems: [string, string][] = [
        ["token", String(newAccessToken)],
        ["refreshToken", String(newRefreshToken)],
      ];
      await AsyncStorage.multiSet(storageItems);

      console.log("✅ 토큰 갱신 성공");
      return newAccessToken;
    }

    // 200이 아닌 응답이 오면 리프레시 토큰도 만료된 것으로 간주
    throw new Error("Refresh request failed");
  } catch (e) {
    console.error("❌ 세션 만료: 모든 데이터 삭제 및 로그아웃");
    // 기기 내 로그인 정보 완전 삭제
    await AsyncStorage.multiRemove([
      "token",
      "refreshToken",
      "userId",
      "coupleId",
      "userData",
    ]);

    // 즉시 로그인 화면으로 튕겨냄
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
    const headers: any = { ...options.headers };

    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    if (t) {
      headers["Authorization"] = `Bearer ${t}`;
    }

    return fetch(fullUrl, { ...options, headers });
  };

  // 1. 현재 저장된 액세스 토큰 확인
  let token = await AsyncStorage.getItem("token");

  // 액세스 토큰이 아예 없는 경우 첫 요청 전에 즉시 갱신 시도
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

  // 다른 요청이 갱신 중인 경우 대기열에서 대기
  if (isRefreshing && !token) {
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    })
      .then((newToken) => execute(newToken as string))
      .catch((err) => Promise.reject(err));
  }

  // 2. 첫 번째 요청 실행
  let res = await execute(token);

  // 3. 만약 401에러가 나면 토큰 만료로 판단하고 재시도 로직 실행
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
