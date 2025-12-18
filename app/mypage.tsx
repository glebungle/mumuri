import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { useUser } from './context/UserContext';

const profileImg = require('../assets/images/userprofile.png');
const settingsImg = require('../assets/images/Settings.png');
const heartImg = require('../assets/images/Heart.png');

const formatDate = (dateString?: string | null) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}. ${month}. ${day}`;
};

const formatBirthString = (raw?: string | null): string => {
  if (!raw) return '--. --. --';
  return formatDate(raw); 
};

export default function MyPage() {
  const { userData, refreshUserData } = useUser(); 
  
  const displayProfileImage = userData?.myProfileImageUrl 
    ? { uri: userData.myProfileImageUrl } 
    : profileImg;

  useFocusEffect(
    useCallback(() => {
      refreshUserData(); 
    }, [])
  );

  const handlePressSetting = () => {
    router.push('/setting');
  };

  const handlePressEditProfile = () => {
    router.push('/edit'); 
  };

  const handleBack = () => router.back();

  const myName = userData?.myName || '사용자';
  const myBirth = formatBirthString(userData?.birthday);

  const partnerName = userData?.partnerName || '애인'; 
  const partnerBirth = formatBirthString(userData?.partnerBirthday); 
  
  const dDayCount = userData?.date ?? 0; 
  const anniversaryDate = formatDate(userData?.anniversary);

  const upcomingAnniversaries = useMemo(() => [50, 100, 200, 300], []);
  
  const getAnniversaryDate = (days: number) => {
    if (!userData?.anniversary) return '';
    const start = new Date(userData.anniversary);
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
              <Pressable onPress={handleBack} >
                    <Ionicons name="chevron-back" size={24} color="#1E1E1E" />
                    </Pressable>
            <View style={{ width: 24 }} />
            <Pressable onPress={handlePressSetting}>
              <Image 
                source={settingsImg} 
                style={styles.settingsImage} 
                resizeMode="contain"
              />
            </Pressable>
          </View>

          {/* 2. 프로필 섹션 */}
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatarPlaceholder}>
                <Image 
                    source={displayProfileImage} 
                    style={styles.profileImage} 
                    resizeMode="cover"
                />
              </View>
            </View>

            <AppText type="pretendard-b" style={styles.nameText}>
              {myName}{Platform.OS === 'android' ? '\u200A' : ''}
            </AppText>
            <AppText type="pretendard-m" style={styles.birthText}>{myBirth}</AppText>

            <Pressable style={styles.editButton} onPress={handlePressEditProfile}>
              <AppText type="pretendard-m" style={styles.editButtonText}>
                프로필 편집
              </AppText>
            </Pressable>
          </View>

          {/* 3. 흰색 카드 영역 */}
          <View style={styles.whiteCard}>
            <View style={styles.dashboardRow}>
              <View style={styles.dashboardItem}>
                <AppText type="pretendard-m" style={styles.bigNumberText}>
                  {partnerBirth}
                </AppText>
                <AppText type="pretendard-m" style={styles.subLabelText}>
                  {partnerName}님의 생일
                </AppText>
              </View>

              <View style={styles.verticalDivider} />

              <View style={styles.dashboardItem}>
                <AppText type="pretendard-m" style={styles.smallDateText}>
                  {anniversaryDate || '---. --. --'}
                </AppText>
                <AppText type="pretendard-m" style={styles.bigNumberText}>
                  {dDayCount > 0 ? `${dDayCount-1}일째` : 'D-Day'}
                </AppText>
                <AppText type="pretendard-m" style={styles.subLabelText}>
                  기념일
                </AppText>
              </View>
            </View>

            {dDayCount > 0 && (
              <View style={styles.listContainer}>
                {upcomingAnniversaries.map((days) => (
                  <View key={days} style={styles.listItem}>
                    <View style={styles.listItemLeft}>
                      <Image source={heartImg} style={[styles.heartImage]} />
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
    width: 110,
    height: 110,
    borderRadius: 99,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden', 
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  nameText: {
    fontSize: 20,
    color: '#444',
    marginBottom: 4,
  },
  birthText: {
    fontSize: 14,
    color: '#A8A8A8',
    marginBottom: 16,
  },
  editButton: {
    backgroundColor: '#FFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 13,
    color: '#555',
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
    height: '100%',
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
    borderRadius: 8,
    paddingVertical: 12,
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
  settingsImage: {
    width: 24,
    height: 24,
    tintColor: '#444', 
  },
  heartImage: {
    width: 20,
    height: 20,
    tintColor: '#F3BDB8',
  }
});