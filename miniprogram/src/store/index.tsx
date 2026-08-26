import React, { createContext, useContext, useReducer, useCallback, useRef, ReactNode } from 'react'
import Taro from '@tarojs/taro'
import request from '../utils/request'

// ========================
// 类型定义
// ========================

export interface ChildProfile {
  nickname: string
  age: number
  gender: 'boy' | 'girl' | 'other'
  interests: string[]
  parentName: string
  bedTime: string
}

export interface VoiceClone {
  id: string
  name: string
  isReady: boolean
  usageCount: number
  createTime: string
  recordDuration: number
  sampleUrl?: string
  speakerType: 'father' | 'mother' | 'grandfather' | 'grandmother' | 'custom'
}

export interface StoryTemplate {
  id: string
  name: string
  cover: string
  ageGroup: string
  theme: string
  educationalGoal: string
  scene: string
  mainCharacter: { name: string; role: string; personality: string }
  duration: 'short' | 'medium' | 'long'
  description: string
  isRecommended: boolean
  useCount: number
  visualStyle?: string
  coverPromptSeed?: string
  contentPromptSeed?: string
  chapterBeats?: string[]
}

export interface StoryChapter {
  chapterNumber: number
  title: string
  text: string
  imageUrl: string
  imagePrompt?: string
  audioUrl?: string
}

export interface UserStory {
  id: string
  title: string
  abstract: string
  chapters: StoryChapter[]
  coverUrl: string
  isAudioReady: boolean
  voiceId: string
  voiceMode: 'single' | 'multi' | 'narrator_ai'
  createTime: string
  isSavedToDiary: boolean
  isFavorite: boolean
  theme: string
  educationalGoal: string
  scene: string
  mainCharacterName: string
  duration: string
  targetAge: number
  bgmType?: string
  coverPrompt?: string
  templateId?: string
  visualStyle?: string
}

export interface AppNotification {
  id: string
  title: string
  content: string
  type: 'system' | 'story' | 'voice' | 'card' | 'referral'
  isRead: boolean
  createdAt: string
}

export interface AppUserRights {
  freeVoiceClonesRemaining: number
  storyGenerationsRemaining: number
  isVip: boolean
  vipExpiry?: string
  inviteCode: string
  usedInviteCode?: string
}

export interface DBState {
  profile: ChildProfile | null
  voiceClones: VoiceClone[]
  userStories: UserStory[]
  notifications: AppNotification[]
  rights: AppUserRights
  templates: StoryTemplate[]
  config?: {
    themes?: string[]
    educationalGoals?: Record<string, string[]>
    scenes?: string[]
  }
}

// ========================
// 缓存配置
// ========================

const CACHE_KEY = 'bm_db_cache'
// 缓存有效期（5分钟）— 超过此时间视为 stale
const CACHE_TTL = 5 * 60 * 1000
// stale-while-revalidate：先展示旧缓存，后台静默刷新

// ========================
// Store State & Actions
// ========================

interface StoreState {
  db: DBState | null
  loading: boolean
  isLoggedIn: boolean
  isTourist: boolean
  /** 是否正在后台静默刷新 */
  isRefreshing: boolean
}

type StoreAction =
  | { type: 'SET_DB'; payload: DBState }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_REFRESHING'; payload: boolean }
  | { type: 'SET_LOGGED_IN'; payload: { isLoggedIn: boolean; isTourist?: boolean } }
  | { type: 'UPDATE_PROFILE'; payload: ChildProfile }
  | { type: 'UPDATE_STORIES'; payload: UserStory[] }
  | { type: 'UPDATE_VOICES'; payload: VoiceClone[] }
  | { type: 'UPDATE_RIGHTS'; payload: AppUserRights }
  | { type: 'UPDATE_NOTIFICATIONS'; payload: AppNotification[] }
  | { type: 'LOGOUT' }

const initialState: StoreState = {
  db: null,
  loading: true,
  isLoggedIn: false,
  isTourist: false,
  isRefreshing: false,
}

