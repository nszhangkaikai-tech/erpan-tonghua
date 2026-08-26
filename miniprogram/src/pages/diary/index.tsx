import { useState } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useStore } from '../../store'
import Icon from '../../components/Icon'
import SafeImage from '../../components/SafeImage'
import Loading from '../../components/Loading'
import BottomNav from '../../components/BottomNav'
import NavBar from '../../components/NavBar'
import request from '../../utils/request'
import './index.scss'

const FILTER_TABS = [
  { key: 'all', label: '全部故事' },
  { key: 'favorite', label: '我的收藏 ❤️' },
  { key: 'bedtime', label: '睡前安抚 🌙' },
  { key: 'courage', label: '勇敢自信 💪' },
]

export default function Diary() {
  const { state, refreshDb, invalidateCache } = useStore()
  const { db, loading } = state

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [renamingId, setRenamingId] = useState('')
  const [newTitle, setNewTitle] = useState('')

  useDidShow(() => {
    refreshDb()
  })

  const stories = db?.userStories || []

  const filtered = stories.filter(s => {
    if (filter === 'favorite' && !s.isFavorite) return false
    if (filter === 'bedtime' && s.theme !== '睡前安抚') return false
    if (filter === 'courage' && s.theme !== '勇敢自信') return false
    if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const playStory = (story: any) => {
    Taro.setStorageSync('bm_active_story', story)
    Taro.navigateTo({ url: '/pages/story-player/index' })
  }

  const toggleFavorite = async (id: string) => {
    try {
      await request({ url: '/api/story/save-toggle', method: 'POST', data: { id, type: 'favorite' } })
      invalidateCache()
      await refreshDb()
    } catch (e) {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  const deleteStory = async (id: string) => {
    const confirmed = await new Promise(resolve => {
      Taro.showModal({
        title: '删除故事',
        content: '确定要删除这个故事吗？',
        success: res => resolve(res.confirm),
      })
    })
    if (!confirmed) return

    try {
      const result: any = await request({ url: '/api/story/delete', method: 'POST', data: { id } })
      // 后端 delete 动作返回 { success } —— 与后端语义对齐，避免"没删成却提示成功"
      if (result && result.success === false) {
        Taro.showToast({ title: '删除失败，记录可能已不存在', icon: 'none' })
        return
      }
      invalidateCache()
      await refreshDb()
      Taro.showToast({ title: '已删除', icon: 'success' })
    } catch (e) {
      Taro.showToast({ title: '删除失败', icon: 'none' })
    }
  }

  const startRename = (story: any) => {
    setRenamingId(story.id)
    setNewTitle(story.title)
  }

  const confirmRename = async () => {
    if (!newTitle.trim()) return
    try {
      await request({ url: '/api/story/rename', method: 'POST', data: { id: renamingId, title: newTitle.trim() } })
      setRenamingId('')
      setNewTitle('')
      invalidateCache()
      await refreshDb()
      Taro.showToast({ title: '重命名成功', icon: 'success' })
    } catch (e) {
      Taro.showToast({ title: '重命名失败', icon: 'none' })
    }
  }

  return (
    <View className='diary'>
      <NavBar title='宝宝故事日记' backgroundColor='#fff' />
      <View className='diary__content'>
      <View className='diary__header'>
        <View className='diary__search'>
          <Icon name='search' size={28} color='#9ca3af' className='diary__search-icon' />
          <Input
            className='diary__search-input'
            placeholder='搜索宝宝的专属童话...'
            value={search}
            maxlength={40}
            confirmType='search'
            cursorSpacing={24}
            adjustPosition
            onInput={e => setSearch(e.detail.value)}
          />
        </View>
      </View>

      <ScrollView className='diary__tabs' scrollX enableFlex>
        <View className='diary__tabs-inner'>
          {FILTER_TABS.map(tab => (
            <View
              key={tab.key}
              className={`diary__tab ${filter === tab.key ? 'diary__tab--active' : ''}`}
              onClick={() => setFilter(tab.key)}
            >
              <Text className='diary__tab-text'>{tab.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {loading && !db ? (
        <Loading type='skeleton' card rows={4} />
      ) : (
      <ScrollView className='diary__list' scrollY enableFlex>
        <View className='diary__list-inner'>
          {filtered.length === 0 ? (
            <View className='diary__empty'>
              <Icon name='book-open' size={64} color='#d1d5db' className='diary__empty-icon' />
              <Text className='diary__empty-text'>还没有相关故事</Text>
              <Text className='diary__empty-hint'>去首页创作专属绘本吧</Text>
            </View>
          ) : (
            filtered.map(story => (
              <View key={story.id} className='diary__card'>
                {/* 封面 */}
                <View className='diary__cover' onClick={() => playStory(story)}>
                  <SafeImage
                    src={story.coverUrl}
                    className='diary__cover-img'
                    mode='aspectFill'
                    placeholder={<Icon name='book-open' size={48} color='#9ca3af' />}
                  />
                </View>

                {/* 内容区 */}
                <View className='diary__body'>
                  {/* 标题行：标题 + 编辑笔 */}
                  {renamingId === story.id ? (
                    <View className='diary__rename-row'>
                      <Input
                        className='diary__rename-input'
                        value={newTitle}
                        maxlength={30}
                        confirmType='done'
                        cursorSpacing={24}
                        adjustPosition
                        onInput={e => setNewTitle(e.detail.value)}
                        focus
                        onConfirm={confirmRename}
                      />
                      <View className='diary__rename-confirm' onClick={confirmRename}>
                        <Icon name='check' size={24} color='#16a34a' />
                      </View>
                    </View>
                  ) : (
                    <View className='diary__title-row' onClick={() => playStory(story)}>
                      <Text className='diary__title'>{story.title}</Text>
                      <View
                        className='diary__title-edit'
                        onClick={e => {
                          e.stopPropagation()
                          startRename(story)
                        }}
                      >
                        <Icon name='edit' size={22} color='#a1a1aa' />
                      </View>
                    </View>
                  )}

                  {/* 摘要（2 行截断） */}
                  <Text className='diary__abstract' onClick={() => playStory(story)}>
                    {story.abstract || ''}
                  </Text>

                  {/* 底部行：主题标签 + 日期 + 操作按钮 */}
                  <View className='diary__footer'>
                    <View className='diary__meta'>
                      <View className='diary__theme-tag'>
                        <Text className='diary__theme-text'>{story.theme}</Text>
                      </View>
                      <Text className='diary__date'>
                        {new Date(story.createTime).toLocaleDateString('zh-CN')}
                      </Text>
                    </View>
                    <View className='diary__actions'>
                      <View className='diary__action' onClick={() => toggleFavorite(story.id)}>
                        <Icon
                          name={story.isFavorite ? 'heart-filled' : 'heart'}
                          size={30}
                          color={story.isFavorite ? '#ef4444' : '#a1a1aa'}
                        />
                      </View>
                      <View className='diary__action' onClick={() => deleteStory(story.id)}>
                        <Icon name='trash' size={30} color='#a1a1aa' />
                      </View>
                      <View className='diary__play' onClick={() => playStory(story)}>
                        <View className='diary__play-icon' />
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
      )}
      </View>
      <BottomNav />
    </View>
  )
}
