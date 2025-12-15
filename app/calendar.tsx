import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addMonths, format, parseISO, subMonths } from 'date-fns';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { useUser } from './context/UserContext';

// Android 애니메이션 설정
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental && !(global as any)?.nativeFabricUIManager) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BASE_URL = 'https://mumuri.shop';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- 타입 정의 ---
type CalendarMode = 'MISSION' | 'SCHEDULE';

type Photo = {
  id: string;
  url: string;
  createdAt: string;
  missionId?: number | null;
  missionTitle?: string | null;
};

type Schedule = {
  id: number;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  couple: boolean;
  ownerType: 'ME' | 'PARTNER';
};

type PhotosByDate = Record<string, Photo[]>;
type SchedulesByDate = Record<string, Schedule[]>;

// --- 데이터 정규화 ---
function normalizeMission(raw: any): Photo | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!raw.photoUrl || !raw.completedAt) return null;

  return {
    id: String(raw.missionId),
    url: raw.photoUrl,
    createdAt: raw.completedAt,
    missionId: raw.missionId,
    missionTitle: raw.title || null,
  };
}

const groupPhotosByDate = (photos: Photo[]): PhotosByDate => {
  const grouped: PhotosByDate = {};
  photos.forEach((photo) => {
    try {
      const date = format(parseISO(photo.createdAt), 'yyyy-MM-dd');
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(photo);
    } catch (e) {
      console.warn('Date parse error:', photo.createdAt);
    }
  });
  return grouped;
};

const groupSchedulesByDate = (schedules: Schedule[]): SchedulesByDate => {
  // 1. ID 기준으로 중복 제거 (Map 사용)
  const uniqueSchedules = new Map<number, Schedule>();
  schedules.forEach(sch => {
      uniqueSchedules.set(sch.id, sch);
  });

  const grouped: SchedulesByDate = {};
  
  // 2. 날짜별 그룹핑
  uniqueSchedules.forEach((sch) => {
    try {
      const date = format(parseISO(sch.startAt), 'yyyy-MM-dd');
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(sch);
    } catch (e) { console.warn(e); }
  });
  
  return grouped;
};

// --- 날짜 셀 ---
const MemoizedDay = React.memo(
  ({ date, state, photos, isSelected, onPress, mode, textColor }: any) => {
    if (!date) return <View style={styles.dayCellEmpty} />;

    const dateStr = date.dateString;
    const dayNum = date.day;
    const dayOfWeek = new Date(dateStr).getDay();
    const isSunday = dayOfWeek === 0;
    const isDisabled = state === 'disabled';
    const hasPhoto = mode === 'MISSION' && photos && photos.length > 0;

    return (
      <Pressable
        style={[
          styles.dayCellContainer,
          isSelected && (
              mode === 'SCHEDULE' ? styles.dayCellSelectedSchedule : styles.dayCellSelectedBorder
          ),
        ]}
        onPress={() => onPress(date)}
        disabled={isDisabled}
      >
        {hasPhoto ? (
          <View style={styles.photoCell}>
            <Image
              source={{ uri: photos[0].url }}
              style={styles.photoCellImage}
              resizeMode="cover"
            />
            {isSelected && <View style={styles.photoSelectedOverlay} />}
            <View style={styles.photoDateOverlay}>
              <AppText type='pretendard-r' style={[styles.photoDateText, isSelected && styles.photoDateSelect]}>{dayNum}</AppText>
            </View>
          </View>
        ) : (
          <Animated.Text
            style={[
              { fontFamily: 'Pretendard-Regular', fontSize: 12 },
              { color: textColor }, 
              isDisabled && styles.dayTextDisabled,
              isSunday && !isDisabled && styles.dayTextSunday,
              isSelected && (mode === 'SCHEDULE' ? { color: '#000' } : styles.dayTextSelected),
            ]}
          >
            {dayNum}
          </Animated.Text>
        )}
      </Pressable>
    );
  },
  (prev, next) => {
    return (
      prev.isSelected === next.isSelected &&
      prev.date?.dateString === next.date?.dateString &&
      prev.state === next.state &&
      prev.photos === next.photos &&
      prev.mode === next.mode &&
      prev.textColor === next.textColor 
    );
  }
);

