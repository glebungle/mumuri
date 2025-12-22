import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ListRenderItem } from 'react-native';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  ViewStyle
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { useUser } from './context/UserContext';
import { ChatIncoming, createChatClient } from './lib/chatSocket';

const ChatText = (props: React.ComponentProps<typeof AppText>) => {
  const { style, ...rest } = props;
  return <AppText {...rest} style={[{ fontFamily: 'Pretendard-Medium' }, style]} />;
};
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const API_BASE = 'https://mumuri.shop';
const WS_URL = `${API_BASE}/ws-chat`;
const MAX_TEXT_LEN = 500;
const HEADER_HEIGHT = SCREEN_HEIGHT * 0.05;
const cameraImg = require('../assets/images/Camera.png');

// ================== 유틸리티 ==================
function isDateMarker(x: ChatMessage | DateMarker): x is DateMarker { return (x as any).__type === 'date'; }
function sameYMD(a: number, b: number) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}
function sameMinute(a: number, b: number) {
  const da = new Date(a), db = new Date(b);
  return da.getHours() === db.getHours() && da.getMinutes() === db.getMinutes() && sameYMD(a, b);
}
function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${['일', '월', '화', '수', '목', '금', '토'][d.getDay()]}요일`;
}
function formatTime(ts: number) {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h < 12 ? '오전' : '오후';
  if (h === 0) h = 12; else if (h > 12) h -= 12;
  return `${ampm} ${h}:${m}`;
}
function uuid4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
function parseTSLocalOrISO(s?: string | null): number | null {
  if (!s) return null;
  const isoTime = new Date(String(s).replace(' ', 'T')).getTime();
  return Number.isNaN(isoTime) ? null : isoTime;
}
async function authedFetch(path: string, init: RequestInit = {}) {
  const token = await AsyncStorage.getItem('token');
  const headers = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`${res.status}`);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

// ================== 타입 ==================
type SendStatus = 'sent' | 'sending' | 'failed' | undefined;
type ChatMessage = {
  id: string;
  text?: string;
  imageUrl?: string;
  mine: boolean;
  createdAt: number;
  type: 'text' | 'image' | 'mission_text';
  status?: SendStatus;
  clientMsgId?: string | null;
  isFirstInGroup?: boolean;
};
type DateMarker = { __type: 'date'; key: string; ts: number };

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { userData } = useUser();
  const userId = userData?.userId || null;
  const ROOM_KEY = userData?.roomId ? String(userData.roomId) : null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [loading, setLoading] = useState(true);

  // 이미지 크게 보기 상태
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const listRef = useRef<FlatList<ChatMessage | DateMarker>>(null);
  const chatRef = useRef<any>(null);
  const latestVisibleMsgId = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    if (listRef.current) listRef.current.scrollToOffset({ offset: 0, animated: true });
  }, []);

  // 키보드 리스너
  useEffect(() => {
    const onShow = (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', onShow);
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', onHide);
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const openImageViewer = (url: string | null) => {
    if (!url) return;
    setSelectedImageUrl(url);
    setViewerVisible(true);
  };

  const onIncoming = useCallback((p: ChatIncoming) => {
    setMessages(prev => {
      if (p.id != null && prev.some(x => String(x.id) === String(p.id))) return prev;
      let nextMessages = [...prev];
      if (p.clientMsgId) {
        nextMessages = nextMessages.filter(m => m.clientMsgId !== p.clientMsgId);
      }
      const add: ChatMessage = {
        id: String(p.id ?? Date.now()),
        text: p.message ?? undefined,
        imageUrl: p.imageUrl ?? undefined,
        mine: String(p.senderId) === String(userId ?? ''),
        createdAt: p.createdAt ?? Date.now(),
        type: (p as any).type === 'MISSION_TEXT' ? 'mission_text' : (p.imageUrl ? 'image' : 'text'),
        status: 'sent',
      };
      return [...nextMessages, add].sort((a, b) => a.createdAt - b.createdAt);
    });
    setTimeout(scrollToBottom, 100);
  }, [userId, scrollToBottom]);

  useFocusEffect(useCallback(() => {
    if (!ROOM_KEY || !userId) return;
    let active = true;
    const init = async () => {
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem('token');
        const res: any = await authedFetch(`/chat/${ROOM_KEY}/history?size=50`);
        const rows = Array.isArray(res) ? res : (res?.messages || []);
        const historyMsgs = rows.map((r: any) => ({
          id: String(r.id), text: r.message, imageUrl: r.imageUrl,
          mine: String(r.senderId) === String(userId ?? ''),
          createdAt: parseTSLocalOrISO(r.sentAt || r.createdAt) || Date.now(),
          type: r.type === 'MISSION_TEXT' ? 'mission_text' : (r.imageUrl ? 'image' : 'text'),
          status: 'sent'
        }));
        if (active) setMessages(historyMsgs.sort((a: any, b: any) => a.createdAt - b.createdAt));

        chatRef.current = createChatClient({
          wsUrl: WS_URL, token: token!, roomId: ROOM_KEY,
          handlers: {
            onMessage: onIncoming,
            onConnected: () => { chatRef.current?.markAsRead(ROOM_KEY, Number(userId), latestVisibleMsgId.current ?? undefined); }
          }
        });
        chatRef.current.activate();
      } finally { if (active) setLoading(false); }
    };
    init();
    return () => { active = false; chatRef.current?.deactivate(); };
  }, [ROOM_KEY, userId, onIncoming]));

  const sendMessage = useCallback(async () => {
    if (!ROOM_KEY || !userId || sending || !text.trim()) return;
    const clientMsgId = uuid4();
    const currentText = text;
    setText('');
    setTimeout(scrollToBottom, 50);

    try {
      chatRef.current?.sendMessage(ROOM_KEY, Number(userId), { message: currentText.trim(), imageUrl: null, clientMsgId, createdAt: Date.now() });
    } catch {
      // 에러 처리 생략
    }
  }, [ROOM_KEY, userId, sending, text, scrollToBottom]);

  const listData = useMemo(() => {
    const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);
    const result: (ChatMessage | DateMarker)[] = [];
    let lastTs = 0;
    sorted.forEach((m, i) => {
      const prev = sorted[i - 1];
      if (!lastTs || !sameYMD(lastTs, m.createdAt)) {
        result.push({ __type: 'date', key: `date_${m.createdAt}`, ts: m.createdAt });
      }
      m.isFirstInGroup = !prev || prev.mine !== m.mine || !sameMinute(prev.createdAt, m.createdAt);
      result.push(m);
      lastTs = m.createdAt;
    });
    return result.reverse();
  }, [messages]);

  const renderItem: ListRenderItem<ChatMessage | DateMarker> = useCallback(({ item, index }) => {
    if (isDateMarker(item)) return <View style={styles.dateWrap}><ChatText style={styles.dateText}>{formatDate(item.ts)}</ChatText></View>;
    const m = item as ChatMessage;
    const nextMsg = listData[index - 1];
    const showTime = !nextMsg || isDateMarker(nextMsg) || (nextMsg as ChatMessage).mine !== m.mine || !sameMinute((nextMsg as ChatMessage).createdAt, m.createdAt);
    
    const bubbleStyle = (m.type === 'mission_text' ? (m.mine ? styles.bubbleMissionMine : styles.bubbleMissionOther) : (m.mine ? styles.bubbleMine : styles.bubbleOther)) as ViewStyle;
    const containerStyle = (m.type === 'image' ? (m.mine ? styles.imageBoxMine : styles.imageBoxOther) : [styles.bubble, bubbleStyle]) as ViewStyle;
    const partnerProfileSource = userData?.partnerProfileImageUrl ? { uri: userData.partnerProfileImageUrl } : require('../assets/images/userprofile.png');

    return (
      <View style={[styles.row, m.mine ? styles.rowMine : styles.rowOther]}>
        {!m.mine && (
          <View style={styles.profileContainer}>
            {m.isFirstInGroup ? (
              <Pressable onPress={() => openImageViewer(userData?.partnerProfileImageUrl || null)}>
                <Image source={partnerProfileSource} style={styles.profileImage} />
              </Pressable>
            ) : <View style={styles.profileSpacer} />}
          </View>
        )}
        <View style={[styles.msgContentWrapper, !m.mine && { alignItems: 'flex-start' }]}>
          {!m.mine && m.isFirstInGroup && <AppText type='pretendard-m' style={styles.partnerName}>{userData?.partnerName || '애인'}{Platform.OS === 'android' ? '\u200A' : ''}</AppText>}
          <View style={[styles.msgContainer, m.mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
            {m.mine && showTime && <ChatText style={styles.timeTextMine}>{formatTime(m.createdAt)}</ChatText>}
            <View style={containerStyle}>
              {m.type === 'mission_text' ? <AppText type='pretendard-b' style={styles.msgText}>{m.text}</AppText> :
                m.type === 'image' ? (
                  <Pressable onPress={() => openImageViewer(m.imageUrl!)}>
                    <Image source={{ uri: m.imageUrl! }} style={styles.missionImage} resizeMode="cover" />
                  </Pressable>
                ) :
                <AppText type='pretendard-m' style={m.mine ? styles.msgTextMine : styles.msgTextOther}>{m.text}{Platform.OS === 'android' ? '\u200A' : ''}</AppText>}
            </View>
            {!m.mine && showTime && <ChatText style={styles.timeTextOther}>{formatTime(m.createdAt)}</ChatText>}
          </View>
        </View>
      </View>
    );
  }, [listData, userData]);

  const isIOS = Platform.OS === 'ios';
  const isKeyboardOpen = keyboardHeight > 0;
  
  // 💡 [핵심수정] iOS 키보드 간격 문제 해결
  // 키보드가 열렸을 때는 insets.bottom을 더하지 않아야 공백이 생기지 않습니다.
  const iosBottomPadding = isKeyboardOpen ? 8 : insets.bottom + 8;
  const androidPadding = isKeyboardOpen ? 60 + keyboardHeight : 12 + insets.bottom;

  // Header와 상단 마진을 합친 정확한 Offset
  const verticalOffset = isIOS ? insets.top + (HEADER_HEIGHT*0.1) : 0;

  return (
    <View style={styles.wrap}>
      {/* 이미지 확대 모달 */}
      <Modal visible={viewerVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalCloseBtn} onPress={() => setViewerVisible(false)}>
            <Ionicons name="close" size={30} color="#fff" />
          </Pressable>
          {selectedImageUrl && <Image source={{ uri: selectedImageUrl }} style={styles.fullImage} resizeMode="contain" />}
        </View>
      </Modal>

      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color="#111" /></Pressable>
        <AppText style={styles.headerTitle}>{userData?.partnerName || '애인'}{Platform.OS === 'android' ? '\u200A' : ''}</AppText>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={isIOS ? 'padding' : undefined} 
        keyboardVerticalOffset={verticalOffset}
      >
        <View style={{ flex: 1 }}>
          {loading ? (
            <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="small" color="#6198FF" /></View>
          ) : (
            <FlatList<ChatMessage | DateMarker>
              ref={listRef} inverted data={listData} renderItem={renderItem}
              keyExtractor={(item) => isDateMarker(item) ? item.key : item.id}
              contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12 }}
              keyboardShouldPersistTaps="handled"
              onViewableItemsChanged={({ viewableItems }) => {
                if (!viewableItems.length) return;
                const latest = viewableItems.find(v => !isDateMarker(v.item))?.item;
                if (latest && !isDateMarker(latest) && latest.id) {
                  if (latest.id !== latestVisibleMsgId.current) {
                    latestVisibleMsgId.current = latest.id;
                    if (ROOM_KEY && userId) chatRef.current?.markAsRead(ROOM_KEY, Number(userId), latest.id);
                  }
                }
              }}
            />
          )}

          <View style={[styles.inputBar, { paddingBottom: isIOS ? iosBottomPadding : androidPadding }]}> 
            <Pressable onPress={() => router.push('/camera')} style={{ paddingHorizontal: 8 }}><Image source={cameraImg} style={styles.cameraImage} resizeMode="contain" /></Pressable>
            <TextInput
              style={styles.input}
              placeholder="대화를 입력하세요" placeholderTextColor="#999"
              value={text} onChangeText={setText} multiline
            />
            <Pressable style={styles.sendBtn} onPress={sendMessage}><Ionicons name="arrow-up" size={22} color="#4D5053" /></Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const STICKER_SIZE = 128;
const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#FFFCF5' },
  header: { height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, justifyContent: 'center', marginTop: HEADER_HEIGHT * 1.5 },
  backBtn: { left: 0, paddingHorizontal: 16, zIndex: 3, position: 'absolute' },
  headerTitle: { fontSize: 16, color: '#111' },
  row: { width: '100%', marginVertical: 2, flexDirection: 'row', alignItems: 'flex-start' },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  profileContainer: { width: 40, marginRight: 4, alignItems: 'center' },
  profileImage: { width: 36, height: 36, borderRadius: 99, backgroundColor: '#DDD' },
  profileSpacer: { width: 0 },
  msgContentWrapper: { maxWidth: '100%' },
  partnerName: { fontSize: 12, color: '#3F3F3F', marginBottom: 4 },
  bubble: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, maxWidth: SCREEN_WIDTH * 0.63 },
  imageBoxMine: { borderRadius: 18, overflow: 'hidden', alignSelf: 'flex-end', maxWidth: SCREEN_WIDTH * 0.6 },
  imageBoxOther: { borderRadius: 18, overflow: 'hidden', alignSelf: 'flex-start', maxWidth: SCREEN_WIDTH * 0.6 },
  bubbleMissionMine: { backgroundColor: '#6198FF', borderBottomRightRadius: 0 },
  bubbleMissionOther: { backgroundColor: '#f28484ff', borderTopLeftRadius: 0 },
  msgContainer: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 },
  timeTextMine: { marginRight: 4, fontSize: 9, color: '#75787B' },
  timeTextOther: { marginLeft: 4, fontSize: 9, color: '#75787B' },
  bubbleMine: { backgroundColor: '#BED5FF', borderBottomRightRadius: 2 },
  bubbleOther: { backgroundColor: '#FFADAD', borderTopLeftRadius: 2 },
  missionImage: { width: STICKER_SIZE * 1.6, height: STICKER_SIZE * 2.5, backgroundColor: '#DDE7FF' },
  msgText: { fontSize: 15, lineHeight: 20, color: '#fff' },
  msgTextMine: { fontSize: 14, color: '#3F3F3F' },
  msgTextOther: { fontSize: 14, color: '#3F3F3F' },
  dateWrap: { alignItems: 'center', marginVertical: 26 },
  dateText: { fontSize: 12, color: '#4D5053', backgroundColor: '#F8F4EA', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 100 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, gap: 8, backgroundColor: '#FFFCF5', paddingTop: 8 },
  input: { flex: 1, minHeight: 40, maxHeight: 120, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb', color: '#111' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEEFEF' },
  cameraImage: { width: 24, height: 24, tintColor: '#6198FF', marginBottom: 10 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 },
  fullImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 },
});