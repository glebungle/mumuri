import * as Linking from 'expo-linking';
import React, { useState } from 'react';
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

export default function KakaoLoginButton() {
  const [webViewVisible, setWebViewVisible] = useState(false);

  const startLogin = () => {
    if (!REST_API_KEY) {
      Alert.alert('설정 오류', '카카오 키가 없습니다.');
      return;
    }
    setWebViewVisible(true);
  };

  const handleDeepLink = (url: string) => {
    // 딥링크가 감지되면 웹뷰를 끄고 앱네비게이션(app/oauth/kakao.tsx)에게 넘김
    if (url.startsWith('mumuri:')) {
      console.log('🚀 [WebView] 딥링크 감지 -> 라우팅 파일로 위임');
      setWebViewVisible(false);
      Linking.openURL(url); // 이게 실행되면 app/oauth/kakao.tsx 가 켜집니다.
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
          <WebView
            style={styles.webView}
            source={{ uri: KAKAO_AUTH_URL }}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            originWhitelist={['*']}
            onShouldStartLoadWithRequest={(req) => handleDeepLink(req.url)}
            onNavigationStateChange={(e) => handleDeepLink(e.url)}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  buttonImage: { height:45,width: 300, resizeMode: 'contain' },
  webViewContainer: { flex: 1, paddingTop: 40, backgroundColor: 'white' },
  webView: { flex: 1 },
});