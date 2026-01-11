import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';

const TERMS_TEXT = `본 약관은 모바일 애플리케이션 무무리(mumuri)(이하 “서비스”)를 개발·제공하는 서비스 제공자 이지민(개발팀 GROWDY)(이하 “서비스 제공자”)와 이용자 간의 서비스 이용 조건 및 권리·의무를 규정합니다.

---

# 제1장 총칙

## 제1조 (목적)

본 약관은 서비스 제공자가 제공하는 무무리 앱 및 관련 기능의 이용과 관련하여
서비스 제공자와 이용자 간의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다.

## 제2조 (용어 정의)

본 약관에서 사용하는 용어의 정의는 다음과 같습니다.

1. “서비스”란 무무리 모바일 앱 및 이에 부수되는 모든 기능을 의미합니다.
2. “이용자”란 본 약관에 따라 서비스를 이용하는 모든 회원을 말합니다.
3. “회원”이란 카카오 간편로그인 등을 통해 서비스 제공자와 이용계약을 체결한 자를 말합니다.
4. “커플 연결”이란 두 명의 회원이 상호 동의하여 커플 기능을 사용하는 것을 뜻합니다.
5. “미션”이란 무무리가 제공하는 일일 사진 촬영 과제를 의미합니다.
6. “게시물”이란 회원이 서비스 내에 업로드한 사진, 텍스트 등 모든 정보를 의미합니다.

## 제3조 (약관의 게시 및 변경)

1. 본 약관은 서비스 내 설정 화면 또는 공지사항에서 확인할 수 있습니다.
2. 서비스 제공자는 관련 법령을 위반하지 않는 범위에서 약관을 개정할 수 있습니다.
3. 약관이 변경되는 경우, 적용일자 및 개정 내용을 최소 7일 이전에 공지합니다.
    
    단, 이용자에게 불리한 변경일 경우 30일 전에 공지합니다.
    

---

# 제2장 이용계약

## 제4조 (이용계약의 성립)

1. 이용계약은 이용자가 본 약관에 동의하고 회원가입을 완료했을 때 성립합니다.
2. 회원가입은 만 14세 이상인 경우에만 가능합니다.
3. 서비스 제공자는 아래 사유가 있는 경우 가입을 승인하지 않을 수 있습니다.
    - 타인의 정보를 도용한 경우
    - 허위 정보를 기재한 경우
    - 만 14세 미만인 경우
    - 서비스 운영을 방해하거나 부정한 목적으로 이용하려는 경우

## 제5조 (회원정보의 변경)

회원은 서비스 내 설정 화면을 통해 등록한 정보를 언제든지 열람 및 수정할 수 있습니다.

## 제6조 (회원 탈퇴)

1. 회원은 언제든지 앱 내 “탈퇴하기” 기능을 통해 탈퇴할 수 있습니다.
2. 탈퇴 시, 관련 법령에서 요구하지 않는 한 회원 정보는 즉시 삭제됩니다.

---

# 제3장 서비스 이용

## 제7조 (서비스 제공 내용)

서비스 제공자는 다음 기능을 제공합니다.

1. 커플 연결 기능
2. 사진 촬영 미션 제공
3. 앨범/갤러리 기능
4. 채팅 기능
5. 캘린더 기능
6. (향후 제공 예정) 위치 기반 미션 추천
7. 서비스 개선을 위한 통계 기능

## 제8조 (서비스 변경 및 중단)

1. 서비스 제공자는 앱의 기능을 변경하거나 종료할 수 있습니다.
2. 기술적 장애, 점검, 통신 두절 등으로 서비스가 일시 중단될 수 있습니다.
3. 서비스 중단에 대해 고의 또는 중대한 과실이 없는 한 책임을 지지 않습니다.

## 제9조 (광고 및 알림)

서비스 제공자는 앱 내 알림·공지 형태로 필요한 정보를 제공할 수 있습니다.

---

# 제4장 이용자의 의무

## 제10조 (금지 행위)

이용자는 다음 행위를 하여서는 안 됩니다.

1. 타인의 개인정보 도용
2. 허위 정보 등록
3. 불법 정보, 음란물, 폭력물 게시
4. 서비스 제공자의 운영을 방해하는 행위
5. 저작권 등 타인의 권리를 침해하는 행위

## 제11조 (게시물 관리)

1. 게시물에 대한 책임은 게시한 회원에게 있습니다.
2. 아래 사유가 있으면 게시물이 삭제될 수 있습니다.
    - 타인 비방
    - 불법 정보 포함
    - 저작권 침해
    - 기타 서비스 운영에 부적합한 경우

---

# 제5장 데이터 및 저작권

## 제12조 (게시물의 권리)

1. 게시물의 저작권은 이용자에게 귀속됩니다.
2. 서비스 제공자는 서비스 운영에 필요한 범위에서 게시물을 사용할 수 있습니다.

## 제13조 (이미지 및 데이터 처리)

본 조항은 개인정보처리방침을 기반으로 요약합니다.

1. 미션 사진은 인증 후 즉시 삭제되며,
    
    이용자가 "앨범 저장"을 선택한 경우에만 암호화하여 서버에 보관됩니다.
    
2. 채팅 데이터는 암호화하여 저장되며, 관리자는 열람할 수 없습니다.
3. 위치 정보는 이용자가 동의한 경우에만 수집됩니다.
4. 데이터는 서비스 개선·통계 목적 범위에서만 사용됩니다.

---

# 제6장 손해배상 및 면책

## 제14조 (손해배상)

무료 앱 특성상, 다음과 같이 규정합니다.

1. 서비스 제공자는 고의 또는 중대한 과실이 없는 한 서비스 이용과 관련된 손해에 책임을 지지 않습니다.
2. 이용자의 부주의 또는 기기 환경으로 인해 발생한 문제는 책임지지 않습니다.

## 제15조 (면책조항)

서비스 제공자는 아래 사항에 대해 책임을 지지 않습니다.

1. 천재지변 등 불가항력
2. 이용자의 기기 문제, 네트워크 장애
3. 이용자가 게시한 정보의 신뢰도 및 정확성

---

# 제7장 분쟁 해결

## 제16조 (분쟁 해결 및 관할)

서비스 이용과 관련된 분쟁은 가능한 원만히 해결하도록 노력합니다.

해결되지 않는 경우, 서비스 제공자의 주소지 관할 법원을 제1심 법원으로 합니다.

---

# 부칙

본 약관은 2025년 12월 16일부터 시행됩니다.

서비스 제공자: 이지민(개발팀 GROWDY)

문의: growdyteam@gmail.com
`;

