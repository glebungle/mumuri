import React, { createContext, useCallback, useContext, useState } from "react";
import { authFetch } from "../utils/apiClient";

// --- 타입 정의  ---
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
}

const UserContext = createContext<UserContextType>({
  userData: null,
  todayMissions: [],
  setUserData: () => {},
  setTodayMissions: () => {},
  refreshUserData: async () => {},
});

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [userData, setUserData] = useState<HomeData | null>(null);
  const [todayMissions, setTodayMissions] = useState<TodayMission[]>([]);

  const refreshUserData = useCallback(async () => {
    try {
      console.log("📡 [UserContext] 데이터 새로고침 시작");

      const [homeRes, userRes, myPageRes] = await Promise.all([
        authFetch("/home/main"),
        authFetch("/user/getuser"),
        authFetch("/api/mypage"),
      ]);

      if (!homeRes.ok || !userRes.ok || !myPageRes.ok) {
        console.warn("[UserContext] 일부 필수 API 호출 실패 - 데이터 보존");
        return;
      }

      const homeResponse = await homeRes.json();
      const userInfo = await userRes.json();
      const myPageResponse = await myPageRes.json();

      let missionResponse: TodayMission[] = [];
      if (homeResponse?.coupleId > 0) {
        try {
          const tRes = await authFetch("/api/couples/missions/today");
          if (tRes.ok) {
            missionResponse = await tRes.json();
          }
        } catch (missionErr) {
          console.warn("오늘의 미션 로드 실패(선택적 에러):", missionErr);
        }
      }

      let extractedUserId: number | null = null;
      if (typeof userInfo === "number") {
        extractedUserId = userInfo;
      } else if (userInfo && typeof userInfo === "object") {
        extractedUserId =
          userInfo.userId ?? userInfo.id ?? userInfo.memberId ?? null;
      }

      if (extractedUserId !== null && homeResponse) {
        const myPageData = myPageResponse as MyPageResponse | null;

        const mergedData: HomeData = {
          anniversary: homeResponse.anniversary || null,
          date: homeResponse.dDay || 0,
          roomId: homeResponse.roomId || 0,
          coupleId: homeResponse.coupleId || 0,
          userId: extractedUserId,
          missionCompletedCount: homeResponse.missionCompletedCount || 0,
          mainPhoto: homeResponse.mainPhoto || null,
          myProfileImageUrl: homeResponse.myProfileImageUrl || null,
          partnerProfileImageUrl: homeResponse.partnerProfileImageUrl || null,
          myName: homeResponse.myName || myPageData?.name || "사용자",
          partnerName: homeResponse.partnerName || "애인",
          birthday: myPageData?.birthday || null,
          partnerBirthday: myPageData?.birthdayCouple || null,
        };

        //업데이트
        setUserData(mergedData);
        setTodayMissions(Array.isArray(missionResponse) ? missionResponse : []);
        console.log("✅ [UserContext] 모든 데이터 동기화 완료");
      }
    } catch (e) {
      console.error("❌ [UserContext] 치명적 에러 발생:", e);
    }
  }, []);

  return (
    <UserContext.Provider
      value={{
        userData,
        todayMissions,
        setUserData,
        setTodayMissions,
        refreshUserData,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
