import Taro from '@tarojs/taro'

/**
 * 统一请求封装（CloudBase 云开发版）
 * -------------------------------------------------------------
 * 内部由 Taro.request（HTTP -> localhost 后端）改为 wx.cloud.callFunction（原生微信云调用）。
 * 所有页面调用 request({ url, method, data }) 的签名保持不变，仅把 URL 映射到
 * 对应的云函数名 + action，因此页面代码基本零改动。
 *
 * 身份不再依赖 token：微信云开发的 wx-server-sdk 在云函数内自动注入可信 openid。
 *
 * ⚠️ 重要：必须使用 wx.cloud（原生）而非 Taro.cloud 调用云函数。
 *   Taro 4.x 的 cloud.callFunction 封装在真机上存在 data 参数丢失 bug
 *   （报 "parameter.data should be object instead of undefined"），
 *   原生 wx.cloud 无此问题。
 */

// 云环境 ID（与 cloudbaserc.json 一致）。如需切换，改这里即可。
const CLOUD_ENV = 'blacke-d7g0wczgza0632d5a'

let cloudInited = false
function ensureCloud() {
  if (cloudInited) return
  // 优先用原生 wx.cloud；降级到 Taro.cloud（仅 init 阶段）
  const cloud = (typeof wx !== 'undefined' && wx.cloud) || Taro.cloud
  if (cloud && cloud.init) {
    cloud.init({ env: CLOUD_ENV, traceUser: true })
    cloudInited = true
  }
}

// ========== URL → 云函数路由 ==========
interface RouteInfo {
  name: string
  action: string
  extra?: Record<string, any>
}

function route(url: string, method: string): RouteInfo {
  // 动态路径：/api/story/audio-status/:jobId
  const audioStatus = url.match(/^\/api\/story\/audio-status\/(.+)$/)
  if (audioStatus) return { name: 'mp-story', action: 'audioStatus', extra: { jobId: audioStatus[1] } }

  // 动态路径：/api/notifications/:id （DELETE）
  const notifDelete = url.match(/^\/api\/notifications\/(.+)$/)
  if (notifDelete && method === 'DELETE') return { name: 'mp-user', action: 'notifDelete', extra: { id: notifDelete[1] } }

  const map: Record<string, { name: string; action: string }> = {
    '/api/auth/wx-login': { name: 'mp-user', action: 'login' },
    '/api/db': { name: 'mp-user', action: 'getUserData' },
    '/api/profile': { name: 'mp-user', action: 'updateProfile' },
    '/api/config': { name: 'mp-user', action: 'updateConfig' },
    '/api/notifications/read-all': { name: 'mp-user', action: 'notifReadAll' },
    '/api/stats/play': { name: 'mp-user', action: 'statsPlay' },

    '/api/voice/clone': { name: 'mp-voice', action: 'clone' },
    '/api/voice/delete': { name: 'mp-voice', action: 'delete' },

    '/api/cdkey/redeem': { name: 'mp-cdkey', action: 'redeem' },
    '/api/referral/bind': { name: 'mp-cdkey', action: 'bind' },

    '/api/story/generate-text': { name: 'mp-story', action: 'generateText' },
    '/api/story/generate-audio': { name: 'mp-story', action: 'generateAudio' },
    // 主题/场景单一数据源配置（方案 B：前后端均从 storyConfig 读取，管理员可统一配置）
    '/api/story/config': { name: 'mp-story', action: 'getStoryConfig' },
    '/api/story/authors': { name: 'mp-story', action: 'getAuthors' },
    '/api/story/bgm-list': { name: 'mp-story', action: 'getBgmList' },
    '/api/story/save-toggle': { name: 'mp-story', action: 'saveToggle' },
    '/api/story/rename': { name: 'mp-story', action: 'rename' },
    '/api/story/delete': { name: 'mp-story', action: 'delete' },

    '/api/admin/login': { name: 'mp-admin', action: 'login' },
    '/api/admin/register': { name: 'mp-admin', action: 'register' },
    '/api/admin/reset': { name: 'mp-admin', action: 'reset' },
    '/api/admin/simulate-api-call': { name: 'mp-admin', action: 'simulate-api-call' },
    '/api/admin/users/profile-update': { name: 'mp-admin', action: 'users/profile-update' },
    '/api/admin/template/add': { name: 'mp-admin', action: 'template/add' },
    '/api/admin/template/delete': { name: 'mp-admin', action: 'template/delete' },
    '/api/admin/template/toggle-recommend': { name: 'mp-admin', action: 'template/toggle-recommend' },
    '/api/admin/author/list': { name: 'mp-admin', action: 'author/list' },
    '/api/admin/author/add': { name: 'mp-admin', action: 'author/add' },
    '/api/admin/author/update': { name: 'mp-admin', action: 'author/update' },
    '/api/admin/author/delete': { name: 'mp-admin', action: 'author/delete' },
    '/api/admin/safety-config/update': { name: 'mp-admin', action: 'safety-config/update' },
    '/api/admin/safety-config/audit-resolve': { name: 'mp-admin', action: 'safety-config/audit-resolve' },
  }

  const hit = map[url]
  if (hit) return hit
  throw new Error('未匹配的接口路径: ' + url)
}

