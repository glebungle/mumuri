import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';

const BASE_URL = 'https://mumuri.shop';

// 간단한 User ID 조회용 (저장 목적)
async function fetchUserId(token: string) {
  try {
    const res = await fetch(`${BASE_URL}/user/getuser`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const text = await res.text();
    // JSON 파싱 시도
    if (text.startsWith('{')) {
      const data = JSON.parse(text);
      return data.userId ?? data.id ?? data.memberId;
    }
    return text; // 그냥 숫자만 오는 경우
  } catch (e) {
    console.log('User ID 조회 실패 (무시 가능):', e);
    return null;
  }
}

export default function KakaoDeepLinkHandler() {
  // ✅ [수정] 백엔드 코드(이미지)에 있는 파라미터들을 모두 받아줍니다.
  const { 
    accessToken, 
    refreshToken, // 백엔드에서 보내주고 있음
    nickname, 
    email,        // 백엔드에서 보내주고 있음
    isNew,        // ✨ 핵심: 신규 유저 여부 ("true" or "false")
    status,
    roomId 
  } = useLocalSearchParams<{ 
    accessToken?: string; 
    refreshToken?: string;
    nickname?: string; 
    email?: string;
    isNew?: string; 
    status?: string;
    roomId?: string;
  }>();
  
  const isProcessing = useRef(false);

  useEffect(() => {
    (async () => {
      if (!accessToken) return;
      if (isProcessing.current) return;
      isProcessing.current = true;

      console.log('🟢 [Login Handler] 시작');
      console.log('🔑 Access Token:', accessToken.slice(0, 10) + '...');
      console.log('🆕 신규 유저 여부(isNew):', isNew); 

      try {
        // 1. 토큰 및 기본 정보 저장
        await AsyncStorage.setItem('token', String(accessToken));
        if (refreshToken) await AsyncStorage.setItem('refreshToken', String(refreshToken));
        if (nickname) await AsyncStorage.setItem('name', String(nickname));
        if (email) await AsyncStorage.setItem('email', String(email));
        if (roomId && roomId !== '0') await AsyncStorage.setItem('roomId', String(roomId));

        // 2. User ID 저장 (선택 사항)
        const userId = await fetchUserId(String(accessToken));
        if (userId) await AsyncStorage.setItem('userId', String(userId));

        // 3. [핵심] isNew 값으로 분기 처리
        if (isNew === 'true') {
            // [신규 유저] -> 회원가입으로
            console.log('🆕 신규 회원입니다. 회원가입 페이지로 이동합니다.');
            router.replace('/signup');
        } else {
            // [기존 유저] -> 홈으로
            // isNew가 "false"이거나 없으면 기존 회원으로 간주
            console.log('✅ 기존 회원입니다. 홈으로 이동합니다.');
            router.replace('/(tabs)/home');
        }

      } catch (e) {
        console.error('❌ 핸들링 중 에러:', e);
        // 에러 나면 안전하게 회원가입으로
        router.replace('/signup');
      }
    })();
  }, [accessToken, isNew]);

  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor: '#FFFCF5' }}>
      <ActivityIndicator size="large" color="#FF9E9E" />
    </View>
  );
}