import React, { createContext, useCallback, useContext, useState } from "react";
import { authFetch } from "../utils/apiClient";

// --- 타입 정의 ---
export interface MainPhoto {
  photoId: number;
  imageUrl: string;
  uploaderType: string;
  uploaderNickname: string;
  createdAt: string;
}

interface MyPageResponse {
  name: string;
  birthday: string;
  anniversary: string;
  birthdayCouple: string;
  dDay: number;
}

export interface HomeData {
  anniversary: string;
  date: number;
  roomId: number;
  userId: number;
  coupleId: number;
  missionCompletedCount: number;
  mainPhoto: MainPhoto | null;
  myProfileImageUrl: string | null;
  partnerProfileImageUrl: string | null;
  myName: string | null;
  partnerName: string | null;
  birthday: string | null;
  partnerBirthday: string | null;
}

export interface TodayMission {
  missionId: number;
  title: string;
  description: string | null;
  difficulty: string;
  reward: number;
  status: string;
  missionDate: string;
  progresses: any[];
  myDone: boolean;
  myCompletedAt: string | null;
}

interface UserContextType {
  userData: HomeData | null;
  todayMissions: TodayMission[];
  setUserData: (data: HomeData | null) => void;
  setTodayMissions: (missions: TodayMission[]) => void;
  refreshUserData: () => Promise<void>;
  isRefreshing: boolean;
}

const UserContext = createContext<UserContextType>({
  userData: null,
  todayMissions: [],
  setUserData: () => {},
  setTodayMissions: () => {},
  refreshUserData: async () => {},
  isRefreshing: false,
});

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [userData, setUserData] = useState<HomeData | null>(null);
  const [todayMissions, setTodayMissions] = useState<TodayMission[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshUserData = useCallback(async () => {
    if (isRefreshing) {
      console.log("[UserContext] 이미 새로고침 중...");
      return;
    }

    setIsRefreshing(true);
    try {
      // 1단계: 기본 정보 로드
      const homeRes = await authFetch("/home/main");

      if (!homeRes.ok) {
        console.warn("[UserContext] /home/main 실패:", homeRes.status);
        if (homeRes.status === 401) {
          throw new Error("AUTHENTICATION_FAILED");
        }
        return;
      }

      const homeResponse = await homeRes.json();

      // 2단계: 사용자 정보 로드
      const [userRes, myPageRes] = await Promise.all([
        authFetch("/user/getuser"),
        authFetch("/api/mypage"),
      ]);

      if (!userRes.ok || !myPageRes.ok) {
        console.warn("[UserContext] 사용자 정보 로드 실패");
      }

      const userInfo = userRes.ok ? await userRes.json() : null;
      const myPageResponse = myPageRes.ok ? await myPageRes.json() : null;

      // 3단계: 미션 정보 로드 (coupleId가 있을 때만)
      let missionResponse: TodayMission[] = [];
      if (homeResponse?.coupleId > 0) {
        try {
          const tRes = await authFetch("/api/couples/missions/today");
          if (tRes.ok) {
            missionResponse = await tRes.json();
          }
        } catch (error) {
          console.warn("[UserContext] 미션 정보 로드 실패:", error);
        }
      }

      // 4단계: 데이터 병합
      let extractedUserId: number | null = null;
      if (typeof userInfo === "number") {
        extractedUserId = userInfo;
      } else if (userInfo && typeof userInfo === "object") {
        extractedUserId =
          userInfo.userId ?? userInfo.id ?? userInfo.memberId ?? null;
      }

      if (extractedUserId !== null && homeResponse) {
        const mergedData: HomeData = {
          anniversary: homeResponse.anniversary || null,
          date: homeResponse.dDay ?? 1,
          roomId: homeResponse.roomId || 0,
          coupleId: homeResponse.coupleId || 0,
          userId: extractedUserId,
          missionCompletedCount: homeResponse.missionCompletedCount || 0,
          mainPhoto: homeResponse.mainPhoto || null,
          myProfileImageUrl: homeResponse.myProfileImageUrl || null,
          partnerProfileImageUrl: homeResponse.partnerProfileImageUrl || null,
          myName: homeResponse.myName || myPageResponse?.name || "사용자",
          partnerName: homeResponse.partnerName || "애인",
          birthday: myPageResponse?.birthday || null,
          partnerBirthday: myPageResponse?.birthdayCouple || null,
        };

        setUserData(mergedData);
        setTodayMissions(Array.isArray(missionResponse) ? missionResponse : []);
      } else {
        console.warn("[UserContext] 사용자 ID 추출 실패");
      }
    } catch (error: any) {
      // 인증 실패 시 데이터 초기화
      if (error.message === "AUTHENTICATION_FAILED") {
        setUserData(null);
        setTodayMissions([]);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  return (
    <UserContext.Provider
      value={{
        userData,
        todayMissions,
        setUserData,
        setTodayMissions,
        refreshUserData,
        isRefreshing,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
