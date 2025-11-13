// app/(tabs)/chat.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react-native';
import {
  Alert,
  FlatList,
  Image,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';
import { ChatIncoming, ChatReadUpdate, createChatClient } from '../lib/chatSocket';

// ================== 환경 ==================
const API_BASE = 'https://mumuri.shop';
const BASE_URL = API_BASE;
const WS_URL   = `${API_BASE}/ws-chat`;

const MAX_TEXT_LEN = 500;
const ALLOWED_MIME = ['image/jpeg'];
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const STICKER_SIZE = 128;
const HEADER_HEIGHT = 56;

const USE_STOMP = true;
const USE_REST_UPLOAD = true;

async function presignIfNeeded(rawUrl?: string | null) {
  if (!rawUrl) return null;
  // 이미 presigned면 그대로 사용
  if (/\bX-Amz-Algorithm=/.test(rawUrl)) return rawUrl;

  // 서버에 presign 요청 (백엔드가 둘 중 하나라도 제공하면 동작)
  try {
    const r1 = await authedFetch(`/api/couples/missions/presign?url=${encodeURIComponent(rawUrl)}`, { method: 'GET' });
    if (r1?.url) return r1.url;
  } catch {}
  try {
    const r2 = await authedFetch(`/photo/presign?url=${encodeURIComponent(rawUrl)}`, { method: 'GET' });
    if (r2?.url) return r2.url;
  } catch {}

  // 최후엔 원본 반환(표시는 안 될 수 있음)
  return rawUrl;
}

// ================== 내부 유틸(API) ==================
async function authedFetch(path: string, init: RequestInit = {}) {
  const token = await AsyncStorage.getItem('token');
  const headers = {
    Accept: 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 160)}`);
  try { return JSON.parse(text); } catch { return text; }
}

function normalizeGetUser(raw: any) {
  if (typeof raw === 'number') return { userId: raw };
  if (typeof raw === 'string' && /^[0-9]+$/.test(raw)) return { userId: Number(raw) };
  if (raw && typeof raw === 'object') {
    const userId = raw.userId ?? raw.id ?? raw.memberId ?? null;
    const coupleId = raw.coupleId ?? raw.couple_id ?? null;
    const coupleCode = raw.coupleCode ?? raw.couple_code ?? null;
    return { userId, coupleId, coupleCode };
  }
  return { userId: null, coupleId: null, coupleCode: null };
}

// ================== 타입 ==================
type SendStatus = 'sent' | 'sending' | 'failed' | undefined;

type MissionMeta = {
  missionId: number;
  owner: 'me' | 'partner';
  shouldBlur: boolean;
};

type ChatMessage = {
  id: string;
  text?: string;
  imageUri?: string;
  imageUrl?: string;
  mine: boolean;
  createdAt: number;
  type: 'text' | 'image' | 'mission';
  status?: SendStatus;
  clientMsgId?: string | null;
  missionMeta?: MissionMeta;
};

type DateMarker = { __type: 'date'; key: string; ts: number };

type MissionState = {
  missionId: number;
  text: string;
  myStatus: string;
  partnerStatus: string;
  myPhotoUrl?: string | null;
  partnerPhotoUrl?: string | null;
  missionDateTs: number;

  myCompletedTs?: number | null;
  partnerCompletedTs?: number | null;
};

// ================== 유틸(날짜/문자열) ==================
function sameYMD(a: number, b: number) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate();
}
function sameMinute(a: number, b: number) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate()
    && da.getHours() === db.getHours()
    && da.getMinutes() === db.getMinutes();
}
function formatDate(ts: number) {
  const d = new Date(ts);
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  const w = ['일','월','화','수','목','금','토'][d.getDay()];
  return `${y}년 ${m}월 ${day}일 ${w}요일`;
}
function formatTime(ts: number) {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h < 12 ? '오전' : '오후';
  if (h === 0) h = 12;
  if (h > 12) h -= 12;
  return `${ampm} ${h}:${m}`;
}
function uuid4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random()*16)|0, v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}
function isSameContent(local: ChatMessage, incoming: ChatIncoming) {
  const lt = (local.text ?? '').trim();
  const it = (incoming.message ?? '').trim();
  const li = !!local.imageUrl || !!local.imageUri;
  const ii = !!incoming.imageUrl;
  return lt === it && li === ii;
}

function parseTSLocal(s?: string | null): number | null {
  if (!s) return null;
  // "YYYY-MM-DD" 패턴이면 로컬 자정으로 만든다
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
    return new Date(y, mo, d, 0, 0, 0, 0).getTime(); // 로컬 00:00
  }
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
}

// 미션 완료 여부 판별 (half_done / done / NOT_DONE 등 다 커버)
function isDoneLike(status?: string | null) {
  if (!status) return false;
  const s = String(status).toUpperCase();
  if (s.includes('NOT')) return false;
  return s.includes('DONE') || s === 'COMPLETE';
}

// ================== 화면 ==================
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const accessoryID = 'chat-input-accessory';

  // ✅ share.tsx에서 넘어오는 낙관적 표시 파라미터
  const {
    justCompletedMissionId,
    justCompletedMissionText,
    justCompletedPhotoUrl,
  } = useLocalSearchParams<{
    justCompletedMissionId?: string;
    justCompletedMissionText?: string;
    justCompletedPhotoUrl?: string;
  }>();

  const [token, setToken] = useState<string | undefined>(undefined);
  const [coupleId, setCoupleId] = useState<number | null>(null);
  const [coupleCode, setCoupleCode] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputBarHeight, setInputBarHeight] = useState(56);

  const [missionState, setMissionState] = useState<MissionState | null>(null);

  const listRef = useRef<FlatList<any>>(null);
  const chatRef = useRef<ReturnType<typeof createChatClient> | null>(null);
  const latestVisibleMsgId = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const entries = await AsyncStorage.multiGet(['token','userId','coupleId','coupleCode']);
      const map = Object.fromEntries(entries);

      const tokenStr   = map.token || undefined;
      const userIdNum  = map.userId ? Number(map.userId) : null;
      const coupleIdNum= map.coupleId ? Number(map.coupleId) : null;
      const codeStr    = map.coupleCode || null;

      setToken(tokenStr);
      setUserId(userIdNum);
      setCoupleId(coupleIdNum);
      setCoupleCode(codeStr);

      if (tokenStr && (!userIdNum || (!coupleIdNum && !codeStr))) {
        try {
          const raw = await authedFetch('/user/getuser', { method: 'GET' });
          console.log('[getuser] raw:', raw);

          const { userId: uid, coupleId: cid, coupleCode: ccode } = normalizeGetUser(raw);
          const kv: [string, string][] = [];

          if (uid != null && uid !== userIdNum) {
            setUserId(uid);
            kv.push(['userId', String(uid)]);
          }
          if (cid != null && cid !== coupleIdNum) {
            setCoupleId(cid);
            kv.push(['coupleId', String(cid)]);
          }
          if (ccode && ccode !== codeStr) {
            setCoupleCode(ccode);
            kv.push(['coupleCode', ccode]);
          }
          if (kv.length) await AsyncStorage.multiSet(kv);

          console.log('[getuser] normalized:', { uid, cid, ccode });
        } catch (e: any) {
          console.warn('[getuser] failed:', e?.message);
        }
      }

      setTimeout(async () => {
        const after = Object.fromEntries(await AsyncStorage.multiGet(['token','userId','coupleId','coupleCode']));
        console.log('[chat final]', {
          token: !!after.token,
          userId: after.userId ?? null,
          coupleId: after.coupleId ?? null,
          coupleCode: after.coupleCode ?? null,
        });
      }, 300);
    })();
  }, []);

  const ROOM_KEY: string | null = (coupleId != null ? String(coupleId) : null);

  const SEND_URL = useMemo(
    () => (ROOM_KEY ? `${BASE_URL}/chat/${encodeURIComponent(ROOM_KEY)}` : null),
    [ROOM_KEY]
  );

  // 키보드
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: KeyboardEvent) => {
      const h = (e as any)?.endCoordinates?.height ?? 0;
      if (Platform.OS === 'android') setKeyboardHeight(h);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    };
    const onHide = () => setKeyboardHeight(0);
    const s1 = Keyboard.addListener(show, onShow);
    const s2 = Keyboard.addListener(hide, onHide);
    return () => { s1.remove(); s2.remove(); };
  }, []);

  // 갤러리
  const pickFromGallery = useCallback(async () => {
    try {
      setAttaching(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('권한 필요', '앨범 접근 권한이 필요합니다.');
        return;
      }
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.9,
      });
      if (r.canceled) return;
      const a = r.assets?.[0];
      if (!a?.uri) return;

      const mime = a.mimeType ?? 'image/jpeg';
      if (!ALLOWED_MIME.includes(mime)) {
        Alert.alert('형식 오류', '이미지는 JPEG 형식만 지원해요.');
        return;
      }
      const size = a.fileSize ?? null;
      if (size != null && size > MAX_FILE_SIZE) {
        Alert.alert('용량 초과', `파일 크기 제한은 ${(MAX_FILE_SIZE / (1024*1024)).toFixed(1)}MB 입니다.`);
        return;
      }
      setPendingImage(a.uri);
    } finally {
      setAttaching(false);
    }
  }, []);

  const appendLocal = useCallback((m: ChatMessage) => {
    setMessages(prev => {
      if (prev.find(x => x.id === m.id)) return prev;
      if (m.clientMsgId && prev.find(x => x.clientMsgId === m.clientMsgId)) return prev;
      const next = [...prev, m];
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      return next;
    });
  }, []);

  const onIncoming = useCallback((p: ChatIncoming) => {
    setMessages(prev => {
      if (p.id != null && prev.some(x => String(x.id) === String(p.id))) return prev;

      if (p.clientMsgId) {
        const ix = prev.findIndex(x => x.clientMsgId === p.clientMsgId);
        if (ix >= 0) {
          const updated = [...prev];
          const cur = updated[ix];
          updated[ix] = {
            ...cur,
            id: String(p.id ?? cur.id),
            status: 'sent',
            createdAt: p.createdAt ?? cur.createdAt,
            imageUrl: p.imageUrl ?? cur.imageUrl,
            imageUri: p.imageUrl ?? cur.imageUri,
          };
          return updated;
        }
      }

      const isMine = String(p.senderId) === String(userId ?? '');
      if (isMine) {
        const revIdx = [...prev].reverse().findIndex(m =>
          m.mine && m.status === 'sending' &&
          isSameContent(m, p) &&
          Math.abs(m.createdAt - (p.createdAt ?? m.createdAt)) < 3000
        );
        if (revIdx !== -1) {
          const realIdx = prev.length - 1 - revIdx;
          const updated = [...prev];
          const cur = updated[realIdx];
          updated[realIdx] = {
            ...cur,
            id: String(p.id ?? cur.id),
            status: 'sent',
            createdAt: p.createdAt ?? cur.createdAt,
            imageUrl: p.imageUrl ?? cur.imageUrl,
            imageUri: p.imageUrl ?? cur.imageUri,
          };
          return updated;
        }
      }

      const add: ChatMessage = {
        id: String(p.id ?? `${Date.now()}`),
        text: p.message ?? undefined,
        imageUrl: p.imageUrl ?? undefined,
        imageUri: p.imageUrl ?? undefined,
        mine: isMine,
        createdAt: p.createdAt ?? Date.now(),
        type: p.imageUrl ? 'image' : 'text',
        status: 'sent',
      };
      if (prev.some(x => x.id === add.id)) return prev;
      return [...prev, add];
    });
  }, [userId]);

  // STOMP 연결
  useEffect(() => {
    if (!USE_STOMP) return;
    if (!token || !ROOM_KEY || !userId) {
      console.log('[stomp guard]', { hasToken: !!token, ROOM_KEY, userId });
      return;
    }

    console.log('[stomp connect]', { ROOM_KEY, userId });
    const chat = createChatClient({
      wsUrl: WS_URL,
      token,
      roomId: ROOM_KEY,
      handlers: {
        onMessage: onIncoming,
        onReadUpdate: (_u: ChatReadUpdate) => {},
        onConnected: () => {
          chatRef.current?.markAsRead(ROOM_KEY, userId, latestVisibleMsgId.current ?? undefined);
        },
        onError: (e: unknown) => console.warn('[STOMP ERROR]', e),
      },
      connectTimeoutMs: 6000,
    });

    chatRef.current = chat;
    chat.activate();

    return () => {
      chat.deactivate();
      chatRef.current = null;
    };
  }, [token, ROOM_KEY, userId, onIncoming]);

  // 오늘의 미션 상태 가져오기 (블러/미션 말풍선 용)
  useEffect(() => {
    if (!token || !userId) return;
    (async () => {
      try {
        // (useEffect 내부 try 블록 맨 위 근처에 추가)
        const pickUrl = (p: any): string | null => {
          if (!p) return null;
          // 평평한 구조
          if (typeof p.photoUrl === 'string') return p.photoUrl;
          if (typeof p.imageUrl === 'string') return p.imageUrl;
          if (typeof p.fileUrl  === 'string') return p.fileUrl;
          if (typeof p.url      === 'string') return p.url;

          // 중첩 객체(photo/file/image ...)
          const cand =
            p.photo?.presignedUrl ?? p.photo?.url ?? p.photo?.imageUrl ??
            p.file?.presignedUrl  ?? p.file?.url  ?? p.file?.imageUrl ??
            p.image?.presignedUrl ?? p.image?.url ?? p.image?.imageUrl;

          return typeof cand === 'string' ? cand : null;
        };

        const raw = await authedFetch('/api/couples/missions/today', { method: 'GET' });
        if (!Array.isArray(raw) || raw.length === 0) {
          setMissionState(null);
          return;
        }
        // 가장 의미있는 항목(사진/상태 포함) 우선
        const m = raw.find((x: any) => Array.isArray(x?.progresses)) ?? raw[0];
        const progresses = Array.isArray(m.progresses) ? m.progresses : [];
        const me = progresses.find((p: any) => String(p.userId) === String(userId));
        const partner = progresses.find((p: any) => String(p.userId) !== String(userId));

        const missionText = m.description || m.title || '';
        const missionId = m.missionId ?? m.id ?? 0;
        const myStatus = me?.status ?? 'NOT_DONE';
        const partnerStatus = partner?.status ?? 'NOT_DONE';
        const myPhotoUrlRaw = me?.photoUrl ?? null;
        const partnerPhotoUrlRaw = partner?.photoUrl ?? null;

        // presign
        const [myPhotoUrl, partnerPhotoUrl] = await Promise.all([
          presignIfNeeded(myPhotoUrlRaw),
          presignIfNeeded(partnerPhotoUrlRaw),
        ]);

        // 기존 parseTS 대신
        const parseTS = (s?: string) => parseTSLocal(s);

        // missionDateTs도 로컬로
        let missionDateTs = Date.now();
        if (m.missionDate) {
          const ts = parseTSLocal(m.missionDate);
          if (ts != null) missionDateTs = ts;
        }

        setMissionState({
          missionId,
          text: missionText,
          myStatus,
          partnerStatus,
          myPhotoUrl,
          partnerPhotoUrl,
          missionDateTs,
          // 완료/갱신 시각도 date-only 가능성 → 로컬 파싱
          myCompletedTs:       parseTSLocal(me?.completedAt)       ?? parseTSLocal(me?.updatedAt)       ?? missionDateTs,
          partnerCompletedTs:  parseTSLocal(partner?.completedAt)  ?? parseTSLocal(partner?.updatedAt)  ?? missionDateTs,
        });

        console.log('[mission today raw]', raw);
        console.log('[mission today userId]', userId);
        console.log('[mission progresses]', JSON.stringify(progresses, null, 2));
        console.log('[mission me/partner]', me, partner, { myPhotoUrl, partnerPhotoUrl });
      } catch (e: any) {
        console.warn('[mission today] failed:', e?.message);
        setMissionState(null);
      }
    })();
  }, [token, userId]);

  // ✅ share에서 막 넘어온 미션을 낙관적으로 즉시 붙이기
  const appendedOnceRef = useRef(false);
  useEffect(() => {
    if (appendedOnceRef.current) return;
    if (!justCompletedMissionId) return;

    const now = Date.now();
    const missionText = (justCompletedMissionText || '').trim();
    const img = (justCompletedPhotoUrl || '').trim() || undefined;

    const optimistic: ChatMessage = {
      id: `mission_me_opt_${justCompletedMissionId}_${now}`,
      text: missionText || '오늘의 미션',
      imageUri: img,
      imageUrl: img,
      mine: true,
      createdAt: now, // ✅ 지금 시간
      type: 'mission',
      status: 'sent',
      clientMsgId: null,
      missionMeta: { missionId: Number(justCompletedMissionId), owner: 'me', shouldBlur: false },
    };
    appendLocal(optimistic);
    appendedOnceRef.current = true;

    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [justCompletedMissionId, justCompletedMissionText, justCompletedPhotoUrl, appendLocal]);

  // 재전송
  const resendMessage = useCallback(async (msgId: string) => {
    if (!ROOM_KEY || !userId) return;
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status:'sending' } : m));
    try {
      const clientMsgId = msg.clientMsgId ?? uuid4();
      chatRef.current?.sendMessage(ROOM_KEY, userId, {
        message: msg.text ?? null,
        imageUrl: msg.imageUrl ?? null,
        clientMsgId,
        createdAt: msg.createdAt,
      });
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, clientMsgId } : m));
    } catch {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status:'failed' } : m));
      Alert.alert('전송 실패','재전송에 실패했어요.');
    }
  }, [ROOM_KEY, userId, messages]);

  // 일반 전송
  const sendMessage = useCallback(async () => {
    if (!ROOM_KEY || !userId) {
      Alert.alert('안내', '커플 정보가 아직 준비되지 않았어요.');
      return;
    }
    if (sending) return;

    const trimmed = text.trim();
    const hasText = trimmed.length > 0;
    const hasImage = !!pendingImage;
    if (!hasText && !hasImage) {
      Alert.alert('안내', '보낼 내용이 없어요.');
      return;
    }
    if (trimmed.length > MAX_TEXT_LEN) {
      Alert.alert('글자 수 초과', `메시지는 최대 ${MAX_TEXT_LEN}자까지 보낼 수 있어요.`);
      return;
    }

    setSending(true);

    const clientMsgId = uuid4();
    const tempId = `local_${clientMsgId}`;
    const createdAt = Date.now();

    const optimistic: ChatMessage = {
      id: tempId,
      text: hasText ? trimmed : undefined,
      imageUri: hasImage ? pendingImage! : undefined,
      mine: true,
      createdAt,
      type: hasImage ? 'image' : 'text',
      status: USE_STOMP ? 'sending' : 'sent',
      clientMsgId,
    };
    appendLocal(optimistic);
    setText('');
    const localImageUri = pendingImage;
    setPendingImage(null);

    try {
      let imageUrlToSend: string | null = null;

      if (hasImage && USE_REST_UPLOAD) {
        if (!SEND_URL) throw new Error('SEND_URL not ready');
        const form = new FormData();
        form.append('file', { uri: localImageUri!, name: `img_${Date.now()}.jpg`, type: 'image/jpeg' } as any);
        const res = await fetch(SEND_URL, {
          method: 'POST',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            Accept: 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          body: form,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        imageUrlToSend = json?.imageUrl ?? null;
      }

      if (USE_STOMP) {
        chatRef.current?.sendMessage(ROOM_KEY, userId, {
          message: hasText ? trimmed : null,
          imageUrl: hasImage ? (imageUrlToSend ?? null) : null,
          clientMsgId,
          createdAt,
        });
      } else {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
      }
    } catch (e) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status:'failed' } : m));
      Alert.alert('전송 실패','메시지 전송 중 오류가 발생했어요.');
    } finally {
      setSending(false);
    }
  }, [text, pendingImage, sending, appendLocal, ROOM_KEY, userId, token, SEND_URL]);

  // 날짜 마커 + 미션 말풍선 합성
  const listData = useMemo<(ChatMessage | DateMarker)[]>(() => {
  // 1) 채팅 메시지를 시간순 정렬
  const baseMsgs = [...messages].sort((a, b) => a.createdAt - b.createdAt);

  // 2) 미션을 ChatMessage로 변환 (시간은 상태에 고정된 completedTs 사용)
  const missionMsgs: ChatMessage[] = [];
    if (missionState) {
      const {
        missionId, text, myStatus, partnerStatus,
        myPhotoUrl, partnerPhotoUrl, myCompletedTs, partnerCompletedTs,
      } = missionState;

      const isDone = (s?: string | null) => s && !String(s).toUpperCase().includes('NOT') && String(s).toUpperCase().includes('DONE');

      if (partnerPhotoUrl || isDone(partnerStatus)) {
        missionMsgs.push({
          id: `mission_partner_${missionId}`,
          text,
          imageUrl: partnerPhotoUrl ?? undefined,
          imageUri: partnerPhotoUrl ?? undefined,
          mine: false,
          createdAt: partnerCompletedTs ?? missionState.missionDateTs, // ✅ 고정된 시간
          type: 'mission',
          status: 'sent',
          clientMsgId: null,
          // missionMeta: {
          //   missionId,
          //   owner: 'partner',
          //   // shouldBlur: isDone(partnerStatus) && !isDone(myStatus),
          // },
        });
      }

      if (myPhotoUrl || isDone(myStatus)) {
        missionMsgs.push({
          id: `mission_me_${missionId}`,
          text,
          imageUrl: myPhotoUrl ?? undefined,
          imageUri: myPhotoUrl ?? undefined,
          mine: true,
          createdAt: myCompletedTs ?? missionState.missionDateTs, // ✅ 고정된 시간
          type: 'mission',
          status: 'sent',
          clientMsgId: null,
          missionMeta: {
            missionId,
            owner: 'me',
            shouldBlur: false,
          },
        });
      }
    }

    // 3) 채팅 + 미션을 합쳐서 createdAt 기준 정렬
    const merged = [...baseMsgs, ...missionMsgs].sort((a, b) => a.createdAt - b.createdAt);

    // 4) 날짜 마커 삽입
    const out: (ChatMessage | DateMarker)[] = [];
    let lastTs: number | null = null;
    for (const m of merged) {
      if (lastTs == null || !sameYMD(lastTs, m.createdAt)) {
        out.push({ __type: 'date', key: `date_${m.createdAt}`, ts: m.createdAt });
      }
      out.push(m);
      lastTs = m.createdAt;
    }
    return out;
  }, [messages, missionState]);

  const shouldShowTime = useCallback((idx: number) => {
    const cur = listData[idx] as ChatMessage;
    if ((cur as any).__type === 'date') return false;
    let j = idx + 1;
    while (j < listData.length && (listData[j] as any).__type === 'date') j++;
    const next = j < listData.length ? (listData[j] as ChatMessage) : null;
    if (!next) return true;
    return !(next.mine === cur.mine && sameMinute(next.createdAt, cur.createdAt));
  }, [listData]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
    if (!viewableItems?.length) return;
    const visibleMsg = viewableItems
      .map(v => v.item)
      .filter((it: ChatMessage | DateMarker) => (it as DateMarker).__type !== 'date') as ChatMessage[];

    if (!visibleMsg.length) return;
    const last = visibleMsg[visibleMsg.length - 1];
    if (last?.id && last.id !== latestVisibleMsgId.current) {
      latestVisibleMsgId.current = last.id;
      if (ROOM_KEY && userId) {
        chatRef.current?.markAsRead(ROOM_KEY, userId, last.id);
      }
    }
  }).current;

  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage | DateMarker; index: number }) => {
      if ((item as DateMarker).__type === 'date') {
        const mark = item as DateMarker;
        return (
          <View style={styles.dateWrap}>
            <AppText style={styles.dateText}>{formatDate(mark.ts)}</AppText>
          </View>
        );
      }
      const m = item as ChatMessage;
      const mine = m.mine;
      const showTime = shouldShowTime(index);
      const isMission = m.type === 'mission';
      const blurAmount = m.missionMeta?.shouldBlur ? 18 : 0;

      const bubbleStyle = isMission
        ? (mine ? styles.bubbleMissionMine : styles.bubbleMissionOther)
        : (mine ? styles.bubbleMine : styles.bubbleOther);

      return (
        <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
          <View style={styles.msgCol}>
            <View style={[styles.bubble, bubbleStyle]}>
              {isMission && (
                <AppText style={styles.missionLabel}>오늘의 미션</AppText>
              )}

              {(m.imageUrl || m.imageUri)  ? (
                <Image
                  source={{ uri: m.imageUrl || m.imageUri! }}
                  style={{
                    width: STICKER_SIZE,
                    height: STICKER_SIZE,
                    borderRadius: 16,
                    marginBottom: m.text ? 6 : 0,
                  }}
                  resizeMode="cover"
                  blurRadius={blurAmount}
                />
              ) : null}

              {m.text ? (
                <AppText
                  style={[
                    styles.msgText,
                    mine ? styles.msgTextMine : styles.msgTextOther,
                  ]}
                >
                  {m.text}
                </AppText>
              ) : null}
            </View>
            {showTime && (
              <AppText style={styles.timeTextLeft}>{formatTime(m.createdAt)}</AppText>
            )}
          </View>

          <View style={styles.metaWrapRight}>
            {m.status === 'failed' ? (
              <Pressable style={styles.retryBtn} onPress={() => resendMessage(m.id)}>
                <Ionicons name="refresh" size={14} color="#FF4D4F" />
              </Pressable>
            ) : m.status === 'sending' ? (
              <Ionicons name="time-outline" size={12} color="#999" />
            ) : null}
          </View>
        </View>
      );
    },
    [shouldShowTime, resendMessage]
  );

  const keyExtractor = useCallback((item: ChatMessage | DateMarker, idx: number) => {
    if ((item as DateMarker).__type === 'date') return (item as DateMarker).key;
    return (item as ChatMessage).id ?? String(idx);
  }, []);

  const inputExtra = Platform.OS === 'android' ? keyboardHeight : 0;
  const listBottomPadding = inputExtra + inputBarHeight + 12 + insets.bottom;

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + HEADER_HEIGHT : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable style={{ paddingHorizontal: 8 }} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#111" />
        </Pressable>
        <AppText style={styles.headerTitle}>애인</AppText>
        <Pressable style={{ paddingHorizontal: 8 }} onPress={pickFromGallery} disabled={attaching}>
          <Ionicons name="camera-outline" size={22} color="#111" />
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: listBottomPadding }}
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
      />

      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={accessoryID}>
          <View
            style={[styles.inputBar, { paddingBottom: 8 + insets.bottom }]}
            onLayout={(e) => setInputBarHeight(e.nativeEvent.layout.height)}
          >
            {pendingImage ? (
              <Image source={{ uri: pendingImage }} style={{ width: 36, height: 36, borderRadius: 8, marginRight: 8 }} />
            ) : null}
            <TextInput
              style={styles.input}
              placeholder="대화를 입력하세요"
              value={text}
              onChangeText={(t) => t.length <= MAX_TEXT_LEN && setText(t)}
              multiline
              inputAccessoryViewID={accessoryID}
            />
            <Pressable style={[styles.sendBtn, sending && { opacity: 0.6 }]} onPress={sendMessage} disabled={sending}>
              <Ionicons name="arrow-up" size={22} color="#fff" />
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : (
        <View
          style={[
            styles.inputBar,
            { position: 'absolute', left: 0, right: 0, bottom: 8 + insets.bottom + keyboardHeight },
          ]}
          onLayout={(e) => setInputBarHeight(e.nativeEvent.layout.height)}
        >
          {pendingImage ? (
            <Image source={{ uri: pendingImage }} style={{ width: 36, height: 36, borderRadius: 8, marginRight: 8 }} />
          ) : null}
          <TextInput
            style={styles.input}
            placeholder="대화를 입력하세요"
            value={text}
            onChangeText={(t) => t.length <= MAX_TEXT_LEN && setText(t)}
            multiline
          />
          <Pressable style={[styles.sendBtn, sending && { opacity: 0.6 }]} onPress={sendMessage} disabled={sending}>
            <Ionicons name="arrow-up" size={22} color="#fff" />
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#FFFCF5' },

  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#111' },

  row: {
    width: '100%',
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },

  msgCol: { maxWidth: '80%' },

  bubble: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16 },
  bubbleMine: { backgroundColor: '#6198FF' },
  bubbleOther: { backgroundColor: '#fff', borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },

  // 미션 전용 말풍선 색상(요청 반영)
  bubbleMissionMine: { backgroundColor: '#6198FF' },
  bubbleMissionOther: {
    backgroundColor: '#FFE8D2',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F7CBA7',
  },
  missionLabel: {
    fontSize: 11,
    color: '#7A4E2A',
    marginBottom: 4,
  },

  msgText: { fontSize: 14, lineHeight: 20 },
  msgTextMine: { color: '#fff' },
  msgTextOther: { color: '#111' },

  timeTextLeft: { marginTop: 4, fontSize: 10, color: '#888', alignSelf: 'flex-start', marginLeft: 6 },

  metaWrapRight: { marginLeft: 6, alignItems: 'center', justifyContent: 'flex-end' },
  retryBtn: {
    padding: 2,
    borderRadius: 10,
    backgroundColor: '#FFF2F2',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFD6D6',
  },

  dateWrap: { alignItems: 'center', marginVertical: 6 },
  dateText: {
    fontSize: 12,
    color: '#888',
    backgroundColor: '#EDEDED',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    gap: 8,
    backgroundColor: 'transparent',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    color: '#111',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FF9191',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, elevation: 3,
  },
});