// ========== 核心请求 ==========
export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS'
  data?: Record<string, any> | string | ArrayBuffer
  header?: Record<string, string>
  /** 兼容旧签名，云开发下无意义，保留以不影响调用方 */
  skipAuth?: boolean
  skipRefresh?: boolean
  timeout?: number
}

export interface ApiResponse<T = any> {
  code: number
  message?: string
  data?: T
  [key: string]: any
}

/**
 * 统一请求（云函数调用）。成功返回云函数 result；失败抛出 { statusCode, data }，
 * 与旧版 Taro.request 的错误形态保持一致，页面 catch 逻辑无需改动。
 */
const request = async <T = any>(options: RequestOptions): Promise<T> => {
  ensureCloud()
  const method = options.method || 'GET'
  let info: RouteInfo
  try {
    info = route(options.url, method)
  } catch (e: any) {
    throw { statusCode: 404, message: e.message, data: { error: e.message } }
  }

  const requestData = options.data && typeof options.data === 'object' && !Array.isArray(options.data)
    ? options.data
    : {}
  const payload: Record<string, any> = {
    action: info.action,
    ...(info.extra || {}),
    ...requestData,
  }

  const call = async () => {
    // 使用原生 wx.cloud.callFunction，避免 Taro 封装层在真机上丢失 data 参数
    const res: any = await new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: info.name,
        // Always pass a fresh plain object. CloudBase rejects an omitted or
        // non-object data value before the cloud function is invoked.
        data: { ...payload },
        success: (r: any) => resolve(r),
        fail: (err: any) => reject(err),
      })
    })
    return res
  }

  try {
    const res = await call()
    const result = res && res.result
    if (result && result.error) {
      throw { statusCode: 400, data: { error: result.error } }
    }
    return result as T
  } catch (err: any) {
    // 网络层失败（非业务错误）对 GET 做一次重试
    if (method === 'GET' && err && !err.statusCode) {
      try {
        const res = await call()
        const result = res && res.result
        if (result && result.error) throw { statusCode: 400, data: { error: result.error } }
        return result as T
      } catch (e2) {
        throw normalize(e2)
      }
    }
    throw normalize(err)
  }
}

function normalize(err: any) {
  if (err && (err.statusCode || err.data)) return err
  return { statusCode: -1, message: (err && err.message) || '网络错误', data: { error: (err && err.message) || '网络错误' } }
}

// ========== 统一错误提示 ==========
export function getErrorMessage(err: any, fallback = '操作失败，请重试'): string {
  if (!err) return fallback
  if (typeof err === 'string') return err
  if (err.message) return err.message
  if (err.data?.error) return err.data.error
  if (err.data?.message) return err.data.message
  if (err.statusCode === 401) return '登录已过期'
  if (err.statusCode === 403) return '无权操作'
  if (err.statusCode === 404) return '资源不存在'
  if (err.statusCode === 500) return '服务器开小差了'
  if (err.statusCode === -1) return '网络连接失败，请检查网络'
  return fallback
}

export function showErrorToast(err: any, fallback?: string) {
  Taro.showToast({ title: getErrorMessage(err, fallback), icon: 'none' })
}

/**
 * 文件上传封装（CloudBase 版）：上传到云存储，返回 fileID。
 * 用于录音等二进制资源（替代旧版 Taro.uploadFile 到 localhost）。
 * 注意：云函数通过其自动注入的 openid 判定归属，前端无需知道 openid。
 */
const uploadFile = async (options: {
  cloudPath: string
  filePath: string
}): Promise<{ fileID: string }> => {
  ensureCloud()
  const res: any = await new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath: options.cloudPath,
      filePath: options.filePath,
      success: (r: any) => resolve(r),
      fail: (err: any) => reject(err),
    })
  })
  if (res.statusCode !== 200 && res.statusCode !== undefined && res.statusCode !== 204) {
    throw { statusCode: res.statusCode || -1, message: '上传失败', data: { error: '上传失败' } }
  }
  return { fileID: res.fileID }
}

export const API_BASE = ''
export default request
export { request, uploadFile }
