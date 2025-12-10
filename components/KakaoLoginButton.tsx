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

// Kakao authorize URL
const KAKAO_AUTH_URL =
  'https://kauth.kakao.com/oauth/authorize'
  + `?response_type=code`
  + `&client_id=${encodeURIComponent(REST_API_KEY)}`
  + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

// 서버 API
const API_BASE = 'https://mumuri.shop';

// 공통 헤더
async function withHeaders() {
  const token = await AsyncStorage.getItem('token');
  return {
    Accept: 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// 🔹 로그인 직후 /user/getuser 로 데이터를 동기화
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

    const raw = await res.text();
    if (!res.ok) {
      console.warn('[login] /user/getuser error', raw);
      return;
    }

    // 🔽 여기만 이렇게 수정
    let data: any = {};
    try { data = JSON.parse(raw); } catch {}

    const userId =
      data.userId ??
      data.id ??
      data.memberId ??
      null;

    const coupleId =
      data.coupleId ??
      data.couple_id ??
      null;

    const coupleCode =
      data.coupleCode ??
      data.couple_code ??
      null;

    const kv: [string, string][] = [];
    if (userId != null) kv.push(['userId', String(userId)]);
    if (coupleId != null) kv.push(['coupleId', String(coupleId)]);
    if (coupleCode) kv.push(['coupleCode', String(coupleCode)]);

    if (kv.length) {
      await AsyncStorage.multiSet(kv);
      console.log('[login] synced user info:', { userId, coupleId, coupleCode });
    }
  } catch (err) {
    console.warn('[login] user sync failed:', err);
  }
}


// 커플 상태 확인
async function checkCoupleAlready(): Promise<string> {
  const res = await fetch(`${API_BASE}/user/couple/already`, {
    method: 'GET',
    headers: await withHeaders(),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(text);

  return text;
}

// 딥링크 파싱
function parseDeepLink(url: string) {
  const parsed = Linking.parse(url);
  const q = parsed.queryParams ?? {};

  return {
    token: typeof q.token === 'string' ? q.token : '',
    userId: typeof q.userId === 'string' ? q.userId : '',
    coupleId: typeof q.coupleId === 'string' ? q.coupleId : '',
    coupleCode: typeof q.coupleCode === 'string' ? q.coupleCode : '',
    isNew: String(q.isNew ?? '').toLowerCase() === 'true',
  };
}

export default function KakaoLoginButton() {
  const [webViewVisible, setWebViewVisible] = useState(false);
  const isHandlingRef = useRef(false);

  // 🔥 딥링크 이벤트는 여기서만 처리함 (중복 금지‼)
  useEffect(() => {
    const onLink = async ({ url }: { url: string }) => {
      if (!url.startsWith('mumuri://auth')) return;

      // 중복 실행 방지
      if (isHandlingRef.current) return;
      isHandlingRef.current = true;

      setWebViewVisible(false);

      try {
        const { token, userId, coupleId, coupleCode, isNew } = parseDeepLink(url);
        if (!token) throw new Error('로그인 토큰이 없습니다.');

        // ① 기본 저장
        const kv: [string, string][] = [['token', token]];
        if (userId) kv.push(['userId', userId]);
        if (coupleId) kv.push(['coupleId', coupleId]);
        if (coupleCode) kv.push(['coupleCode', coupleCode]);
        await AsyncStorage.multiSet(kv);

        // ② 서버 값 다시 받아 최신화
        await fetchAndSyncUserInfo();

        // ③ 신규 회원이면 signup으로
        if (isNew) {
          router.replace('/signup');
          return;
        }

        // ④ 커플 여부 확인
        let status = '';
        try {
          status = await checkCoupleAlready();
        } catch {
          router.replace('/signup');
          return;
        }

        if (/COUPLED|OK|DONE/i.test(status)) {
          router.replace('/(tabs)/home');
        } else {
          router.replace('/signup');
        }
      } catch (err: any) {
        Alert.alert('로그인 실패', err?.message ?? '다시 시도해주세요.');
      } finally {
        setTimeout(() => {
          isHandlingRef.current = false;
        }, 700);
      }
    };

    const sub = Linking.addEventListener('url', onLink);

    return () => {
      sub.remove();
    };
  }, []);

  const startLogin = () => {
    if (!REST_API_KEY) {
      Alert.alert('⚙️ 설정 필요', 'EXPO_PUBLIC_KAKAO_REST_KEY 환경변수를 설정하세요.');
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
            onShouldStartLoadWithRequest={(req) => {
              if (req.url.startsWith('mumuri://auth')) {
                Linking.openURL(req.url);
                setWebViewVisible(false);
                return false;
              }
              return true;
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