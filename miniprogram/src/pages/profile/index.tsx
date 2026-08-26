import { useState, useEffect } from 'react'
import { View, Text, Input, Button, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useStore } from '../../store'
import request from '../../utils/request'
import Icon from '../../components/Icon'
import NavBar from '../../components/NavBar'
import BottomNav from '../../components/BottomNav'
import './index.scss'

const INTERESTS = ['森林动物', '宇宙探险', '积木组装', '魔法城堡', '深海奥秘', '机械交通', '恐龙王国']
const AGES = [2, 3, 4, 5, 6, 7, 8, 9]

export default function Profile() {
  const { state, dispatch, refreshDb, invalidateCache } = useStore()
  const [nickname, setNickname] = useState('')
  const [ageIdx, setAgeIdx] = useState(2) // 默认4岁
  const [gender, setGender] = useState<'boy' | 'girl'>('boy')
  const [parentName, setParentName] = useState('')
  const [bedTime, setBedTime] = useState('21:00')
  const [interests, setInterests] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // 回填已有数据
  useEffect(() => {
    const profile = state.db?.profile
    if (profile) {
      setNickname(profile.nickname || '')
      setAgeIdx(AGES.indexOf(profile.age) >= 0 ? AGES.indexOf(profile.age) : 2)
      setGender(profile.gender === 'girl' ? 'girl' : 'boy')
      setParentName(profile.parentName || '')
      setBedTime(profile.bedTime || '21:00')
      setInterests(profile.interests || [])
    }
    // 尝试从微信授权信息回填
    const wxNick = Taro.getStorageSync('bm_wx_nickname')
    if (wxNick && !parentName) {
      setParentName(wxNick)
    }
  }, [state.db?.profile])

  const toggleInterest = (item: string) => {
    setInterests(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    )
  }

  const handleSave = async () => {
    if (!nickname.trim()) {
      Taro.showToast({ title: '请填写宝贝昵称', icon: 'none' })
      return
    }

    setSaving(true)
    try {
      await request({
        url: '/api/profile',
        method: 'POST',
        data: {
          nickname: nickname.trim(),
          age: AGES[ageIdx],
          gender,
          parentName: parentName.trim() || `${nickname.trim()}家长`,
          bedTime,
          interests,
        },
      })

      Taro.setStorageSync('bm_profile_done', true)
      invalidateCache()
      await refreshDb()

      Taro.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => {
        Taro.reLaunch({ url: '/pages/home/index' })
      }, 800)
    } catch (e) {
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className='profile'>
      <NavBar title='宝宝档案 👶' backgroundColor='#fff' />

      <View className='profile__content'>
        {/* 说明卡片 */}
        <View className='profile__intro'>
          <Text className='profile__intro-text'>因材施教。</Text>
        </View>

      {/* 表单 */}
      <View className='profile__form'>
        {/* 宝贝昵称 */}
        <View className='profile__field'>
          <Text className='profile__label'>宝贝小名 / 昵称</Text>
          <Input
            className='profile__input'
            placeholder='如：淘淘、沐沐'
            value={nickname}
            maxlength={20}
            confirmType='done'
            cursorSpacing={24}
            adjustPosition
            onInput={e => setNickname(e.detail.value)}
          />
        </View>

        {/* 年龄 + 性别 */}
        <View className='profile__row'>
          <View className='profile__field profile__field--half'>
            <Text className='profile__label'>宝贝年龄</Text>
            <Picker
              mode='selector'
              range={AGES.map(a => `${a} 岁`)}
              value={ageIdx}
              onChange={e => setAgeIdx(Number(e.detail.value))}
            >
              <View className='profile__picker'>
                <Text className='profile__picker-text'>{AGES[ageIdx]} 岁</Text>
                <View className='profile__picker-chevron' />
              </View>
            </Picker>
          </View>

          <View className='profile__field profile__field--half'>
            <Text className='profile__label'>宝贝性别</Text>
            <View className='profile__gender'>
              <View
                className={`profile__gender-btn ${gender === 'boy' ? 'profile__gender-btn--active' : ''}`}
                onClick={() => setGender('boy')}
              >
                <Text>小王子</Text>
              </View>
              <View
                className={`profile__gender-btn ${gender === 'girl' ? 'profile__gender-btn--active' : ''}`}
                onClick={() => setGender('girl')}
              >
                <Text>小公主</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 家长称呼 */}
        <View className='profile__field'>
          <Text className='profile__label'>家长称呼</Text>
          <Input
            className='profile__input'
            placeholder='如：淘淘妈妈、糖糖爸爸'
            value={parentName}
            maxlength={20}
            confirmType='done'
            cursorSpacing={24}
            adjustPosition
            onInput={e => setParentName(e.detail.value)}
          />
        </View>

        {/* 睡觉时间 */}
        <View className='profile__field'>
          <Text className='profile__label'>常用播放时间（睡前）</Text>
          <Picker
            mode='time'
            value={bedTime}
            onChange={e => setBedTime(e.detail.value as string)}
          >
            <View className='profile__picker profile__picker--time'>
              <Text className='profile__picker-text'>{bedTime}</Text>
              <Icon name='clock' size={16} color='#a1a1aa' />
            </View>
          </Picker>
        </View>

        {/* 兴趣偏好 */}
        <View className='profile__field'>
          <Text className='profile__label'>宝贝兴趣偏好（多选）</Text>
          <View className='profile__interests'>
            {INTERESTS.map(item => (
              <View
                key={item}
                className={`profile__interest ${interests.includes(item) ? 'profile__interest--active' : ''}`}
                onClick={() => toggleInterest(item)}
              >
                <Text className='profile__interest-text'>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* 提交按钮 */}
      <View className='profile__submit'>
        <Button
          className='profile__submit-btn'
          loading={saving}
          disabled={saving}
          onClick={handleSave}
        >
          完善信息，开启伴梦之旅
        </Button>
      </View>
      </View>

      <BottomNav active='my' />
    </View>
  )
}
