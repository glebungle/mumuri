// app/(tabs)/camera.tsx
import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraCapturedPicture, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
const BASE_URL = 'https://mumuri.shop';
const SWIPE_THRESHOLD = 40; // 스와이프로 인식할 최소 이동 거리

type CropRect = { originX: number; originY: number; width: number; height: number };

type MissionProgress = {
  userId: number;
  status: string;
  photoUrl: string | null;
};

type TodayMission = {
  missionId: number;
  title: string;
  description: string;
  difficulty: string;
  reward: number;
  status: string;
  missionDate: string;
  progresses: MissionProgress[];
};

export default function CameraHome() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();

  const [camPerm, requestCamPerm] = useCameraPermissions();

  const [isReady, setIsReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const [viewW, setViewW] = useState(0);
  const [viewH, setViewH] = useState(0);

  // D-Day
  const [dday, setDday] = useState<number>(100);

  // 오늘의 미션 (여러 개 캐러셀 선택)
  const [missions, setMissions] = useState<TodayMission[]>([]);
  const [sel, setSel] = useState(0);
  // 스와이프 처리를 위한 상태
  const [startX, setStartX] = useState<number | null>(null);

  const nextMission = React.useCallback(() => {
    if (!missions.length) return;
    setSel((i) => (i + 1) % missions.length);
  }, [missions.length]);

  const prevMission = React.useCallback(() => {
    if (!missions.length) return;
    setSel((i) => (i - 1 + missions.length) % missions.length);
  }, [missions.length]);

  const onCameraWrapLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewW(width);
    setViewH(height);
  };

  // 스와이프 핸들러
  const handleTouchStart = (e: any) => {
    // 터치 시작 X 좌표 저장
    setStartX(e.nativeEvent.pageX);
    return true; // Responder로 지정
  };

  const handleTouchEnd = (e: any) => {
    if (startX == null) return;
    const endX = e.nativeEvent.pageX;
    const dx = endX - startX;
    setStartX(null); // 초기화

    if (Math.abs(dx) < SWIPE_THRESHOLD) return; // 임계값 미만은 무시

    if (dx < 0) {
      // 왼쪽으로 스와이프 (다음 미션)
      nextMission();
    } else {
      // 오른쪽으로 스와이프 (이전 미션)
      prevMission();
    }
  };

  // 카메라 권한
  useEffect(() => {
    (async () => {
      if (!camPerm?.granted) await requestCamPerm();
    })();
  }, []);

  // D-Day 가져오기
  useEffect(() => {
    const fetchDday = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return;

        const res = await fetch(`${BASE_URL}/user/main`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) return;
        const json = await res.json();
        if (typeof json.dday === 'number') setDday(json.dday);
      } catch {}
    };
    fetchDday();
  }, []);

  // 오늘의 미션 가져오기
  useEffect(() => {
    const fetchTodayMission = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return;

        const res = await fetch(`${BASE_URL}/api/couples/missions/today`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) return;
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
          setMissions(json);
          setSel(0);
        } else {
          setMissions([]);
          setSel(0);
        }
      } catch {}
    };
    fetchTodayMission();
  }, []);

  if (!camPerm) return <View style={styles.loadingScreen} />;

  if (!camPerm.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionTitle}>카메라 권한이 필요해요</Text>
        <Pressable style={styles.permBtn} onPress={requestCamPerm}>
          <Text style={styles.permBtnText}>권한 허용하기</Text>
        </Pressable>
      </View>
    );
  }

  // 촬영
  const takePhoto = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);

    let pic: CameraCapturedPicture | null = null;
    let finalUri: string | null = null;

    try {
      pic = (await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: false,
        exif: true,
      })) as CameraCapturedPicture;

      if (!pic?.uri || !pic.width || !pic.height) {
        Alert.alert('촬영 실패', '이미지를 불러오지 못했습니다.');
        return;
      }

      const targetAspect = viewW && viewH ? viewW / viewH : 3 / 4;

      let srcW = pic.width;
      let srcH = pic.height;
      const orientation = pic.exif?.Orientation;
      const isRotated = Platform.OS === 'android' && (orientation === 6 || orientation === 8);
      if (isRotated) [srcW, srcH] = [srcH, srcW];

      const srcAspect = srcW / srcH;
      let crop: CropRect;

      if (srcAspect > targetAspect) {
        const newW = Math.round(srcH * targetAspect);
        const originX = Math.max(0, Math.floor((srcW - newW) / 2));
        crop = { originX, originY: 0, width: newW, height: srcH };
      } else if (srcAspect < targetAspect) {
        const newH = Math.round(srcW / targetAspect);
        const originY = Math.max(0, Math.floor((srcH - newH) / 2));
        crop = { originX: 0, originY, width: srcW, height: newH };
      } else {
        crop = { originX: 0, originY: 0, width: srcW, height: srcH };
      }

      crop.originX = Math.max(0, Math.min(crop.originX, srcW - 1));
      crop.originY = Math.max(0, Math.min(crop.originY, srcH - 1));
      crop.width = Math.min(crop.width, srcW - crop.originX);
      crop.height = Math.min(crop.height, srcH - crop.originY);

      const manipulated = await ImageManipulator.manipulateAsync(
        pic.uri,
        [{ crop }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );

      finalUri = manipulated.uri;
    } catch (e) {
      Alert.alert('크롭 실패', '사진 비율 조정에 실패했습니다. 원본으로 진행합니다.');
      if (pic?.uri) finalUri = pic.uri;
    } finally {
      if (finalUri) setPreviewUri(finalUri);
      setCapturing(false);
    }
  };

  const retake = () => setPreviewUri(null);

  // share 이동 (선택된 미션으로)
  const confirm = async () => {
    if (!previewUri) return;
    const picked = missions[sel];

    try {
      router.push({
        pathname: './share',
        params: {
          uri: previewUri,
          missionId: picked ? String(picked.missionId) : '',
          missionTitle: picked?.title ?? '',
          missionDescription: picked?.description ?? '',
        },
      });
    } catch (e) {
      Alert.alert('오류', '공유 화면으로 이동할 수 없습니다.');
    }
  };

  const cameraPreviewComponent = (
    <View style={styles.cameraFrame} onLayout={onCameraWrapLayout}>
      {previewUri ? (
        <Image source={{ uri: previewUri }} style={styles.previewFrameImage} resizeMode="cover" />
      ) : (
        <CameraView
          ref={cameraRef}
          style={styles.previewFrameImage}
          facing="back"
          onCameraReady={() => setIsReady(true)}
        />
      )}

      {/* 상단 디데이 (가운데 정렬) - 미리보기 화면에서는 숨김 */}
      {!previewUri && (
        <View style={styles.ddayBadge}>
          <Ionicons name="heart-outline" size={18} color="#fff" />
          <AppText style={styles.ddayText}>{dday}</AppText>
        </View>
      )}

      {/* 오늘의 미션 캐러셀 (스와이프/화살표) */}
      {!previewUri && (
        <View
          style={styles.hintBubbleWrap}
          // 스와이프 처리를 위해 View를 Responder로 설정
          onMoveShouldSetResponder={() => true}
          onResponderGrant={handleTouchStart}
          onResponderRelease={handleTouchEnd}
        >
          <View style={styles.missionDotsRow}>
            {missions.map((_, i) => (
              <View
                key={i}
                style={[styles.missionDot, i === sel && styles.missionDotActive]}
              />
            ))}
          </View>

          <View style={styles.hintRow}>
            <View style={styles.hintBubble}>
              <AppText style={styles.hintText}>
                {missions[sel]?.description || missions[sel]?.title || '오늘의 미션을 찍어 보내주세요'}
              </AppText>
              <Ionicons name="play" size={18} color="#FFFFFF" /> 
            </View>
          </View>
        </View>
      )}

      {/* 오른쪽 상단 버튼 그룹 */}
      {!previewUri && (
        <View style={styles.floatingTopButtonsGroupCamera}>
          <Pressable style={styles.floatBtn} onPress={() => Alert.alert('준비중')}>
            <Feather name="book" size={20} color="#6198FF" />
          </Pressable>
        </View>
      )}

      {/* 하단 촬영 / 확인 버튼 */}
      <View style={[styles.bottomOverlay, { paddingBottom: 24 + insets.bottom }]}>
        {previewUri ? (
          <Pressable onPress={confirm} style={styles.confirmBtn}>
            <Ionicons name="checkmark-sharp" size={36} color="#fff" />
          </Pressable>
        ) : (
          <Pressable
            onPress={takePhoto}
            disabled={!isReady || capturing}
            style={[styles.shutterOuter, (!isReady || capturing) && { opacity: 0.5 }]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.fullScreenContainer}>
      <View style={styles.backgroundDim} />
      <SafeAreaView style={[styles.uiOverlay, { paddingTop: insets.top }]}>
        {previewUri && (
          <View style={styles.topBarPreview}>
            <Pressable onPress={retake} style={styles.topIconBtnRetake}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>
        )}

        {cameraPreviewComponent}

        <View style={{ height: screenHeight * 0.1, backgroundColor: '#FFFCF5' }} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, backgroundColor: '#FFFCF5' },
  fullScreenContainer: { flex: 1, backgroundColor: '#FFFCF5' },
  backgroundDim: { ...StyleSheet.absoluteFillObject },

  cameraFrame: {
    width: screenWidth,
    height: screenHeight * 0.8,
    borderRadius: 0,
    overflow: 'hidden',
    marginTop: 0,
    position: 'relative',
  },
  previewFrameImage: { ...StyleSheet.absoluteFillObject },

  uiOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 0,
    zIndex: 1,
  },

  // D-DAY
  ddayBadge: {
    position: 'absolute',
    top: 18,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ddayText: { marginLeft: 6, color: '#fff', fontSize: 14 },

  // 상단 오른쪽 버튼
  floatingTopButtonsGroupCamera: {
    position: 'absolute',
    top: 18,
    right: 18,
    flexDirection: 'row',
    zIndex: 2,
  },
  floatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },

  // 미션 말풍선 영역
  hintBubbleWrap: {
    position: 'absolute',
    top: screenHeight * 0.1,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  missionDotsRow: { flexDirection: 'row', marginBottom: 8 },
  missionDot: {
    width: 6, height: 6, borderRadius: 3, marginHorizontal: 3,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  missionDotActive: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3279FF' },

  hintRow: { flexDirection: 'row', alignItems: 'center' },
  arrowBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 6,
  },

  hintBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 12,
  },
  hintText: { color: '#3279FF', fontSize: 13, textAlign: 'center', marginRight: 10 },

  // 하단 버튼 영역
  bottomOverlay: {
    position: 'absolute',
    left: 0, right: 0, bottom: -40,
    alignItems: 'center', justifyContent: 'center',
  },
  shutterOuter: {
    width: 86, height: 86, borderRadius: 43, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: '#FF9191',
  },
  shutterInner: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#FF9191' },

  topBarPreview: {
    position: 'absolute',
    top: Platform.select({ ios: 0, android: 10 }),
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 14,
    zIndex: 10,
  },
  topIconBtnRetake: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtn: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#FF9191',
    alignItems: 'center', justifyContent: 'center',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  permissionTitle: { fontSize: 18, marginBottom: 16, fontWeight: 'bold' },
  permBtn: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#6198FF', borderRadius: 12 },
  permBtnText: { color: '#fff', fontWeight: '700' },
});