// --- 일정 추가 모달 ---
const AddScheduleModal = ({ visible, onClose, onSave, selectedDate }: any) => {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [isCouple, setIsCouple] = useState(false);
  const [isAllDay, setIsAllDay] = useState(false);
  
  const [startHour, setStartHour] = useState('13');
  const [startMin, setStartMin] = useState('00');
  const [endHour, setEndHour] = useState('15');
  const [endMin, setEndMin] = useState('00');

  const panY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 0;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 150) {
          Animated.timing(panY, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start(onClose);
        } else {
          Animated.spring(panY, {
            toValue: 0,
            bounciness: 5,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if(visible) {
        panY.setValue(0);
        setTitle('');
        setStartHour('13');
        setStartMin('00');
        setEndHour('15');
        setEndMin('00');
        setIsCouple(false);
        setIsAllDay(false);
    }
  }, [visible]);

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('알림', '일정 제목을 입력해주세요.');
      return;
    }
    
    onSave({
      title,
      isCouple,
      isAllDay,
      start: { 
        hour: parseInt(startHour, 10) || 0, 
        minute: parseInt(startMin, 10) || 0 
      },
      end: { 
        hour: parseInt(endHour, 10) || 0, 
        minute: parseInt(endMin, 10) || 0 
      }
    });
  };

  const formattedDate = React.useMemo(() => {
      if(!selectedDate) return '';
      const date = new Date(selectedDate);
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      return `${format(date, 'MM월 dd일')} (${days[date.getDay()]})`;
  }, [selectedDate]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Animated.View 
          style={[styles.modalContent, { transform: [{ translateY: panY }] }]} 
          {...panResponder.panHandlers}
        >
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          <View style={styles.titleInputRow}>
             <View style={styles.blueDot} />
             <TextInput 
                style={[styles.modalTitleInput,{fontFamily:'Pretendard-Bold'}]} 
                placeholder="제목" 
                placeholderTextColor="#999"
                value={title}
                onChangeText={setTitle}
                autoFocus={false} 
             />
          </View>

          <View style={{height: 20}} />

          <View style={styles.timeSection}>
             <View style={styles.timeRow}>
                <Ionicons name="time-outline" size={20} color="#CCC" style={{marginRight: 8}} />
                <View style={styles.timeInputContainer}>
                    <AppText type='semibold' style={styles.timeDateText}>{formattedDate}</AppText>
                    {!isAllDay && (
                        <View style={styles.timeInputBox}>
                            <TextInput style={[styles.timeInput,{fontFamily:'Pretendard-SemiBold'}]} keyboardType="number-pad" value={startHour} onChangeText={setStartHour} maxLength={2} selectTextOnFocus />
                            <AppText type='semibold'style={styles.timeColon}>:</AppText>
                            <TextInput style={[styles.timeInput,{fontFamily:'Pretendard-SemiBold'}]} keyboardType="number-pad" value={startMin} onChangeText={setStartMin} maxLength={2} selectTextOnFocus />
                        </View>
                    )}
                </View>
             </View>

             <View style={styles.timeConnector} />

             <View style={styles.timeRow}>
                <View style={{width: 28}} /> 
                <View style={styles.timeInputContainer}>
                    <AppText type='semibold' style={styles.timeDateText}>{formattedDate}</AppText>
                    {!isAllDay && (
                        <View style={styles.timeInputBox}>
                            <TextInput style={[styles.timeInput,{fontFamily:'Pretendard-SemiBold'}]} keyboardType="number-pad" value={endHour} onChangeText={setEndHour} maxLength={2} selectTextOnFocus />
                            <AppText type='semibold' style={styles.timeColon}>:</AppText>
                            <TextInput style={[styles.timeInput,{fontFamily:'Pretendard-SemiBold'}]} keyboardType="number-pad" value={endMin} onChangeText={setEndMin} maxLength={2} selectTextOnFocus />
                        </View>
                    )}
                </View>
             </View>
          </View>

          <View style={{height: 20}} />

          <View style={styles.toggleRow}>
            <AppText type='semibold' style={styles.modalLabel}>하루종일</AppText>
            <Pressable onPress={() => setIsAllDay(!isAllDay)} style={styles.checkboxArea}>
                <View style={[styles.checkbox, isAllDay && styles.checkboxChecked]}>
                    {isAllDay && <Ionicons name="checkmark" size={14} color="#333" />}
                </View>
            </Pressable>
          </View>

          <View style={styles.toggleRow}>
            <View style={{flexDirection:'row', alignItems:'center', gap: 6}}>
                <Ionicons name="heart-outline" size={18} color="#CCC" />
                <AppText type='semibold' style={styles.modalLabel}>커플 일정으로 등록</AppText>
            </View>
            <Pressable onPress={() => setIsCouple(!isCouple)} style={styles.checkboxArea}>
                <View style={[styles.checkbox, isCouple && styles.checkboxChecked]}>
                    {isCouple && <Ionicons name="checkmark" size={14} color="#333" />}
                </View>
            </Pressable>
          </View>

          <View style={{flex: 1}} />

          <Pressable style={[styles.saveButton, {marginBottom: insets.bottom + 20}]} onPress={handleSave}>
            <AppText type="bold" style={styles.saveButtonText}>저장</AppText>
          </Pressable>

        </Animated.View>
      </View>
    </Modal>
  );
};

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { userData } = useUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('MISSION');

  const [photosByDate, setPhotosByDate] = useState<PhotosByDate>({});
  const [schedulesByDate, setSchedulesByDate] = useState<SchedulesByDate>({});

  const [currentMonth, setCurrentMonth] = useState<string>(format(new Date(), 'yyyy-MM-01'));
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  
  const [selectedPhotos, setSelectedPhotos] = useState<Photo[]>([]);
  const [selectedSchedules, setSelectedSchedules] = useState<Schedule[]>([]);

  const [addModalVisible, setAddModalVisible] = useState(false);

  const modeAnim = useRef(new Animated.Value(0)).current;

  const bgColor = modeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFCF5', '#1C1C1E'], 
  });

  const headerTextColor = modeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#111111', '#FFFFFF'], 
  });

  const switchBgColor = modeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#111111', '#FFFCF5'], 
  });

  const switchTextColor = modeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#EEEEEE', '#111111'], 
  });

  const fetchMissions = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${BASE_URL}/api/couples/missions/history`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to fetch missions');
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.content || [];
      const parsed = list.map(normalizeMission).filter(Boolean) as Photo[];
      setPhotosByDate(groupPhotosByDate(parsed));
    } catch (e) { console.warn(e); }
  }, []);

  const fetchSchedules = useCallback(async (targetMonth: string) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      const date = parseISO(targetMonth);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      const res = await fetch(`${BASE_URL}/calendar/schedules?year=${year}&month=${month}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to fetch schedules');
      const data = await res.json(); 
      setSchedulesByDate(groupSchedulesByDate(data));
    } catch (e) { console.warn(e); }
  }, []);

  useFocusEffect(
    useCallback(() => {
        const initLoad = async () => {
            setLoading(true);
            await fetchMissions();
            await fetchSchedules(currentMonth);
            setLoading(false);
        };
        initLoad();
    }, [])
  );

  useEffect(() => {
      if (!loading && calendarMode === 'SCHEDULE') {
          fetchSchedules(currentMonth);
      }
  }, [currentMonth]);

  const toggleMode = () => {
    const nextMode = calendarMode === 'MISSION' ? 'SCHEDULE' : 'MISSION';
    setCalendarMode(nextMode);

    Animated.timing(modeAnim, {
        toValue: nextMode === 'SCHEDULE' ? 1 : 0,
        duration: 300,
        useNativeDriver: false, 
    }).start();
  };

  useEffect(() => {
    if (calendarMode === 'MISSION') {
        setSelectedPhotos(photosByDate[selectedDate] || []);
    } else {
        setSelectedSchedules(schedulesByDate[selectedDate] || []);
    }
  }, [photosByDate, schedulesByDate, selectedDate, calendarMode]);

  const onDayPress = useCallback((day: DateData) => {
    setSelectedDate(day.dateString);
  }, []);

  const changeMonth = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev' ? subMonths(parseISO(currentMonth), 1) : addMonths(parseISO(currentMonth), 1);
    setCurrentMonth(format(newDate, 'yyyy-MM-01'));
  };

  const handleAddSchedule = async (input: any) => {
    try {
        const token = await AsyncStorage.getItem('token');
        
        const pad = (n: number) => n.toString().padStart(2, '0');
        const startH = parseInt(input.start.hour, 10) || 0;
        const startM = parseInt(input.start.minute, 10) || 0;
        const endH = parseInt(input.end.hour, 10) || 0;
        const endM = parseInt(input.end.minute, 10) || 0;

        const startTimeStr = input.isAllDay ? "00:00:00" : `${pad(startH)}:${pad(startM)}:00`;
        const endTimeStr = input.isAllDay ? "23:59:59" : `${pad(endH)}:${pad(endM)}:00`;

        const body = {
            title: input.title,
            date: selectedDate,
            startTime: startTimeStr, 
            endTime: endTimeStr,     
            allDay: input.isAllDay,
            couple: input.isCouple
        };

        const res = await fetch(`${BASE_URL}/calendar/schedules`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            setAddModalVisible(false);
            fetchSchedules(currentMonth); 
        } else {
            const errText = await res.text();
            console.error('[Schedule Add] Failed:', res.status, errText);
            Alert.alert('실패', `등록 실패 (${res.status})`);
        }
    } catch(e) { console.error('[Schedule Add] Error:', e); }
  };

  const handleDeleteSchedule = (id: number) => {
    Alert.alert('삭제', '이 일정을 삭제하시겠습니까?', [
        { text: '취소', style: 'cancel' },
        {
            text: '삭제',
            style: 'destructive',
            onPress: async () => {
                try {
                    const token = await AsyncStorage.getItem('token');
                    await fetch(`${BASE_URL}/calendar/schedules/${id}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    fetchSchedules(currentMonth);
                } catch(e) { console.error(e); }
            }
        }
    ]);
  };

  const isScheduleMode = calendarMode === 'SCHEDULE';
  const bgColorStyle = isScheduleMode ? '#1C1C1E' : '#FFFCF5'; 
  const textColorStyle = isScheduleMode ? '#FFF' : '#111';

  if (loading && !refreshing) {
    return <View style={[styles.center, { backgroundColor: bgColorStyle }]}><ActivityIndicator size="large" color={textColorStyle} /></View>;
  }

  return (
    <Animated.View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* 1. 헤더 */}
      <Animated.View style={[styles.header, { backgroundColor: bgColor }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Animated.Text style={{ color: headerTextColor }}>
                <Ionicons name="chevron-back" size={28} />
            </Animated.Text>
          </Pressable>
          <Animated.Text style={[styles.headerTitle, { color: headerTextColor, fontFamily: 'Paperlogy-7Bold' }]}>
            {calendarMode === 'SCHEDULE' ? '일정 캘린더' : '미션 캘린더'}
          </Animated.Text>
        </View>
        <Pressable onPress={toggleMode}>
            <Animated.View style={[styles.switchBtn, { backgroundColor: switchBgColor }]}>
                <Animated.Text style={[styles.switchBtnText, { color: switchTextColor, fontFamily: 'Paperlogy-7Bold' }]}>
                    {calendarMode === 'SCHEDULE' ? '미션 캘린더' : '일정 캘린더'}
                </Animated.Text>
            </Animated.View>
        </Pressable>
      </Animated.View>

      {/* 2. 월 이동 */}
      <View style={styles.monthNav}>
        <Pressable onPress={() => changeMonth('prev')} style={styles.monthNavBtn}>
            <Animated.Text style={{ color: headerTextColor }}>
                <Ionicons name="chevron-back" size={20} />
            </Animated.Text>
        </Pressable>
        <Animated.Text style={[styles.monthTitle, { color: headerTextColor, fontFamily: 'Pretendard-SemiBold' }]}>
          {format(parseISO(currentMonth), 'yyyy년 M월')}
        </Animated.Text>
        <Pressable onPress={() => changeMonth('next')} style={styles.monthNavBtn}>
            <Animated.Text style={{ color: headerTextColor }}>
                <Ionicons name="chevron-forward" size={20} />
            </Animated.Text>
        </Pressable>
      </View>

      {/* 3. 캘린더 */}
      <View style={styles.CalenderContainer}>
        <Calendar
          key={`${currentMonth}`} 
          current={currentMonth}
          renderHeader={() => null}
          hideArrows={true}
          theme={{
            backgroundColor: 'transparent',
            calendarBackground: 'transparent',
            textSectionTitleColor: '#B0B0B0',
            selectedDayBackgroundColor: 'transparent',
            todayTextColor: calendarMode === 'SCHEDULE' ? '#6198FF' : '#333',
            dayTextColor: '#888',
            textDisabledColor: '#555',
          }}
          dayComponent={({ date, state }) => {
            const photos = date ? photosByDate[date.dateString] : [];
            return (
              <MemoizedDay
                date={date}
                state={state}
                photos={photos}
                isSelected={date?.dateString === selectedDate}
                onPress={onDayPress}
                mode={calendarMode} 
                textColor={headerTextColor} 
              />
            );
          }}
        />
      </View>

      {/* 4. 하단 영역 */}
      <View style={styles.bottomContainer}>
        {calendarMode === 'MISSION' && (
            selectedPhotos.length === 0 ? (
                <View style={styles.emptyBox}>
                    <AppText style={styles.emptyText}>이 날의 미션 기록이 없어요.</AppText>
                </View>
            ) : (
                <FlatList
                    data={selectedPhotos}
                    keyExtractor={(item) => item.id}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <View style={styles.previewCard}>
                            <ImageBackground source={{ uri: item.url }} style={styles.previewImage} resizeMode="cover">
                                <View style={styles.previewHeaderOverlay}>
                                    <View style={styles.previewAvatar}>
                                        <Image source={{ uri: item.url }} style={{ width: '100%', height: '100%' }} />
                                    </View>
                                    <View>
                                        <AppText style={styles.previewNameText}>애인</AppText>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Ionicons name="calendar-outline" size={12} color="#EEE" />
                                            <AppText style={styles.previewDateText}>{format(parseISO(item.createdAt), 'yyyy. MM. dd.')}</AppText>
                                        </View>
                                    </View>
                                </View>
                                {item.missionTitle && (
                                    <View style={styles.previewMissionBadge}>
                                        <AppText style={styles.previewMissionText}>{item.missionTitle}</AppText>
                                    </View>
                                )}
                            </ImageBackground>
                        </View>
                    )}
                />
            )
        )}

        {calendarMode === 'SCHEDULE' && (
            <>
                <View style={styles.scheduleHeader}>
                    <AppText style={{color:'#FFF', fontSize:14}}>{selectedDate}</AppText>
                </View>
                <FlatList 
                    data={selectedSchedules}
                    keyExtractor={item => String(item.id)}
                    contentContainerStyle={{ gap: 10, paddingBottom: 100 }}
                    renderItem={({item}) => {
                        let barColor = '#4CD964'; 
                        if (item.couple) barColor = '#FF8080';
                        else if (item.ownerType === 'ME') barColor = '#6198FF';

                        const timeStr = item.allDay ? '하루 종일' : format(parseISO(item.startAt), 'HH:mm');

                        return (
                            // 🟢 [수정 2] 삭제 버튼(X)으로 변경
                            <View style={[styles.scheduleItem, { backgroundColor: barColor }]}>
                                <View style={styles.scheduleTimeBox}>
                                    <AppText type="bold" style={styles.scheduleTimeText}>{timeStr}</AppText>
                                </View>
                                <View style={styles.verticalBar} />
                                <View style={{flex:1}}>
                                    <AppText type="medium" style={styles.scheduleTitleText}>{item.title}</AppText>
                                </View>
                                <TouchableOpacity onPress={() => handleDeleteSchedule(item.id)} style={{padding:8}} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                                    <Ionicons name="close" size={20} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={{marginTop: 20, alignItems:'center'}}>
                            <AppText style={{color:'#555'}}>일정이 없습니다.</AppText>
                        </View>
                    }
                />
                
                {/* 🟢 [수정 3] FAB 버튼 위치 조정 */}
                <Pressable style={[styles.fabBtn, { bottom: insets.bottom + 30 }]} onPress={() => setAddModalVisible(true)}>
                    <Ionicons name="add" size={32} color="#1C1C1E" />
                </Pressable>
            </>
        )}
      </View>

      <AddScheduleModal 
        visible={addModalVisible} 
        onClose={() => setAddModalVisible(false)} 
        onSave={handleAddSchedule}
        selectedDate={selectedDate}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 40, paddingBottom: 4 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 22 },
  switchBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 24 },
  switchBtnText: { fontSize: 13, color:'#999999' },
  monthNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 8 },
  monthNavBtn: { padding: 4 },
  monthTitle: { fontSize: 14, marginHorizontal: 4 },
  CalenderContainer: {},
  dayCellEmpty: { flex: 1 },
  dayCellContainer: { width: 44, height: 56, alignItems: 'center', justifyContent: 'flex-start' },
  
  dayCellSelectedBorder: { borderWidth: 2, borderColor: '#6198FF', borderRadius: 10 },
  
  dayCellSelectedSchedule: { 
      backgroundColor: '#FFF', 
      borderRadius: 10,
  },

  dayText: { fontSize: 12 },
  dayTextDisabled: { color: '#555' },
  dayTextSunday: { color: '#FF3B30' },
  dayTextSelected: { color: '#6198FF'},
  
  photoCell: { width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden', backgroundColor: '#E5E5EA' },
  photoCellImage: { width: '100%', height: '100%', opacity: 0.8 },
  photoSelectedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(97, 152, 255, 0.3)' },
  photoDateOverlay: { position: 'absolute', left: 0, width: '100%', alignItems: 'center' },
  photoDateText: { fontSize: 12, color: '#111'},
  photoDateSelect: { fontSize: 12, color: '#6198FF' },
  bottomContainer: { flex: 1, marginTop: 10, paddingHorizontal: 16, paddingBottom: 20 },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  emptyText: { color: '#BBB', fontSize: 15 },
  previewCard: { width: SCREEN_WIDTH - 32, height: '90%', borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' },
  previewImage: { width: '100%', height: '100%', justifyContent: 'space-between' },
  previewHeaderOverlay: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 24, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 3 },
  previewAvatar: { width: 40, height: 40, borderRadius: 22, overflow: 'hidden', backgroundColor: '#DDD' },
  previewNameText: { color: '#FFF', fontSize: 11, marginBottom: 2 },
  previewDateText: { color: '#EEE', fontSize: 11 },
  previewMissionBadge: { position: 'absolute', bottom: 20, left: 20, backgroundColor: 'rgba(0,0,0,0.4)', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 16, alignItems: 'center' },
  previewMissionText: { color: '#FFF', fontSize: 10, textAlign: 'center' },
  scheduleHeader: { marginBottom: 10 },
  scheduleItem: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, height: 56 },
  scheduleTimeBox: { width: '25%', alignItems: 'center' },
  scheduleTimeText: { color: '#FFF', fontSize: 14 },
  verticalBar: { width: 2, height: '100%', backgroundColor: '#fff', marginHorizontal: 12 },
  scheduleTitleText: { color: '#FFF', fontSize: 15 },
  
  fabBtn: { position: 'absolute', right: 16, width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6 },
  
  // 모달 스타일
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { width: '100%', height: '92%', backgroundColor: '#2C2C2E', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 20, paddingTop: 10 },
  dragHandleContainer: { alignItems: 'center', paddingVertical: 10, marginBottom: 10 },
  dragHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#555' },
  titleInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  blueDot: { width: 15, height: 15, borderRadius: 100, backgroundColor: '#6198FF', marginRight: 12 },
  modalTitleInput: { flex: 1, fontSize: 24, color: '#FFF' },
  timeSection: {},
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 4 },
  timeInputContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 },
  timeDateText: { color: '#FFF', fontSize: 14 },
  timeInputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3A3A3C', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  timeInput: { color: '#FFF', fontSize: 18, width: 28, textAlign: 'center' },
  timeColon: { color: '#FFF', fontSize: 18, marginHorizontal: 2 },
  timeConnector: { width: 1, height: 12, backgroundColor: '#555', marginLeft: 9, marginVertical: 2 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12 },
  modalLabel: { color: '#FFF', fontSize: 13 },
  checkboxArea: { padding: 4 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: '#555', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#FFF' },
  saveButton: { backgroundColor: '#FFF', borderRadius: 30, paddingVertical: 16, alignItems: 'center' },
  saveButtonText: { color: '#000', fontSize: 16 },
});