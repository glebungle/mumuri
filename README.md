mumuri — 둘만의 순간을 기록하는 커플 미션 앱 💑
매일의 미션으로 더 가까워지는 우리,
사진 한 장으로 주고받는 우리의 하루, mumuri

프로젝트 소개 (About)
mumuri는 커플이 서로를 초대해 연결하고, 매일 주어지는 미션을 사진으로 인증하며 추억을 함께 쌓아가는 모바일 앱입니다.
채팅, 캘린더, 위치 공유, 위젯까지 — 둘만의 공간에서 일상을 더 따뜻하게 이어가세요.

주요 기능 (Features)
💌 커플 연결 — 초대 코드로 서로를 연결하고 둘만의 공간 생성
📸 데일리 미션 — 매일 주어지는 미션을 사진으로 인증하고 공유
💬 실시간 채팅 — STOMP/WebSocket 기반 1:1 커플 채팅
🗓️ 공유 캘린더 — 기념일과 일정을 함께 기록
📍 위치 공유 — 지도에서 서로의 위치 확인
🔔 푸시 알림 — 미션·메시지 실시간 알림
📱 홈 화면 위젯 — 앱을 열지 않아도 우리의 순간을 확인
🔐 간편 로그인 — 카카오 / Apple 소셜 로그인

기술 스택 (Tech Stack)
Framework: React Native 0.81 · Expo 54 · Expo Router (typed routes)
Language: TypeScript
State: Zustand
Realtime: STOMP.js · SockJS
Auth: Kakao Login · Apple Sign-In · Expo Auth Session
Native: Expo Camera / Notifications / Location / Media Library / Widget
Maps: react-native-maps
Validation: Zod
Deploy: EAS Build & Update
시작하기 (Getting Started)

# 의존성 설치
yarn install

# 개발 서버 실행
yarn start

# 플랫폼별 실행
yarn ios
yarn android
.env 파일에 EXPO_PUBLIC_NATIVE_APP_KEY(카카오 네이티브 앱 키) 등 환경 변수가 필요합니다.
