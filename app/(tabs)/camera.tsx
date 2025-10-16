import { Feather, Ionicons } from '@expo/vector-icons';
import { CameraCapturedPicture, CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export default function CameraHome() {
    const router = useRouter();
    const cameraRef = useRef<CameraView>(null);

    const [camPerm, requestCamPerm] = useCameraPermissions();
    const [libPerm, requestLibPerm] = MediaLibrary.usePermissions();

    const [isReady, setIsReady] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const [previewUri, setPreviewUri] = useState<string | null>(null); // 미리보기 모드 여부를 URI로 판단

    // 권한 요청
    useEffect(() => {
        (async () => {
            if (!camPerm?.granted) await requestCamPerm();
            if (!libPerm?.granted) await requestLibPerm();
        })();
    }, []);

    // 권한 없으면 UI
    if (!camPerm || !libPerm) return <View style={{ flex: 1, backgroundColor: '#000' }} />;
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
    // 라이브러리 권한도 처리
    if (!libPerm.granted) {
        return (
            <View style={styles.center}>
                <Text style={styles.permissionTitle}>사진 저장 권한이 필요해요</Text>
                <Pressable style={styles.permBtn} onPress={requestLibPerm}>
                    <Text style={styles.permBtnText}>권한 허용하기</Text>
                </Pressable>
            </View>
        );
    }

    // 촬영
    const takePhoto = async () => {
        if (!cameraRef.current) return;
        setCapturing(true); // 캡처 시작

        try {
            const pic = await cameraRef.current.takePictureAsync({
                quality: 1,
                skipProcessing: false,
            }) as CameraCapturedPicture;

            if (pic?.uri) {
                setPreviewUri(pic.uri);
            }
        } catch (e) {
            console.error(e);
            Alert.alert('촬영 실패', '사진 촬영 중 문제가 발생했습니다.');
        } finally {
            setCapturing(false); // 캡처 종료
        }
    };


    // 재촬영
    const retake = () => setPreviewUri(null);

    // 확정 → 공유 화면으로 이동 (임시로 로컬에 저장하는 로직도 추가)
    const confirm = async () => {
        if (!previewUri) return;
        
        try {
            // 💡 MediaLibrary에 사진 저장 (로컬 갤러리)
            if (libPerm.granted) {
                 await MediaLibrary.saveToLibraryAsync(previewUri);
            }

            // 🚨 라우팅: 상대 경로를 사용하여 경로 타입 오류 방지
            router.push({
                pathname: './share', // / (tabs)/share 대신 상대 경로 사용
                params: { uri: previewUri, mission: '상대방이 주말을 어떻게 보내고 있을지' },
            });
        } catch (e) {
            console.error('사진 저장 및 공유 실패:', e);
            Alert.alert('오류', '사진을 저장하거나 공유 화면으로 이동할 수 없습니다.');
        }
    };

    return (
        <View style={styles.container}>
            {/* 카메라 화면 */}
            {previewUri ? (
                // ====== 미리보기 화면 ======
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                    <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="cover" />
                    {/* 상단 닫기/재촬영 */}
                    <View style={styles.topBar}>
                        <Pressable onPress={retake} style={styles.topIconBtn}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </Pressable>
                    </View>

                    {/* 하단 확인 버튼 */}
                    <View style={styles.bottomBarPreview}>
                        <Pressable onPress={confirm} style={styles.confirmBtn}>
                            <Ionicons name="checkmark-sharp" size={36} color="#fff" />
                        </Pressable>
                    </View>
                </View>
            ) : (
                // ====== 촬영 화면 ======
                <>
                    <View style={styles.cameraWrap}>
                        <CameraView
                            ref={cameraRef}
                            style={StyleSheet.absoluteFill}
                            // 미션을 위해 후면 카메라를 기본으로 설정
                            facing="back"
                            enableTorch={false}
                            onCameraReady={() => setIsReady(true)}
                        />

                        {/* 좌상단 아이콘들(예시: 갤러리/지도자리) */}
                        <View style={styles.floatingTopButtons}>
                            {/* 버튼 스타일을 floatBtnGroup으로 묶어 가시성 향상 */}
                            <Pressable style={styles.floatBtn} onPress={() => Alert.alert('준비중', '앨범은 다음 단계에서 연결할게요!')}>
                                <Feather name="image" size={20} color="#1f2937" />
                            </Pressable>
                            <Pressable style={styles.floatBtn} onPress={() => Alert.alert('준비중', '지도는 다음 단계에서 연결할게요!')}>
                                <Feather name="map" size={20} color="#1f2937" />
                            </Pressable>
                        </View>

                        {/* 중앙 말풍선 안내 (미션) */}
                        <View style={styles.hintBubbleWrap}>
                            <View style={styles.hintBubble}>
                                <Text style={styles.hintText}>상대방이 주말을 어떻게 보내고 있을지 찍어 보내주세요</Text>
                            </View>
                        </View>
                    </View>

                    {/* 하단 촬영 버튼 */}
                    <View style={styles.bottomBar}>
                        <Pressable
                            onPress={takePhoto}
                            // 준비되지 않았거나 캡처 중일 때 비활성화
                            disabled={!isReady || capturing}
                            style={[styles.shutterOuter, (!isReady || capturing) && { opacity: 0.5 }]}
                        >
                            <View style={styles.shutterInner} />
                        </Pressable>
                    </View>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },

    cameraWrap: {
        flex: 1,
        overflow: 'hidden',
        borderRadius: 16,
        margin: 16,
        backgroundColor: '#000', // 카메라가 로딩되지 않았을 때 배경
    },

    floatingTopButtons: {
        position: 'absolute',
        top: 14,
        left: 14, // 🚨 오른쪽에서 왼쪽으로 위치 변경
        flexDirection: 'row',
        gap: 10,
    },
    floatBtn: {
        width: 36, height: 36, borderRadius: 18, // 원형으로 변경
        backgroundColor: 'rgba(255,255,255,0.95)',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 3,
    },

    hintBubbleWrap: {
        position: 'absolute',
        left: 0, right: 0, bottom: 28,
        alignItems: 'center',
    },
    hintBubble: {
        paddingHorizontal: 18, paddingVertical: 10,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 22,
    },
    hintText: { color: '#2563eb', fontWeight: '600', textAlign: 'center' },

    bottomBar: {
        paddingVertical: 18, // 하단 패딩 조정
        alignItems: 'center',
        backgroundColor: '#fff', // 하단 바 색상
    },
    shutterOuter: {
        width: 78, height: 78, borderRadius: 39, // 원형
        backgroundColor: '#e2e8f0', // 옅은 회색
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 4,
    },
    shutterInner: {
        width: 64, height: 64, borderRadius: 32, // 원형
        backgroundColor: '#2563eb', // 파란색
        borderWidth: 4,
        borderColor: '#fff',
    },

    // 미리보기
    topBar: {
        position: 'absolute',
        top: Platform.select({ ios: 40, android: 20 }), // 노치 영역 고려
        left: 14, right: 14,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        zIndex: 10, // 앞으로 나오도록
    },
    topIconBtn: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center', justifyContent: 'center',
    },
    bottomBarPreview: {
        position: 'absolute', left: 0, right: 0, bottom: Platform.select({ ios: 50, android: 30 }),
        alignItems: 'center',
        zIndex: 10, // 앞으로 나오도록
    },
    confirmBtn: {
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: '#2563eb',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 4,
    },

    previewImage: { width: '100%', height: '100%' },

    // 권한 화면
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
    permissionTitle: { fontSize: 18, marginBottom: 16, fontWeight: 'bold' },
    permBtn: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#2563eb', borderRadius: 12 },
    permBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
