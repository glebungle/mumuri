// app/signup.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
// ✅ [수정] useRef, useEffect 추가
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../components/AppText';

// ===================== API 공통 =====================
const BASE = 'https://mumuri.shop';

async function authedFetch(path: string, init: RequestInit = {}) {
  const token = (await AsyncStorage.getItem('token')) || '';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const url = `${BASE}${path}`;
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();

  if (!res.ok) throw new Error(`${path} 실패 (HTTP ${res.status})`);
  try { return JSON.parse(text); } catch { return text; }
}

// API 함수들 (기존 유지)
export const postName = (name: string) =>
  authedFetch(`/user/name?name=${encodeURIComponent(name)}`, { method: 'POST' });

export const postBirthday = (iso: string) =>
  authedFetch(`/user/birthday?birthday=${encodeURIComponent(iso)}`, { method: 'POST' });

export const postAnniversary = (iso: string) =>
  authedFetch(`/user/anniversary?anniversary=${encodeURIComponent(iso)}`, { method: 'POST' });

export const postTestGo = () =>
  authedFetch(`/test/go`, { method: 'POST' });

export async function postCouple(code: string) {
  try {
    return await authedFetch(`/user/couple?coupleCode=${encodeURIComponent(code)}`, { method: 'POST' });
  } catch {
    return await authedFetch(`/user/couple`, {
      method: 'POST',
      body: JSON.stringify({ coupleCode: code }),
    });
  }
}

// ===================== UI & Helpers =====================
const isDate = (s: string) => /^\d{4}\.\s?\d{2}\.\s?\d{2}$/.test(s.trim());
function toIsoDate(s: string): string {
  const only = s.replace(/\D/g, '');
  if (only.length !== 8) throw new Error('잘못된 날짜 형식');
  const y = only.slice(0, 4);
  const m = only.slice(4, 6);
  const d = only.slice(6, 8);
  return `${y}-${m}-${d}`;
}

type StepKey = 'name' | 'birthday' | 'anniversary' | 'preferences' | 'partnerCode';
const HEART_ICON = require('../assets/images/BlueHeart.png');

// 지난 카드 컴포넌트
const PastCard = React.memo(({ label, value }: { label: string; value: string }) => (
  <View style={[styles.pastCardBase, { height: 90 }]}>
    <AppText style={styles.pastCardLabel}>{label}</AppText>
    <AppText type='semibold' style={styles.pastCardValue}>{value || '-'}</AppText>
  </View>
));

const InputField = React.memo(({
  label, value, placeholder, onChangeText, keyboardType = 'default', accentColor
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (text: string) => void;
  keyboardType?: TextInputProps['keyboardType'];
  accentColor: string; // 색상 타입 정의
}) => {
  const inputColor = value.length > 0 ? '#4D5053' : '#9CA3AF';
  return (
    <View>
      <AppText style={[styles.inputLabel, { color: accentColor }]}>{label}</AppText>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize="none"
        style={[styles.textInputBase, { fontFamily: 'Paperlogy-6SemiBold', color: inputColor }]}
      />
    </View>
  );
});

// 취향 선택용 데이터
const HOBBIES = ['운동/스포츠', '예술/창작', '문화생활', '게임/오락', '여행/탐험', '맛집/카페', '집콕/힐링', '학습/자기계발'];
const DATE_STYLES = ['활동적인', '문화/감성', '미식/카페', '휴식/힐링', '체험/창작', '홈데이트', '여행/탐험'];

