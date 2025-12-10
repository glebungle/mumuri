// app/mypage.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../components/AppText';

const API_BASE = 'https://mumuri.shop';

const handlePressSetting = () => {
  router.push('/setting');
};


// 날짜 포맷 헬퍼 함수 (YYYY. MM. DD)
const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}. ${month}. ${day}`;
};

// 문자열(YYYY-MM-DD / YYYY.MM.DD 등)을 Date로 파싱
const parseToDate = (value?: string | null): Date | null => {
  if (!value) return null;

  // 2025.11.29 같은 케이스를 2025-11-29로 치환
  const normalized = value.replace(/\./g, '-').replace(/\s/g, '');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

// 생일 문자열 포맷: YYYY. MM. DD / MM. DD 로 맞춰주기
const formatBirthString = (raw?: string | null): string => {
  if (!raw) return '';
  const s = raw.trim();

  // 이미 "YYYY. MM. DD" 형식이면 그대로 사용
  if (/^\d{4}\.\s?\d{2}\.\s?\d{2}$/.test(s)) return s;

  // "YYYY-MM-DD" 또는 "YYYY.MM.DD"
  if (/^\d{4}[-.]\d{2}[-.]\d{2}$/.test(s)) {
    const [y, m, d] = s.split(/[-.]/);
    return `${y}. ${m}. ${d}`;
  }

  // "MM-DD" 또는 "MM.DD"
  if (/^\d{2}[-.]\d{2}$/.test(s)) {
    const [m, d] = s.split(/[-.]/);
    return `${m}.${d}`;
  }

  // 그 외는 일단 그대로
  return s;
};

type ProfileState = {
  name: string;
  birthDate: string;            // "YYYY. MM. DD"
  startDay: Date;               // 사귄 날
  partnerName: string;
  partnerBirthString: string;   // "MM.DD" 등
  currentDayCount: number;      // 오늘 기준 D-day(몇 일째인지)
};

export default function MyPage() {
  const [profile, setProfile] = useState<ProfileState>({
    name: '',
    birthDate: '',
    startDay: new Date(),
    partnerName: '',
    partnerBirthString: '',
    currentDayCount: 0,
  });

  const [loading, setLoading] = useState(false);

  // 서버에서 내 정보 + 커플 정보 가져오기
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          console.warn('[mypage] no token');
          return;
        }

        // 1) /user/getuser : 이름, 생일, 상대 정보 등
        let myName = '';
        let myBirth = '';
        let partnerName = '';
        let partnerBirth = '';
        let coupleStartFromUser: Date | null = null;

        try {
          const res = await fetch(`${API_BASE}/user/getuser`, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
              'ngrok-skip-browser-warning': 'true',
            },
          });

          const text = await res.text();
          if (res.ok) {
            let data: any = {};
            try { data = JSON.parse(text); } catch {}

            // 내 이름 후보 키
            myName =
              data.name ??
              data.nickname ??
              data.username ??
              '';

            // 내 생일 후보 키 (YYYY-MM-DD / YYYY.MM.DD 등)
            const myBirthRaw =
              data.birthDate ??
              data.birth_day ??
              data.birthday ??
              data.birth ??
              null;
            myBirth = myBirthRaw ? formatBirthString(String(myBirthRaw)) : '';

            // 상대 이름 / 생일 후보 키
            const partner = data.partner ?? data.couplePartner ?? {};
            partnerName =
              partner.name ??
              partner.nickname ??
              partner.username ??
              data.partnerName ??
              '';

            const partnerBirthRaw =
              partner.birthDate ??
              partner.birth ??
              partner.birthday ??
              data.partnerBirth ??
              null;
            partnerBirth = partnerBirthRaw ? formatBirthString(String(partnerBirthRaw)) : '';

            // 사귄 날(커플 시작일) 정보가 있다면 사용
            const startRaw =
              data.coupleStartDate ??
              data.startDate ??
              data.firstDate ??
              null;
            const parsedStart = startRaw ? parseToDate(String(startRaw)) : null;
            if (parsedStart) coupleStartFromUser = parsedStart;
          } else {
            console.warn('[mypage] /user/getuser failed', text);
          }
        } catch (e: any) {
          console.warn('[mypage] /user/getuser error', e?.message);
        }

        // 2) /user/main : dday 등(이미 카메라에서 쓰던 API)
        let ddayCount = 0;
        let startDayFromMain: Date | null = null;

        try {
          const res = await fetch(`${API_BASE}/user/main`, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
              'ngrok-skip-browser-warning': 'true',
            },
          });
          const text = await res.text();
          if (res.ok) {
            let data: any = {};
            try { data = JSON.parse(text); } catch {}

            // dday 숫자 (몇 일째인지) – 카메라에서 쓰던 json.dday와 동일
            if (typeof data.dday === 'number') {
              ddayCount = data.dday;
            }

            // 시작일이 따로 오면 사용
            const startRaw =
              data.startDay ??
              data.coupleStartDay ??
              data.firstDate ??
              null;
            const parsedStart = startRaw ? parseToDate(String(startRaw)) : null;
            if (parsedStart) {
              startDayFromMain = parsedStart;
            }
          } else {
            console.warn('[mypage] /user/main failed', text);
          }
        } catch (e: any) {
          console.warn('[mypage] /user/main error', e?.message);
        }

        // 3) 최종 startDay / dday 계산
        const today = new Date();

        let finalDday = ddayCount;
        let finalStartDay: Date;

        if (startDayFromMain) {
          finalStartDay = startDayFromMain;
          // dday가 없다면 startDay 기준으로 계산
          if (!finalDday) {
            const diffMs = today.getTime() - finalStartDay.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1; // 1일차부터
            finalDday = diffDays;
          }
        } else if (coupleStartFromUser) {
          finalStartDay = coupleStartFromUser;
          const diffMs = today.getTime() - finalStartDay.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
          finalDday = finalDday || diffDays;
        } else if (finalDday) {
          // startDay가 없고 dday만 있을 때: 오늘에서 (dday - 1)일을 뺀 날을 시작일로
          const base = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(), 0, 0, 0, 0,
          );
          base.setDate(base.getDate() - (finalDday - 1));
          finalStartDay = base;
        } else {
          // 둘 다 없으면 오늘을 기준으로 1일차 처리
          finalStartDay = today;
          finalDday = 1;
        }

        setProfile({
          name: myName || '애인',
          birthDate: myBirth || '',
          startDay: finalStartDay,
          partnerName: partnerName || '',
          partnerBirthString: partnerBirth || '',
          currentDayCount: finalDday,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 미래 기념일 계산 함수
  const getAnniversaryDate = (days: number) => {
    const targetDate = new Date(profile.startDay);
    targetDate.setDate(targetDate.getDate() + (days - 1)); // 1일차부터 시작하므로 days-1
    return formatDate(targetDate);
  };

  const upcomingAnniversaries = useMemo(() => [50, 100, 200, 300], []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {/* 1. 상단 헤더 (설정 아이콘) */}
        <View style={styles.header}>
          <View style={{ width: 24 }} />
          <Pressable onPress={handlePressSetting}>
            <Ionicons name="settings-outline" size={24} color="#444" />
          </Pressable>
        </View>

        {/* 2. 프로필 섹션 */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={40} color="#FF9E9E" />
            </View>
          </View>

          <AppText type='pretendard-b' style={styles.nameText}>
            {profile.name || (loading ? '불러오는 중...' : '이름 미등록')}
          </AppText>
          {!!profile.birthDate && (
            <AppText style={styles.birthText}>{profile.birthDate}</AppText>
          )}

          <Pressable style={styles.editButton}>
            <AppText type='pretendard-m' style={styles.editButtonText}>프로필 편집</AppText>
          </Pressable>
        </View>

        {/* 3. 흰색 카드 영역 (정보 및 리스트) */}
        <View style={styles.whiteCard}>
          {/* 상단: 생일 및 현재 기념일수 */}
          <View style={styles.dashboardRow}>
            {/* 왼쪽: 생일 */}
            <View style={styles.dashboardItem}>
              <AppText style={styles.bigNumberText}>
                {profile.partnerBirthString || '--.--'}
              </AppText>
              <AppText style={styles.subLabelText}>
                {profile.partnerName || '상대방'}님의 생일
              </AppText>
            </View>

            {/* 구분선 */}
            <View style={styles.verticalDivider} />

            {/* 오른쪽: 기념일 */}
            <View style={styles.dashboardItem}>
              <AppText style={styles.smallDateText}>
                {formatDate(profile.startDay)}
              </AppText>
              <AppText type='pretendard-m' style={styles.bigNumberText}>
                {profile.currentDayCount}일째
              </AppText>
              <AppText style={styles.subLabelText}>기념일</AppText>
            </View>
          </View>

          {/* 하단: 기념일 리스트 */}
          <View style={styles.listContainer}>
            {upcomingAnniversaries.map((days) => (
              <View key={days} style={styles.listItem}>
                <View style={styles.listItemLeft}>
                  <Ionicons name="heart-outline" size={20} color="#FF9E9E" />
                  <AppText type='pretendard-b' style={styles.dayLabel}>{days}일</AppText>
                </View>
                <AppText type='pretendard-m' style={styles.dateValue}>{getAnniversaryDate(days)}</AppText>
              </View>
            ))}

            {/* 1주년 */}
            <View style={styles.listItem}>
              <View style={styles.listItemLeft}>
                <Ionicons name="heart-outline" size={20} color="#FF9E9E" />
                <AppText style={styles.dayLabel}>1주년</AppText>
              </View>
              <AppText type='pretendard-m' style={styles.dateValue}>{getAnniversaryDate(365)}</AppText>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFCF5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FFDEDE',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFC8C8',
  },
  nameText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  birthText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
  },
  editButton: {
    backgroundColor: '#FFF',
    marginTop: 15,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
  },
  whiteCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 40,
    paddingHorizontal: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },
  dashboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  dashboardItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verticalDivider: {
    width: 2,
    height: '100%',
    backgroundColor: '#E2E2E2',
    marginHorizontal: 10,
  },
  bigNumberText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#444',
    marginBottom: 4,
  },
  smallDateText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  subLabelText: {
    fontSize: 14,
    color: '#999',
  },
  listContainer: {
    gap: 12,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF1F1',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dayLabel: {
    fontSize: 15,
    color: '#444',
  },
  dateValue: {
    fontSize: 13,
    color: '#626262',
  },
});