export default function TermsOfServiceScreen() {
  const insets = useSafeAreaInsets();
  
  const handleBack = () => router.back();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1E1E1E" />
        </Pressable>
        <AppText style={styles.headerTitle}>무무리 이용약관</AppText>
        <View style={{ width: 24 }} />
      </View>

      {/* 본문 (스크롤 박스) */}
      <View style={styles.content}>
        <View style={styles.termsBox}>
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            indicatorStyle="black" 
            showsVerticalScrollIndicator={true}
          >
            <Markdown style={markdownStyles}>
              {TERMS_TEXT}
            </Markdown>
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
    color: '#555555',
    fontFamily: 'Pretendard-Medium',
  },
  heading1: {
    fontSize: 20,
    color: '#1E1E1E',
    fontFamily: 'Pretendard-Bold',
    marginTop: 20,
    marginBottom: 10,
  },
  heading2: {
    fontSize: 16,
    color: '#333333',
    fontFamily: 'Pretendard-Bold',
    marginTop: 15,
    marginBottom: 8,
  },
  heading3: {
    fontSize: 14,
    color: '#444444',
    fontFamily: 'Pretendard-Bold',
    marginTop: 10,
    marginBottom: 5,
  },
  strong: {
    fontFamily: 'Pretendard-Bold',
    color: '#111111',
  },
  hr: {
    backgroundColor: '#E3E7EB',
    marginVertical: 15,
  },
  list_item: {
    marginVertical: 2,
  },
  bullet_list: {
    marginBottom: 10,
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F2', 
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    color: '#444444',
  },
  content: {
    flex: 1,
    padding: 20, 
  },
  termsBox: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3E7EB',
    overflow: 'hidden', 
  },
  scrollContent: {
    padding: 20,
  },
  termsText: {
    fontSize: 12,
    lineHeight: 24,
    color: '#555555',
  },
});