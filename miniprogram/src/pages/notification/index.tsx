import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useStore } from '../../store'
import request from '../../utils/request'
import Icon from '../../components/Icon'
import BottomNav from '../../components/BottomNav'
import NavBar from '../../components/NavBar'
import './index.scss'

const TYPE_LABELS: Record<string, string> = {
  system: '系统安全',
  story: '绘本创作',
  voice: '声音克隆',
  card: '卡密兑换',
  referral: '邀请奖励',
}

export default function Notification() {
  const { state, refreshDb, invalidateCache } = useStore()
  const { db } = state

  useDidShow(() => {
    // 进入页面自动标记已读
    markAllRead()
  })

  const markAllRead = async () => {
    try {
      await request({ url: '/api/notifications/read-all', method: 'POST' })
      invalidateCache()
      await refreshDb()
    } catch (e) {
      // 静默失败
    }
  }

  const handleDelete = (id: string) => {
    Taro.showModal({
      title: '删除通知',
      content: '确定删除这条通知吗？',
      success: async res => {
        if (res.confirm) {
          try {
            const result: any = await request({ url: `/api/notifications/${id}`, method: 'DELETE' })
            // 后端 notifDelete 返回 { success } —— 与后端语义对齐
            if (result && result.success === false) {
              Taro.showToast({ title: '删除失败，记录可能已不存在', icon: 'none' })
              return
            }
            invalidateCache()
            await refreshDb()
            Taro.showToast({ title: '已删除', icon: 'success' })
          } catch (e: any) {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      },
    })
  }

  const notifications = db?.notifications || []

  return (
    <View className='notif'>
      <NavBar
        title='通知消息中心'
        right={
          <Text className='navbar__right-text' onClick={markAllRead}>全部已读</Text>
        }
      />

      <ScrollView className='notif__list' scrollY enableFlex>
        <View className='notif__list-inner'>
          {notifications.length === 0 ? (
            <View className='notif__empty'>
              <Icon name='bell' size={64} color='#d1d5db' className='notif__empty-icon' />
              <Text className='notif__empty-text'>暂无通知消息</Text>
            </View>
          ) : (
            notifications.map(n => (
              <View
                key={n.id}
                className={`notif__card ${n.isRead ? 'notif__card--read' : ''}`}
                onLongPress={() => handleDelete(n.id)}
              >
                {!n.isRead && <View className='notif__dot' />}
                <Text className='notif__card-title'>{n.title}</Text>
                <Text className='notif__card-content'>{n.content}</Text>
                <View className='notif__card-footer'>
                  <Text className='notif__card-type'>类型：{TYPE_LABELS[n.type] || n.type}</Text>
                  <Text className='notif__card-time'>
                    {n.createdAt ? new Date(n.createdAt).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    }) : ''}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}
