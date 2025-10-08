import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../components/AppText';

// 간단 유효성 검사. 추후 수정 필요
const isDate = (s: string) => /^\d{4}\.\s?\d{2}\.\s?\d{2}$/.test(s.trim());

type StepKey = 'name' | 'birthday' | 'anniversary' | 'partnerCode';

const HEART_ICON = require('../assets/images/BlueHeart.png');

// PastCard 컴포넌트를 Signup 함수 외부로 이동하고 useCallback으로 감쌉니다.
const PastCard = React.memo(({ label, value }: { label: string; value: string }) => (
    <View
        style={[styles.pastCardBase, { height: 90 }]} // 높이 조정 (이전 로그 기반)
    >
        <AppText style={styles.pastCardLabel}>{label}</AppText>
        <AppText style={styles.pastCardValue}>{value || '-'}</AppText>
    </View>
));

// InputField 컴포넌트를 Signup 함수 밖으로 이동
const InputField = React.memo(({ label, value, placeholder, onChangeText, keyboardType = 'default' }: { 
    label: string; 
    value: string; 
    placeholder: string; 
    onChangeText: (text: string) => void; 
    keyboardType?: TextInputProps['keyboardType'];
}) => {
    const inputColor = value.length > 0 ? '#111827' : '#9CA3AF';
    const placeholderColor = '#9CA3AF'; 
    
    return (
        <View>
            <AppText style={styles.inputLabel}>{label}</AppText>
            <TextInput
                placeholder={placeholder}
                placeholderTextColor={placeholderColor}
                value={value}
                onChangeText={onChangeText}
                keyboardType={keyboardType}
                autoCapitalize="none"
                style={[
                    styles.textInputBase, 
                    { fontFamily: 'Pretendard-SemiBold', color: inputColor } 
                ]}
            />
        </View>
    );
});


