import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Image, Pressable } from 'react-native';

// ✅ iOS 세션 정리 (반드시 제일 위)
WebBrowser.maybeCompleteAuthSession();

// ✅ 카카오 OAuth 엔드포인트
const discovery = {
  authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
};

export default function KakaoLoginButton() {
  async function handlePress() {
    try {
      // ✅ Expo Proxy 기반 redirectUri (https://auth.expo.io/...)
      const redirectUri = AuthSession.makeRedirectUri({useProxy: true} as any);
      console.log('Redirect URI (등록용):', redirectUri)

      // ✅ REST API 키 (환경변수 or 직접 테스트용 키)
      const clientId =
        process.env.EXPO_PUBLIC_KAKAO_REST_KEY || '여기에_테스트용_카카오_REST_API_KEY';
      if (!clientId) {
        Alert.alert('⚙️ 설정 필요', 'EXPO_PUBLIC_KAKAO_REST_KEY가 .env에 설정되어야 합니다.');
        return;
      }

      // ✅ Auth 요청 객체 생성
      const request = new AuthSession.AuthRequest({
        clientId,
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        usePKCE: false, // 테스트용, 실제 배포시 true로 권장
        scopes: ['profile_nickname'],
      });

      // ✅ 로그인 시도 (Proxy 통해 https://auth.expo.io/... 사용)
      const result = await request.promptAsync(discovery, { useProxy: true } as any);

      // ✅ 로그인 결과 처리
      if (result.type === 'success' && result.params?.code) {
        const code = result.params.code;
        Alert.alert('인가코드 받음 ✅', code);
        console.log('🟢 Kakao Authorization Code:', code);
        // TODO: 이 코드를 백엔드에 POST
      } else if (result.type === 'dismiss') {
        Alert.alert('취소됨', '사용자가 로그인 창을 닫았습니다.');
      } else {
        Alert.alert('로그인 실패 ❌', JSON.stringify(result, null, 2));
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('에러 발생 ⚠️', e?.message ?? '알 수 없는 오류');
    }
  }

  return (
    <Pressable onPress={handlePress}>
      <Image
        source={require('../assets/images/kakao_login.png')}
        style={{
          width: 240,
          height: 56,
          resizeMode: 'contain',
        }}
      />
    </Pressable>
  );
}
