import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

// ===== Kakao OAuth =====
const REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_KEY || '';
const BACKEND_CALLBACK_URL = 'https://mumuri.shop/api/auth/kakao/callback';
const REDIRECT_URI = BACKEND_CALLBACK_URL;

const KAKAO_AUTH_URL =
  'https://kauth.kakao.com/oauth/authorize'
  + `?response_type=code`
  + `&client_id=${encodeURIComponent(REST_API_KEY)}`
  + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

const API_BASE = 'https://mumuri.shop';

async function withHeaders() {
  const token = await AsyncStorage.getItem('token');
  return {
    Accept: 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchAndSyncUserInfo() {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    const res = await fetch(`${API_BASE}/user/getuser`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'ngrok-skip-browser-warning': 'true',
      },
    });

    if (res.status === 429) {
      console.warn('🚨 [429 Error] 요청이 너무 많습니다. 잠시 후 시도하세요.');
      return;
    }

    const raw = await res.text();
    if (!res.ok) return;

    let data: any = {};
    try { data = JSON.parse(raw); } catch {}

    const userId = data.userId ?? data.id ?? data.memberId ?? null;
    const coupleId = data.coupleId ?? data.couple_id ?? null;
    const coupleCode = data.coupleCode ?? data.couple_code ?? null;

    const kv: [string, string][] = [];
    if (userId != null) kv.push(['userId', String(userId)]);
    if (coupleId != null) kv.push(['coupleId', String(coupleId)]);
    if (coupleCode) kv.push(['coupleCode', String(coupleCode)]);

    if (kv.length) await AsyncStorage.multiSet(kv);
  } catch (err) {
    console.warn('[login] user sync failed:', err);
  }
}

async function checkCoupleAlready(): Promise<string> {
  const res = await fetch(`${API_BASE}/user/couple/already`, {
    method: 'GET',
    headers: await withHeaders(),
  });
  
  if (res.status === 429) {
    throw new Error('요청이 너무 많습니다. 5분 뒤 다시 시도해주세요.');
  }

  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return text;
}

function parseDeepLink(url: string) {
  const parsed = Linking.parse(url);
  const q = parsed.queryParams ?? {};

  return {
    token: typeof q.accessToken === 'string' ? q.accessToken : (typeof q.token === 'string' ? q.token : ''),
    userId: typeof q.userId === 'string' ? q.userId : '',
    coupleId: typeof q.coupleId === 'string' ? q.coupleId : '',
    coupleCode: typeof q.coupleCode === 'string' ? q.coupleCode : '',
    isNew: String(q.isNew ?? '').toLowerCase() === 'true' || q.status === 'solo',
  };
}

export default function KakaoLoginButton() {
  const [webViewVisible, setWebViewVisible] = useState(false);
  const isHandlingRef = useRef(false);

  useEffect(() => {
    const onLink = async ({ url }: { url: string }) => {
      if (!url.startsWith('mumuri:')) return;

      // 🔥 [중복 방지] 이미 처리 중이면 무시
      if (isHandlingRef.current) return;
      isHandlingRef.current = true;

      setWebViewVisible(false);

      try {
        const parsedData = parseDeepLink(url);
        const { token, isNew } = parsedData;

        if (!token) {
          console.log('⚠️ 토큰 없음 (무시):', url);
          // 실패했더라도 바로 풀지 않고 약간 딜레이를 둠
          setTimeout(() => { isHandlingRef.current = false; }, 1000);
          return;
        }

        console.log('🔑 토큰 획득 성공! API 호출 시작...');

        const kv: [string, string][] = [['token', token]];
        if (parsedData.userId) kv.push(['userId', parsedData.userId]);
        if (parsedData.coupleId) kv.push(['coupleId', parsedData.coupleId]);
        if (parsedData.coupleCode) kv.push(['coupleCode', parsedData.coupleCode]);
        await AsyncStorage.multiSet(kv);

        // API 호출들
        await fetchAndSyncUserInfo();

        if (isNew) {
           router.replace('/signup');
           return;
        }

        let status = '';
        try {
          status = await checkCoupleAlready();
          console.log('🔍 커플 상태:', status);
        } catch (e: any) {
          console.log('⚠️ 상태 확인 실패:', e.message);
          // 429 에러면 여기서 멈춤
          if (e.message.includes('요청이 너무 많습니다')) {
             Alert.alert('잠시만요!', '로그인 요청이 너무 많습니다. 5분 뒤 다시 시도해주세요.');
             return;
          }
          // 그 외 에러는 일단 홈으로
          router.replace('/(tabs)/home');
          return;
        }

        if (/COUPLED|OK|DONE|SOLO|NOT COUPLE|NOT_COUPLE/i.test(status)) {
          router.replace('/(tabs)/home');
        } else {
          router.replace('/signup');
        }

      } catch (err: any) {
        Alert.alert('로그인 실패', err?.message ?? '다시 시도해주세요.');
      } finally {
        // 🔥 [중요] 처리 완료 후 3초 동안은 재진입 금지 (API 난사 방지)
        setTimeout(() => {
          isHandlingRef.current = false;
        }, 3000);
      }
    };

    const sub = Linking.addEventListener('url', onLink);
    return () => {
      sub.remove();
    };
  }, []);

  const startLogin = () => {
    // 버튼 눌렀을 때도 처리 중이면 막음
    if (isHandlingRef.current) return;
    
    if (!REST_API_KEY) {
      Alert.alert('오류', '카카오 키 설정 확인 필요');
      return;
    }
    setWebViewVisible(true);
  };

  return (
    <>
      <Pressable onPress={startLogin}>
        <Image
          source={require('../assets/images/kakao_login.png')}
          style={styles.buttonImage}
        />
      </Pressable>

      <Modal
        visible={webViewVisible}
        animationType="slide"
        onRequestClose={() => setWebViewVisible(false)}
      >
        <View style={styles.webViewContainer}>
          <WebView
            style={styles.webView}
            source={{ uri: KAKAO_AUTH_URL }}
            javaScriptEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            domStorageEnabled
            originWhitelist={['*']}
            
            onShouldStartLoadWithRequest={(req) => {
              if (req.url.startsWith('mumuri:')) {
                Linking.openURL(req.url);
                setWebViewVisible(false);
                return false;
              }
              return true;
            }}

            onNavigationStateChange={(e) => {
              if (e.url.startsWith('mumuri:')) {
                setWebViewVisible(false);
                Linking.openURL(e.url);
              }
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  buttonImage: {
    width: 300,
    resizeMode: 'contain',
  },
  webViewContainer: {
    flex: 1,
    paddingTop: 40,
    backgroundColor: 'white',
  },
  webView: {
    flex: 1,
  },
});