import axios from 'axios';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function AppleLoginButton() {
  const handleAppleLogin = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // 1. API로 identityToken 전송
      const response = await axios.post('https://your-api-url.com/auth/apple', {
        identityToken: credential.identityToken,
        fullName: credential.fullName, 
        email: credential.email,    
      });

      if (response.status === 200) {
        // 2. 서버에서 받은 자체 JWT 등을 저장하고 메인으로 이동
        console.log('서버 로그인 성공');
        router.replace('/signup');
      }
      
    } catch (e: any) {
      console.error('Apple Login Error:', e);
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