// app/couple-connect.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { useUser } from './context/UserContext';

const BASE_URL = 'https://mumuri.shop';

export default function CoupleConnectScreen() {
  const insets = useSafeAreaInsets();
  const { refreshUserData } = useUser();

  const [myCode, setMyCode] = useState<string>(''); 
  const [partnerCode, setPartnerCode] = useState<string>(''); 
  const [loading, setLoading] = useState(false); 
  const [modalVisible, setModalVisible] = useState(false);

  // 1. 내 커플 코드 가져오기 (수정됨: 서버 정보 우선 조회)
  useEffect(() => {
    fetchMyCode();
  }, []);

  const fetchMyCode = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      // [STEP 1] 서버에 저장된 내 진짜 기념일을 먼저 조회합니다.
      let Anniversary = '';
      try {
        const userRes = await fetch(`${BASE_URL}/api/mypage`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (userRes.ok) {
          const userData = await userRes.json();
          // 서버에서 받아온 기념일 (예: "2023-11-11")
          if (userData && userData.anniversary) {
            Anniversary = userData.anniversary;
            console.log("📅 [Connect] 서버에서 가져온 내 기념일:", Anniversary);
          }
        }
      } catch (err) {
        console.warn("마이페이지 정보 조회 실패 (기본값 사용 예정)", err);
      }

      // [STEP 2] 서버에 기념일이 없다면(완전 신규) 오늘 날짜, 있다면 그 날짜 사용
      const targetDate = Anniversary ;
      // || new Date().toISOString().split('T')[0]

      // [STEP 3] 확정된 기념일로 코드 발급 요청
      const res = await fetch(`${BASE_URL}/user/anniversary?anniversary=${targetDate}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const code = await res.text(); 
        setMyCode(code);
      } else {
        console.warn("커플 코드 발급 실패:", res.status);
      }
    } catch (e) {
      console.error('내 코드 가져오기 에러:', e);
    }
  };

  const copyToClipboard = async () => {
    if (!myCode) return;
    await Clipboard.setStringAsync(myCode);
    Alert.alert('복사 완료', '커플 코드가 복사되었습니다!');
  };

  // 2. 가상 상대방 생성 (테스트용)
  const handleTestGo = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/test/go`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const text = await res.text();
      if (res.ok) {
        Alert.alert(
          "테스트 상대 생성 완료", 
          `코드: ${text}\n입력창에 넣을까요?`,
          [
            { text: '취소', style: 'cancel' },
            { text: '확인', onPress: () => setPartnerCode(text) }
          ]
        );
      } else {
        Alert.alert("테스트 실패", text);
      }
    } catch (e) {
      Alert.alert("에러", "테스트 호출 중 에러 발생");
    }
  };

  // 3. 커플 연결 시도
  // handleConnect 함수 내부 수정

  const handleConnect = async () => {
    if (!partnerCode.trim()) {
      Alert.alert('알림', '상대방의 코드를 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      console.log("🔗 [Connect] 커플 연결 시도:", partnerCode);

      // (1) 커플 연결 API 호출
      const res = await fetch(`${BASE_URL}/user/couple?coupleCode=${encodeURIComponent(partnerCode)}`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
      });

      // (2) 응답 파싱
      const text = await res.text();
      console.log("🔗 [Connect] 원본 응답:", text);
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        Alert.alert('오류', '서버 응답 형식이 올바르지 않습니다.');
        return;
      }

      if (res.ok) {
        // ✅ [수정] 명세서에 따르면 memberName이 커플ID임.
        // 혹시 모르니 coupleId도 체크하지만, memberName을 최우선으로 함.
        const cid = data.memberName;

        console.log(`✅ [Debug] 추출된 ID 값: ${cid} (타입: ${typeof cid})`);

        // ✅ [수정] ID가 0일 수도 있으므로, null/undefined만 아니면 저장하도록 조건 변경
        if (cid !== undefined && cid !== null) {
          
          console.log(`💾 [Storage] coupleId 저장 시도: ${cid}`);
          await AsyncStorage.setItem('coupleId', String(cid));
          
          // 저장 직후 바로 확인 (디버깅용)
          const savedCid = await AsyncStorage.getItem('coupleId');
          console.log(`💾 [Storage] 저장된 값 확인: ${savedCid}`);

          // 전역 상태 갱신
          await refreshUserData();
          
          // 성공 모달
          setModalVisible(true);
        } else {
          console.warn("❌ [Error] 커플 ID를 찾을 수 없음 (memberName 누락)");
          Alert.alert('오류', '커플 연결은 되었으나 ID를 받아오지 못했습니다.');
        }

      } else {
        // 에러 메시지 처리
        const errorMsg = data?.message || '코드를 다시 확인해주세요.';
        Alert.alert('연결 실패', errorMsg);
      }
    } catch (e) {
      console.error('커플 연결 에러:', e);
      Alert.alert('오류', '연결 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessConfirm = async () => {
    setModalVisible(false);
    
    // 홈으로 이동하면서 한 번 더 갱신 보장
    await refreshUserData(); 
    router.replace('/(tabs)/home'); 
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1E1E1E" />
        </Pressable>
        <AppText style={styles.headerTitle}>커플 연결</AppText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <AppText type="semibold" style={styles.cardTitle}>나의 커플 코드</AppText>
          <AppText style={styles.cardDesc}>
            이 코드를 상대방에게 공유하여{'\n'}연결을 요청하세요.
          </AppText>

          <View style={styles.codeContainer}>
            {myCode ? (
              <AppText type="bold" style={styles.codeText}>{myCode}</AppText>
            ) : (
              <ActivityIndicator size="small" color="#6198FF" />
            )}
            <Pressable onPress={copyToClipboard} style={styles.copyButton}>
              <Ionicons name="copy-outline" size={20} color="#6198FF" />
              <AppText style={styles.copyText}>복사</AppText>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, { marginTop: 24 }]}>
          <AppText type="semibold" style={styles.cardTitle}>상대방 코드 입력</AppText>
          <AppText style={styles.cardDesc}>
            전달받은 상대방의 코드를{'\n'}여기에 입력해주세요.
          </AppText>

          <TextInput
            style={styles.input}
            placeholder="코드를 입력하세요"
            placeholderTextColor="#AAA"
            value={partnerCode}
            onChangeText={setPartnerCode}
            autoCapitalize="characters"
          />

          <Pressable 
            style={({ pressed }) => [
              styles.connectButton,
              styles.connectButton,
              pressed && { opacity: 0.8 }
            ]}
            onPress={handleConnect}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <AppText type="bold" style={styles.connectButtonText}>연결하기</AppText>
            )}
          </Pressable>
        </View>

        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <Pressable onPress={handleTestGo} style={styles.testButton}>
            <AppText style={{ color: '#FF6B6B', fontSize: 13 }}>🛠 (TEST) 가상 상대방 생성하기</AppText>
          </Pressable>
          <AppText style={{ color: '#AAA', fontSize: 11, marginTop: 4 }}>
            *누르면 상대방 코드가 발급됩니다.
          </AppText>
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleSuccessConfirm}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="heart" size={32} color="#FF6B6B" />
            </View>
            <AppText type="bold" style={styles.modalTitle}>연결 성공!</AppText>
            <AppText style={styles.modalMessage}>
              이제 두 분만의 소중한 기록을{'\n'}시작해보세요.
            </AppText>
            <Pressable style={styles.modalButton} onPress={handleSuccessConfirm}>
              <AppText type="bold" style={styles.modalButtonText}>홈으로 가기</AppText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFCF5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, color: '#444' },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  cardTitle: { fontSize: 18, color: '#333', marginBottom: 8 },
  cardDesc: { fontSize: 14, color: '#888', marginBottom: 20, lineHeight: 20 },
  codeContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F7F7F7', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  codeText: { fontSize: 20, color: '#333', letterSpacing: 1 },
  copyButton: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  copyText: { color: '#6198FF', fontSize: 14, fontWeight: '600' },
  input: { backgroundColor: '#F7F7F7', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#333', marginBottom: 20, fontFamily: 'Pretendard-Medium' },
  connectButton: { backgroundColor: '#6198FF', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  connectButtonText: { color: '#FFF', fontSize: 16 },
  testButton: { padding: 10, borderWidth: 1, borderColor: '#FF6B6B', borderRadius: 8, backgroundColor: '#FFF0F0' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: '#FFF', borderRadius: 20, padding: 30, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  modalIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF0F0', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, color: '#333', marginBottom: 10 },
  modalMessage: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  modalButton: { backgroundColor: '#6198FF', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 999 },
  modalButtonText: { color: '#FFF', fontSize: 15 },
});