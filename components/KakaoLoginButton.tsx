import React, { useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

// --- 상수 및 유틸리티 ---

const REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_KEY || '';
const REDIRECT_URI = 'https://auth.expo.io/@starsam/mumuri'; 
// 백엔드 통신 로직은 잠시 주석 처리하고, 필요 시 다시 활성화하세요.
// const BACKEND_URL = 'https://[당신의 백엔드 서버 주소]/api/auth/kakao'; 

const KAKAO_AUTH_URL = `https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=${REST_API_KEY}&redirect_uri=${REDIRECT_URI}`;


// URL에서 code 파라미터를 안전하게 추출하는 유틸리티
const extractCodeFromUrl = (url: string): string | null => {
    try {
        const urlObj = new URL(url);
        // code 파라미터를 추출하고, null이 아니면 반환
        return urlObj.searchParams.get('code'); 
    } catch (e) {
        return null;
    }
};

// 백엔드로 인가 코드를 전송하는 함수 (컴포넌트 외부에 정의)
const requestTokenExchange = async (code: string) => {
    console.log('--- 백엔드 전송 준비 ---');
    // ... 실제 fetch 로직 ...
};

// --- 메인 컴포넌트 ---

export default function KakaoLoginButton() {
    const [webViewVisible, setWebViewVisible] = useState(false); 

    // 버튼 클릭 핸들러
    function handlePress() {
        if (!REST_API_KEY) {
            Alert.alert('⚙️ 설정 필요', 'REST_API_KEY가 설정되어야 합니다.');
            return;
        }
        setWebViewVisible(true);
    }

    // 웹뷰 URL 변경 감지 핸들러 (인가 코드 처리)
    const handleWebViewNavigationStateChange = (navState: any) => {
        const url = navState.url;
        console.log('--- WebView Navigation URL (Final Check) ---', url); 
        
        // 1. 인가 코드가 포함된 경우 (성공)
        // REDIRECT_URI가 불완전하게 감지되는 경우를 우회하기 위해 'code='만 체크합니다.
        if (url.includes('code=')) {
            
            const code = extractCodeFromUrl(url);

            if (code) {
                console.log('Full Code:', code); 
                
                // Alert을 띄웁니다.
                Alert.alert('인가코드 테스트', `코드 값: ${code}`, [
                    {
                        text: "확인",
                        onPress: () => {
                            // Alert 확인 후 백엔드 전송은 바로 실행
                            requestTokenExchange(code); 
                        }
                    }
                ]);
                
                setTimeout(() => {
                    setWebViewVisible(false);
                }, 1000); 

                return; 
                
            } else {
                Alert.alert('오류', 'URL에서 인가 코드를 찾을 수 없습니다.');
                setWebViewVisible(false);
                return;
            }
        }
        
        // 2. 에러가 포함된 경우->여기에 취소하는 경우도 포함됨. 수정 필요
        else if (url.includes('error=')) {
            setWebViewVisible(false);
            Alert.alert('로그인 실패', '카카오 인증 서버에서 에러가 발생했습니다.');
            return;
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
        marginTop: 40, 
    },
    webView: {
        flex: 1,
    }
});