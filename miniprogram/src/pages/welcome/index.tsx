import { useState, useRef } from 'react'
import { View, Text, Button, Input, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useStore } from '../../store'
import request from '../../utils/request'
import Icon, { IconName } from '../../components/Icon'
import './index.scss'

// 用 require 让 webpack/asset-loader 把图片打包进 dist，字符串路径在真机会 404
const loginBg = require('../../assets/login-bg.jpeg')
const loginLogo = require('../../assets/login-logo.png')

const AVATAR_OPTIONS: Array<{ id: string; icon: IconName; color: string }> = [
  { id: 'parent', icon: 'user', color: '#64748b' },
  { id: 'heart', icon: 'heart-filled', color: '#f43f5e' },
  { id: 'star', icon: 'star', color: '#f59e0b' },
  { id: 'moon', icon: 'moon', color: '#6C8EEF' },
  { id: 'home', icon: 'home', color: '#0ea5e9' },
  { id: 'compass', icon: 'compass', color: '#10b981' },
]

export default function Welcome() {
  const { dispatch } = useStore()
  const [showAuth, setShowAuth] = useState(false)
  const [avatar, setAvatar] = useState('parent')
  const [nickname, setNickname] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [agreed, setAgreed] = useState(false)

  // 已登录则直接进首页（上线版已取消游客体验，必须持有服务端 token 才放行）
  const redirectedRef = useRef(false)
  useDidShow(() => {
    if (redirectedRef.current) return
    const loggedIn = Boolean(Taro.getStorageSync('bm_logged_in'))
    const hasToken = Boolean(Taro.getStorageSync('bm_token'))
    if (loggedIn && hasToken) {
      redirectedRef.current = true
      setTimeout(() => Taro.reLaunch({ url: '/pages/home/index' }), 0)
    } else if (loggedIn) {
      Taro.removeStorageSync('bm_logged_in')
      Taro.removeStorageSync('bm_tourist')
    }
  })

  const handleWechatLogin = () => {
    setAuthError('')
    setAgreed(false)
    setShowAuth(true)
  }

  const handleReject = () => {
    if (authLoading) return
    setShowAuth(false)
    Taro.showToast({ title: '已取消授权', icon: 'none' })
  }

  const goPolicy = (type: 'user' | 'child') => {
    Taro.navigateTo({ url: `/pages/policy/index?type=${type}` })
  }

  const handleAccept = async () => {
    if (authLoading) return
    if (!agreed) {
      Taro.showToast({ title: '请先阅读并同意政策', icon: 'none' })
      return
    }
    setAuthLoading(true)
    setAuthError('')
    try {
      const authRes: any = await request({
        url: '/api/auth/wx-login',
        method: 'POST',
        data: {
          nickname: nickname.trim().slice(0, 20),
          avatar,
        },
        skipAuth: true,
      })
      if (!authRes?.success) throw new Error('登录服务未返回有效会话')

      Taro.setStorageSync('bm_token', authRes.token || 'cloud')
      if (authRes.openid) Taro.setStorageSync('bm_openid', authRes.openid)
      Taro.setStorageSync('bm_logged_in', true)
      Taro.removeStorageSync('bm_tourist')
      Taro.setStorageSync('bm_wx_avatar', avatar)
      Taro.setStorageSync('bm_wx_nickname', nickname.trim() || '淘淘家长')

      dispatch({ type: 'SET_LOGGED_IN', payload: { isLoggedIn: true } })
      setShowAuth(false)

      const hasProfile = Taro.getStorageSync('bm_profile_done')
      if (hasProfile) {
        Taro.reLaunch({ url: '/pages/home/index' })
      } else {
        Taro.reLaunch({ url: '/pages/profile/index' })
      }

      Taro.showToast({ title: '登录成功', icon: 'success' })
    } catch (e: any) {
      const realError = e?.data?.error || e?.data?.message || e?.message || String(e || '')
      console.error('[welcome] handleAccept 失败:', JSON.stringify(e), '| 提取:', realError)
      setAuthError(realError)
      Taro.showToast({ title: realError.slice(0, 8), icon: 'none' })
    } finally {
      setAuthLoading(false)
    }
  }

  return (
    <View className='welcome'>
      {/* 水彩夜景背景 */}
      <Image className='welcome__bg' src={loginBg} mode='aspectFill' lazyLoad={false} />
      {/* 顶部压暗 + 底部提亮的软渐变，保证文字与面板可读（微信不支持 backdrop-filter） */}
      <View className='welcome__scrim' />

      <View className='welcome__content'>
        {/* 品牌区 */}
        <View className='welcome__header'>
          <View className='welcome__logo'>
            <Image className='welcome__logo-img' src={loginLogo} mode='aspectFill' lazyLoad={false} />
          </View>
          <Text className='welcome__slogan'>让爱与陪伴，留在每一个睡前故事里</Text>
        </View>

        {/* 底部：毛玻璃登录面板 + 协议 */}
        <View className='welcome__bottom'>
          <View className='welcome__panel'>
            <Button className='welcome__login-btn' onClick={handleWechatLogin}>
              <Icon name='message-circle' size={32} color='#ffffff' className='welcome__login-icon' />
              <Text>微信一键快速登录</Text>
            </Button>
          </View>
          <Text className='welcome__protocol'>
            登录即代表您已同意
            <Text className='welcome__protocol-link' onClick={() => goPolicy('user')}>《耳畔童话用户协议》</Text>
            和
            <Text className='welcome__protocol-link' onClick={() => goPolicy('child')}>《儿童信息保护政策》</Text>
          </Text>
        </View>
      </View>

      {/* 微信授权弹窗 */}
      {showAuth && (
        <View className='auth-modal'>
          <View className='auth-modal__backdrop' onClick={() => !authLoading && setShowAuth(false)} />
          <View className='auth-modal__sheet'>
            <View className='auth-modal__header'>
              <View className='auth-modal__header-left'>
                <View className='auth-modal__wx-icon'>
                  <Text className='auth-modal__wx-icon-text'>微</Text>
                </View>
                <Text className='auth-modal__header-title'>微信授权登录</Text>
              </View>
              <View className='auth-modal__close' onClick={() => !authLoading && setShowAuth(false)}>
                <Icon name='x' size={28} color='#a1a1aa' />
              </View>
            </View>

            <View className='auth-modal__desc'>
              <Text className='auth-modal__desc-title'>耳畔童话 申请使用：</Text>
              <Text className='auth-modal__desc-text'>您选择的昵称和头像样式将用于个性化家长称呼及同步绘本记录</Text>
            </View>

            <View className='auth-modal__form'>
              <View className='auth-modal__field'>
                <Text className='auth-modal__field-label'>选择头像样式</Text>
                <View className='auth-modal__avatars'>
                  {AVATAR_OPTIONS.map(option => (
                    <View
                      key={option.id}
                      className={`auth-modal__avatar ${avatar === option.id ? 'auth-modal__avatar--active' : ''}`}
                      onClick={() => !authLoading && setAvatar(option.id)}
                    >
                      <Icon name={option.icon} size={34} color={avatar === option.id ? '#ffffff' : option.color} />
                    </View>
                  ))}
                </View>
              </View>

              <View className='auth-modal__field'>
                <Text className='auth-modal__field-label'>自定义昵称</Text>
                <Input
                  className={`auth-modal__input ${authError ? 'auth-modal__input--error' : ''}`}
                  type='nickname'
                  placeholder='请输入微信昵称'
                  value={nickname}
                  onInput={e => setNickname(e.detail.value)}
                  maxlength={20}
                  confirmType='done'
                  cursorSpacing={20}
                  adjustPosition
                  focus={showAuth && !authLoading}
                  onConfirm={handleAccept}
                />
              </View>
            </View>

            {authError && <Text className='auth-modal__error'>{authError}</Text>}

            <View className='auth-modal__agree' onClick={() => !authLoading && setAgreed(v => !v)}>
              <View className={`auth-modal__checkbox ${agreed ? 'auth-modal__checkbox--on' : ''}`}>
                {agreed && <Icon name='check' size={22} color='#fff' />}
              </View>
              <Text className='auth-modal__agree-text'>
                我已阅读并同意
                <Text className='auth-modal__agree-link' onClick={(e) => { e.stopPropagation(); goPolicy('user') }}>《耳畔童话用户协议》</Text>
                和
                <Text className='auth-modal__agree-link' onClick={(e) => { e.stopPropagation(); goPolicy('child') }}>《儿童信息保护政策》</Text>
              </Text>
            </View>

            <View className='auth-modal__btns'>
              <Button className='auth-modal__btn auth-modal__btn--reject' onClick={handleReject} disabled={authLoading}>拒绝</Button>
              <Button className='auth-modal__btn auth-modal__btn--accept' onClick={handleAccept} loading={authLoading} disabled={!agreed || authLoading}>允许</Button>
            </View>
            <Text className='auth-modal__tip'>
              授权登录即代表您已同意
              <Text className='auth-modal__tip-link' onClick={(e) => { e.stopPropagation(); goPolicy('user') }}>《耳畔童话用户协议》</Text>
            </Text>
          </View>
        </View>
      )}
    </View>
  )
}
