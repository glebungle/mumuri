// app/camera.tsx
import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraCapturedPicture, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
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
import AppText from '../components/AppText';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
const BASE_URL = 'https://mumuri.shop';
const heartImg = require('../assets/images/Heart.png');
const galleryImg = require('../assets/images/gallery.png');
const rotateImg = require('../assets/images/camera-rotate.png');

// ================== 공통 authedFetch ==================
async function authedFetch(path: string, init: RequestInit = {}) {
  const token = await AsyncStorage.getItem('token');
  const headers = {
    Accept: 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.body && typeof init.body === 'string'
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(init.headers || {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  const text = await res.text();

  if (!res.ok) {
    const msg = `${path} ${res.status}: ${text.slice(0, 200)}`;
    console.log('[authedFetch error]', msg);
    throw new Error(msg);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ================== 타입 ==================
type CropRect = { originX: number; originY: number; width: number; height: number };

type MissionProgress = {
  userId: number;
  status: string;
  photoUrl: string | null;
  completedAt?: string | null;
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
  myDone?: boolean;
  myCompletedAt?: string;
};

export default function CameraHome() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();

  const [camPerm, requestCamPerm] = useCameraPermissions();

  const [isReady, setIsReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');

  const [viewW, setViewW] = useState(0);
  const [viewH, setViewH] = useState(0);

  // D-Day
  const [dday, setDday] = useState<number>(100);

  // 오늘의 미션 (여러 개 캐러셀 선택)
  const [missions, setMissions] = useState<TodayMission[]>([]);
  const [sel, setSel] = useState(0);

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
        const json = await authedFetch('/api/couples/missions/today', {
          method: 'GET',
        });

        console.log('[today missions raw]', JSON.stringify(json, null, 2));

        let missionsData: TodayMission[] = [];

        if (Array.isArray(json)) {
          missionsData = json as TodayMission[];
        } else if (json && Array.isArray((json as any).missions)) {
          missionsData = (json as any).missions as TodayMission[];
        }

        if (missionsData.length > 0) {
          setMissions(missionsData);
          setSel(0);
        } else {
          setMissions([]);
          setSel(0);
        }
      } catch (e: any) {
        console.log('[today missions error]', e?.message);
        setMissions([]);
        setSel(0);
      }
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

  // 갤러리에서 사진 선택
  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setPreviewUri(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('오류', '갤러리에서 사진을 가져올 수 없습니다.');
    }
  };

  // 카메라 전환
  const toggleCameraFacing = () => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
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
          facing={facing}
          onCameraReady={() => setIsReady(true)}
        />
      )}

      {/* ================= 상단 버튼 그룹 (수정됨) ================= */}
      {!previewUri && (
        <View style={styles.topHeaderContainer}>
          {/* 1. 뒤로가기 버튼 */}
          <Pressable style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#6198FF" />
          </Pressable>

          {/* 2. 디데이 뱃지  */}
          <View style={styles.ddayBadge}>
            <Image source={heartImg} style={[styles.heartImage]} />
            <AppText style={styles.ddayText}>{dday}</AppText>
          </View>

          {/* 3. 우측 상단 버튼 (앨범 등) */}
          <Pressable style={styles.headerBtn} onPress={() => router.push('/(tabs)/gallery')}>
            <Feather name="book" size={20} color="#6198FF" />
          </Pressable>
        </View>
      )}
      {/* ========================================================== */}

      {/* 오늘의 미션 캐러셀 (화살표 포함 말풍선) */}
      {!previewUri && missions.length > 0 && (
        <View style={styles.hintBubbleWrap}>
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
              {/* 왼쪽 화살표 (흰색 삼각형) */}
              {missions.length > 1 ? (
                <Pressable
                  style={styles.innerArrowArea}
                  onPress={prevMission}
                  hitSlop={8}
                >
                  <Ionicons
                    name="caret-forward"
                    size={20}
                    color='rgba(50,121,255,0.7)'
                    style={{ transform: [{ rotate: '180deg' }] }}
                  />
                </Pressable>
              ) : (
                <View style={styles.innerArrowArea} />
              )}

              {/* 가운데 텍스트 */}
              <View style={styles.hintTextWrap}>
                <AppText style={styles.hintText}>
                  {missions[sel]?.description ||
                    missions[sel]?.title ||
                    '오늘의 미션을 찍어 보내주세요'}
                </AppText>
              </View>

              {/* 오른쪽 화살표 (파란 삼각형) */}
              {missions.length > 1 ? (
                <Pressable
                  style={styles.innerArrowArea}
                  onPress={nextMission}
                  hitSlop={8}
                >
                  <Ionicons
                    name="caret-forward"
                    size={20}
                    color='rgba(50,121,255,0.7)'
                  />
                </Pressable>
              ) : (
                <View style={styles.innerArrowArea} />
              )}
            </View>
          </View>
        </View>
      )}

      {/* 하단 버튼 영역 */}
      <View style={[styles.bottomOverlay, { paddingBottom: 24 + insets.bottom }]}>
        {previewUri ? (
          <Pressable onPress={confirm} style={styles.confirmBtn}>
            <Ionicons name="checkmark-sharp" size={36} color="#fff" />
          </Pressable>
        ) : (
          <View style={styles.bottomButtonsRow}>
            {/* 갤러리 버튼 */}
            <Pressable style={styles.galleryBtn} onPress={pickFromGallery}>
              {/* <Ionicons name="images-outline" size={28} color="#fff" /> */}
              <Image source={galleryImg} style={[styles.galleryImage]} />
            </Pressable>

            {/* 촬영 버튼 */}
            <Pressable
              onPress={takePhoto}
              disabled={!isReady || capturing}
              style={[styles.shutterOuter, (!isReady || capturing) && { opacity: 0.5 }]}
            >
              <View style={styles.shutterInner} />
            </Pressable>

            {/* 카메라 전환 버튼 */}
            <Pressable style={styles.flipBtn} onPress={toggleCameraFacing}>
              {/* <Ionicons name="camera-reverse-outline" size={28} color="#fff" /> */}
              <Image source={rotateImg} style={[styles.rotateImage]} />
            </Pressable>
          </View>
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

  topHeaderContainer: {
    position: 'absolute',
    top: 18,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },

  ddayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(77, 80, 83, 0.6)', // 진한 회색 반투명
    borderRadius: 20,
  },
  ddayText: { marginLeft: 6, color: '#fff', fontSize: 14,},

  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#D9D9D9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 미션 말풍선 영역
  hintBubbleWrap: {
    position: 'absolute',
    top: screenHeight * 0.1, // 위치 살짝 조정
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  missionDotsRow: { flexDirection: 'row', marginBottom: 8 },
  missionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  missionDotActive: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3279FF' },

  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  // 말풍선 스타일
  hintBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 12,
    maxWidth: '85%',
  },
  innerArrowArea: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintTextWrap: {
    flex: 1,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: {
    color: '#444444',
    fontSize: 12, // 폰트 크기 살짝 키움
    textAlign: 'center',
    fontWeight: '600',
  },

  // 하단 버튼 영역
  bottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 40,
  },
  galleryBtn: {
    width: 50,
    height: 50,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 40,
  },
  galleryImage: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  shutterOuter: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 12,
    borderColor: '#FF9191',
  },
  shutterInner: { width: 48, height: 48, borderRadius: 33, backgroundColor: '#FF9191' },
  flipBtn: {
    width: 50,
    height: 50,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 40,
  },

  rotateImage: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },

  topBarPreview: {
    position: 'absolute',
    top: Platform.select({ ios: 0, android: 10 }),
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 14,
    zIndex: 10,
  },
  topIconBtnRetake: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF9191',
    alignItems: 'center',
    justifyContent: 'center',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  permissionTitle: { fontSize: 18, marginBottom: 16, fontWeight: 'bold' },
  permBtn: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#6198FF', borderRadius: 12 },
  permBtnText: { color: '#fff', fontWeight: '700' },

  heartImage: {
    width: 20,
    height: 20,
    tintColor: '#ffffffff',
  }

});