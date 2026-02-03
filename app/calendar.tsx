import { Ionicons } from "@expo/vector-icons";
import { addMonths, format, parseISO, subMonths } from "date-fns";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "../components/AppText";
import { useUser } from "./context/UserContext";
import { authFetch } from "./utils/apiClient";

const clockImg = require("../assets/images/Clock.png");
const heartImg = require("../assets/images/Heart.png");
const defaultProfileImg = require("../assets/images/userprofile.png");
const calendarImg = require("../assets/images/calendar.png");

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental &&
  !(global as any)?.nativeFabricUIManager
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BASE_URL = "https://mumuri.shop";
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const CALENDAR_HPADDING = 16;
const DAY_WIDTH = (SCREEN_WIDTH - CALENDAR_HPADDING * 5) / 7;
const DAY_HEIGHT = SCREEN_HEIGHT * 0.08;

const HOLIDAYS_JSON_URL = "https://holidays.hyunbin.page/basic.json";

type CalendarMode = "MISSION" | "SCHEDULE";
type Photo = {
  id: string;
  url: string;
  createdAt: string;
  missionTitle?: string | null;
  ownerType?: "ME" | "PARTNER";
  ownerNickname?: string;
  blurred: boolean;
  blurMessage?: string;
};
type Schedule = {
  id: number;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  couple: boolean;
  ownerType: "ME" | "PARTNER";
};
type PhotosByDate = Record<string, Photo[]>;
type SchedulesByDate = Record<string, Schedule[]>;

function normalizeMission(raw: any): Photo | null {
  if (!raw || !raw.imageUrl) return null;
  return {
    id: String(raw.photoId),
    url: raw.imageUrl,
    createdAt: raw.createdAt,
    missionTitle: raw.missionText || null,
    ownerType: raw.ownerType,
    ownerNickname: raw.ownerNickname,
    blurred: raw.blurred ?? false,
    blurMessage: raw.blurMessage || "",
  };
}

