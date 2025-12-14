import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useState } from 'react';

const BASE_URL = 'https://mumuri.shop';

// [1] 홈 메인 데이터 + 유저 ID
export interface HomeData {
  anniversary: string;
  name: string | null;
  date: number;
  roomId: number;
  userId: number; 
  coupleId: number;
}

// [2] 오늘의 미션 데이터
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
  setTodayMissions: (missions: TodayMission[]) => void; // ✅ [수정] 이 줄이 추가되어야 합니다!
  refreshUserData: () => Promise<void>;
}

// 초기값 설정
const UserContext = createContext<UserContextType>({
  userData: null,
  todayMissions: [],
  setUserData: () => {},
  setTodayMissions: () => {}, // ✅ [수정] 초기값 추가
  refreshUserData: async () => {},
});

export const useUser = () => useContext(UserContext);

// --- API 호출 함수들 ---

async function fetchHomeMain(token: string) {
  try {
    const res = await fetch(`${BASE_URL}/home/main`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Home Main Fetch Error: ${res.status}`);
    return res.json();
  } catch (error) {
    console.error('❌ fetchHomeMain 실패:', error);
    return null; 
  }
}

async function fetchUserInfo(token: string) {
  try {
    const res = await fetch(`${BASE_URL}/user/getuser`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`User Info Fetch Error: ${res.status}`);
    return res.json();
  } catch (error) {
    console.error('❌ fetchUserInfo 실패:', error);
    return null;
  }
}

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [userData, setUserData] = useState<HomeData | null>(null);
  const [todayMissions, setTodayMissions] = useState<TodayMission[]>([]);

  const refreshUserData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.log('토큰이 없습니다.');
        return;
      }

      // 1️⃣ [STEP 1] 홈 데이터(미션포함)와 유저 ID 정보 병렬 호출
      const [homeResponse, userInfo] = await Promise.all([
        fetchHomeMain(token),
        fetchUserInfo(token),
      ]);

      // 2️⃣ [STEP 2] UserData (내 정보 + 커플 정보) 조립
      let mergedData: HomeData | null = null;
      let extractedUserId = null;

      if (typeof userInfo === 'number') {
        extractedUserId = userInfo;
      } else if (typeof userInfo === 'object' && userInfo !== null) {
        extractedUserId = userInfo.userId ?? userInfo.id ?? userInfo.memberId ?? null;
      }

      if (homeResponse && extractedUserId !== null) {
        mergedData = {
          anniversary: homeResponse.anniversary,
          name: homeResponse.name,
          date: homeResponse.date,
          roomId: homeResponse.roomId,
          coupleId: homeResponse.coupleId, 
          userId: Number(extractedUserId),
        };
        setUserData(mergedData);
        console.log(`✅ [UserContext] 데이터 로드 완료 (RoomID: ${mergedData.roomId}, CoupleID: ${mergedData.coupleId})`);
      } else {
        console.warn('⚠️ [UserContext] 데이터 로드 실패 (필수 정보 누락)');
      }

      // 3️⃣ [STEP 3] 홈 데이터에 포함된 미션 정보를 상태로 변환
      if (homeResponse && Array.isArray(homeResponse.coupleMission)) {
        const mappedMissions: TodayMission[] = homeResponse.coupleMission.map((m: any) => ({
          missionId: m.id,
          title: m.title || '오늘의 미션',
          status: m.status || 'NOT_STARTED',
          description: m.description || null,
          difficulty: m.difficulty || 'NORMAL',
          reward: m.reward || 0,
          missionDate: new Date().toISOString().split('T')[0],
          progresses: [], 
          myDone: false,
          myCompletedAt: null
        }));
        console.log('[미션 확인용]', JSON.stringify(mappedMissions, null, 2));
        console.log(`🔄 [UserContext] 미션 ${mappedMissions.length}개 로드됨`);
        setTodayMissions(mappedMissions);
      } else {
        setTodayMissions([]);
      }

    } catch (e) {
      console.warn('User data fetch failed', e);
    }
  };

  return (
    // ✅ [수정] setTodayMissions를 Provider 값에 포함
    <UserContext.Provider value={{ userData, todayMissions, setUserData, setTodayMissions, refreshUserData }}>
      {children}
    </UserContext.Provider>
  );
};