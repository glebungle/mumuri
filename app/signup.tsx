import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

// 간단 유효성 검사. 추후 수정 필요
const isDate = (s: string) => /^\d{4}\.\s?\d{2}\.\s?\d{2}$/.test(s.trim());

type StepKey = 'name' | 'birthday' | 'anniversary' | 'partnerCode';

export default function Signup() {
  const [step, setStep] = useState<number>(0);
  const [values, setValues] = useState<Record<StepKey, string>>({
    name: '',
    birthday: '',
    anniversary: '',
    partnerCode: '',
  });

  // 내 코드(랜덤) – 실제로는 서버가 발급
  const myCode = useMemo(() => Math.random().toString(36).slice(2, 10), []);

  const steps: { key: StepKey; title: string; hint: string; accent: string; placeholder: string }[] = [
    { key: 'name',        title: '이름 입력',     hint: '연인과 부르는 애칭도 좋아요.',         accent: '#3B82F6', placeholder: '이름을 입력해주세요' },
    { key: 'birthday',    title: '생일 입력',     hint: '생년월일을 입력해주세요. (예: 2004. 04. 23)', accent: '#22C55E', placeholder: '0000. 00. 00.' },
    { key: 'anniversary', title: '기념일 입력',   hint: '우리의 사랑이 시작된 날을 입력해주세요.', accent: '#EF4444', placeholder: '0000. 00. 00.' },
    { key: 'partnerCode', title: '코드 입력',     hint: '연인을 초대하고 함께 시작해봐요!',     accent: '#3B82F6', placeholder: '상대방 코드 입력' },
  ];

  const current = steps[step];

  const canNext = (() => {
    switch (current.key) {
      case 'name':        return values.name.trim().length >= 1;
      case 'birthday':    return isDate(values.birthday);
      case 'anniversary': return isDate(values.anniversary);
      case 'partnerCode': return values.partnerCode.trim().length >= 4; // 임의 기준. 추후 수정
    }
  })();

  const onNext = () => {
    if (!canNext) return;
    if (step < steps.length - 1) setStep(step + 1);
    else {
      // 완료 화면으로 이동
      router.replace('/signup-finish');
    }
  };

  const onBack = () => {
    if (step === 0) return router.back();
    setStep(step - 1);
  };

  // 이전 단계 카드 컴포넌트
  const PastCard = ({ label, value }: { label: string; value: string }) => (
    <View
      style={{
        borderWidth: 1,
        borderColor: '#DDD',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: '#F8F8F8',
        marginTop: 8,
      }}
    >
      <Text style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 16, color: '#444' }}>{value || '-'}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={{ flex: 1, backgroundColor: '#FFF' }}
    >
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* 상단 타이틀 */}
        <View style={{ marginTop: 16, marginBottom: 20 }}>
          <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>회원가입</Text>
          <Text style={{ fontSize: 24, fontWeight: '800', color: current.accent }}>
            {current.title}
          </Text>
          <Text style={{ marginTop: 6, color: '#6B7280' }}>{current.hint}</Text>
        </View>

        {/* 현재 단계 입력 카드 */}
        <View
          key={current.key}
          style={{
            borderWidth: 2,
            borderColor: current.accent,
            borderRadius: 16,
            padding: 14,
            backgroundColor: '#FFF',
          }}
        >
          {current.key === 'partnerCode' ? (
            <View style={{ gap: 12 }}>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  backgroundColor: '#F3F4F6',
                }}
              >
                <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>나의 코드</Text>
                <Text selectable style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                  {myCode}
                </Text>
              </View>

              <View>
                <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>상대방 코드 입력</Text>
                <TextInput
                  placeholder={current.placeholder}
                  value={values.partnerCode}
                  onChangeText={(t) => setValues((s) => ({ ...s, partnerCode: t }))}
                  style={{
                    borderWidth: 1,
                    borderColor: '#D1D5DB',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 16,
                    backgroundColor: '#FFF',
                  }}
                  autoCapitalize="none"
                />
              </View>
            </View>
          ) : (
            <View>
              <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>
                {current.key === 'name' ? '이름' :
                 current.key === 'birthday' ? '생년월일' : '기념일'}
              </Text>
              <TextInput
                placeholder={current.placeholder}
                value={values[current.key]}
                onChangeText={(t) => setValues((s) => ({ ...s, [current.key]: t }))}
                style={{
                  borderWidth: 1,
                  borderColor: '#D1D5DB',
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 16,
                  backgroundColor: '#FFF',
                }}
                keyboardType={current.key === 'name' ? 'default' : 'numbers-and-punctuation'}
                autoCapitalize="none"
              />
            </View>
          )}
        </View>

        {/* 아래로 쌓이는 이전 값 카드들 */}
        <View style={{ marginTop: 14 }}>
          {step >= 1 && <PastCard label="이름" value={values.name} />}
          {step >= 2 && <PastCard label="생년월일" value={values.birthday} />}
          {step >= 3 && <PastCard label="기념일" value={values.anniversary} />}
        </View>
      </ScrollView>

      {/* 하단 버튼 */}
      <View style={{ padding: 20, gap: 10, flexDirection: 'row' }}>
        <TouchableOpacity
          onPress={onBack}
          style={{
            flex: 1,
            height: 48,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: '#E5E7EB',
            backgroundColor: '#FFF',
          }}
        >
          <Text style={{ fontWeight: '700', color: '#6B7280' }}>
            {step === 0 ? '닫기' : '이전'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={!canNext}
          onPress={onNext}
          style={{
            flex: 2,
            height: 48,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: canNext ? '#111827' : '#D1D5DB',
          }}
        >
          <Text style={{ fontWeight: '800', color: '#FFF' }}>
            {step < steps.length - 1 ? '다음' : '완료'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
