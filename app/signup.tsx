import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
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
  
  console.log('[REQ]', init.method || 'GET', url);
  if (init.body) console.log('[REQ BODY]', init.body);

  const res = await fetch(url, { ...init, headers });
  const text = await res.text();

  console.log('[RES]', res.status, text.slice(0, 300));

  if (!res.ok) throw new Error(`${path} 실패 (HTTP ${res.status}) ${text.slice(0, 100)}`);
  try { return JSON.parse(text); } catch { return text; }
}

export const postName = (name: string) =>
  authedFetch(`/user/name?name=${encodeURIComponent(name)}`, { method: 'POST' });

export const postBirthday = (iso: string) =>
  authedFetch(`/user/birthday?birthday=${encodeURIComponent(iso)}`, { method: 'POST' });

export const postAnniversary = (iso: string) =>
  authedFetch(`/user/anniversary?anniversary=${encodeURIComponent(iso)}`, { method: 'POST' });

export const getCoupleCode = () =>
  authedFetch(`/user/couple/code`, { method: 'GET' });

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

// 날짜 변환
const formatBirthDate = (text: string) => {
  const cleaned = text.replace(/\D/g, ''); 
  let formatted = cleaned;
  if (cleaned.length > 4) {
    formatted = `${cleaned.slice(0, 4)}. ${cleaned.slice(4, 6)}`;
  }
  if (cleaned.length > 6) {
    formatted = `${cleaned.slice(0, 4)}. ${cleaned.slice(4, 6)}. ${cleaned.slice(6, 8)}`;
  }
  return formatted.slice(0, 14); // 최대 길이 고정
};

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
  accentColor: string;
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

const HOBBIES = ['운동/스포츠', '예술/창작', '문화생활', '게임/오락', '여행/탐험', '맛집/카페', '집콕/힐링', '학습/자기계발'];
const DATE_STYLES = ['활동적인', '문화/감성', '미식/카페', '휴식/힐링', '체험/창작', '홈데이트', '여행/탐험'];
const LOVE_LANGUAGES = [
  '"사랑해", "보고싶어" 등 말로 표현해줄 때',
  '안아주고 스킨십 해줄 때',
  '깜짝 선물이나 이벤트 해줄 때',
  '함께 시간 내서 데이트 할 때',
  '집안일, 심부름 등 도움을 줄 때',
  '관심 갖고 내 이야기 들어줄 때',
  '응원하고 칭찬해줄 때',
  '작은 것도 기억하고 챙겨줄 때'
];

