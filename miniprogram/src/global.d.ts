/// <reference types="@tarojs/taro" />

interface WechatCloudCallResult {
  result?: unknown
  statusCode?: number
  fileID?: string
}

interface WechatCloud {
  init(options: { env: string; traceUser?: boolean }): void
  callFunction(options: {
    name: string
    data: Record<string, unknown>
    success?: (result: WechatCloudCallResult) => void
    fail?: (error: unknown) => void
  }): void
  uploadFile(options: {
    cloudPath: string
    filePath: string
    success?: (result: WechatCloudCallResult) => void
    fail?: (error: unknown) => void
  }): void
}

declare const wx: {
  cloud: WechatCloud
}

declare module '*.png'
declare module '*.gif'
declare module '*.jpg'
declare module '*.jpeg'
declare module '*.svg'
declare module '*.scss' {
  const content: { [className: string]: string }
  export default content
}
declare module '*.css'
declare module '*.less'
declare module '*.sass'
