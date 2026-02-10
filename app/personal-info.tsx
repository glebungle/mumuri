import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Markdown from "react-native-markdown-display";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "../components/AppText";

const TERMS_TEXT = `# 개인정보처리방침 VER 25.12.16

본 개인정보처리방침은 모바일 앱 “무무리(mumuri)” 서비스(이하 “서비스”)를 제공하는 이지민(개발팀 GROWDY)(이하 “서비스 제공자”)가 이용자의 개인정보를 어떻게 처리하는지를 설명합니다. 서비스 제공자는 이용자의 개인정보를 소중히 보호하며, 「개인정보 보호법」 등 관련 법령을 준수합니다.

---

# 1. 수집하는 개인정보 항목

## 1) 이용자가 직접 제공하는 정보

### ● SNS 간편로그인(카카오)

- 이메일, 닉네임, 프로필 사진, 카카오 계정 ID

### ● 서비스 이용을 위해 추가로 입력하는 정보

- 닉네임
- 생년월일(선택)
- 사귄 날짜
- 취미
- 데이트 취향
- 애정표현 취향
- 커플 코드

---

## 2) 서비스 이용 과정에서 생성·수집되는 정보

### ● 사진 촬영 및 업로드 시

- 사진 파일

### ● 기기 및 로그 정보

- 접속 일시, 사용 시간, 방문 기록
- 기기 OS, 기기 모델명
- 앱 버전, 오류 로그

---

## 3) 채팅 기능 이용 시

- 이용자가 입력한 채팅 메시지 및 사진
- 서비스 제공자는 채팅 내용을 열람하지 않도록 암호화하여 저장할 예정
    
    (단, 신고 처리 및 법령에 따른 요구가 있는 경우 예외적으로 확인될 수 있음)
    

---

# 2. **개인정보의 이용 목적**

수집한 개인정보는 다음의 목적 범위 내에서만 이용됩니다.

- 회원가입 및 본인 확인
- 커플 매칭, 커플 기능 제공
- 사진 저장 및 앨범 기능 제공
- 서비스 운영, 통계·분석, 품질 개선
- 부정 이용 방지, 안전한 서비스 제공
- (향후 제공 예정) 사용자 위치 패턴 기반 맞춤형 미션 추천
- 고객 상담 및 문의 대응

---

# 3. 개인정보의 보유 및 이용 기간

- 회원 탈퇴 시 즉시 삭제
- 단, 부정 이용 방지 및 분쟁 해결을 위해 탈퇴 후 6개월간 최소 정보만 보관
- 법령에서 요구하는 경우 해당 기간 동안 보관

---

# 4. 개인정보의 제3자 제공

서비스 제공자는 이용자의 사전 동의 없이 개인정보를 외부에 제공하지 않습니다.

단, 법령에 근거한 경우 또는 수사기관 등의 적법한 요청이 있는 경우 예외로 합니다.

---

# 5. 외부 서비스 및 SDK 이용 현황

무무리는 아래 외부 서비스를 사용하며, 각 서비스는 자체 개인정보처리방침을 가지고 있습니다.

### ● Kakao Login SDK

https://developers.kakao.com/docs/latest/ko/kakaologin/overview

---

# 6. 이용자의 권리

이용자는 언제든지 자신의 개인정보에 대해 다음을 요청할 수 있습니다.

- 열람
- 정정
- 삭제
- 처리정지

요청은 이메일(growdyteam@gmail.com)을 통해 접수되며 서비스 제공자는 요청을 신속하게 처리합니다.

---

# 7. 개인정보의 안전성 확보 조치

서비스 제공자는 이용자의 개인정보를 안전하게 관리하기 위해 아래 조치를 시행합니다.

- 개인정보 암호화 저장
- 서버 접근 권한 최소화
- 정기적 보안 점검
- 전송 구간 암호화(SSL 적용)

---

# 8. 아동의 개인정보 보호

서비스는 만 13세 미만 아동을 대상으로 하지 않습니다.

만약 아동이 개인정보를 제공한 사실을 확인한 경우 즉시 삭제 조치를 취합니다.

---

# 9. 개인정보처리방침 변경 안내

본 방침은 서비스 운영 정책, 법령 변경 등에 따라 개정될 수 있으며,

변경 사항은 앱 내 공지 또는 업데이트 화면을 통해 안내합니다.

---

# 10. 문의처

개인정보 관련 문의는 아래 연락처로 접수할 수 있습니다.

- 서비스 제공자: 이지민(개발팀 GROWDY)
- 이메일: growdyteam@gmail.com

---

본 개인정보처리방침은 2025년 12월 16일부터 시행됩니다.
`;

export default function PersonalInfoScreen() {
  const insets = useSafeAreaInsets();

  const handleBack = () => router.back();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1E1E1E" />
        </Pressable>
        <AppText style={styles.headerTitle}>무무리 개인정보 처리방침</AppText>
        <View style={{ width: 24 }} />
      </View>

      {/* 본문 (스크롤 박스) */}
      <View style={styles.content}>
        <View style={styles.termsBox}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            indicatorStyle="black" // iOS 스크롤바 색상
            showsVerticalScrollIndicator={true}
          >
            <Markdown style={markdownStyles}>{TERMS_TEXT}</Markdown>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const markdownStyles = {
  body: {
    fontSize: 13,
    lineHeight: 22,
    color: "#555555",
    fontFamily: "Pretendard-Medium",
  },
  heading1: {
    fontSize: 20,
    color: "#1E1E1E",
    fontFamily: "Pretendard-Bold",
    marginTop: 20,
    marginBottom: 10,
  },
  heading2: {
    fontSize: 16,
    color: "#333333",
    fontFamily: "Pretendard-Bold",
    marginTop: 15,
    marginBottom: 8,
  },
  heading3: {
    fontSize: 14,
    color: "#444444",
    fontFamily: "Pretendard-Bold",
    marginTop: 10,
    marginBottom: 5,
  },
  strong: {
    fontFamily: "Pretendard-Bold",
    color: "#111111",
  },
  hr: {
    backgroundColor: "#E3E7EB",
    marginVertical: 15,
  },
  list_item: {
    marginVertical: 2,
  },
  bullet_list: {
    marginBottom: 10,
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F2",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    color: "#444444",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  termsBox: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E3E7EB",
    overflow: "hidden",
  },
  scrollContent: {
    padding: 20,
  },
  termsText: {
    fontSize: 12,
    lineHeight: 24,
    color: "#555555",
  },
});
