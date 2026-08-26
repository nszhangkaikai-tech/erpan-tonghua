import { PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import { StoreProvider } from './store'
import './app.scss'

const CLOUD_ENV = 'blacke-d7g0wczgza0632d5a'

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    // 初始化微信云开发（CloudBase）。优先使用原生 wx.cloud，避免 Taro 封装兼容问题。
    const cloud = (typeof wx !== 'undefined' && wx.cloud) || Taro.cloud
    if (cloud && cloud.init) {
      cloud.init({ env: CLOUD_ENV, traceUser: true })
    }
    console.log('耳畔童话 App launched.')
  })

  return (
    <StoreProvider>
      {children}
    </StoreProvider>
  )
}

export default App