function storeReducer(state: StoreState, action: StoreAction): StoreState {
  switch (action.type) {
    case 'SET_DB':
      return { ...state, db: action.payload, loading: false, isRefreshing: false }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_REFRESHING':
      return { ...state, isRefreshing: action.payload }
    case 'SET_LOGGED_IN':
      return { ...state, isLoggedIn: action.payload.isLoggedIn, isTourist: action.payload.isTourist ?? false }
    case 'UPDATE_PROFILE':
      return state.db ? { ...state, db: { ...state.db, profile: action.payload } } : state
    case 'UPDATE_STORIES':
      return state.db ? { ...state, db: { ...state.db, userStories: action.payload } } : state
    case 'UPDATE_VOICES':
      return state.db ? { ...state, db: { ...state.db, voiceClones: action.payload } } : state
    case 'UPDATE_RIGHTS':
      return state.db ? { ...state, db: { ...state.db, rights: action.payload } } : state
    case 'UPDATE_NOTIFICATIONS':
      return state.db ? { ...state, db: { ...state.db, notifications: action.payload } } : state
    case 'LOGOUT':
      // 清除缓存
      Taro.removeStorageSync(CACHE_KEY)
      return { ...initialState, loading: false }
    default:
      return state
  }
}

// ========================
// Context
// ========================

interface StoreContextType {
  state: StoreState
  dispatch: React.Dispatch<StoreAction>
  /**
   * 刷新 DB 数据（stale-while-revalidate 模式）
   * @param force 强制刷新（跳过缓存检查）
   */
  refreshDb: (force?: boolean) => Promise<void>
  /** 失效缓存（写操作后调用） */
  invalidateCache: () => void
  unreadCount: number
}

const StoreContext = createContext<StoreContextType | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(storeReducer, initialState)
  // 防止并发刷新
  const refreshLockRef = useRef(false)

  /**
   * 从缓存读取数据（如果有）
   */
  const loadFromCache = useCallback((): DBState | null => {
    try {
      const cached = Taro.getStorageSync(CACHE_KEY)
      if (cached?.data) {
        return cached.data as DBState
      }
    } catch {
      // ignore
    }
    return null
  }, [])

  /**
   * 从服务端获取最新数据
   */
  const fetchFromServer = useCallback(async (): Promise<DBState | null> => {
    try {
      const data = await request<DBState>({ url: '/api/db' })
      // 写入缓存
      Taro.setStorageSync(CACHE_KEY, { data, ts: Date.now() })
      return data
    } catch {
      return null
    }
  }, [])

  /**
   * 刷新 DB 数据
   * - 首次加载（state.db 为空）：先读缓存快速展示，再后台拉取最新
   * - 后续刷新（页面 useDidShow）：直接拉取最新
   * - force=true：跳过缓存，直接拉取
   */
  const refreshDb = useCallback(async (force = false) => {
    // 并发锁：防止多个页面同时触发刷新
    if (refreshLockRef.current) return
    refreshLockRef.current = true

    const hasData = !!state.db

    if (!hasData && !force) {
      // 首次加载：先读缓存快速展示
      const cached = loadFromCache()
      if (cached) {
        dispatch({ type: 'SET_DB', payload: cached })
        // 后台静默刷新
        dispatch({ type: 'SET_REFRESHING', payload: true })
        const fresh = await fetchFromServer()
        if (fresh) {
          dispatch({ type: 'SET_DB', payload: fresh })
        } else {
          dispatch({ type: 'SET_REFRESHING', payload: false })
        }
        refreshLockRef.current = false
        return
      }
    }

    // 直接拉取最新
    if (!hasData) {
      dispatch({ type: 'SET_LOADING', payload: true })
    } else {
      dispatch({ type: 'SET_REFRESHING', payload: true })
    }

    const fresh = await fetchFromServer()
    if (fresh) {
      dispatch({ type: 'SET_DB', payload: fresh })
    } else {
      // 网络失败：尝试读缓存兜底
      const cached = loadFromCache()
      if (cached && !hasData) {
        dispatch({ type: 'SET_DB', payload: cached })
      } else {
        dispatch({ type: 'SET_LOADING', payload: false })
        dispatch({ type: 'SET_REFRESHING', payload: false })
      }
    }

    refreshLockRef.current = false
  }, [state.db, loadFromCache, fetchFromServer])

  /**
   * 失效缓存（写操作后调用，确保下次 refreshDb 拉取最新数据）
   */
  const invalidateCache = useCallback(() => {
    Taro.removeStorageSync(CACHE_KEY)
  }, [])

  const unreadCount = state.db?.notifications?.filter(n => !n.isRead).length ?? 0

  return (
    <StoreContext.Provider value={{ state, dispatch, refreshDb, invalidateCache, unreadCount }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

export default StoreContext
