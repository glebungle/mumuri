import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../components/AppText';

// 백엔드 API 명세에 맞춘 타입 정의
interface MyPageResponse {
  name: string;           // 내 이름
  birthday: string;       // 내 생일 (YYYY-MM-DD)
  anniversary: string;    // 기념일 (YYYY-MM-DD)
  birthdayCouple: string; // 상대방 생일 (YYYY-MM-DD)
  dDay: number;          // 며칠째인지
}

const BASE_URL = 'https://mumuri.shop'; // API 주소

// --- 날짜 포맷 헬퍼 함수들 ---
const formatDate = (dateString?: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}. ${month}. ${day}`;
};

// 생일 문자열 포맷팅 (YYYY. MM. DD)
const formatBirthString = (raw?: string | null): string => {
  if (!raw) return '--. --. --';
  return formatDate(raw); // 서버가 YYYY-MM-DD로 준다고 가정하고 재사용
};

export default function MyPage() {
  const [myPageData, setMyPageData] = useState<MyPageResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // ✅ 마이페이지 전용 데이터 가져오기 함수
  const fetchMyPageData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`${BASE_URL}/api/mypage`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        console.error('마이페이지 조회 실패:', res.status);
        return;
      }

      const data = await res.json();
      // console.log('마이페이지 데이터:', data); // 디버깅용
      setMyPageData(data);
    } catch (e) {
      console.error('마이페이지 에러:', e);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 화면에 들어올 때마다 데이터 갱신
  useFocusEffect(
    useCallback(() => {
      fetchMyPageData();
    }, [])
  );

  const handlePressSetting = () => {
    router.push('/setting');
  };

  // --- 데이터 바인딩 (이제 로직이 필요 없습니다!) ---
  const myName = myPageData?.name || '사용자';
  const myBirth = formatBirthString(myPageData?.birthday);

  const partnerName = '애인'; 
  const partnerBirth = formatBirthString(myPageData?.birthdayCouple);
  
  const dDayCount = myPageData?.dDay ?? 0;
  const anniversaryDate = formatDate(myPageData?.anniversary);

  // 미래 기념일 계산 (기존 로직 유지)
  const upcomingAnniversaries = useMemo(() => [50, 100, 200, 300], []);
  
  const getAnniversaryDate = (days: number) => {
    if (!myPageData?.anniversary) return '';
    const start = new Date(myPageData.anniversary);
    if (isNaN(start.getTime())) return '';
    
    const target = new Date(start);
    target.setDate(target.getDate() + (days - 1));
    return formatDate(target.toISOString());
  };

  return (
    <LinearGradient
      colors={['#FFFCF5', '#E4DED0']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 0.5 }}
      style={styles.gradientBackground}
    >
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. 상단 헤더 */}
          <View style={styles.header}>
            <View style={{ width: 24 }} />
            <Pressable onPress={handlePressSetting}>
              <Ionicons name="settings-outline" size={24} color="#444" />
            </Pressable>
          </View>

          {loading && !myPageData ? (
             <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
                <ActivityIndicator size="large" color="#FF9E9E" />
             </View>
          ) : (
            <>
              {/* 2. 프로필 섹션 */}
              <View style={styles.profileSection}>
                <View style={styles.avatarContainer}>
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={40} color="#FF9E9E" />
                  </View>
                </View>

                <AppText type="pretendard-b" style={styles.nameText}>
                  {myName}
                </AppText>
                <AppText style={styles.birthText}>{myBirth}</AppText>

                <Pressable style={styles.editButton}>
                  <AppText type="pretendard-m" style={styles.editButtonText}>
                    프로필 편집
                  </AppText>
                </Pressable>
              </View>

              {/* 3. 흰색 카드 영역 */}
              <View style={styles.whiteCard}>
                {/* 상단: 대시보드 */}
                <View style={styles.dashboardRow}>
                  {/* 왼쪽: 상대방 생일 */}
                  <View style={styles.dashboardItem}>
                    <AppText type="pretendard-m" style={styles.bigNumberText}>
                      {partnerBirth}
                    </AppText>
                    <AppText type="pretendard-m" style={styles.subLabelText}>
                      {partnerName}님의 생일
                    </AppText>
                  </View>

                  <View style={styles.verticalDivider} />

                  {/* 오른쪽: 기념일 */}
                  <View style={styles.dashboardItem}>
                    <AppText type="pretendard-m" style={styles.smallDateText}>
                      {anniversaryDate || '---. --. --'}
                    </AppText>
                    <AppText type="pretendard-m" style={styles.bigNumberText}>
                       {/* dDay가 0이면 연결 대기중으로 표시 */}
                      {dDayCount > 0 ? `${dDayCount}일째` : 'D-Day'}
                    </AppText>
                    <AppText type="pretendard-m" style={styles.subLabelText}>
                      기념일
                    </AppText>
                  </View>
                </View>

                {/* 하단: 기념일 리스트 */}
                {dDayCount > 0 && (
                  <View style={styles.listContainer}>
                    {upcomingAnniversaries.map((days) => (
                      <View key={days} style={styles.listItem}>
                        <View style={styles.listItemLeft}>
                          <Ionicons name="heart-outline" size={20} color="#FF9E9E" />
                          <AppText type="pretendard-b" style={styles.dayLabel}>
                            {days}일
                          </AppText>
                        </View>
                        <AppText type="pretendard-m" style={styles.dateValue}>
                          {getAnniversaryDate(days)}
                        </AppText>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: '5%',
  },
  profileSection: {
    alignItems: 'center',
    marginVertical: 20,
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
    color: '#444',
    marginBottom: 4,
  },
  birthText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
  },
  editButton: {
    backgroundColor: '#FFF',
    marginTop: 10,
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
    marginTop: 20,
  },
  dashboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  dashboardItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verticalDivider: {
    width: 2,
    height: 50,
    backgroundColor: '#E2E2E2',
    marginHorizontal: 10,
  },
  bigNumberText: {
    fontSize: 24,
    color: '#444',
    marginBottom: 4,
  },
  smallDateText: {
    fontSize: 12,
    color: '#A8A8A8',
    marginBottom: 2,
  },
  subLabelText: {
    fontSize: 14,
    color: '#A8A8A8',
  },
  listContainer: {
    gap: 10,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF1F1',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dayLabel: {
    fontSize: 13,
    color: '#626262',
  },
  dateValue: {
    fontSize: 12,
    color: '#626262',
  },
});