// ===================== Signup =====================
export default function Signup() {
  const [step, setStep] = useState<number>(0);
  const [isPosting, setIsPosting] = useState(false);

  const [values, setValues] = useState({
    name: '',
    birthday: '',
    anniversary: '',
    partnerCode: '',
  });

  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [selectedDateStyles, setSelectedDateStyles] = useState<string[]>([]);
  const [selectedLoveLanguages, setSelectedLoveLanguages] = useState<string[]>([]);
  const [myCoupleCode, setMyCoupleCode] = useState<string>('');

  const copyToClipboard = async () => {
    if (!myCoupleCode) return;
    await Clipboard.setStringAsync(myCoupleCode);
    Alert.alert('복사 완료', '커플 코드가 복사되었습니다!');
  };

  const steps: { key: StepKey; title: string; hint: string; accent: string; placeholder: string }[] = useMemo(() => [
    { key: 'name',         title: '이름 입력',   hint: '연인과 부르는 애칭도 좋아요. 사용자님을 어떻게 부를까요?', accent: '#6198FF', placeholder: '이름을 입력해주세요' },
    { key: 'birthday',    title: '생일 입력',   hint: '생년월일을 입력해주세요. 생일은 나중에 변경할 수 있어요!', accent: '#49DC95', placeholder: '0000. 00. 00.' },
    { key: 'anniversary', title: '기념일 입력', hint: '우리의 사랑이 시작된 날! 기념일을 입력해주세요.', accent: '#FF9191', placeholder: '0000. 00. 00.' },
    { key: 'preferences', title: '질문에 답해주세요!', hint: '더 나은 서비스를 제공하기 위해,\n사용자님의 취향을 파악하는 질문을 몇가지 준비했어요.', accent: '#3B82F6', placeholder: '' },
    { key: 'partnerCode', title: '코드 입력',   hint: '연인을 초대하고 함께 시작해봐요!', accent: '#FF9191', placeholder: '상대방의 코드를 입력해주세요' },
  ], []);

  const current = steps[step];

  const canNext = useMemo(() => {
    switch (current.key) {
      case 'name':        return values.name.trim().length >= 1;
      case 'birthday':    return isDate(values.birthday);
      case 'anniversary': return isDate(values.anniversary);
      case 'preferences': return selectedHobbies.length > 0 && selectedDateStyles.length > 0 && selectedLoveLanguages.length > 0;
      case 'partnerCode': return values.partnerCode.trim().length > 0;
    }
  }, [current.key, values, selectedHobbies, selectedDateStyles, selectedLoveLanguages]);

  const progressPercent = ((step + 1) / steps.length) * 100;
  const progressAnim = useRef(new Animated.Value(progressPercent)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPercent,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progressPercent]);

  const toggleSelection = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const onSkip = useCallback(async () => {
    try {
      console.log('⏭ [onSkip] 커플 연결 건너뜀');
      try {
        const me: any = await authedFetch('/user/getuser', { method: 'GET' });
        const fallbackCid = me?.coupleId ?? me?.couple_id ?? null;
        if (fallbackCid != null) {
          await AsyncStorage.setItem('coupleId', String(fallbackCid));
        }
      } catch {}
      router.replace('/signup-finish');
    } catch (e) {
      console.warn(e);
      router.replace('/signup-finish');
    }
  }, []);

  const onNext = useCallback(async () => {
    if (!canNext || isPosting) return;

    try {
      setIsPosting(true);

      if (current.key === 'name') {
        await postName(values.name.trim());
      } else if (current.key === 'birthday') {
        await postBirthday(toIsoDate(values.birthday));
      } else if (current.key === 'anniversary') {

        await postAnniversary(toIsoDate(values.anniversary));

        const codeResponse = await getCoupleCode();
        
        const code = (typeof codeResponse === 'object' && codeResponse !== null) 
                    ? codeResponse.coupleCode 
                    : codeResponse;

        if (code) {
          console.log('✅ 발급된 내 코드:', code);
          setMyCoupleCode(code);
          await AsyncStorage.setItem('coupleCode', code);
        }

        try {
          const me: any = await authedFetch('/user/getuser', { method: 'GET' });
          const userId   = me?.userId   ?? me?.id ?? me?.memberId ?? null;
          const coupleId = me?.coupleId ?? me?.couple_id ?? null;
          const sets: [string, string][] = [];
          if (userId != null) sets.push(['userId', String(userId)]);
          if (coupleId != null) sets.push(['coupleId', String(coupleId)]);
          if (sets.length) await AsyncStorage.multiSet(sets);
        } catch (e) {
          console.warn('[signup] /user/getuser 실패:', (e as Error)?.message);
        }

      } else if (current.key === 'preferences') {
        console.log(' [onNext] Preferences Saved');
      } else if (current.key === 'partnerCode') {
        const code = values.partnerCode.trim();
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

      if (step < steps.length - 1) {
        setStep(step + 1);
      } else {
        router.replace('/signup-finish');
      }
    } catch (e: any) {
      console.warn('[signup error]', e); 
      Alert.alert('오류', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setIsPosting(false);
    }
  }, [canNext, isPosting, current.key, values, step, steps.length, selectedHobbies, selectedDateStyles, selectedLoveLanguages]);

  const onBack = useCallback(() => {
    if (step === 0) return router.back();
    setStep(step - 1);
  }, [step]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        <View style={styles.headerContainer}>
          <View style={styles.iconRow}>
            <Image source={HEART_ICON} style={[styles.heartImage, { tintColor: current.accent }]} />
            <View style={styles.progressBarBg}>
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

        <View>
          {current.key === 'preferences' ? (
            <View>
              <AppText type="bold" style={styles.questionTitle}>평소 즐기는 활동은?</AppText>
              <View style={styles.chipContainer}>
                {HOBBIES.map((hobby) => {
                  const isSelected = selectedHobbies.includes(hobby);
                  return (
                    <TouchableOpacity key={hobby} style={[styles.chip, isSelected && styles.chipSelected]} onPress={() => toggleSelection(selectedHobbies, setSelectedHobbies, hobby)}>
                      <AppText type='regular' style={[styles.chipText, isSelected && styles.chipTextSelected]}>{hobby}</AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <AppText type="bold" style={[styles.questionTitle, { marginTop: 40 }]}>상대방과 가장 하고 싶은 데이트는?</AppText>
              <View style={styles.chipContainer}>
                {DATE_STYLES.map((style) => {
                  const isSelected = selectedDateStyles.includes(style);
                  return (
                    <TouchableOpacity key={style} style={[styles.chip, isSelected && styles.chipSelected]} onPress={() => toggleSelection(selectedDateStyles, setSelectedDateStyles, style)}>
                      <AppText type='regular'style={[styles.chipText, isSelected && styles.chipTextSelected]}>{style}</AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <AppText type="bold" style={[styles.questionTitle, { marginTop: 40 }]}>가장 사랑받는다고 느껴지는 순간은?</AppText>
              <View style={styles.chipContainer}>
                {LOVE_LANGUAGES.map((item) => {
                  const isSelected = selectedLoveLanguages.includes(item);
                  return (
                    <TouchableOpacity key={item} style={[styles.chip, isSelected && styles.chipSelected, { width: '100%' }]} onPress={() => toggleSelection(selectedLoveLanguages, setSelectedLoveLanguages, item)}>
                      <AppText type='regular' style={[styles.chipText, isSelected && styles.chipTextSelected]}>{item}</AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

          ) : current.key === 'partnerCode' ? (
            <View style={[styles.codeStepContainer, { borderColor: current.accent }]}>
              <View style={{ marginBottom: 50 }}>
                <AppText type="bold" style={styles.inputLabel}>나의 코드</AppText>
                <View style={styles.myCodeRow}>
                  <View style={[styles.grayInputBox, { flex: 1, marginRight: 10 }]}>
                    <AppText type="bold" style={{ fontSize: 12, color: '#4D5053' }} selectable>
                      {myCoupleCode || '발급 중...'}
                    </AppText>
                  </View>
                  <TouchableOpacity onPress={copyToClipboard} style={styles.copyIconButton}>
                    <Ionicons name="copy-outline" size={20} color="#6198FF" />
                  </TouchableOpacity>
                </View>
              </View>

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
              
              <TouchableOpacity onPress={onSkip} activeOpacity={0.7} style={{ marginTop: 16, alignItems:'center' }}>
                <AppText style={{ color: '#9CA3AF', fontSize: 12 }}>
                  아직 커플코드가 없으신가요? <AppText style={{ textDecorationLine: 'underline', color: '#6B7280', fontSize: 12  }}>건너뛰기</AppText>
                </AppText>
              </TouchableOpacity>
              {isPosting && <AppText style={{ color: '#6B7280', marginTop: 10, textAlign:'center' }}>연결 중...</AppText>}
            </View>

          ) : (
            <View style={[styles.currentCardBase, { borderColor: current.accent }]}>
              <InputField
                label={current.key === 'name' ? '이름' : current.key === 'birthday' ? '생년월일' : '기념일'}
                value={values[current.key as keyof typeof values]}
                placeholder={current.placeholder}
                onChangeText={(t) => {
                  // [수정] 날짜 입력 단계일 때만 자동 포맷팅 적용
                  const isDateStep = current.key === 'birthday' || current.key === 'anniversary';
                  const nextValue = isDateStep ? formatBirthDate(t) : t;
                  setValues((s) => ({ ...s, [current.key]: nextValue }));
                }}
                // [수정] 날짜 입력 시 숫자 키패드 유도
                keyboardType={current.key === 'name' ? 'default' : 'number-pad'}
                accentColor={current.accent} 
              />
            </View>
          )}
        </View>

        {current.key !== 'partnerCode' && current.key !== 'preferences' && (
          <View style={{ marginTop: 14 }}>
            {steps.slice(0, step).filter(s => s.key !== 'preferences').reverse().map((s) => (
              <PastCard key={s.key} label={s.title.replace(' 입력', '')} value={values[s.key as keyof typeof values]} />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <AppText type="semibold" style={styles.backButtonText}>{step === 0 ? '닫기' : '이전'}</AppText>
        </TouchableOpacity>
        <TouchableOpacity disabled={!canNext || isPosting} onPress={onNext} style={[styles.nextButton, { backgroundColor: (!canNext || isPosting) ? '#D1D5DB' : current.accent }]}>
          <AppText type="bold" style={styles.nextButtonText}>{step < steps.length - 1 ? '다음' : '완료'}</AppText>
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
  progressBarBg: { flex: 1, height: 6, backgroundColor: '#DDDDDD', borderRadius: 3 },
  progressBarFill: { height: '100%', borderRadius: 3 },
  title: { fontSize: 18, marginBottom: 6, marginLeft:4 },
  hintText: { color: '#4D5053', fontSize: 11, lineHeight: 18 },
  currentCardBase: { borderWidth: 2, borderRadius: 16, padding: 20, backgroundColor: 'transparent' },
  pastCardBase: { borderWidth: 2, borderColor: '#75787B', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 14, marginTop: 10, justifyContent: 'center', overflow: 'hidden' },
  pastCardLabel: { fontSize: 11, color: '#75787B', marginBottom: 4 },
  pastCardValue: { fontSize: 13, color: '#75787B' },
  inputLabel: { fontSize: 11, marginBottom: 8 },
  textInputBase: { color:'#CECECE', padding: 0, fontSize: 15 },
  questionTitle: { fontSize: 14, color: '#6198FF', marginBottom: 16 },
  chipContainer: { borderWidth:1, borderColor:'#6198FF', borderRadius:16, padding:16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  chip: { width: '48%', paddingVertical: 10, borderWidth: 1, borderColor: '#6B7280', borderRadius: 16, alignItems: 'center', marginBottom: 4, backgroundColor: 'transparent' },
  chipSelected: { backgroundColor: '#6198FF', borderColor: '#6198FF' },
  chipText: { fontSize: 14, color: '#4B5563' },
  chipTextSelected: { color: '#fff' },
  codeStepContainer: { padding: 20, paddingVertical:35, borderWidth: 2, borderRadius: 16, backgroundColor: 'transparent' },
  grayInputBox: { backgroundColor: '#E5E7EB', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, justifyContent: 'center' },
  buttonContainer: { padding: 20, gap: 10, flexDirection: 'row', paddingBottom: 20, backgroundColor: '#FFFCF5' },
  backButton: { flex: 1, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5E7EB' },
  backButtonText: { color: '#6B7280', fontSize: 16 },
  nextButton: { flex: 2, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  nextButtonText: { color: '#FFF', fontSize: 16 },
  
  myCodeRow: { flexDirection: 'row', alignItems: 'center' },
  copyIconButton: { padding: 12, backgroundColor: '#E5E7EB', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
});