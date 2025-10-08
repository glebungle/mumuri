import React, { useState } from 'react'; // 👈 useState 추가
import { Alert, Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview'; // 👈 WebView import 유지

// ⚠️ 여기에 카카오 로그인에 필요한 변수를 정의합니다.
const REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_KEY || '여기에_테스트용_카카오_REST_API_KEY';
// 카카오 콘솔에 등록한 HTTPS 형식의 Redirect URI를 사용합니다.
const REDIRECT_URI = 'https://auth.expo.io/@starsam/mumuri'; 
// (주의: 이 URI가 카카오 콘솔에 등록되어 있어야 합니다.)

const KAKAO_AUTH_URL = `https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=${REST_API_KEY}&redirect_uri=${REDIRECT_URI}`;

// URL에서 'code=' 이후의 인가 코드를 추출하는 함수
const extractCodeFromUrl = (url: string) => {
  const params = new URLSearchParams(url.split('?')[1]);
  return params.get('code');
};

const requestTokenExchange = async (code: string) => {
    // ⚠️ [필수] 백엔드 서버 URL과 엔드포인트를 정확히 입력하세요.
    const BACKEND_URL = 'https://[당신의 백엔드 서버 주소]/api/auth/kakao'; 

    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            // 데이터 형식이 JSON임을 명시합니다.
            headers: {
                'Content-Type': 'application/json',
            },
            // 인가 코드를 JSON 본문에 담아 보냅니다.
            body: JSON.stringify({ code: code }), 
        });
        
        const data = await response.json();

        // 🟢 백엔드로부터 응답을 받은 후 처리
        if (response.ok && data.token) {
            console.log('백엔드 토큰 교환 성공. 서버에서 받은 토큰:', data.token);
            Alert.alert('로그인 성공', '환영합니다!');
            
            // TODO: 1. 서버에서 받은 JWT 토큰(data.token)을 로컬 저장소(AsyncStorage)에 저장
            // TODO: 2. 앱의 메인 화면으로 이동 (expo-router 라우팅)

        } else {
            // 백엔드에서 오류 메시지를 전달한 경우
            Alert.alert('로그인 오류', data.message || '서버와의 통신에 실패했습니다.');
        }

    } catch (e) {
        console.error("백엔드 통신 오류:", e);
        Alert.alert('통신 실패', '서버에 연결할 수 없습니다.');
    }
}

export default function KakaoLoginButton() {
  // 웹뷰 모달의 가시성을 관리하는 상태
  const [webViewVisible, setWebViewVisible] = useState(false); 

  // 버튼 클릭 핸들러: 웹뷰를 띄웁니다.
  function handlePress() {
    if (!REST_API_KEY) {
        Alert.alert('⚙️ 설정 필요', 'EXPO_PUBLIC_KAKAO_REST_KEY가 .env에 설정되어야 합니다.');
        return;
    }
    setWebViewVisible(true);
  }

  // 웹뷰의 URL 변경을 감지하여 인가 코드를 처리합니다.
  const handleWebViewNavigationStateChange = (navState: any) => {
    const url = navState.url;

    // 1. 현재 URL이 등록된 REDIRECT_URI를 포함하고, 'code' 파라미터가 있는지 확인
    if (url.includes(REDIRECT_URI) && url.includes('code=')) {
      
      const code = extractCodeFromUrl(url);

      if (code) {
        Alert.alert('인가코드 받음 ✅', code);
        console.log('🟢 Kakao Authorization Code:', code);
        // TODO: 이 코드를 백엔드에 POST하여 최종 토큰을 발급받습니다.
      } else {
        Alert.alert('오류', '인가 코드를 찾을 수 없습니다.');
      }
      
      // 인가 코드를 추출했으므로 웹뷰를 닫습니다.
      setWebViewVisible(false);
    }
    
    // 만약 에러가 발생했다면 웹뷰를 닫을 수도 있습니다.
    if (url.includes(REDIRECT_URI) && url.includes('error=')) {
         setWebViewVisible(false);
         Alert.alert('로그인 실패', '카카오 로그인 중 오류가 발생했습니다.');
    }
  };


  return (
    <>
      {/* 1. 카카오 로그인 버튼 */}
      <Pressable onPress={handlePress}>
        <Image
          source={require('../assets/images/kakao_login.png')}
          style={styles.buttonImage}
        />
      </Pressable>

      {/* 2. 웹뷰 모달 */}
      <Modal 
        visible={webViewVisible} 
        animationType="slide" 
        onRequestClose={() => setWebViewVisible(false)} // Android 뒤로가기 버튼 처리
      >
        <View style={styles.webViewContainer}>
          <WebView
            style={styles.webView}
            source={{ uri: KAKAO_AUTH_URL }}
            onNavigationStateChange={handleWebViewNavigationStateChange} 
            javaScriptEnabled={true}
            // 웹뷰를 닫을 수 있는 X 버튼 등을 상단에 추가하면 더 좋습니다.
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
    buttonImage: {
        width: 240,
        height: 56,
        resizeMode: 'contain',
    },
    webViewContainer: {
        flex: 1,
        marginTop: 40, // 상단 노치 영역 등을 고려하여 띄웁니다.
    },
    webView: {
        flex: 1,
    }
});