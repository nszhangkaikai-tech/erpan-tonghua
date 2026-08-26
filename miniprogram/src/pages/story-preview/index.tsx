import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, Button, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Icon from '../../components/Icon'
import SafeImage from '../../components/SafeImage'
import BottomNav from '../../components/BottomNav'
import request, { getErrorMessage } from '../../utils/request'
import './index.scss'

// 异步任务轮询间隔（毫秒）
const POLL_INTERVAL = 2000
// 最大轮询次数（约 2 分钟超时）
const MAX_POLL_COUNT = 60

interface Chapter {
  chapterNumber: number
  title: string
  text: string
  imageUrl: string
  audioUrl?: string
}

interface Story {
  title: string
  abstract: string
  chapters: Chapter[]
  coverUrl: string
  theme: string
  educationalGoal: string
  scene: string
  mainCharacterName: string
  duration: string
  targetAge: number
  targetAgeRange?: string
  authorId?: string
  authorName?: string
}

export default function StoryPreview() {
  const [story, setStory] = useState<Story | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  // 异步音频任务状态
  const [audioJobStatus, setAudioJobStatus] = useState<'idle' | 'synthesizing' | 'done' | 'failed'>('idle')
  const [audioProgress, setAudioProgress] = useState(0)
  const pollTimerRef = useRef<any>(null)
  const pollCountRef = useRef(0)

  useEffect(() => {
    const draft = Taro.getStorageSync('bm_draft_story')
    if (draft) {
      setStory(draft)
    }
  }, [])

  // 重新生成
  const handleRegenerate = async () => {
    if (!story) return

    const isFree = retryCount === 0
    if (!isFree) {
      const confirm = await new Promise<boolean>(resolve => {
        Taro.showModal({
          title: '重新生成',
          content: '重新生成将扣除 1 次故事额度，是否继续？',
          success: res => resolve(res.confirm),
        })
      })
      if (!confirm) return
    }

    setWaiting(true)
    try {
      const result = await request({
        url: '/api/story/generate-text',
        method: 'POST',
        data: {
          theme: story.theme,
          educationalGoal: story.educationalGoal,
          scene: story.scene,
          mainCharacters: [{ name: story.mainCharacterName, role: '', personality: '' }],
          duration: story.duration,
          age: story.targetAge,
          targetAgeRange: story.targetAgeRange,
          authorId: story.authorId,
          isRetry: true,
        },
      })

      if (result?.story) {
        setStory(result.story)
        Taro.setStorageSync('bm_draft_story', result.story)
        setRetryCount(prev => prev + 1)
        Taro.showToast({ title: '重新生成成功', icon: 'success' })
      }
    } catch (e) {
      Taro.showToast({ title: '生成失败，请重试', icon: 'none' })
    } finally {
      setWaiting(false)
    }
  }

  // 清理轮询定时器
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    pollCountRef.current = 0
  }, [])

  // 轮询音频任务状态
  const pollAudioStatus = useCallback(async (jobId: string) => {
    pollCountRef.current += 1

    if (pollCountRef.current > MAX_POLL_COUNT) {
      stopPolling()
      setAudioJobStatus('failed')
      Taro.hideLoading()
      Taro.showToast({ title: '合成超时，请稍后重试', icon: 'none' })
      return
    }

    try {
      const result: any = await request({
        url: `/api/story/audio-status/${jobId}`,
        method: 'GET',
        skipRefresh: true,
      })

      const { status, progress, story: savedStory, error } = result

      if (status === 'ready' && savedStory) {
        stopPolling()
        setAudioJobStatus('done')
        setAudioProgress(100)
        Taro.hideLoading()
        Taro.setStorageSync('bm_active_story', savedStory)
        Taro.navigateTo({ url: '/pages/story-player/index' })
      } else if (status === 'failed') {
        stopPolling()
        setAudioJobStatus('failed')
        Taro.hideLoading()
        // 即使配音失败，若已有封面/章节插图也先展示（绘本可看，仅缺声音）
        if (savedStory && (savedStory.coverUrl || savedStory.chapters?.some(ch => ch.imageUrl))) {
          setStory(savedStory)
          Taro.setStorageSync('bm_active_story', savedStory)
          Taro.showToast({ title: '绘本已生成，但配音失败', icon: 'none' })
        } else {
          Taro.showToast({ title: error || '合成失败，请重试', icon: 'none' })
        }
      } else {
        // queued / tts_generating / mixing
        setAudioProgress(progress || 0)
      }
    } catch (e) {
      // 轮询失败不立即终止，继续下次轮询
      console.warn('poll audio status failed:', e)
    }
  }, [stopPolling])

  // 合成有声故事（异步任务模式）
  const handleSynthesize = async () => {
    if (!story) return

    const voiceConfig = Taro.getStorageSync('bm_wizard_voice') || {}

    setAudioJobStatus('synthesizing')
    setAudioProgress(0)
    pollCountRef.current = 0
    Taro.showLoading({ title: '提交合成任务...', mask: true })

    try {
      // Step 1: 提交异步任务，获取 jobId
      const result: any = await request({
        url: '/api/story/generate-audio',
        method: 'POST',
        data: {
          story,
          voiceId: voiceConfig.voiceId || 'voice_default_mom',
          voiceMode: voiceConfig.voiceMode || 'single',
          theme: story.theme,
          educationalGoal: story.educationalGoal,
          scene: story.scene,
          mainCharacterName: story.mainCharacterName,
          duration: story.duration,
          targetAge: story.targetAge,
          targetAgeRange: story.targetAgeRange,
          authorId: story.authorId,
          authorName: story.authorName,
          bgmType: voiceConfig.bgmType || 'none',
        },
      })

      // 去重命中：直接展示已有故事
      if (result?.deduplicated) {
        Taro.hideLoading()
        setAudioJobStatus('ready')
        setAudioProgress(100)
        // savedStory 已由后端 resolveUrls，直接使用
        if (result.savedStory) {
          onStoryUpdate?.(result.savedStory)
        }
        Taro.showToast({ title: '已加载已有故事', icon: 'success' })
        return
      }

      if (!result?.jobId) {
        Taro.hideLoading()
        setAudioJobStatus('failed')
        Taro.showToast({ title: result?.error || '合成任务创建失败', icon: 'none' })
        return
      }

      // Step 2: 开始轮询任务状态
      Taro.showLoading({ title: '正在合成配音...', mask: true })
      pollTimerRef.current = setInterval(() => {
        pollAudioStatus(result.jobId)
      }, POLL_INTERVAL)

      // 立即执行第一次轮询
      pollAudioStatus(result.jobId)
    } catch (e: any) {
      Taro.hideLoading()
      setAudioJobStatus('failed')
      Taro.showToast({ title: getErrorMessage(e, '合成失败，请重试'), icon: 'none' })
    }
  }

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  // ===== 等待状态 =====
  if (waiting || !story) {
    return (
      <View className='preview preview--wait'>
          <View className='preview__wait-icon-wrap'>
          <View className='preview__wait-icon'>
            <Icon name='book-open' size={48} color='#6C8EEF' className='preview__wait-icon' />
          </View>
          <Icon name='sparkles' size={24} color='#f59e0b' className='preview__wait-sparkle' />
        </View>

        <Text className='preview__wait-title'>AI 正在为您全力构思童话中...</Text>
        <Text className='preview__wait-desc'>
          正在根据您的定制需求精心组织大纲和每一章节
        </Text>

        <View className='preview__wait-tips'>
          <View className='preview__wait-tip-header'>
            <Icon name='sparkles' size={24} color='#f59e0b' className='preview__wait-tip-icon' />
            <Text className='preview__wait-tip-title'>耳畔星夜精灵童话编织预测：</Text>
          </View>
          <View className='preview__wait-tip'>
            <Icon name='sparkles' size={24} color='#6C8EEF' className='preview__wait-tip-icon' />
            <Text className='preview__wait-tip-text'><Text className='preview__wait-tip-bold'>今日成长大魔法</Text>：悄悄往故事里注入了一颗亮晶晶勇气魔法糖果！</Text>
          </View>
          <View className='preview__wait-tip'>
            <Icon name='info' size={24} color='#0ea5e9' className='preview__wait-tip-icon' />
            <Text className='preview__wait-tip-text'><Text className='preview__wait-tip-bold'>梦境温度与配方</Text>：已调节至最适宜的温度，让天马行空的想象化作温柔的小河。</Text>
          </View>
          <View className='preview__wait-tip preview__wait-tip--pulse'>
            <Icon name='star' size={24} color='#f59e0b' className='preview__wait-tip-icon' />
            <Text className='preview__wait-tip-text'><Text className='preview__wait-tip-bold'>星夜预言家悄悄话</Text>：这一次，听故事的宝宝会在温馨与感动中甜甜睡去哦。</Text>
          </View>
        </View>
        <BottomNav />
      </View>
    )
  }

  // ===== 预览状态 =====
  return (
    <View className='preview'>
      <ScrollView className='preview__scroll' scrollY enableFlex>
        <View className='preview__scroll-inner'>
        {/* 封面 */}
        <View className='preview__cover'>
          <SafeImage
            src={story.coverUrl}
            className='preview__cover-img'
            mode='aspectFill'
            placeholder={<Icon name='book-open' size={48} color='#9ca3af' />}
            placeholderClassName='preview__cover-placeholder'
          />
          <View className='preview__cover-overlay'>
            <View className='preview__cover-badge'>
              <View className='preview__cover-badge-text'><Icon name='star' size={20} color='#f59e0b' /><Text>AI 绘本成果</Text></View>
            </View>
            <Text className='preview__cover-title'>{story.title}</Text>
          </View>
        </View>

        {/* 概要 */}
        <View className='preview__abstract'>
          <Text className='preview__abstract-text'><Text className='preview__abstract-bold'>故事概要</Text>：{story.abstract}</Text>
        </View>

        {/* 章节列表 */}
        <View className='preview__chapters'>
          <View className='preview__chapters-title icon-inline'><Icon name='book-open' size={28} /> 绘本章节内容预览（{story.chapters?.length}章）</View>

          {story.chapters?.map(ch => (
            <View key={ch.chapterNumber} className='preview__chapter'>
              <View className='preview__chapter-header'>
                <Text className='preview__chapter-num'>CHAPTER {ch.chapterNumber}</Text>
                <Text className='preview__chapter-name'>{ch.title}</Text>
              </View>
              <Text className='preview__chapter-text'>{ch.text}</Text>
              {ch.imageUrl && (
                <View className='preview__chapter-img-wrap'>
                  <SafeImage
                    src={ch.imageUrl}
                    className='preview__chapter-img'
                    mode='aspectFill'
                    placeholder={<Icon name='sparkles' size={40} color='#d1d5db' />}
                    placeholderClassName='preview__chapter-placeholder'
                  />
                  <View className='preview__chapter-img-badge'>
                    <Text className='preview__chapter-img-badge-text'>AI 插图 {ch.chapterNumber}</Text>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
        </View>
      </ScrollView>

      {/* 底部操作 */}
      <View className='preview__footer'>
        {audioJobStatus === 'synthesizing' ? (
          <View className='preview__footer-progress'>
            <View className='preview__progress-bar'>
              <View className='preview__progress-fill' style={{ width: `${audioProgress}%` }} />
            </View>
            <Text className='preview__progress-text'>
              {audioProgress < 10 ? '排队中...' : audioProgress < 80 ? `语音合成中 ${audioProgress}%` : `混音处理中 ${audioProgress}%`}
            </Text>
          </View>
        ) : (
          <View className='preview__footer-btns'>
            <View className='preview__footer-retry' onClick={handleRegenerate}>
              <Icon name='refresh' size={28} color='#6b7280' />
              <Text className='preview__footer-retry-text'>重新生成（{retryCount === 0 ? '免费1次' : '扣1次'}）</Text>
            </View>
            <View className='preview__footer-confirm' onClick={handleSynthesize}>
              <Icon name='volume' size={28} color='#fff' />
              <Text className='preview__footer-confirm-text'>
                {audioJobStatus === 'failed' ? '重新合成' : '满意，合成有声故事'}
              </Text>
            </View>
          </View>
        )}
        {audioJobStatus !== 'synthesizing' && (
          <Text className='preview__footer-tip'>生成有声不会消耗您的故事次数，声音将使用您录制的专属声色。</Text>
        )}
      </View>
      <BottomNav />
    </View>
  )
}
