import { useEffect } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useStore } from '../../store'
import Icon from '../../components/Icon'
import SafeImage from '../../components/SafeImage'
import NavBar from '../../components/NavBar'
import BottomNav from '../../components/BottomNav'
import './index.scss'

export default function Home() {
  const { state, refreshDb } = useStore()
  const { db, loading } = state

  useDidShow(() => {
    refreshDb()
  })

  // 首页转发 / 朋友圈分享
  useShareAppMessage(() => ({
    title: '耳畔童话 · 为孩子定制专属声画有声绘本',
    path: '/pages/home/index',
    imageUrl: '',
  }))

  useShareTimeline(() => ({
    title: '耳畔童话 · 为孩子定制专属声画有声绘本',
    query: '',
    imageUrl: '',
  }))

  const goWizard = () => Taro.navigateTo({ url: '/pages/wizard/index' })
  const goDiary = () => Taro.navigateTo({ url: '/pages/diary/index' })
  const goTemplate = () => Taro.navigateTo({ url: '/pages/template/index' })
  const goMy = () => Taro.reLaunch({ url: '/pages/my/index' })
  const goNotification = () => Taro.navigateTo({ url: '/pages/notification/index' })

  const playStory = (story: any) => {
    Taro.setStorageSync('bm_active_story', story)
    Taro.navigateTo({ url: '/pages/story-player/index' })
  }

  const applyTemplate = (tpl: any) => {
    Taro.setStorageSync('bm_apply_template', tpl)
    Taro.navigateTo({ url: '/pages/wizard/index' })
  }

  const latestStory = db?.userStories?.[0]
  const latestNotification = db?.notifications?.find(notification => notification.type === 'story') || db?.notifications?.[0]

  // 注意：不要在此处用“加载态骨架屏 early-return”返回与正常树不同的根节点。
  // Taro 4.x 里页面首屏 render 若先返回 skeleton、数据到达后再返回完整树，
  // 会导致页面 loader 的 waiting 状态机在第二次渲染时再次 setWaiting，
  // 真机抛 “LifeCycle.load fail: Cannot set a non-pending waiting value”。
  // 首页字段均用 db?. 可选链兜底，直接渲染完整结构即可（加载中显示占位文案）。

  return (
    <View className='home'>
      <NavBar title='耳畔童话' showBack={false} />
      {/* ===== 欢迎卡片 ===== */}
      <View className='home__welcome'>
        <View className='home__welcome-overlay' />
        <View className='home__welcome-content'>
          <View className='home__welcome-header'>
            <View className='home__welcome-text'>
              <Text className='home__welcome-greeting'>
                下午好，{db?.profile?.parentName || '淘淘妈妈'}
              </Text>
              <Text className='home__welcome-sub'>
                为孩子定制专属的声画有声绘本吧
              </Text>
            </View>
          </View>

          {/* 额度栏 */}
          <View className='home__quota'>
            <View className='home__quota-items'>
              <View className='home__quota-item'>
                <Text className='home__quota-label'>故事额度：</Text>
                <Text className='home__quota-value'>
                  {db?.rights?.isVip ? '无限' : `${db?.rights?.storyGenerationsRemaining ?? 0} 次`}
                </Text>
              </View>
              <View className='home__quota-item'>
                <Text className='home__quota-label'>克隆次数：</Text>
                <Text className='home__quota-value'>{db?.rights?.freeVoiceClonesRemaining ?? 0} 次</Text>
              </View>
            </View>
            <View className='home__quota-btn' onClick={goMy}>
              <Text className='home__quota-btn-text'>充值/兑换</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ===== 首页最新消息 ===== */}
      <View className='home__notification' onClick={goNotification}>
        <View className='home__notification-dot' />
        <Icon name='bell' size={28} color='#f97316' />
        <Text className='home__notification-label'>最新消息：</Text>
        <Text className='home__notification-content'>
          {latestNotification?.title || '专属有声故事《神奇冒险》已准备好，快去查看吧'}
        </Text>
        <View className='home__notification-btn'>
          <Text className='home__notification-btn-text'>去查看</Text>
        </View>
      </View>

      {/* ===== 功能入口 ===== */}
      <View className='home__actions'>
        <View className='home__action-card' onClick={goWizard}>
          <View className='home__action-icon'>
            <Icon name='sparkles' size={40} color='#f59e0b' />
          </View>
          <View className='home__action-body'>
            <Text className='home__action-title'>AI 自由定制</Text>
            <Text className='home__action-desc'>自主编辑主角、场景与教育目标</Text>
          </View>
        </View>

        <View className='home__action-card' onClick={goDiary}>
          <View className='home__action-icon'>
            <Icon name='book-open' size={40} color='#4f73e6' />
          </View>
          <View className='home__action-body'>
            <Text className='home__action-title'>故事日记本</Text>
            <Text className='home__action-desc'>查看所有保存的童话绘本</Text>
          </View>
        </View>
      </View>

      {/* ===== 最近播放 ===== */}
      {latestStory && (
        <View className='home__recent'>
          <View className='home__recent-left'>
            <View className='home__recent-cover'>
              <SafeImage
                src={latestStory.coverUrl}
                className='home__recent-img'
                mode='aspectFill'
                placeholder={<Icon name='book-open' size={40} color='#9ca3af' />}
                placeholderClassName='home__recent-placeholder'
              />
            </View>
            <View className='home__recent-info'>
              <View className='home__recent-label icon-inline'>最近播放 <Icon name='volume' size={24} color='#18181b' /></View>
              <Text className='home__recent-title'>{latestStory.title}</Text>
            </View>
          </View>
          <View className='home__recent-play' onClick={() => playStory(latestStory)}>
            <View className='home__recent-play-icon' />
          </View>
        </View>
      )}

      {/* ===== 推荐模板 ===== */}
      <View className='home__templates'>
        <View className='home__templates-header'>
          <View className='home__templates-title'>
            <Icon name='sparkles' size={24} color='#f59e0b' />
            <Text>耳畔推荐绘本模板</Text>
          </View>
          <View className='home__templates-more' onClick={goTemplate}>
            <Text className='home__templates-more-text'>查看全部</Text>
            <Text className='home__templates-more-arrow'>›</Text>
          </View>
        </View>

        <View className='home__templates-list'>
          {(db?.templates || []).slice(0, 4).map(tpl => (
            <View key={tpl.id} className='home__tpl-card'>
              <View className='home__tpl-cover'>
                <SafeImage
                  src={tpl.cover}
                  className='home__tpl-img'
                  mode='aspectFill'
                  placeholder={<Icon name='book-open' size={48} color='#9ca3af' />}
                  placeholderClassName='home__tpl-placeholder'
                />
              </View>
              <View className='home__tpl-body'>
                <View className='home__tpl-top'>
                  <View className='home__tpl-name-row'>
                    <Text className='home__tpl-name'>{tpl.name}</Text>
                    <View className='home__tpl-age'>
                      <Text className='home__tpl-age-text'>{tpl.ageGroup}</Text>
                    </View>
                  </View>
                  <Text className='home__tpl-desc'>{tpl.description}</Text>
                </View>
                <View className='home__tpl-bottom'>
                  <View className='home__tpl-count'>
                    <Icon name='headphones' size={18} color='#a1a1aa' />
                    <Text>{tpl.useCount} 位宝贝已听</Text>
                  </View>
                  <View className='home__tpl-use' onClick={() => applyTemplate(tpl)}>
                    <Text className='home__tpl-use-text'>套用模板 ›</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ===== 邀请推广 ===== */}
      <View className='home__invite' onClick={goMy}>
        <View className='home__invite-left'>
          <View className='home__invite-icon'><Icon name='gift' size={40} /></View>
          <View className='home__invite-text'>
            <Text className='home__invite-title'>分享邀请有礼</Text>
            <Text className='home__invite-desc'>新老用户双方均可得 2 次故事生成福利</Text>
          </View>
        </View>
        <Text className='home__invite-arrow'>›</Text>
      </View>

      <BottomNav active='home' />
    </View>
  )
}
