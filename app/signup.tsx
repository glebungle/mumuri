// app/signup.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
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
const BASE = 'https://5fbe91913f6e.ngrok-free.app';

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
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  console.log('[RES]', res.status, text.slice(0, 300));

  if (!res.ok) throw new Error(`${path} 실패 (HTTP ${res.status}) ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return text; }
}

// 도메인 API (쿼리 파라미터 방식)
export const postName        = (name: string) =>
  authedFetch(`/user/name?name=${encodeURIComponent(name)}`, { method: 'POST' });

export const postBirthday    = (iso: string /* yyyy-MM-dd */) =>
  authedFetch(`/user/birthday?birthday=${encodeURIComponent(iso)}`, { method: 'POST' });

/** 서버가 커플코드(문자열) 반환 */
export const postAnniversary = (iso: string /* yyyy-MM-dd */) =>
  authedFetch(`/user/anniversary?anniversary=${encodeURIComponent(iso)}`, { method: 'POST' });

/** 완료 전에 호출해야 하는 임시 API */
export const postTestGo      = () =>
  authedFetch(`/test/go`, { method: 'POST' });

/** 커플 연결 (쿼리 실패 시 JSON body 폴백) — 반드시 1개만 선언! */
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

type StepKey = 'name' | 'birthday' | 'anniversary' | 'partnerCode';
const HEART_ICON = require('../assets/images/BlueHeart.png');

const PastCard = React.memo(({ label, value }: { label: string; value: string }) => (
  <View style={[styles.pastCardBase, { height: 90 }]}>
    <AppText style={styles.pastCardLabel}>{label}</AppText>
    <AppText style={styles.pastCardValue}>{value || '-'}</AppText>
  </View>
));

const InputField = React.memo(({
  label, value, placeholder, onChangeText, keyboardType = 'default',
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (text: string) => void;
  keyboardType?: TextInputProps['keyboardType'];
}) => {
  const inputColor = value.length > 0 ? '#111827' : '#9CA3AF';
  return (
    <View>
      <AppText style={styles.inputLabel}>{label}</AppText>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize="none"
        style={[styles.textInputBase, { fontFamily: 'Pretendard-SemiBold', color: inputColor }]}
      />
    </View>
  );
});

// ===================== Signup =====================
export default function Signup() {
  const [step, setStep] = useState<number>(0);
  const [isPosting, setIsPosting] = useState(false);

  const [values, setValues] = useState<Record<StepKey, string>>({
    name: '',
    birthday: '',
    anniversary: '',
    partnerCode: '',
  });

  const myCode = useMemo(() => Math.random().toString(36).slice(2, 10), []);

  const steps: { key: StepKey; title: string; hint: string; accent: string; placeholder: string }[] = useMemo(() => [
    { key: 'name',        title: '이름 입력',   hint: '연인과 부르는 애칭도 좋아요. 어떻게 불러드릴까요?', accent: '#3B82F6', placeholder: '이름을 입력해주세요' },
    { key: 'birthday',    title: '생일 입력',   hint: '생년월일을 입력해주세요. (예: 2000. 01. 23)',      accent: '#22C55E', placeholder: '0000. 00. 00.' },
    { key: 'anniversary', title: '기념일 입력', hint: '우리의 기념일을 입력해주세요. (예: 2024. 10. 01)', accent: '#EF4444', placeholder: '0000. 00. 00.' },
    { key: 'partnerCode', title: '코드 입력',   hint: '연인의 코드를 입력해 연결해요. (임시)',            accent: '#3B82F6', placeholder: '상대방 코드 입력' },
  ], []);

  const current = steps[step];

  const canNext = useMemo(() => {
    switch (current.key) {
      case 'name':        return values.name.trim().length >= 1;
      case 'birthday':    return isDate(values.birthday);
      case 'anniversary': return isDate(values.anniversary);
      case 'partnerCode': return true; // 임시: 코드 없어도 완료 가능
    }
  }, [current.key, values]);

  const onNext = useCallback(async () => {
    if (!canNext || isPosting) return;

    try {
      setIsPosting(true);

      if (current.key === 'name') {
        await postName(values.name.trim());

      } else if (current.key === 'birthday') {
        await postBirthday(toIsoDate(values.birthday));

      } else if (current.key === 'anniversary') {
        // 1) 완료 이전 필수 호출
        await postTestGo();
        console.log('[signup] test/go 호출 성공');

        // 2) 기념일 저장 → 서버가 커플코드(문자열) 반환
        const coupleCode: string = await postAnniversary(toIsoDate(values.anniversary));
        console.log('[signup] anniversary → coupleCode:', coupleCode);
        if (coupleCode) {
          await AsyncStorage.setItem('coupleCode', coupleCode); // 채팅 ROOM_KEY 등에서 사용 가능
        }

        // 3) (선택) 보정: /user/getuser 로 me 정보 확보
        try {
          const me: any = await authedFetch('/user/getuser', { method: 'GET' });
          const userId   = me?.userId   ?? me?.id        ?? me?.memberId ?? null;
          const coupleId = me?.coupleId ?? me?.couple_id ?? null;

          const sets: [string, string][] = [];
          if (userId   != null) sets.push(['userId', String(userId)]);
          if (coupleId != null) sets.push(['coupleId', String(coupleId)]);
          if (sets.length) await AsyncStorage.multiSet(sets);
        } catch (e) {
          console.warn('[signup] /user/getuser 실패:', (e as Error)?.message);
        }

      } else if (current.key === 'partnerCode') {
        const code = values.partnerCode.trim();
        if (code) {
          // 1) 커플 연결 호출
          const resp: any = await postCouple(code);
          console.log('[postCouple] resp =', resp);

          // 2) 백엔드가 memberName 필드에 "커플아이디"를 담아 보내줌(요청 반영)
          const rawCid = resp?.memberName ?? resp?.coupleId ?? resp?.couple_id ?? null;
          const cidNum = rawCid != null ? Number(rawCid) : NaN;

          if (Number.isFinite(cidNum)) {
            await AsyncStorage.setItem('coupleId', String(cidNum));
            console.log('[postCouple] coupleId saved:', cidNum);
          } else {
            console.warn('[postCouple] invalid coupleId from response:', rawCid);
            // 3) 폴백: /user/getuser 로 보강해서 coupleId 확보
            try {
              const me: any = await authedFetch('/user/getuser', { method: 'GET' });
              const fallbackCid = me?.coupleId ?? me?.couple_id ?? null;
              if (fallbackCid != null && Number.isFinite(Number(fallbackCid))) {
                await AsyncStorage.setItem('coupleId', String(fallbackCid));
                console.log('[getuser] fallback coupleId saved:', fallbackCid);
              }
            } catch (e) {
              console.warn('[getuser] fallback failed:', (e as Error)?.message);
            }
          }
        }
      }

      if (step < steps.length - 1) {
        setStep(step + 1);
      } else {
        router.replace('/signup-finish');
      }
    } catch (e: any) {
      console.warn('[signup] error:', e?.message);
      Alert.alert('회원정보 저장 실패', e?.message ?? '다시 시도해 주세요.');
    } finally {
      setIsPosting(false);
    }
  }, [canNext, isPosting, current.key, values, step, steps.length]);

  const onBack = useCallback(() => {
    if (step === 0) return router.back();
    setStep(step - 1);
  }, [step]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.headerContainer}>
          <Image source={HEART_ICON} style={[styles.heartImage, { tintColor: current.accent }]} />
          <AppText type="bold" style={[styles.title, { color: current.accent }]}>{current.title}</AppText>
          <AppText type="medium" style={styles.hintText}>{current.hint}</AppText>
        </View>

        <View key={current.key} style={[styles.currentCardBase, { borderColor: current.accent }]}>
          {current.key === 'partnerCode' ? (
            <View style={{ gap: 12 }}>
              <View style={styles.myCodeBox}>
                <AppText style={styles.myCodeLabel}>나의 코드</AppText>
                <AppText selectable type="bold">{myCode}</AppText>
              </View>
              <InputField
                label="상대방 코드 입력"
                value={values.partnerCode}
                placeholder={current.placeholder}
                onChangeText={(t) => setValues((s) => ({ ...s, partnerCode: t }))}
              />
              {isPosting ? <AppText style={{ color: '#6B7280', marginTop: 6 }}>처리 중...</AppText> : null}
            </View>
          ) : (
            <InputField
              label={current.key === 'name' ? '이름' : current.key === 'birthday' ? '생년월일' : '기념일'}
              value={values[current.key]}
              placeholder={current.placeholder}
              onChangeText={(t) => setValues((s) => ({ ...s, [current.key]: t }))}
              keyboardType={current.key === 'name' ? 'default' : 'numbers-and-punctuation'}
            />
          )}
        </View>

        <View style={{ marginTop: 14 }}>
          {steps.slice(0, step).reverse().map((s) => (
            <PastCard
              key={s.key}
              label={s.key === 'name' ? '이름' : s.key === 'birthday' ? '생년월일' : '기념일'}
              value={values[s.key]}
            />
          ))}
        </View>
      </ScrollView>

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
          <AppText type="extrabold" style={styles.nextButtonText}>
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
  headerContainer: { marginTop: 16, marginBottom: 20 },
  heartImage: { width: 28, height: 28, marginBottom: 8, resizeMode: 'contain' },
  title: { fontSize: 24 },
  hintText: { marginTop: 6, color: '#4D5053', fontSize: 12 },

  currentCardBase: { borderWidth: 2, borderRadius: 16, padding: 14, backgroundColor: 'transparent' },

  pastCardBase: {
    borderWidth: 2, borderColor: '#75787B', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 11,
    marginTop: 8, justifyContent: 'center', overflow: 'hidden',
  },
  pastCardLabel: { fontSize: 12, color: '#75787B', marginBottom: 4 },
  pastCardValue: { fontSize: 16, color: '#75787B' },

  inputLabel: { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  textInputBase: { paddingHorizontal: 0, paddingVertical: 0, fontSize: 16, backgroundColor: 'transparent' },

  myCodeBox: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#EAEAEA' },
  myCodeLabel: { fontSize: 12, color: '#6B7280', marginBottom: 6 },

  buttonContainer: {
    padding: 20, gap: 10, flexDirection: 'row',
    paddingBottom: 20, backgroundColor: '#FFFCF5', borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  backButton: {
    flex: 1, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFF',
  },
  backButtonText: { color: '#6B7280' },
  nextButton: { flex: 2, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  nextButtonText: { color: '#FFF' },
});
