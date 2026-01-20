import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { authFetch } from "../utils/apiClient";

// --- [1] 타입 정의 ---
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

// --- [2] Provider 구현 ---
export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [userData, setUserData] = useState<HomeData | null>(null);
  const [todayMissions, setTodayMissions] = useState<TodayMission[]>([]);

  const refreshingRef = useRef(false);
  const [isRefreshingState, setIsRefreshingState] = useState(false);

  const refreshUserData = useCallback(async () => {
    // 1. 중복 호출 락(Lock)
    if (refreshingRef.current) {
      console.log("[UserContext] 이미 데이터를 가져오는 중입니다.");
      return;
    }

    refreshingRef.current = true;
    setIsRefreshingState(true);

    try {
      console.log("📡 [UserContext] 데이터 새로고침 시작");

      // 2. 필수 데이터 호출
      const [homeRes, userRes, myPageRes] = await Promise.all([
        authFetch("/home/main"),
        authFetch("/user/getuser"),
        authFetch("/api/mypage"),
      ]);

      if (!homeRes.ok || !userRes.ok || !myPageRes.ok) {
        console.warn("[UserContext] 필수 API 로드 실패 (상태 유지)");
        return;
      }

      const homeResponse = await homeRes.json();
      const userInfo = await userRes.json();
      const myPageResponse = await myPageRes.json();

      // 3. 미션 정보 로드
      let missionResponse: TodayMission[] = [];
      if (homeResponse?.coupleId > 0) {
        const tRes = await authFetch("/api/couples/missions/today");
        if (tRes.ok) {
          missionResponse = await tRes.json();
        }
      }

      // 4. 데이터 조립
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
          date: homeResponse.dDay ?? 1,
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

        setUserData(mergedData);
        setTodayMissions(Array.isArray(missionResponse) ? missionResponse : []);
        console.log("✅ [UserContext] 데이터 업데이트 완료");
      }
    } catch (e: any) {
      console.error("❌ [UserContext] 새로고침 중 오류 발생:", e.message);
    } finally {
      refreshingRef.current = false;
      setIsRefreshingState(false);
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
        isRefreshing: isRefreshingState,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
