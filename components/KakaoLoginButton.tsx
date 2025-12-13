import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

const REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_KEY || '';
const BACKEND_CALLBACK_URL = 'https://mumuri.shop/api/auth/kakao/callback';
const REDIRECT_URI = BACKEND_CALLBACK_URL;

// 기본 URL
const BASE_AUTH_URL = 
  'https://kauth.kakao.com/oauth/authorize'
  + `?response_type=code`
  + `&client_id=${encodeURIComponent(REST_API_KEY)}`
  + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

export default function KakaoLoginButton() {
  const [webViewVisible, setWebViewVisible] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(BASE_AUTH_URL);
  const isHandled = useRef(false);

  const startLogin = async () => {
    if (!REST_API_KEY) {
      Alert.alert('설정 오류', '카카오 키가 없습니다.');
      return;
    }

    isHandled.current = false;
    
    // 1. 로그아웃 했었는지 확인
    const wasLoggedOut = await AsyncStorage.getItem('isLoggingOut');

    if (wasLoggedOut === 'true') {
      console.log('🔒 [LoginButton] 로그아웃 기록 확인 -> 아이디/비번 입력 강제');
      // ✅ [핵심] 로그아웃 직후일 때만 입력창을 강제합니다. (쿠키 무시)
      // 깃발을 여기서 지우지 않습니다. (실수로 창 닫았을 때 대비)
      setCurrentUrl(`${BASE_AUTH_URL}&prompt=login`);
    } else {
      console.log('⚡️ [LoginButton] 일반 로그인 (자동 로그인 허용)');
      setCurrentUrl(BASE_AUTH_URL);
    }

    setWebViewVisible(true);
  };

  const handleWebViewChange = async (url: string) => { // async
    // 2. 로그인 성공 (딥링크 감지)
    if (url.startsWith('mumuri:')) {
      if (isHandled.current) return false;
      
      console.log('🚀 [WebView] 로그인 성공! 깃발 제거 후 핸들러 이동');
      isHandled.current = true;
      
      // ✅ [핵심] 로그인이 확실히 성공했으니 이제 방어막(깃발)을 제거합니다.
      // 이걸 먼저 하고 openURL을 해야 핸들러가 차단을 안 합니다.
      await AsyncStorage.removeItem('isLoggingOut');
      
      setWebViewVisible(false);
      Linking.openURL(url); 
      return false;
    }
    return true;
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
          {webViewVisible && (
            <WebView
              style={styles.webView}
              source={{ uri: currentUrl }}
              
              sharedCookiesEnabled={true}
              thirdPartyCookiesEnabled={true}
              incognito={false} 
              
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              
              // onShouldStartLoadWithRequest: iOS 등에서 요청 가로채기
              onShouldStartLoadWithRequest={(req) => {
                // 비동기 함수 호출하고, WebView 로딩은 일단 진행(true)하거나 막음(false)
                // handleWebViewChange 내부에서 openURL 하면 페이지 이동 멈춤
                const shouldLoad = !req.url.startsWith('mumuri:');
                if (!shouldLoad) handleWebViewChange(req.url); 
                return shouldLoad;
              }}
              
              // onNavigationStateChange: Android 등에서 URL 변경 감지
              onNavigationStateChange={(e) => handleWebViewChange(e.url)}
              
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.loadingOverlay}>
                   <ActivityIndicator size="large" color="#FAE100" />
                </View>
              )}
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  buttonImage: { height: 45, width: 300, resizeMode: 'contain' },
  webViewContainer: { flex: 1, paddingTop: 40, backgroundColor: 'white' },
  webView: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  }
});