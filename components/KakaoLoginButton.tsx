// app/components/KakaoLoginButton.tsx (경로는 프로젝트 구조에 맞게)
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

// ===== Kakao OAuth =====
const REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_KEY || '';
const BACKEND_CALLBACK_URL = 'https://5fbe91913f6e.ngrok-free.app/api/auth/kakao/callback';
const REDIRECT_URI = BACKEND_CALLBACK_URL;

const KAKAO_AUTH_URL =
  'https://kauth.kakao.com/oauth/authorize'
  + `?response_type=code`
  + `&client_id=${encodeURIComponent(REST_API_KEY)}`
  + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

// ===== Backend API base =====
const API_BASE = 'https://5fbe91913f6e.ngrok-free.app';

// 공통 헤더
async function withHeaders() {
  const token = await AsyncStorage.getItem('token');
  return {
    Accept: 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  } as const;
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

// 딥링크 쿼리 
function parseDeepLink(url: string) {
  const parsed = Linking.parse(url);
  const q = parsed.queryParams ?? {};
  const token = (typeof q.token === 'string' && q.token) || '';
  const userId = (typeof q.userId === 'string' && q.userId) || '';
  const coupleId = (typeof q.coupleId === 'string' && q.coupleId) || '';
  const coupleCode = (typeof q.coupleCode === 'string' && q.coupleCode) || '';
  const isNew = String(q.isNew ?? '').toLowerCase() === 'true';
  return { token, userId, coupleId, coupleCode, isNew };
}


export default function KakaoLoginButton() {
  const [webViewVisible, setWebViewVisible] = useState(false);
  const deepLinkHandled = useRef(false);

  useEffect(() => {
    const sub = Linking.addEventListener('url', async ({ url }) => {
      if (deepLinkHandled.current) return;
      if (!url.startsWith('mumuri://auth')) return;

      deepLinkHandled.current = true;
      setWebViewVisible(false);

      try {
        const { token, userId, coupleId, coupleCode, isNew } = parseDeepLink(url);
        if (!token) throw new Error('로그인 토큰이 없습니다.');

        // 저장
        const kv: [string, string][] = [['token', token]];
        if (userId) kv.push(['userId', userId]);
        if (coupleId) kv.push(['coupleId', coupleId]);
        if (coupleCode) kv.push(['coupleCode', coupleCode]);
        await AsyncStorage.multiSet(kv);


        let status = '';
        try {
          status = await checkCoupleAlready(); 
        } catch (e) {
          router.replace('/signup');
          return;
        }

        if (/COUPLED|OK|DONE/i.test(status)) {
          router.replace('/(tabs)');
        } else {
          router.replace('/signup');
        }
      } catch (e: any) {
        console.warn('DeepLink handle error:', e?.message);
        Alert.alert('로그인 실패', e?.message ?? '다시 시도해주세요.');
      } finally {
        setTimeout(() => { deepLinkHandled.current = false; }, 500);
      }
    });

    (async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl && initialUrl.startsWith('mumuri://auth') && !deepLinkHandled.current) {
        deepLinkHandled.current = true;
        setWebViewVisible(false);
        try {
          const { token, userId, coupleId, coupleCode, isNew } = parseDeepLink(initialUrl);
          if (!token) throw new Error('로그인 토큰이 없습니다.');

          const kv: [string, string][] = [['token', token]];
          if (userId) kv.push(['userId', userId]);
          if (coupleId) kv.push(['coupleId', coupleId]);
          if (coupleCode) kv.push(['coupleCode', coupleCode]);
          await AsyncStorage.multiSet(kv);

          if (isNew) {
            router.replace('/signup');
            return;
          }
          let status = '';
          try {
            status = await checkCoupleAlready();
          } catch {
            router.replace('/signup');
            return;
          }
          if (/COUPLED|OK|DONE/i.test(status)) {
            router.replace('/(tabs)');
          } else {
            router.replace('/signup');
          }
        } catch (e: any) {
          console.warn('InitialURL handle error:', e?.message);
        } finally {
          setTimeout(() => { deepLinkHandled.current = false; }, 500);
        }
      }
    })();

    return () => sub.remove();
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
        <Image source={require('../assets/images/kakao_login.png')} style={styles.buttonImage} />
      </Pressable>

      <Modal visible={webViewVisible} animationType="slide" onRequestClose={() => setWebViewVisible(false)}>
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
  buttonImage: { width: 300, resizeMode: 'contain' },
  webViewContainer: { flex: 1, paddingTop: 40, backgroundColor: 'white' },
  webView: { flex: 1 },
});
