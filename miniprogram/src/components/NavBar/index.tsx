import type { ReactNode } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Icon from '../Icon'
import './index.scss'

export interface NavAction {
  key: string
  icon: any // IconName
  color?: string
  badge?: number
  onClick: () => void
}

interface NavBarProps {
  title?: string
  showBack?: boolean
  onBack?: () => void
  actions?: NavAction[]
  right?: ReactNode
  backgroundColor?: string
  textColor?: string
  transparent?: boolean
}

// 状态栏高度（px，仅计算一次）。navigationStyle:custom 后页面内容从 y=0 开始，
// 必须预留状态栏高度，否则标题会被时钟/电池遮挡。
let STATUS_BAR_HEIGHT = 20
try {
  const w = (Taro.getWindowInfo ? Taro.getWindowInfo() : (Taro as any).getSystemInfoSync()) as any
  if (w && typeof w.statusBarHeight === 'number') STATUS_BAR_HEIGHT = w.statusBarHeight
} catch (e) {
  // 兜底 20px
}

export default function NavBar({
  title = '',
  showBack = true,
  onBack,
  actions = [],
  right,
  backgroundColor = '#fafafa',
  textColor = '#18181b',
  transparent = false,
}: NavBarProps) {
  const handleBack = () => {
    if (onBack) return onBack()
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) Taro.navigateBack()
    else Taro.reLaunch({ url: '/pages/home/index' })
  }

  return (
    <View
      className={`navbar${transparent ? ' navbar--transparent' : ''}`}
      style={{
        backgroundColor: transparent ? 'transparent' : backgroundColor,
        paddingTop: `${STATUS_BAR_HEIGHT}px`,
      }}
    >
      <View className='navbar__inner' style={{ color: textColor }}>
        <View className='navbar__left'>
          {showBack && (
            <View className='navbar__back' onClick={handleBack}>
              <Icon name='chevron-left' size={36} color={textColor} />
            </View>
          )}
        </View>

        <View className='navbar__title'>{title}</View>

        <View className='navbar__right'>
          {actions.map(a => (
            <View key={a.key} className='navbar__action' onClick={a.onClick}>
              <Icon name={a.icon} size={28} color={a.color || textColor} />
              {a.badge ? (
                <View className='navbar__badge'>
                  <Text className='navbar__badge-text'>{a.badge > 9 ? '9+' : a.badge}</Text>
                </View>
              ) : null}
            </View>
          ))}
          {right}
        </View>
      </View>
    </View>
  )
}
