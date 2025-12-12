// app/oauth/kakao.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
// import { authedFetch, normalizeMe } from '../lib/api'; // (경로가 맞는지 확인 필요)
// import { hydrateUserBasicsFromGetuser } from '../lib/userBasics'; // (경로가 맞는지 확인 필요)

// ✅ 임시로 fetch 함수 정의 (기존 파일에 있다면 import 그대로 쓰세요)
async function authedFetch(path: string, options: any) {
  const token = await AsyncStorage.getItem('token');
  const res = await fetch(`https://mumuri.shop${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'ngrok-skip-browser-warning': 'true',
    }
  });
  return res.json();
}

function normalizeMe(raw: any) {
  return {
    userId: raw.userId ?? raw.id ?? raw.memberId,
    coupleId: raw.coupleId ?? raw.couple_id,
    coupleCode: raw.coupleCode ?? raw.couple_code,
    name: raw.name ?? raw.nickname,
  };
}

export default function KakaoDeepLinkHandler() {
  // ✅ [수정 1] 백엔드가 보내주는 이름인 'accessToken'으로 받아야 합니다.
  const { accessToken, nickname, status } = useLocalSearchParams<{ accessToken?: string; nickname?: string; status?: string }>();
  const once = useRef(false);

  useEffect(() => {
    (async () => {
      // 파라미터가 아직 로드되지 않았으면 대기 (Expo Router 특성상 초기 렌더링에 비어있을 수 있음)
      if (!accessToken) return; 
      
      if (once.current) return;
      once.current = true;

      console.log('✅ [DeepLink Page] Token Received:', accessToken);

      try {
        // 1) 토큰/닉네임 저장
        // ✅ [수정 2] accessToken을 앱 내부에서는 'token'이라는 이름으로 저장
        await AsyncStorage.setItem('token', String(accessToken));
        
        if (nickname) await AsyncStorage.setItem('name', String(nickname));
        
        // (필요하다면 여기서 hydrateUserBasicsFromGetuser 호출)
        // await hydrateUserBasicsFromGetuser(); 

        // 2) /user/getuser 호출하여 정보 최신화
        const raw = await authedFetch('/user/getuser', { method: 'GET' });
        const me = normalizeMe(raw);
        
        const kv: [string,string][] = [];
        if (me.userId != null)   kv.push(['userId', String(me.userId)]);
        if (me.coupleId != null) kv.push(['coupleId', String(me.coupleId)]);
        if (me.coupleCode)       kv.push(['coupleCode', String(me.coupleCode)]);
        if (me.name)             kv.push(['name', String(me.name)]);
        
        if (kv.length) await AsyncStorage.multiSet(kv);

        console.log('💾 [DeepLink Page] User Info Saved:', me);

        // 3) 라우팅 분기
        // 백엔드가 status로 'solo'를 보내는지 'NEW'를 보내는지 확인 필요
        // (이전 로그에서는 'solo'였음. 둘 다 처리하도록 || 조건 추가)
        if (status === 'NEW' || status === 'NEED_INFO' || status === 'solo') {
           router.replace('/signup');
        } else {
           router.replace('/(tabs)/home');
        }

      } catch (e: any) {
        console.warn('getuser failed:', e?.message);
        Alert.alert('로그인 처리 실패', '정보를 불러오는데 실패했습니다.');
        router.replace('/'); // 실패 시 로그인 화면으로
      }
    })();
  }, [accessToken, nickname, status]);

  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor: '#FFFCF5' }}>
      <ActivityIndicator size="large" color="#333" />
    </View>
  );
}