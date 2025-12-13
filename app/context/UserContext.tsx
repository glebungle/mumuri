import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useState } from 'react';

const BASE_URL = 'https://mumuri.shop';

// [수정] 백엔드 API 응답 구조에 맞춘 타입 정의
// 1. 멤버 정보 (member1, member2)
export interface MemberData {
  id: number;
  name: string;
  nickname: string;
  birthday: string;   // "2025-12-12" (String)
  anniversary: string;
  email: string;
  // 필요한 필드 추가
}

// 2. 커플 정보
interface CoupleData {
  id: number;
  member1: MemberData;
  member2: MemberData;
  anniversary: string;
  // ...
}

// 3. 커플 미션 구조
interface CoupleMissionItem {
  id: number;
  couple: CoupleData;
  mission: {
    id: number;
    title: string;
    description: string;
  };
  missionDate: string;
  // ...
}

// 4. 최상위 응답 (/home/main)
export interface HomeData {
  anniversary: string; // "2025-12-12" (String)
  name: string;        // 사용자 이름
  date: number;        // D-Day (Number) - API에서는 date라는 이름으로 옴
  roomId: number;      // 채팅방 ID
  coupleMission: CoupleMissionItem[]; // 구체적인 타입 적용
}

interface UserContextType {
  userData: HomeData | null;
  setUserData: (data: HomeData | null) => void;
  refreshUserData: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  userData: null,
  setUserData: () => {},
  refreshUserData: async () => {},
});

export const useUser = () => useContext(UserContext);

async function fetchHomeMain() {
  const token = await AsyncStorage.getItem('token');
  
  if (!token) return null;
  
  try {
    const res = await fetch(`${BASE_URL}/home/main`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch home data (Status: ${res.status})`);
    }

    // [변경] res.json() 대신 text로 먼저 받아서 확인
    const textData = await res.text();
    console.log("Raw Server Response:", textData.substring(0, 500) + "..."); // 너무 기니까 앞부분만 출력

    // 여기서 에러가 난다면 백엔드 데이터가 확실히 순환참조임
    return JSON.parse(textData); 

  } catch (error) {
    console.error("Network or Logic Error:", error);
    throw error;
  }
}

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [userData, setUserData] = useState<HomeData | null>(null);

  const refreshUserData = async () => {
    try {
      const data = await fetchHomeMain();
      console.log('✅ Home Data Loaded:', data); // 데이터 확인용
      setUserData(data);
    } catch (e) {
      console.warn('User data fetch failed', e);
    }
  };

  return (
    <UserContext.Provider value={{ userData, setUserData, refreshUserData }}>
      {children}
    </UserContext.Provider>
  );
};