// ===================== Signup =====================
export default function Signup() {
  const [step, setStep] = useState<number>(0);
  const [isPosting, setIsPosting] = useState(false);

  // 기본 입력값
  const [values, setValues] = useState({
    name: '',
    birthday: '',
    anniversary: '',
    partnerCode: '',
  });

  // 취향 선택값 (다중 선택 가능)
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [selectedDateStyles, setSelectedDateStyles] = useState<string[]>([]);

  const myCode = useMemo(() => Math.random().toString(36).slice(2, 10), []);

  const steps: { key: StepKey; title: string; hint: string; accent: string; placeholder: string }[] = useMemo(() => [
    { key: 'name',        title: '이름 입력',   hint: '연인과 부르는 애칭도 좋아요. 사용자님을 어떻게 부를까요?', accent: '#6198FF', placeholder: '이름을 입력해주세요' },
    { key: 'birthday',    title: '생일 입력',   hint: '생년월일을 입력해주세요. 생일은 나중에 변경할 수 있어요!', accent: '#49DC95', placeholder: '0000. 00. 00.' },
    { key: 'anniversary', title: '기념일 입력', hint: '우리의 사랑이 시작된 날! 기념일을 입력해주세요.', accent: '#FF9191', placeholder: '0000. 00. 00.' },
    { key: 'preferences', title: '질문에 답해주세요!', hint: '더 나은 서비스를 제공하기 위해,\n사용자님의 취향을 파악하는 질문을 몇가지 준비했어요.', accent: '#3B82F6', placeholder: '' },
    { key: 'partnerCode', title: '코드 입력',   hint: '연인을 초대하고 함께 시작해봐요!', accent: '#FF9191', placeholder: '' },
  ], []);

  const current = steps[step];

  const canNext = useMemo(() => {
    switch (current.key) {
      case 'name':        return values.name.trim().length >= 1;
      case 'birthday':    return isDate(values.birthday);
      case 'anniversary': return isDate(values.anniversary);
      case 'preferences': return selectedHobbies.length > 0 && selectedDateStyles.length > 0;
      case 'partnerCode': return true;
    }
  }, [current.key, values, selectedHobbies, selectedDateStyles]);

  const progressPercent = ((step + 1) / steps.length) * 100;

  // ✅ [추가] 애니메이션 값 초기화
  const progressAnim = useRef(new Animated.Value(progressPercent)).current;

  // ✅ [추가] step이 변경될 때마다 애니메이션 실행
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPercent,
      duration: 300, // 0.3초 동안 부드럽게 이동
      useNativeDriver: false, // width 속성 변경을 위해 false 설정
    }).start();
  }, [progressPercent]);

  const toggleSelection = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const onNext = useCallback(async () => {
    if (!canNext || isPosting) return;

    try {
      setIsPosting(true);

      if (current.key === 'name') {
        await postName(values.name.trim());
      } else if (current.key === 'birthday') {
        await postBirthday(toIsoDate(values.birthday));
      } else if (current.key === 'anniversary') {
        await postTestGo();
        const coupleCode = await postAnniversary(toIsoDate(values.anniversary));
        if (coupleCode) {
          await AsyncStorage.setItem('coupleCode', coupleCode);
        }
      } else if (current.key === 'preferences') {
        console.log('Selected Hobbies:', selectedHobbies);
        console.log('Selected Date Styles:', selectedDateStyles);
      } else if (current.key === 'partnerCode') {
        const code = values.partnerCode.trim();
        if (code) {
          const resp: any = await postCouple(code);
          const rawCid = resp?.memberName ?? resp?.coupleId ?? resp?.couple_id ?? null;
          const cidNum = rawCid != null ? Number(rawCid) : NaN;

          if (Number.isFinite(cidNum)) {
            await AsyncStorage.setItem('coupleId', String(cidNum));
          } else {
            try {
              const me: any = await authedFetch('/user/getuser', { method: 'GET' });
              const fallbackCid = me?.coupleId ?? me?.couple_id ?? null;
              if (fallbackCid != null) await AsyncStorage.setItem('coupleId', String(fallbackCid));
            } catch {}
          }
        }
      }

      if (step < steps.length - 1) {
        setStep(step + 1);
      } else {
        router.replace('/signup-finish');
      }
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setIsPosting(false);
    }
  }, [canNext, isPosting, current.key, values, step, steps.length, selectedHobbies, selectedDateStyles]);

  const onBack = useCallback(() => {
    if (step === 0) return router.back();
    setStep(step - 1);
  }, [step]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        {/* 헤더 영역 */}
        <View style={styles.headerContainer}>
          <View style={styles.iconRow}>
            <Image source={HEART_ICON} style={[styles.heartImage, { tintColor: current.accent }]} />
            {/* 진행 바 */}
            <View style={styles.progressBarBg}>
              {/* ✅ [수정] Animated.View 적용 */}
              <Animated.View 
                style={[
                  styles.progressBarFill, 
                  { 
                    width: progressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%']
                    }),
                    backgroundColor: current.accent 
                  }
                ]} 
              />
            </View>
          </View>
          
          <AppText type="bold" style={[styles.title, { color: current.accent }]}>{current.title}</AppText>
          <AppText type="medium" style={styles.hintText}>{current.hint}</AppText>
        </View>

        {/* 메인 컨텐츠 영역 */}
        <View>
          {current.key === 'preferences' ? (
            // === 취향 선택 UI ===
            <View>
              <AppText type="bold" style={styles.questionTitle}>평소 즐기는 활동은?</AppText>
              <View style={styles.chipContainer}>
                {HOBBIES.map((hobby) => {
                  const isSelected = selectedHobbies.includes(hobby);
                  return (
                    <TouchableOpacity
                      key={hobby}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => toggleSelection(selectedHobbies, setSelectedHobbies, hobby)}
                    >
                      <AppText type='regular' style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {hobby}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <AppText type="bold" style={[styles.questionTitle, { marginTop: 40 }]}>상대방과 가장 하고 싶은 데이트는?</AppText>
              <View style={styles.chipContainer}>
                {DATE_STYLES.map((style) => {
                  const isSelected = selectedDateStyles.includes(style);
                  return (
                    <TouchableOpacity
                      key={style}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => toggleSelection(selectedDateStyles, setSelectedDateStyles, style)}
                    >
                      <AppText type='regular'style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {style}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

          ) : current.key === 'partnerCode' ? (
            // === 커플 코드 입력 UI ===
            <View style={[styles.codeStepContainer, { borderColor: current.accent }]}>
              {/* 나의 코드 박스 */}
              <View style={{ marginBottom: 50 }}>
                <AppText type="bold" style={styles.inputLabel}>나의 코드</AppText>
                <View style={styles.grayInputBox}>
                  <AppText type="bold" style={{ fontSize: 12, color: '#4D5053' }} selectable>{myCode}</AppText>
                </View>
              </View>

              {/* 상대방 코드 입력 박스 */}
              <View>
                <AppText type="bold" style={styles.inputLabel}>상대방 코드 입력</AppText>
                <TextInput
                  placeholder={current.placeholder}
                  placeholderTextColor="#9CA3AF"
                  value={values.partnerCode}
                  onChangeText={(t) => setValues((s) => ({ ...s, partnerCode: t }))}
                  autoCapitalize="none"
                  style={[styles.grayInputBox, { fontFamily: 'Paperlogy-7Bold', fontSize: 12, color: '#4D5053' }]}
                />
              </View>
              {isPosting && <AppText style={{ color: '#6B7280', marginTop: 10, textAlign:'center' }}>연결 중...</AppText>}
            </View>

          ) : (
            // === 일반 입력 UI (이름, 생일, 기념일) ===
            <View style={[styles.currentCardBase, { borderColor: current.accent }]}>
              <InputField
                label={current.key === 'name' ? '이름' : current.key === 'birthday' ? '생년월일' : '기념일'}
                value={values[current.key as keyof typeof values]}
                placeholder={current.placeholder}
                onChangeText={(t) => setValues((s) => ({ ...s, [current.key]: t }))}
                keyboardType={current.key === 'name' ? 'default' : 'numbers-and-punctuation'}
                accentColor={current.accent} 
              />
            </View>
          )}
        </View>

        {/* 하단 누적 카드 */}
        {current.key !== 'partnerCode' && current.key !== 'preferences' && (
          <View style={{ marginTop: 14 }}>
            {steps.slice(0, step).filter(s => s.key !== 'preferences').reverse().map((s) => (
              <PastCard
                key={s.key}
                label={s.title.replace(' 입력', '')}
                value={values[s.key as keyof typeof values]}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* 하단 버튼 */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <AppText type="semibold" style={styles.backButtonText}>
            {step === 0 ? '닫기' : '이전'}
          </AppText>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={!canNext || isPosting}
          onPress={onNext}
          style={[styles.nextButton, { backgroundColor: (!canNext || isPosting) ? '#D1D5DB' : current.accent }]}
        >
          <AppText type="bold" style={styles.nextButtonText}>
            {step < steps.length - 1 ? '다음' : '완료'}
          </AppText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ===================== styles =====================
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFCF5' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  
  headerContainer: { marginTop: 16, marginBottom: 30 },
  iconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  heartImage: { width: 24, height: 24, resizeMode: 'contain', marginRight: 10 },
  
  // 진행바 스타일
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#DDDDDD',
    borderRadius: 3,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  title: { fontSize: 18, marginBottom: 6, marginLeft:4 },
  hintText: { color: '#4D5053', fontSize: 11, lineHeight: 18 },

  // 기본 입력 카드 (테두리 있는 버전)
  currentCardBase: { borderWidth: 2, borderRadius: 16, padding: 20, backgroundColor: 'transparent' },

  // 과거 카드
  pastCardBase: {
    borderWidth: 2, borderColor: '#D1D5DB', borderRadius: 16,
    paddingHorizontal: 20, paddingVertical: 14,
    marginTop: 10, justifyContent: 'center', overflow: 'hidden',
    backgroundColor: 'transparate'
  },
  pastCardLabel: { fontSize: 11, color: '#75787B', marginBottom: 4 },
  pastCardValue: { fontSize: 13, color: '#CECECE' },

  inputLabel: { fontSize: 11, marginBottom: 8 },
  textInputBase: { color:'#CECECE', padding: 0, fontSize: 15 },

  // === 취향 선택 스타일 ===
  questionTitle: { fontSize: 14, color: '#3B82F6', marginBottom: 16 },
  chipContainer: {
    borderWidth:1,
    borderColor:'#6198FF',
    borderRadius:16,
    padding:16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  chip: {
    width: '48%', // 2열 배치
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#6B7280',
    borderRadius: 16, // 둥근 버튼
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: '#3B82F6', 
    borderColor: '#3B82F6',
  },
  chipText: {
    fontSize: 14,
    color: '#4B5563',
  },
  chipTextSelected: {
    color: '#fff',
  },

  // === 코드 입력 단계 스타일 (회색 박스) ===
  codeStepContainer: {
    padding: 20,
    paddingVertical:35,
    borderWidth: 2,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  grayInputBox: {
    backgroundColor: '#E5E7EB', // 옅은 회색 배경
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  myCodeBox: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#EAEAEA' },
  myCodeLabel: { fontSize: 12, color: '#6B7280', marginBottom: 6 },

  // 하단 버튼
  buttonContainer: {
    padding: 20, gap: 10, flexDirection: 'row',
    paddingBottom: 20, backgroundColor: '#FFFCF5', 
  },
  backButton: {
    flex: 1, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },
  backButtonText: { color: '#6B7280', fontSize: 16 },
  nextButton: { flex: 2, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  nextButtonText: { color: '#FFF', fontSize: 16 },
});