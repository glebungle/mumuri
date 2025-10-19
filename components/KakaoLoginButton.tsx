import * as Linking from 'expo-linking';
import React, { useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

const BACKEND_CALLBACK_URL = 'https://40b57014557d.ngrok-free.app/api/auth/kakao/callback';
const REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_KEY || '';
const REDIRECT_URI = BACKEND_CALLBACK_URL;

const KAKAO_AUTH_URL =
  'https://kauth.kakao.com/oauth/authorize'
  + `?response_type=code`
  + `&client_id=${encodeURIComponent(REST_API_KEY)}`
  + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

export default function KakaoLoginButton() {
  const [webViewVisible, setWebViewVisible] = useState(false);

  const handlePress = () => {
    if (!REST_API_KEY) {
      Alert.alert('⚙️ 설정 필요', 'EXPO_PUBLIC_KAKAO_REST_KEY 환경변수를 설정하세요.');
      return;
    }
    setWebViewVisible(true);
  };

  return (
    <>
      <Pressable onPress={handlePress}>
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
              console.log('REQ URL =>', req.url);
              if (req.url.startsWith('mumuri://')) {
                // 딥링크는 앱으로 넘기고 WebView는 닫기
                Linking.openURL(req.url);
                setWebViewVisible(false);
                return false;
              }
              return true;
            }}
            onNavigationStateChange={(nav) => console.log('WebView URL:', nav.url)}
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
