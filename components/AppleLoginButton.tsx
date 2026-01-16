import AsyncStorage from '@react-native-async-storage/async-storage'; // 추가
import axios from 'axios';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

const BASE_URL = 'https://mumuri.shop'; // 사용자님의 실제 서버 주소

export default function AppleLoginButton() {
  const handleAppleLogin = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // 1. 서버로 identityToken 전송 (인경님 API 주소로 변경 필요)
      const response = await axios.post(`${BASE_URL}/api/auth/apple/callback

Parameters`, {
        identityToken: credential.identityToken,
        fullName: credential.fullName, 
        email: credential.email,    
      });

      if (response.status === 200) {
        const { accessToken, refreshToken, isNew, roomId } = response.data;

        // 2. 카카오 핸들러처럼 AsyncStorage에 토큰 및 정보 저장
        await AsyncStorage.setItem('token', String(accessToken));
        if (refreshToken) await AsyncStorage.setItem('refreshToken', String(refreshToken));
        if (roomId && roomId !== '0') await AsyncStorage.setItem('roomId', String(roomId));
        
        // 이메일/이름 저장
        if (credential.email) await AsyncStorage.setItem('email', String(credential.email));
        if (credential.fullName?.givenName) {
            await AsyncStorage.setItem('name', String(credential.fullName.givenName));
        }

        // 3. 페이지 이동 (카카오 로직과 동일하게 적용)
        if (isNew === true || isNew === 'true') {
            router.replace('/signup');
        } else {
            router.replace('/(tabs)/home');
        }
        
        console.log('애플 로그인 및 토큰 저장 완료');
      }
      
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') {
          console.log('사용자가 취소함');
      } else {
          console.error('Apple Login Error:', e);
      }
    }
  };

  return (
    <View style={styles.container}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={8}
        style={styles.button}
        onPress={handleAppleLogin}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', height: 48, marginTop: 12 },
  button: { width: '100%', height: '100%' },
});