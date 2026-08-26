import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Icon from '../Icon'
import './index.scss'

type NavKey = 'home' | 'studio' | 'my'

const ITEMS: Array<{ key: NavKey; label: string; icon: 'compass' | 'mic' | 'user'; path: string }> = [
  { key: 'home', label: '首页', icon: 'compass', path: '/pages/home/index' },
  { key: 'studio', label: '录音室', icon: 'mic', path: '/pages/studio/index' },
  { key: 'my', label: '我的', icon: 'user', path: '/pages/my/index' },
]

export default function BottomNav({ active }: { active?: NavKey }) {
  // 全站统一用自绘 BottomNav（原生 tabBar 已移除），主 tab 切换语义用 reLaunch：
  // 关闭所有页面栈并以目标页为根重新打开，等同于原生 tab 切换。
  const handleSwitch = (item: typeof ITEMS[number]) => {
    if (item.key !== active) Taro.reLaunch({ url: item.path })
  }

  return (
    <View className='bottom-nav'>
      {ITEMS.map(item => (
        <View
          key={item.key}
          className={`bottom-nav__item ${active === item.key ? 'bottom-nav__item--active' : ''}`}
          onClick={() => handleSwitch(item)}
        >
          <Icon name={item.icon} size={60} color={active === item.key ? '#18181b' : '#a1a1aa'} />
          <Text className='bottom-nav__label'>{item.label}</Text>
        </View>
      ))}
    </View>
  )
}
