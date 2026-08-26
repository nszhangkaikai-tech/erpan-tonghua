import { useState } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useStore } from '../../store'
import request from '../../utils/request'
import Icon from '../../components/Icon'
import NavBar from '../../components/NavBar'
import BottomNav from '../../components/BottomNav'
import './index.scss'

export default function My() {
  const { state, dispatch, refreshDb, invalidateCache, unreadCount } = useStore()
  const { db } = state
  const [cdkey, setCdkey] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [binding, setBinding] = useState(false)

  useDidShow(() => {
    refreshDb()
  })

  const handleRedeem = async () => {
    if (!cdkey.trim()) {
      Taro.showToast({ title: '请输入卡密', icon: 'none' })
      return
    }
    setRedeeming(true)
    try {
      const result = await request({
        url: '/api/cdkey/redeem',
        method: 'POST',
        data: { code: cdkey.trim().toUpperCase() },
      })
      invalidateCache()
      await refreshDb()
      setCdkey('')
      Taro.showToast({ title: result?.message || '兑换成功', icon: 'success' })
    } catch (e: any) {
      Taro.showToast({ title: e?.data?.error || '兑换失败', icon: 'none' })
    } finally {
      setRedeeming(false)
    }
  }

  const handleBindInvite = async () => {
    if (!inviteCode.trim()) {
      Taro.showToast({ title: '请输入邀请码', icon: 'none' })
      return
    }
    setBinding(true)
    try {
      await request({
        url: '/api/referral/bind',
        method: 'POST',
        data: { inviteCode: inviteCode.trim().toUpperCase() },
      })
      invalidateCache()
      await refreshDb()
      setInviteCode('')
      Taro.showToast({ title: '绑定成功', icon: 'success' })
    } catch (e: any) {
      Taro.showToast({ title: e?.data?.error || '绑定失败', icon: 'none' })
    } finally {
      setBinding(false)
    }
  }

  const copyInviteCode = () => {
    const code = db?.rights?.inviteCode || ''
    if (code) {
      Taro.setClipboardData({
        data: code,
        success: () => Taro.showToast({ title: '邀请码已复制', icon: 'success' }),
      })
    }
  }

  const goProfile = () => Taro.navigateTo({ url: '/pages/profile/index' })

  const handleLogout = () => {
    Taro.showModal({
      title: '退出登录',
      content: '确定要安全退出当前微信登录吗？',
      success: res => {
        if (res.confirm) {
          Taro.clearStorageSync()
          dispatch({ type: 'LOGOUT' })
          Taro.reLaunch({ url: '/pages/welcome/index' })
        }
      },
    })
  }

  const profile = db?.profile
  const rights = db?.rights

  return (
    <View className='my'>
      <NavBar title='我的' showBack={false} />
      <ScrollView className='my__scroll' scrollY enableFlex>
        <View className='my__scroll-inner'>
        {/* ===== 用户权益卡 ===== */}
        <View className='my__card'>
          <View className='my__user'>
            <View className='my__avatar'>
              <Text className='my__avatar-text'>{profile?.nickname?.charAt(0) || '淘'}</Text>
            </View>
            <View className='my__user-info'>
              <Text className='my__user-name'>{profile?.parentName || '淘淘家长'}</Text>
              <View className='my__user-meta'>
                <Text className='my__user-meta-text'>绑定宝宝：{profile?.nickname || '无'}</Text>
                <Text className='my__user-meta-sep'>•</Text>
                <Text className='my__user-meta-text'>{profile?.age || '无'} 岁</Text>
              </View>
            </View>
          </View>

          <View className='my__quotas'>
            <View className='my__quota'>
              <Text className='my__quota-label'>绘本生成额度</Text>
              <Text className='my__quota-value'>
                {rights?.isVip ? '无限次 (VIP)' : `${rights?.storyGenerationsRemaining ?? 0} 次`}
              </Text>
            </View>
            <View className='my__quota'>
              <Text className='my__quota-label'>声音克隆余额</Text>
              <Text className='my__quota-value'>{rights?.freeVoiceClonesRemaining ?? 0} 次</Text>
            </View>
          </View>

          {rights?.isVip && (
            <View className='my__vip'>
              <Icon name='award' size={28} color='#f59e0b' className='my__vip-icon' />
              <Text className='my__vip-text'>VIP尊享会员有效至：{new Date(rights.vipExpiry || '').toLocaleDateString()}</Text>
            </View>
          )}
        </View>

        {/* ===== 兑换卡密 ===== */}
        <View className='my__card'>
          <View className='my__card-title'><Icon name='copy' size={26} color='#18181b' /><Text>兑换卡密激活码</Text></View>
          <Text className='my__card-desc'>
            在小红书、微信等官方社群获得的纸质或电子版次数券、月卡礼包卡密，请在下方输入激活兑换：
          </Text>
          <View className='my__input-row'>
            <Input
              className='my__input'
              placeholder='请输入卡密'
              value={cdkey}
              maxlength={32}
              confirmType='done'
              cursorSpacing={24}
              adjustPosition
              onInput={e => setCdkey(e.detail.value)}
            />
            <View className={`my__btn ${redeeming ? 'my__btn--loading' : ''}`} onClick={handleRedeem}>
              <Text className='my__btn-text'>{redeeming ? '兑换中...' : '兑换'}</Text>
            </View>
          </View>
        </View>

        {/* ===== 邀请好友 ===== */}
        <View className='my__card'>
          <View className='my__card-title'><Icon name='gift' size={26} color='#18181b' /><Text>绑定好友邀请码</Text></View>
          <Text className='my__card-desc'>
            输入好友的专属推荐邀请码。绑定后双方均可获赠 <Text className='my__tip-bold'>2 次</Text> 故事生成额度！
          </Text>
          <View className='my__input-row'>
            <Input
              className='my__input'
              placeholder='请输入邀请码，如 BMTH-8888'
              value={inviteCode}
              maxlength={20}
              confirmType='done'
              cursorSpacing={24}
              adjustPosition
              onInput={e => setInviteCode(e.detail.value)}
              disabled={!!rights?.usedInviteCode}
            />
            <View className={`my__btn ${binding ? 'my__btn--loading' : ''} ${rights?.usedInviteCode ? 'my__btn--disabled' : ''}`} onClick={rights?.usedInviteCode ? undefined : handleBindInvite}>
              <Text className='my__btn-text'>{rights?.usedInviteCode ? '已绑定' : binding ? '绑定中...' : '绑定'}</Text>
            </View>
          </View>

          {rights?.usedInviteCode && (
            <Text className='my__bound'>✓ 已绑定推荐人：{rights.usedInviteCode}</Text>
          )}

          {/* 我的邀请码 */}
          <View className='my__invite-code'>
            <View className='my__invite-code-left'>
              <Text className='my__invite-code-label'>我的专属邀请码（长按复制）：</Text>
              <Text className='my__invite-code-value'>{rights?.inviteCode || 'BMTH-XXXX'}</Text>
            </View>
            <View className='my__invite-copy' onClick={copyInviteCode}>
              <Text className='my__invite-copy-text'>复制</Text>
            </View>
          </View>
        </View>

        {/* ===== 设置入口 ===== */}
        <View className='my__menu'>
          <View className='my__menu-item' onClick={goProfile}>
            <View className='my__menu-text'><Icon name='user' size={26} color='#18181b' /><Text>修改宝宝成长资料</Text></View>
            <Text className='my__menu-arrow'>›</Text>
          </View>
          <View className='my__menu-item' onClick={() => Taro.navigateTo({ url: '/pages/notification/index' })}>
            <View className='my__menu-left'>
              <View className='my__menu-text'><Icon name='bell' size={26} color='#18181b' /><Text>通知中心</Text></View>
              {unreadCount > 0 && (
                <View className='my__menu-badge'>
                  <Text className='my__menu-badge-text'>{unreadCount}</Text>
                </View>
              )}
            </View>
            <Text className='my__menu-arrow'>›</Text>
          </View>
          <View className='my__menu-item' onClick={() => Taro.showToast({ title: '耳畔童话 v1.1.0', icon: 'none' })}>
            <View className='my__menu-text'><Icon name='info' size={26} color='#18181b' /><Text>关于耳畔童话</Text></View>
            <Text className='my__menu-arrow'>›</Text>
          </View>
          <View className='my__menu-item my__menu-item--danger' onClick={handleLogout}>
            <View className='my__menu-text my__menu-text--danger'><Icon name='logout' size={26} color='#dc2626' /><Text>退出微信登录</Text></View>
            <Text className='my__menu-arrow my__menu-arrow--danger'>›</Text>
          </View>
        </View>
        </View>
      </ScrollView>
      <BottomNav active='my' />
    </View>
  )
}