// =======================================================
// 2. Signup 메인 컴포넌트
// =======================================================
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

    const steps: { key: StepKey; title: string; hint: string; accent: string; placeholder: string }[] = useMemo(() => [
        { key: 'name', title: '이름 입력', hint: '연인과 부르는 애칭도 좋아요. 사용자님을 어떻게 부를까요?', accent: '#3B82F6', placeholder: '이름을 입력해주세요' },
        { key: 'birthday', title: '생일 입력', hint: '생년월일을 입력해주세요. 생일은 나중에 변경할 수 있어요!', accent: '#22C55E', placeholder: '0000. 00. 00.' },
        { key: 'anniversary', title: '기념일 입력', hint: '우리의 사랑이 시작된 날! 기념일을 입력해주세요.', accent: '#EF4444', placeholder: '0000. 00. 00.' },
        { key: 'partnerCode', title: '코드 입력', hint: '연인을 초대하고 함께 시작해봐요!', accent: '#3B82F6', placeholder: '상대방 코드 입력' },
    ], []);

    const current = steps[step];

    // 렌더링 최적화: canNext 로직을 useMemo로 감싸 불필요한 계산 방지
    const canNext = useMemo(() => {
        switch (current.key) {
            case 'name': return values.name.trim().length >= 1;
            case 'birthday': return isDate(values.birthday);
            case 'anniversary': return isDate(values.anniversary);
            case 'partnerCode': return values.partnerCode.trim().length >= 4;
        }
    }, [current.key, values]);

    // 렌더링 최적화: onNext/onBack 함수를 useCallback으로 감싸 불필요한 재생성 방지
    const onNext = useCallback(() => {
        if (!canNext) return;
        if (step < steps.length - 1) setStep(step + 1);
        else {
            // 완료 화면으로 이동
            router.replace('/signup-finish');
        }
    }, [canNext, step, steps.length]);

    const onBack = useCallback(() => {
        if (step === 0) return router.back();
        setStep(step - 1);
    }, [step]);
    

    return (
        <SafeAreaView style={styles.safeArea}> 
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                
                {/* 상단 타이틀 */}
                <View style={styles.headerContainer}>
                    {/* 🚨 수정된 부분: 상수화된 HEART_ICON 변수를 source에 사용 */}
                    <Image
                        source={HEART_ICON} 
                        style={[styles.heartImage, { tintColor: current.accent }]}
                    />
                    <AppText type='bold' style={[styles.title, { color: current.accent }]}>
                        {current.title}
                    </AppText>
                    <AppText type="medium" style={styles.hintText}>{current.hint}</AppText>
                </View>

                {/* 현재 단계 입력 카드 */}
                <View
                    key={current.key} // key를 사용하여 단계 변경 시 카드 리마운트
                    style={[styles.currentCardBase, { borderColor: current.accent }]}
                >
                    {current.key === 'partnerCode' ? (
                        <View style={{ gap: 12 }}>
                            {/* 나의 코드 표시 영역 */}
                            <View style={styles.myCodeBox}>
                                <AppText style={styles.myCodeLabel}>나의 코드</AppText>
                                <AppText selectable type='bold'>{myCode}</AppText>
                            </View>

                            {/* 상대방 코드 입력 필드 */}
                            <InputField
                                label="상대방 코드 입력"
                                value={values.partnerCode}
                                placeholder={current.placeholder}
                                onChangeText={(t) => setValues((s) => ({ ...s, partnerCode: t }))}
                            />
                        </View>
                    ) : (
                        // 이름, 생일, 기념일 입력 필드
                        <InputField
                            label={current.key === 'name' ? '이름' : current.key === 'birthday' ? '생년월일' : '기념일'}
                            value={values[current.key]}
                            placeholder={current.placeholder}
                            onChangeText={(t) => setValues((s) => ({ ...s, [current.key]: t }))}
                            keyboardType={current.key === 'name' ? 'default' : 'numbers-and-punctuation'}
                        />
                    )}
                </View>

                {/* 아래로 쌓이는 이전 값 카드들 */}
                <View style={{ marginTop: 14 }}>
                    {steps.slice(0, step).reverse().map((stepItem) => (
                        <PastCard 
                            key={stepItem.key} 
                            label={stepItem.key === 'name' ? '이름' : stepItem.key === 'birthday' ? '생년월일' : '기념일'} 
                            value={values[stepItem.key]} 
                        />
                    ))}
                </View>

            </ScrollView>

            {/* 하단 버튼 */}
            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    onPress={onBack}
                    style={styles.backButton}
                >
                    <AppText type='semibold' style={styles.backButtonText}>
                        {step === 0 ? '닫기' : '이전'}
                    </AppText>
                </TouchableOpacity>

                <TouchableOpacity
                    disabled={!canNext}
                    onPress={onNext}
                    style={[styles.nextButton, { backgroundColor: canNext ? current.accent : '#D1D5DB' }]}
                >
                    <AppText type='extrabold' style={styles.nextButtonText}>
                        {step < steps.length - 1 ? '다음' : '완료'}
                    </AppText>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1, 
        backgroundColor: '#FFFCF5', 
    },
    scrollContent: { 
        padding: 20, 
        paddingBottom: 40 
    },
    headerContainer: { 
        marginTop: 16, 
        marginBottom: 20,
    },

    heartImage: {
        width: 28,
        height: 28,
        marginBottom: 8,
        resizeMode: 'contain',
    },
    title: { 
        fontSize: 24 
    },
    hintText: { 
        marginTop: 6, 
        color: '#4D5053', 
        fontSize: 12 
    },
    currentCardBase: {
        borderWidth: 2,
        borderRadius: 16,
        padding: 14,
        backgroundColor: 'transparent',
    },
    // PastCard 스타일
    pastCardBase: {
        borderWidth: 2,
        borderColor: '#75787B',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 11, // 높이 90에 맞게 조정
        marginTop: 8,
        justifyContent: 'center',
        overflow: 'hidden',
    },
    pastCardLabel: {
        fontSize: 12, 
        color: '#75787B',
        marginBottom: 4, // 간격 조정
    },
    pastCardValue: {
        fontSize: 16, 
        color: '#75787B'
    },
    // TextInput 관련 스타일
    inputLabel: {
        fontSize: 12, 
        color: '#6B7280', 
        marginBottom: 6 
    },
    textInputBase: {
        paddingHorizontal: 0,
        paddingVertical: 0,
        fontSize: 16,
        backgroundColor: 'transparent',
    },
    myCodeBox: {
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: '#EAEAEA',
    },
    myCodeLabel: { 
        fontSize: 12, 
        color: '#6B7280', 
        marginBottom: 6 
    },
    // 버튼 스타일
    buttonContainer: { 
        padding: 20, 
        gap: 10, 
        flexDirection: 'row',
        paddingBottom: 20, 
        backgroundColor: '#FFFCF5', 
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    backButton: {
        flex: 1,
        height: 48,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFF',
    },
    backButtonText: { 
        color: '#6B7280' 
    },
    nextButton: {
        flex: 2,
        height: 48,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nextButtonText: { 
        color: '#FFF' 
    }
});