const MemoizedDay = React.memo(
  ({
    date,
    state,
    photos,
    schedules,
    isSelected,
    onPress,
    mode,
    textColor,
    isHoliday,
  }: any) => {
    if (!date)
      return (
        <View
          style={[
            styles.dayCellContainer,
            { width: DAY_WIDTH, height: DAY_HEIGHT },
          ]}
        />
      );
    const dayNum = date.day;
    const isSunday = new Date(date.dateString).getDay() === 0;
    const isDisabled = state === "disabled";
    const hasPhoto = mode === "MISSION" && photos && photos.length > 0;
    const hasSchedules =
      mode === "SCHEDULE" && schedules && schedules.length > 0;

    const isRedDay = (isSunday || !!isHoliday) && !isDisabled;

    return (
      <Pressable
        style={[
          styles.dayCellContainer,
          { width: DAY_WIDTH, height: DAY_HEIGHT },
          isSelected &&
            (mode === "SCHEDULE"
              ? styles.dayCellSelectedSchedule
              : styles.dayCellSelectedBorder),
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
              blurRadius={photos[0].blurred ? 15 : 0}
            />
            {isSelected && <View style={styles.photoSelectedOverlay} />}
            <View style={styles.photoDateOverlay}>
              <AppText
                type="pretendard-r"
                style={[
                  styles.photoDateText,
                  !isSelected && isRedDay && { color: "#FF3B30" },
                  isSelected && styles.photoDateSelect,
                ]}
              >
                {dayNum}
              </AppText>
            </View>
          </View>
        ) : (
          <View
            style={{
              alignItems: "center",
              width: "100%",
              height: "100%",
              justifyContent: "flex-start",
              paddingTop: 4,
            }}
          >
            <Animated.Text
              style={[
                {
                  fontFamily: "Pretendard-Regular",
                  fontSize: 13,
                  color: textColor,
                },
                isDisabled && styles.dayTextDisabled,
                isRedDay && styles.dayTextSunday,
                isSelected &&
                  (mode === "SCHEDULE"
                    ? { color: "#000" }
                    : styles.dayTextSelected),
              ]}
            >
              {dayNum}
            </Animated.Text>

            {hasSchedules && (
              <View style={styles.daySchedulesWrapper}>
                {schedules.slice(0, 2).map((sch: Schedule) => {
                  const barColor = sch.couple
                    ? "#FF9191"
                    : sch.ownerType === "ME"
                      ? "#6198FF"
                      : "#49DC95";
                  return (
                    <View
                      key={sch.id}
                      style={[
                        styles.miniScheduleBar,
                        { backgroundColor: barColor },
                      ]}
                    >
                      <AppText
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={styles.miniScheduleText}
                      >
                        {sch.title}
                      </AppText>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </Pressable>
    );
  },
  (p, n) =>
    p.isSelected === n.isSelected &&
    p.photos === n.photos &&
    p.schedules === n.schedules &&
    p.mode === n.mode &&
    p.textColor === n.textColor &&
    p.isHoliday === n.isHoliday,
);

const AddScheduleModal = ({ visible, onClose, onSave, selectedDate }: any) => {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [isCouple, setIsCouple] = useState(false);
  const [isAllDay, setIsAllDay] = useState(false);
  const [startHour, setStartHour] = useState("13");
  const [startMin, setStartMin] = useState("00");
  const [endHour, setEndHour] = useState("15");
  const [endMin, setEndMin] = useState("00");

  const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(panY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      setTitle("");
      setStartHour("13");
      setStartMin("00");
      setEndHour("15");
      setEndMin("00");
      setIsCouple(false);
      setIsAllDay(false);
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.timing(panY, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 10,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) panY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 150) handleDismiss();
        else
          Animated.spring(panY, {
            toValue: 0,
            bounciness: 5,
            useNativeDriver: true,
          }).start();
      },
    }),
  ).current;

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert("알림", "일정 제목을 입력해주세요.");
      return;
    }
    onSave({
      title,
      isCouple,
      isAllDay,
      start: {
        hour: parseInt(startHour, 10) || 0,
        minute: parseInt(startMin, 10) || 0,
      },
      end: {
        hour: parseInt(endHour, 10) || 0,
        minute: parseInt(endMin, 10) || 0,
      },
    });
    handleDismiss();
  };

  const formattedDate = React.useMemo(() => {
    if (!selectedDate) return "";
    const date = new Date(selectedDate);
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return `${format(date, "MM월 dd일")} (${days[date.getDay()]})`;
  }, [selectedDate]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <Pressable style={styles.modalOverlay} onPress={Keyboard.dismiss}>
        <Animated.View
          style={[styles.modalContent, { transform: [{ translateY: panY }] }]}
          {...panResponder.panHandlers}
        >
          <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
            <View style={styles.dragHandleContainer}>
              <View style={styles.dragHandle} />
            </View>
            <View style={styles.titleInputRow}>
              <View style={styles.blueDot} />
              <TextInput
                style={[
                  styles.modalTitleInput,
                  { fontFamily: "Pretendard-Bold" },
                ]}
                placeholder="제목"
                placeholderTextColor="#999"
                value={title}
                onChangeText={setTitle}
              />
            </View>
            <View style={styles.timeSection}>
              <View style={styles.timeRow}>
                <Image source={clockImg} style={styles.clockImage} />
                <View style={styles.timeInputContainer}>
                  <AppText type="semibold" style={styles.timeDateText}>
                    {formattedDate}
                  </AppText>
                  {!isAllDay && (
                    <View style={styles.timeInputBox}>
                      <TextInput
                        style={styles.timeInput}
                        keyboardType="number-pad"
                        value={startHour}
                        onChangeText={setStartHour}
                        maxLength={2}
                      />
                      <AppText type="semibold" style={styles.timeColon}>
                        :
                      </AppText>
                      <TextInput
                        style={styles.timeInput}
                        keyboardType="number-pad"
                        value={startMin}
                        onChangeText={setStartMin}
                        maxLength={2}
                      />
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.timeConnector} />
              <View style={styles.timeRow}>
                <Image source={clockImg} style={styles.clockImage} />
                <View style={styles.timeInputContainer}>
                  <AppText type="semibold" style={styles.timeDateText}>
                    {formattedDate}
                  </AppText>
                  {!isAllDay && (
                    <View style={styles.timeInputBox}>
                      <TextInput
                        style={styles.timeInput}
                        keyboardType="number-pad"
                        value={endHour}
                        onChangeText={setEndHour}
                        maxLength={2}
                      />
                      <AppText type="semibold" style={styles.timeColon}>
                        :
                      </AppText>
                      <TextInput
                        style={styles.timeInput}
                        keyboardType="number-pad"
                        value={endMin}
                        onChangeText={setEndMin}
                        maxLength={2}
                      />
                    </View>
                  )}
                </View>
              </View>
            </View>
            <View style={styles.toggleRow}>
              <AppText type="semibold" style={styles.modalLabel}>
                하루종일
              </AppText>
              <Pressable
                onPress={() => setIsAllDay(!isAllDay)}
                style={styles.checkboxArea}
              >
                <View
                  style={[styles.checkbox, isAllDay && styles.checkboxChecked]}
                >
                  {isAllDay && (
                    <Ionicons name="checkmark" size={14} color="#333" />
                  )}
                </View>
              </Pressable>
            </View>
            <View style={styles.toggleRow}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Image source={heartImg} style={styles.heartImage} />
                <AppText type="semibold" style={styles.modalLabel}>
                  커플 일정으로 등록
                </AppText>
              </View>
              <Pressable
                onPress={() => setIsCouple(!isCouple)}
                style={styles.checkboxArea}
              >
                <View
                  style={[styles.checkbox, isCouple && styles.checkboxChecked]}
                >
                  {isCouple && (
                    <Ionicons name="checkmark" size={14} color="#333" />
                  )}
                </View>
              </Pressable>
            </View>
            <View style={{ flex: 1 }} />
            <Pressable
              style={[styles.saveButton, { marginBottom: insets.bottom + 20 }]}
              onPress={handleSave}
            >
              <AppText type="bold" style={styles.saveButtonText}>
                저장
              </AppText>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { userData, refreshUserData } = useUser();

  const myName = userData?.myName || "나";
  const partnerName = userData?.partnerName || "상대방";

  const [loading, setLoading] = useState(true);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("MISSION");
  const [photosByDate, setPhotosByDate] = useState<PhotosByDate>({});
  const [schedulesByDate, setSchedulesByDate] = useState<SchedulesByDate>({});
  const [currentMonth, setCurrentMonth] = useState<string>(
    format(new Date(), "yyyy-MM-01"),
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [selectedPhotos, setSelectedPhotos] = useState<Photo[]>([]);
  const [selectedSchedules, setSelectedSchedules] = useState<Schedule[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const modeAnim = useRef(new Animated.Value(0)).current;

  const [holidaySet, setHolidaySet] = useState<Set<string>>(new Set());
  const holidayYearCache = useRef<Record<string, Record<string, string[]>>>({});

  const photoListRef = useRef<FlatList>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const bgColor = modeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#FFFCF5", "#1C1C1E"],
  });
  const headerTextColor = modeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#111111", "#FFFFFF"],
  });
  const switchBgColor = modeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#111111", "#FFFCF5"],
  });
  const switchTextColor = modeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#999999", "#999999"],
  });

  const fetchHolidays = useCallback(async (targetMonth: string) => {
    try {
      const year = format(parseISO(targetMonth), "yyyy");
      if (holidayYearCache.current[year]) {
        const keys = Object.keys(holidayYearCache.current[year]);
        setHolidaySet(new Set(keys));
        return;
      }
      const res = await fetch(HOLIDAYS_JSON_URL);
      const all = await res.json();
      const yearMap: Record<string, string[]> = all?.[year] ?? {};
      holidayYearCache.current[year] = yearMap;
      const keys = Object.keys(yearMap);
      setHolidaySet(new Set(keys));
    } catch (e) {
      setHolidaySet(new Set());
    }
  }, []);

  const fetchMissions = useCallback(async (targetMonth: string) => {
    try {
      const dateObj = parseISO(targetMonth);
      const url = `/calendar/missions?year=${dateObj.getFullYear()}&month=${dateObj.getMonth() + 1}`;
      const res = await authFetch(url);
      const data = res.ok ? await res.json() : [];
      const grouped: PhotosByDate = {};
      (data || []).forEach((item: any) => {
        const photo = normalizeMission(item);
        if (photo) {
          const d = format(parseISO(photo.createdAt), "yyyy-MM-dd");
          if (!grouped[d]) grouped[d] = [];
          grouped[d].push(photo);
        }
      });
      setPhotosByDate(grouped);
    } catch (e) {
      setPhotosByDate({});
    }
  }, []);

  const fetchSchedules = useCallback(async (targetMonth: string) => {
    try {
      const date = parseISO(targetMonth);
      const url = `/calendar/schedules?year=${date.getFullYear()}&month=${date.getMonth() + 1}`;
      const res = await authFetch(url);
      const data = res.ok ? await res.json() : [];
      const uniqueDataMap = new Map();
      (data || []).forEach((sch: any) => uniqueDataMap.set(sch.id, sch));
      const grouped: SchedulesByDate = {};
      Array.from(uniqueDataMap.values()).forEach((sch: any) => {
        const d = format(parseISO(sch.startAt), "yyyy-MM-dd");
        if (!grouped[d]) grouped[d] = [];
        grouped[d].push(sch);
      });
      setSchedulesByDate(grouped);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  const handleDeleteSchedule = (schedule: Schedule) => {
    if (schedule.ownerType === "PARTNER" && !schedule.couple) {
      Alert.alert("알림", "상대방 단독 일정은 삭제할 수 없어요.");
      return;
    }
    Alert.alert("삭제", "이 일정을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await authFetch(`/calendar/schedules/${schedule.id}`, {
              method: "DELETE",
            });
            fetchSchedules(currentMonth);
          } catch (e) {
            console.error(e);
          }
        },
      },
    ]);
  };

  const handleAddSchedule = async (input: any) => {
    try {
      const pad = (n: number) => n.toString().padStart(2, "0");
      const startTimeStr = input.isAllDay
        ? "00:00:00"
        : `${pad(input.start.hour)}:${pad(input.start.minute)}:00`;
      const endTimeStr = input.isAllDay
        ? "23:59:59"
        : `${pad(input.end.hour)}:${pad(input.end.minute)}:00`;
      const body = {
        title: input.title,
        date: selectedDate,
        startTime: startTimeStr,
        endTime: endTimeStr,
        allDay: input.isAllDay,
        couple: input.isCouple,
      };
      const res = await authFetch("/calendar/schedules", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.ok) fetchSchedules(currentMonth);
      else Alert.alert("실패", `등록 실패 (${res.status})`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleArrowPress = (direction: "prev" | "next") => {
    const nextIndex =
      direction === "prev" ? activePhotoIndex - 1 : activePhotoIndex + 1;
    if (nextIndex >= 0 && nextIndex < selectedPhotos.length) {
      photoListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setActivePhotoIndex(nextIndex);
    }
  };

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        await Promise.all([
          refreshUserData(),
          fetchMissions(currentMonth),
          fetchSchedules(currentMonth),
          fetchHolidays(currentMonth),
        ]);
        setLoading(false);
      })();
    }, []),
  );

  useEffect(() => {
    fetchMissions(currentMonth);
    fetchSchedules(currentMonth);
    fetchHolidays(currentMonth);
  }, [currentMonth]);

  useEffect(() => {
    setActivePhotoIndex(0);
    if (calendarMode === "MISSION")
      setSelectedPhotos(photosByDate[selectedDate] || []);
    else setSelectedSchedules(schedulesByDate[selectedDate] || []);
  }, [selectedDate, calendarMode, photosByDate, schedulesByDate]);

  if (loading)
    return (
      <View
        style={[
          styles.center,
          {
            backgroundColor:
              calendarMode === "SCHEDULE" ? "#1C1C1E" : "#FFFCF5",
          },
        ]}
      >
        <ActivityIndicator size="large" color="#999" />
      </View>
    );

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: bgColor, paddingTop: insets.top },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Animated.Text style={{ color: headerTextColor }}>
              <Ionicons name="chevron-back" size={28} />
            </Animated.Text>
          </Pressable>
          <Animated.Text
            style={[
              styles.headerTitle,
              { color: headerTextColor, fontFamily: "Paperlogy-7Bold" },
            ]}
          >
            {calendarMode === "SCHEDULE" ? "일정 캘린더" : "미션 캘린더"}
          </Animated.Text>
        </View>
        <Pressable
          onPress={() => {
            const next = calendarMode === "MISSION" ? "SCHEDULE" : "MISSION";
            setCalendarMode(next);
            Animated.timing(modeAnim, {
              toValue: next === "SCHEDULE" ? 1 : 0,
              duration: 300,
              useNativeDriver: false,
            }).start();
          }}
        >
          <Animated.View
            style={[styles.switchBtn, { backgroundColor: switchBgColor }]}
          >
            <Animated.Text
              style={[
                styles.switchBtnText,
                { color: switchTextColor, fontFamily: "Paperlogy-7Bold" },
              ]}
            >
              {calendarMode === "SCHEDULE" ? "미션 캘린더" : "일정 캘린더"}
            </Animated.Text>
          </Animated.View>
        </Pressable>
      </View>

      <View style={styles.monthNavRow}>
        <View style={styles.monthNavControls}>
          <Pressable
            onPress={() =>
              setCurrentMonth(
                format(subMonths(parseISO(currentMonth), 1), "yyyy-MM-01"),
              )
            }
            style={styles.monthNavBtn}
          >
            <Animated.Text style={{ color: headerTextColor }}>
              <Ionicons name="chevron-back" size={20} />
            </Animated.Text>
          </Pressable>
          <Animated.Text
            style={[
              styles.monthTitle,
              { color: headerTextColor, fontFamily: "Paperlogy-6SemiBold" },
            ]}
          >
            {format(parseISO(currentMonth), "yyyy년 M월")}
          </Animated.Text>
          <Pressable
            onPress={() =>
              setCurrentMonth(
                format(addMonths(parseISO(currentMonth), 1), "yyyy-MM-01"),
              )
            }
            style={styles.monthNavBtn}
          >
            <Animated.Text style={{ color: headerTextColor }}>
              <Ionicons name="chevron-forward" size={20} />
            </Animated.Text>
          </Pressable>
        </View>

        {calendarMode === "SCHEDULE" && (
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <AppText
                type="semibold"
                style={[styles.legendText, { color: "#FFF" }]}
              >
                {myName}
              </AppText>
              <View
                style={[styles.legendDot, { backgroundColor: "#6198FF" }]}
              />
            </View>
            <View style={styles.legendItem}>
              <AppText
                type="semibold"
                style={[styles.legendText, { color: "#FFF" }]}
              >
                {partnerName}
              </AppText>
              <View
                style={[styles.legendDot, { backgroundColor: "#49DC95" }]}
              />
            </View>
            <View style={styles.legendItem}>
              <AppText
                type="semibold"
                style={[styles.legendText, { color: "#FFF" }]}
              >
                함께
              </AppText>
              <View
                style={[styles.legendDot, { backgroundColor: "#FF9191" }]}
              />
            </View>
          </View>
        )}
      </View>

      <View style={styles.CalenderContainer}>
        <Calendar
          key={currentMonth}
          current={currentMonth}
          hideArrows
          renderHeader={() => null}
          theme={
            {
              backgroundColor: "transparent",
              calendarBackground: "transparent",
              textSectionTitleColor: "#B0B0B0",
              todayTextColor: "#6198FF",
              dayTextColor: "#888",
              textDisabledColor: "#555",
              ["stylesheet.calendar.header" as any]: {
                header: { height: 0, padding: 0, margin: 0 },
                week: { marginTop: 0, marginBottom: 0, height: 0, opacity: 0 },
              },
              ["stylesheet.calendar.main" as any]: {
                container: {
                  paddingLeft: 0,
                  paddingRight: 0,
                  paddingBottom: 0,
                },
                monthView: { marginVertical: 0 },
                week: {
                  marginVertical: 1,
                  flexDirection: "row",
                  justifyContent: "space-around",
                },
              },
            } as any
          }
          dayComponent={({ date, state }) => (
            <MemoizedDay
              date={date}
              state={state}
              photos={date ? photosByDate[date.dateString] : []}
              schedules={date ? schedulesByDate[date.dateString] : []}
              isSelected={date?.dateString === selectedDate}
              onPress={(d: any) => setSelectedDate(d.dateString)}
              mode={calendarMode}
              textColor={headerTextColor}
              isHoliday={!!(date && holidaySet.has(date.dateString))}
            />
          )}
        />
      </View>

      <View
        style={[
          styles.bottomContainer,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        {calendarMode === "MISSION" ? (
          selectedPhotos.length === 0 ? (
            <View style={styles.emptyBox}>
              <AppText style={styles.emptyText}>
                이 날의 미션 기록이 없어요.
              </AppText>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <FlatList
                ref={photoListRef}
                data={selectedPhotos}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const x = e.nativeEvent.contentOffset.x;
                  const index = Math.round(x / (SCREEN_WIDTH - 32));
                  setActivePhotoIndex(index);
                }}
                renderItem={({ item }) => {
                  const avatar = (
                    item.ownerType === "ME"
                      ? userData?.myProfileImageUrl
                      : userData?.partnerProfileImageUrl
                  )
                    ? {
                        uri:
                          item.ownerType === "ME"
                            ? userData?.myProfileImageUrl
                            : userData?.partnerProfileImageUrl,
                      }
                    : defaultProfileImg;
                  return (
                    <View style={styles.previewCard}>
                      <ImageBackground
                        source={{ uri: item.url }}
                        style={styles.previewImage}
                        resizeMode="cover"
                        blurRadius={item.blurred ? 20 : 0}
                      >
                        {item.blurred && (
                          <View style={styles.blurOverlay}>
                            <Ionicons
                              name="eye-off"
                              size={32}
                              color="#fff"
                              style={{ marginBottom: 12 }}
                            />
                            <AppText
                              type="pretendard-r"
                              style={styles.blurText}
                            >
                              {item.blurMessage}
                            </AppText>
                          </View>
                        )}
                        <View style={styles.previewHeaderOverlay}>
                          <View style={styles.previewAvatar}>
                            <Image
                              source={avatar}
                              style={{ width: "100%", height: "100%" }}
                            />
                          </View>
                          <View>
                            <AppText
                              type="pretendard-b"
                              style={styles.previewNameText}
                            >
                              {item.ownerNickname}
                            </AppText>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <Image
                                source={calendarImg}
                                style={styles.calendarImage}
                              />
                              <AppText
                                type="semibold"
                                style={styles.previewDateText}
                              >
                                {format(
                                  parseISO(item.createdAt),
                                  "yyyy. MM. dd.",
                                )}
                              </AppText>
                            </View>
                          </View>
                        </View>
                        <View style={styles.previewMissionBadge}>
                          <AppText style={styles.previewMissionText}>
                            {item.missionTitle}
                          </AppText>
                        </View>
                      </ImageBackground>
                    </View>
                  );
                }}
              />
              {activePhotoIndex > 0 && (
                <Pressable
                  style={styles.arrowLeft}
                  onPress={() => handleArrowPress("prev")}
                >
                  <Ionicons name="chevron-back" size={32} color="#fff" />
                </Pressable>
              )}
              {activePhotoIndex < selectedPhotos.length - 1 && (
                <Pressable
                  style={styles.arrowRight}
                  onPress={() => handleArrowPress("next")}
                >
                  <Ionicons name="chevron-forward" size={32} color="#fff" />
                </Pressable>
              )}
            </View>
          )
        ) : (
          <>
            <View style={styles.scheduleHeader}>
              <AppText type="semibold" style={{ color: "#FFF", fontSize: 13 }}>
                {selectedDate
                  ? format(parseISO(selectedDate), "yyyy. MM. dd.")
                  : ""}
              </AppText>
            </View>
            <FlatList
              data={selectedSchedules}
              keyExtractor={(item) => `schedule-${item.id}`}
              renderItem={({ item }) => {
                const barColor = item.couple
                  ? "#FF8080"
                  : item.ownerType === "ME"
                    ? "#6198FF"
                    : "#4CD964";
                const isPartnerOnly =
                  item.ownerType === "PARTNER" && !item.couple;
                return (
                  <View
                    style={[styles.scheduleItem, { backgroundColor: barColor }]}
                  >
                    <View style={styles.scheduleTimeBox}>
                      <AppText type="bold" style={styles.scheduleTimeText}>
                        {item.allDay
                          ? "하루 종일"
                          : format(parseISO(item.startAt), "HH:mm")}
                      </AppText>
                    </View>
                    <View style={styles.verticalBar} />
                    <AppText
                      type="medium"
                      style={[styles.scheduleTitleText, { flex: 1 }]}
                    >
                      {item.title}
                    </AppText>
                    {!isPartnerOnly && (
                      <TouchableOpacity
                        onPress={() => handleDeleteSchedule(item)}
                      >
                        <Ionicons name="close" size={20} color="#FFF" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <AppText style={styles.emptyText}>일정이 없습니다.</AppText>
                </View>
              }
            />
          </>
        )}
      </View>

      {calendarMode === "SCHEDULE" && (
        <Pressable
          style={[styles.fabBtn, { bottom: insets.bottom + 20 }]}
          onPress={() => setAddModalVisible(true)}
        >
          <Ionicons name="add" size={40} color="#1E1E1E" />
        </Pressable>
      )}

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
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20 },
  switchBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  switchBtnText: { fontSize: 12 },
  monthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 36,
    marginBottom: 2,
  },
  monthNavControls: { flexDirection: "row", alignItems: "center" },
  monthNavBtn: { padding: 4 },
  monthTitle: { fontSize: 16 },
  legendContainer: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendText: { fontSize: 11, textAlign: "right" },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  CalenderContainer: {
    paddingHorizontal: CALENDAR_HPADDING,
    flex: 1.2,
    justifyContent: "flex-start",
  },
  dayCellContainer: { alignItems: "center", justifyContent: "flex-start" },
  dayCellSelectedBorder: {
    borderWidth: 2,
    borderColor: "#6198FF",
    borderRadius: 10,
  },
  dayCellSelectedSchedule: { backgroundColor: "#fff", borderRadius: 10 },
  dayTextDisabled: { color: "#d2d2d2" },
  dayTextSunday: { color: "#FF3B30" },
  dayTextSelected: { color: "#6198FF" },
  photoCell: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#E5E5EA",
  },
  photoCellImage: { width: "100%", height: "100%", opacity: 0.9 },
  photoSelectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(97, 152, 255, 0.2)",
  },
  photoDateOverlay: {
    position: "absolute",
    top: 1,
    width: "100%",
    alignItems: "center",
  },
  photoDateText: { fontSize: 10, color: "#111" },
  photoDateSelect: { color: "#6198FF", fontWeight: "bold" },
  bottomContainer: { flex: 1, paddingHorizontal: 16 },
  emptyBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#BBB", fontSize: 14 },
  previewCard: {
    width: SCREEN_WIDTH - 32,
    flex: 1,
    maxHeight: SCREEN_HEIGHT * 0.42,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  previewImage: { width: "100%", height: "100%" },
  previewHeaderOverlay: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 10,
  },
  previewAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: "hidden",
  },
  previewNameText: { color: "#FFF", fontSize: 12 },
  previewDateText: { color: "#fff", fontSize: 11 },
  previewMissionBadge: {
    position: "absolute",
    bottom: 16,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  previewMissionText: { color: "#FFF", fontSize: 11 },
  scheduleHeader: { marginBottom: 10 },
  scheduleItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    height: SCREEN_HEIGHT * 0.07,
  },
  scheduleTimeBox: { width: 65, alignItems: "center" },
  scheduleTimeText: { color: "#FFF", fontSize: 12 },
  verticalBar: {
    width: 1,
    height: 16,
    backgroundColor: "rgba(255,255,255,0.4)",
    marginRight: 12,
  },
  scheduleTitleText: { color: "#FFF", fontSize: 14 },
  fabBtn: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  calendarImage: { width: 14, height: 14, tintColor: "#fff" },
  daySchedulesWrapper: { width: "90%", marginTop: 2, gap: 1.5 },
  miniScheduleBar: {
    height: 14,
    borderRadius: 2,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  miniScheduleText: {
    color: "#FFF",
    fontSize: 8,
    fontFamily: "Pretendard-Medium",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    width: "100%",
    height: "92%",
    backgroundColor: "#2C2C2E",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingVertical: 10,
    marginBottom: 10,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#555",
  },
  titleInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  blueDot: {
    width: 15,
    height: 15,
    borderRadius: 100,
    backgroundColor: "#6198FF",
    marginRight: 12,
  },
  modalTitleInput: { flex: 1, fontSize: 24, color: "#FFF" },
  timeSection: {},
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 4,
  },
  timeInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  timeDateText: { color: "#FFF", fontSize: 14 },
  timeInputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3A3A3C",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timeInput: { color: "#FFF", fontSize: 18, width: 35, textAlign: "center" },
  timeColon: { color: "#FFF", fontSize: 18, marginHorizontal: 2 },
  timeConnector: {
    width: 1,
    height: 15,
    backgroundColor: "#555",
    marginLeft: 9,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 12,
  },
  modalLabel: { color: "#FFF", fontSize: 13 },
  checkboxArea: { padding: 4 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#555",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: "#FFF" },
  saveButton: {
    backgroundColor: "#FFF",
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveButtonText: { color: "#000", fontSize: 16 },
  heartImage: { width: 20, height: 20, tintColor: "#fff" },
  clockImage: { width: 20, height: 20, tintColor: "#fff", marginRight: 4 },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 10,
  },
  blurText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },

  arrowLeft: {
    position: "absolute",
    left: 0,
    top: "40%",
    zIndex: 100,
    padding: 15,
  },
  arrowRight: {
    position: "absolute",
    right: 0,
    top: "40%",
    zIndex: 100,
    padding: 15,
  },
});
