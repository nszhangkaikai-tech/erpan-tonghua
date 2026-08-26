import Taro from '@tarojs/taro'
import request from './request'

// ========================
// 主题/场景单一数据源配置（方案 B）
// 前后端统一从云函数 getStoryConfig 读取 storyConfig 文档。
// 本工具负责：拉取 + 5 分钟 TTL 本地缓存 + 并发去重，避免重复请求与抖动。
// ========================

export interface ThemeCategory {
  key: string
  name: string
  sortOrder?: number
}

export interface ThemeItem {
  key: string
  category: string
  mood?: string
  palette?: string
  arc?: string
  educationalGoals?: string[]
  sortOrder?: number
  enabled?: boolean
}

export interface SceneItem {
  key: string
  setting?: string
  details?: string
  sortOrder?: number
  enabled?: boolean
}

export interface StoryConfig {
  categories: ThemeCategory[]
  themes: ThemeItem[]
  scenes: SceneItem[]
  version?: number
  updatedAt?: string | null
}

const CACHE_KEY = 'bm_story_config'
const TTL = 5 * 60 * 1000 // 5 分钟

// 模块级内存中请求去重（并发请求复用同一个 Promise）
let inflight: Promise<StoryConfig> | null = null

function normalize(data: any): StoryConfig {
  return {
    categories: Array.isArray(data?.categories) ? data.categories : [],
    themes: Array.isArray(data?.themes) ? data.themes : [],
    scenes: Array.isArray(data?.scenes) ? data.scenes : [],
    version: data?.version,
    updatedAt: data?.updatedAt ?? null,
  }
}

/**
 * 拉取主题配置（单一数据源）。
 * - 命中本地 TTL 缓存则直接返回（不请求网络）。
 * - 缓存未命中或 force=true 时请求云函数，并写回缓存。
 * - 多个并发调用共享同一个请求（inflight 去重）。
 */
export async function fetchStoryConfig(force = false): Promise<StoryConfig> {
  // 1. 本地缓存命中
  if (!force) {
    try {
      const cached = Taro.getStorageSync(CACHE_KEY)
      if (cached?.data && cached.ts && Date.now() - cached.ts < TTL) {
        return cached.data as StoryConfig
      }
    } catch {
      // ignore storage error
    }
  }

  // 2. 并发去重
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const data = await request<StoryConfig>({ url: '/api/story/config' })
      const result = normalize(data)
      try {
        Taro.setStorageSync(CACHE_KEY, { data: result, ts: Date.now() })
      } catch {
        // ignore storage error
      }
      return result
    } finally {
      inflight = null
    }
  })()

  return inflight
}

/** 失效本地缓存（管理后台改完配置、或前端需要强刷时调用） */
export function invalidateStoryConfig() {
  try {
    Taro.removeStorageSync(CACHE_KEY)
  } catch {
    // ignore
  }
}

/** 仅从本地缓存读取（同步，用于首屏即时展示，无数据返回空配置） */
export function getStoryConfigFromCache(): StoryConfig {
  try {
    const cached = Taro.getStorageSync(CACHE_KEY)
    if (cached?.data) return cached.data as StoryConfig
  } catch {
    // ignore
  }
  return { categories: [], themes: [], scenes: [] }
}
