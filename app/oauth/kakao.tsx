import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

const BASE_URL = 'https://mumuri.shop';

// 기본 API 호출 함수
async function authedFetch(path: string, token: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'ngrok-skip-browser-warning': 'true',
    },
  });
  return res;
}

// [핵심] 진짜 가입된 유저인지 확인하는 함수 (이름, 생일 등이 있는지)
async function checkIsRealMember(token: string) {
  try {
    // 마이페이지를 조회해봅니다.
    // 200 OK: 이름/생일 정보가 있음 -> (홈으로)
    // 500 Error: 정보가 없어서 서버 에러 발생 -> (회원가입으로)
    const res = await fetch(`${BASE_URL}/api/mypage`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.ok; 
  } catch (e) {
    return false;
  }
}

export default function KakaoDeepLinkHandler() {
  const { accessToken, nickname, status } = useLocalSearchParams<{ accessToken?: string; nickname?: string; status?: string }>();
  const isProcessing = useRef(false);

  useEffect(() => {
    (async () => {
      // 1. 토큰 유효성 체크
      if (!accessToken) return;
      if (isProcessing.current) return;
      isProcessing.current = true;

      console.log('🟢 [Login Check] 로직 시작');
      console.log('🔑 받은 토큰:', accessToken.slice(0, 10) + '...');

      try {
        // 2. 토큰 및 기본 정보 로컬 저장
        await AsyncStorage.setItem('token', String(accessToken));
        if (nickname) await AsyncStorage.setItem('name', String(nickname));

        // 3. 백엔드가 명시적으로 "신규 유저"라고 알려준 경우
        if (status === 'NEW' || status === 'NEED_INFO') {
          console.log('✨ 상태코드(NEW) 감지 -> 회원가입 이동');
          router.replace('/signup');
          return;
        }

        // 4. 유저 ID 가져오기 (저장 목적)
        // 참고: 여기서 ID가 나와도(예: 80), 이름/생일이 없을 수 있음
        const userRes = await authedFetch('/user/getuser', String(accessToken));
        const userText = await userRes.text();
        console.log('📦 User ID 응답:', userText);

        try {
          // 응답이 JSON 객체일 수도 있고, 그냥 숫자(80)일 수도 있어서 처리
          let userId = userText; 
          let coupleId = null;

          // 만약 JSON 형식이면 파싱 시도
          if (userText.startsWith('{')) {
             const userData = JSON.parse(userText);
             userId = userData.userId ?? userData.id ?? userData.memberId;
             coupleId = userData.coupleId ?? userData.couple_id;
          }

          // ID 저장
          if (userId) await AsyncStorage.setItem('userId', String(userId));
          if (coupleId) await AsyncStorage.setItem('coupleId', String(coupleId));
        } catch (parseError) {
          console.log('ID 파싱 중 경미한 오류 (무시 가능):', parseError);
        }

        // 5. [중요] 실제 정보가 있는지 확인 (API 찔러보기)
        const isRealMember = await checkIsRealMember(String(accessToken));

        if (isRealMember) {
          console.log('✅ 정회원 확인됨 (정보 있음) -> 홈으로 이동');
          router.replace('/(tabs)/home');
        } else {
          console.log('📝 정보 없음 (ID만 있는 껍데기 계정) -> 회원가입 이동');
          router.replace('/signup');
        }

      } catch (e: any) {
        console.error('❌ 로그인 처리 중 에러:', e);
        if (e.message?.includes('요청이 너무 많습니다')) {
            Alert.alert('알림', '잠시 후 다시 시도해주세요.');
        } else {
            // 에러가 나면 안전하게 로그인 화면이나 회원가입으로 보냄
            Alert.alert('로그인 확인', '추가 정보 입력이 필요합니다.');
            router.replace('/signup');
        }
      }
    })();
  }, [accessToken]);

  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor: '#FFFCF5' }}>
      <ActivityIndicator size="large" color="#FF9E9E" />
    </View>
  );
}