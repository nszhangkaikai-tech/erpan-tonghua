import { useState, useEffect, useRef } from 'react'
import { View, Text, Button, ScrollView, Picker, Slider } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { API_BASE, request } from '../../utils/request'
import Icon, { IconName } from '../../components/Icon'
import SafeImage from '../../components/SafeImage'
import BottomNav from '../../components/BottomNav'
import NavBar from '../../components/NavBar'
import './index.scss'

// BGM 静态元数据（label/icon 由前端渲染）。真实可播放 URL 在播放页加载时
// 由后端 getBgmList 接口把 cloud:// 解析为 HTTP 临时 URL 后下发（与故事音频一致），
// 避免小程序直接播放 cloud:// 在开发工具/部分机型解析失败导致没声音。
const BGM_META: Array<{ key: string; label: string; icon: IconName }> = [
  { key: 'none', label: '关闭', icon: 'x' },
  { key: 'heartwarming_story', label: '温馨故事', icon: 'heart' },
  { key: 'fairytale_choir', label: '童话合唱', icon: 'star' },
  { key: 'shepherd_dream', label: '牧羊少年的梦', icon: 'moon' },
  { key: 'witch', label: '女巫魔法', icon: 'sparkles' },
  { key: 'inspiring_story', label: '励志篇章', icon: 'award' },
  { key: 'magic_fantasy_a', label: '魔法奇缘', icon: 'sparkles' },
  { key: 'magic_fantasy_b', label: '梦幻童话', icon: 'star' },
  { key: 'fairytale_intro', label: '童话序曲', icon: 'book-open' },
  { key: 'fantasy_arcadium', label: '幻想秘境', icon: 'compass' },
]
const TIMER_OPTIONS = ['定时关', '5分钟', '15分钟', '30分钟', '60分钟']
const TIMER_VALUES = [0, 5, 15, 30, 60]

export default function StoryPlayer() {
  const [story, setStory] = useState<any>(null)
  const [currentChapter, setCurrentChapter] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [bgmType, setBgmType] = useState('none')
  const [bgmVolume, setBgmVolume] = useState(15)
  // 后端解析后的 BGM 列表（含 HTTP 播放地址）；未加载时先用静态元数据占位（url 为空）
  const [bgmList, setBgmList] = useState<Array<{ key: string; label: string; icon: IconName; url: string }>>(
    BGM_META.map(m => ({ ...m, url: '' }))
  )
  const [sleepTimer, setSleepTimer] = useState(0)
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null)

  const audioRef = useRef<any>(null)
  const bgmAudioRef = useRef<any>(null)
  const progressTimer = useRef<any>(null)
  const chapterTimerRef = useRef<any>(null)
  const segIndexRef = useRef<number>(0)
  const sleepTimerRef = useRef<any>(null)

  useEffect(() => {
    const active = Taro.getStorageSync('bm_active_story')
    if (active) {
      setStory(active)
      setBgmType(active.bgmType || 'none')
    }

    // 拉取后端解析好的 BGM HTTP 播放地址（替代写死的 cloud://）
    loadBgmList()

    return () => {
      stopAudio()
      if (progressTimer.current) clearInterval(progressTimer.current)
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current)
    }
  }, [])

  // 分享给好友（转发）/ 分享到朋友圈
  useShareAppMessage(() => {
    const cover = typeof story?.coverUrl === 'string' && /^https?:\/\//.test(story.coverUrl) ? story.coverUrl : ''
    return {
      title: story?.title ? `宝宝睡前故事《${story.title}》｜耳畔童话` : '耳畔童话 · 专属定制睡前故事',
      path: '/pages/story-player/index',
      imageUrl: cover,
    }
  })

  useShareTimeline(() => {
    const cover = typeof story?.coverUrl === 'string' && /^https?:\/\//.test(story.coverUrl) ? story.coverUrl : ''
    return {
      title: story?.title ? `我为宝宝定制了《${story.title}》` : '耳畔童话 · 专属定制睡前故事',
      query: '',
      imageUrl: cover,
    }
  })

  // 从后端 getBgmList 获取 cloud:// → HTTP 临时 URL 映射，合并进 bgmList
  const loadBgmList = async () => {
    try {
      const res = await request({ url: '/api/story/bgm-list' })
      if (Array.isArray(res)) {
        const urlMap: Record<string, string> = {}
        ;(res as Array<{ key: string; url?: string }>).forEach(b => {
          if (b && b.key) urlMap[b.key] = b.url || ''
        })
        setBgmList(prev => prev.map(m => ({ ...m, url: urlMap[m.key] || '' })))
      }
    } catch (e) {
      console.warn('loadBgmList failed, BGM will be unavailable:', e)
    }
  }

  const stopBGM = () => {
    if (bgmAudioRef.current) {
      try {
        bgmAudioRef.current.stop()
        bgmAudioRef.current.destroy()
      } catch (e) {
        // ignore
      }
      bgmAudioRef.current = null
    }
  }

  // 小程序音频必须播放网络 URL、云存储 fileID(cloud://) 或本地临时路径，不能直接用 /public/... 代码包相对路径。
  // 网络 URL 与 cloud:// fileID 由 innerAudioContext 原生播放，直接透传；本地 /public 文件复制到 USER_DATA_PATH 临时目录。
  const resolveBgmSrc = (relPath: string): string => {
    if (relPath.startsWith('http') || relPath.startsWith('cloud://')) return relPath
    try {
      const fs = Taro.getFileSystemManager()
      const pkgPath = relPath.replace(/^\/public\//, '')
      const dest = `${Taro.env.USER_DATA_PATH}/${pkgPath.replace(/\//g, '_')}`
      try { fs.accessSync(dest) } catch (e) { fs.copyFileSync(pkgPath, dest) }
      return dest
    } catch (e) {
      console.warn('BGM resolve failed, fallback to raw path:', e)
      return relPath
    }
  }

  const startBGM = (key: string) => {
    stopBGM()
    const bgm = bgmList.find(b => b.key === key)
    if (!bgm || !bgm.url) return

    const ctx = Taro.createInnerAudioContext()
    ctx.src = resolveBgmSrc(bgm.url)
    ctx.loop = true
    ctx.volume = bgmVolume / 100
    ctx.onError(() => {
      // BGM 加载失败不影响主音频
      console.warn('BGM load failed:', bgm.url)
    })
    ctx.play()
    bgmAudioRef.current = ctx
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.stop()
      audioRef.current.destroy()
      audioRef.current = null
    }
    stopBGM()
    setIsPlaying(false)
    if (progressTimer.current) {
      clearInterval(progressTimer.current)
      progressTimer.current = null
    }
    if (chapterTimerRef.current) {
      clearInterval(chapterTimerRef.current)
      chapterTimerRef.current = null
    }
  }

  // 提取章节的可播放音频段：优先 audioUrls（多段细切），回退单 audioUrl
  const getSegments = (chapter: any): string[] => {
    if (chapter?.audioUrls && chapter.audioUrls.length) return chapter.audioUrls
    if (chapter?.audioUrl) return [chapter.audioUrl]
    return []
  }

  // 整章进度计时器（基于时长估算，多段/单段/演示模式一致，避免按真实 duration 在多段间乱跳）
  const startChapterProgress = () => {
    if (chapterTimerRef.current) clearInterval(chapterTimerRef.current)
    const total = totalSecs
    const stepMs = 200
    chapterTimerRef.current = setInterval(() => {
      setProgress(prev => {
        const next = prev + (stepMs / 1000) / total * 100
        if (next >= 100) {
          if (chapterTimerRef.current) { clearInterval(chapterTimerRef.current); chapterTimerRef.current = null }
          return 100
        }
        return next
      })
    }, stepMs)
  }

  // 播放某章的某一段；段播完自动下一段，整章播完进下一章
  const playSegment = (chapterIdx: number, segIdx: number) => {
    const chapter = story?.chapters?.[chapterIdx]
    if (!chapter) return
    const segments = getSegments(chapter)
    if (segIdx >= segments.length) {
      // 整章播完 → 下一章
      if (chapterIdx < (story?.chapters?.length || 0) - 1) playChapter(chapterIdx + 1)
      return
    }
    // 仅停主音频（保留 BGM）
    if (audioRef.current) {
      try { audioRef.current.stop(); audioRef.current.destroy() } catch (e) { /* ignore */ }
      audioRef.current = null
    }
    const url = segments[segIdx]
    const ctx = Taro.createInnerAudioContext()
    ctx.src = url.startsWith('http') ? url : API_BASE + url
    ctx.onPlay(() => setIsPlaying(true))
    ctx.onPause(() => setIsPlaying(false))
    ctx.onEnded(() => {
      setIsPlaying(false)
      playSegment(chapterIdx, segIdx + 1)
    })
    ctx.onError(() => {
      setIsPlaying(false)
      // 单段失败跳过，继续后续段/章
      playSegment(chapterIdx, segIdx + 1)
    })
    ctx.play()
    audioRef.current = ctx
  }

  const playChapter = (idx: number) => {
    if (!story) return
    stopAudio()

    const chapter = story.chapters?.[idx]
    if (!chapter) return

    setCurrentChapter(idx)
    setProgress(0)

    const segments = getSegments(chapter)
    if (segments.length === 0) {
      // 模拟播放进度（演示模式）
      simulateProgress()
      return
    }

    segIndexRef.current = 0
    startChapterProgress()

    // 联动启动 BGM（如果已选择）
    if (bgmType !== 'none') {
      startBGM(bgmType)
    }
    playSegment(idx, 0)
  }

  const simulateProgress = () => {
    setIsPlaying(true)
    // 联动启动 BGM（如果已选择）
    if (bgmType !== 'none') {
      startBGM(bgmType)
    }
    let p = 0
    progressTimer.current = setInterval(() => {
      p += 2
      if (p >= 100) {
        p = 100
        setIsPlaying(false)
        clearInterval(progressTimer.current)
        // 自动下一章
        if (currentChapter < (story?.chapters?.length || 1) - 1) {
          playChapter(currentChapter + 1)
        }
      }
      setProgress(p)
    }, 200)
  }

  const togglePlay = () => {
    if (isPlaying) {
      if (audioRef.current) audioRef.current.pause()
      stopBGM()
      if (progressTimer.current) { clearInterval(progressTimer.current); progressTimer.current = null }
      if (chapterTimerRef.current) { clearInterval(chapterTimerRef.current); chapterTimerRef.current = null }
      setIsPlaying(false)
    } else {
      if (audioRef.current) {
        audioRef.current.play()
        if (chapterTimerRef.current) { clearInterval(chapterTimerRef.current); chapterTimerRef.current = null }
        startChapterProgress()
        if (bgmType !== 'none') startBGM(bgmType)
      } else {
        playChapter(currentChapter)
      }
    }
  }

  const prevChapter = () => {
    if (currentChapter > 0) {
      playChapter(currentChapter - 1)
    } else {
      Taro.showToast({ title: '已经是第一章啦', icon: 'none' })
    }
  }

  const nextChapter = () => {
    if (story && currentChapter < story.chapters.length - 1) {
      playChapter(currentChapter + 1)
    } else {
      Taro.showToast({ title: '已经是最后一章啦', icon: 'none' })
    }
  }

  const handleBgmChange = (key: string) => {
    setBgmType(key)
    if (key === 'none') {
      stopBGM()
    } else {
      // 仅在主音频正在播放时才启动 BGM
      if (isPlaying) {
        startBGM(key)
      }
    }
  }

  const handleBgmVolumeChange = (e: any) => {
    const value = Number(e.detail.value)
    setBgmVolume(value)
    if (bgmAudioRef.current) bgmAudioRef.current.volume = value / 100
  }

  const toggleFav = () => {
    Taro.showToast({ title: story?.isFavorite ? '已取消收藏' : '已收藏', icon: 'none' })
  }

  const handleTimerChange = (e: any) => {
    const idx = Number(e.detail.value)
    const mins = TIMER_VALUES[idx]
    setSleepTimer(mins)
    if (mins > 0) {
      setTimerRemaining(mins * 60)
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current)
      sleepTimerRef.current = setInterval(() => {
        setTimerRemaining(prev => {
          if (prev === null || prev <= 1) {
            stopAudio()
            if (sleepTimerRef.current) clearInterval(sleepTimerRef.current)
            Taro.showToast({ title: '睡眠定时已到，已暂停播放', icon: 'none' })
            return null
          }
          return prev - 1
        })
      }, 1000)
      Taro.showToast({ title: `已开启 ${mins} 分钟睡眠定时`, icon: 'none' })
    } else {
      setTimerRemaining(null)
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current)
    }
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  if (!story) {
    return (
      <View className='player player--empty'>
        <Text className='player__empty-text'>暂无播放中的故事</Text>
        <BottomNav />
      </View>
    )
  }

  const chapter = story.chapters?.[currentChapter]
  const totalSecs = (story.duration === 'short' ? 3 : story.duration === 'medium' ? 5 : 8) * 60
  const elapsedSecs = Math.floor((progress / 100) * totalSecs)

  return (
    <View className='player'>
      {/* 顶部导航（统一 NavBar，无右侧图标，避免与微信胶囊重叠） */}
      <NavBar title='星夜陪伴播放器' showBack />

      {/* 封面插画 */}
      <View className='player__cover-wrap'>
        <View className='player__cover'>
          <SafeImage
            src={story.coverUrl}
            className='player__cover-img'
            mode='aspectFill'
            placeholder={<Icon name='book-open' size={48} color='#9ca3af' />}
            placeholderClassName='player__cover-placeholder'
          />

          {/* 声音标签 */}
          <View className='player__voice-badge'>
            <Icon name='volume' size={20} color='#fff' className='player__voice-badge-icon' />
            <Text className='player__voice-badge-text'>{story.voiceMode === 'single' ? '单一声音' : '单一声音 · 开发中'}</Text>
          </View>

          {/* Fallback 模式标签 */}
          {story.isFallbackAudio && (
            <View className='player__voice-badge player__voice-badge--fallback'>
              <View className='player__voice-badge-text'><Icon name='book-open' size={18} color='#fff' /><Text>演示模式</Text></View>
            </View>
          )}

          {/* 章节标签 */}
          <View className='player__chapter-badge'>
            <Text className='player__chapter-badge-text'>第 {currentChapter + 1}/{story.chapters?.length} 章节</Text>
          </View>
        </View>
      </View>

      {/* 标题信息 */}
      <View className='player__info'>
        <Text className='player__title'>{story.title}</Text>
        <View className='player__goal-tag'>
          <View className='player__goal-text'><Icon name='info' size={20} color='#6b7280' /><Text>教育目标：{story.educationalGoal}</Text></View>
        </View>
      </View>

      {/* 章节文本 */}
      <View className='player__text-card'>
        <ScrollView className='player__text-scroll' scrollY enableFlex>
          <Text className='player__text'>{chapter?.text || ''}</Text>
        </ScrollView>
      </View>

      {/* 进度条 */}
      <View className='player__progress'>
        <View className='player__progress-bar'>
          <View className='player__progress-fill' style={{ width: `${progress}%` }} />
        </View>
        <View className='player__progress-time'>
          <Text className='player__progress-text'>{formatTime(elapsedSecs)}</Text>
          <Text className='player__progress-text'>{formatTime(totalSecs)}</Text>
        </View>
      </View>

      {/* 播放控制 */}
      <View className='player__controls'>
        <View className='player__ctrl-btn' onClick={prevChapter}>
          <View className='player__ctrl-prev' />
        </View>
        <View className='player__ctrl-play' onClick={togglePlay}>
          {isPlaying ? <View className='player__ctrl-pause' /> : <View className='player__ctrl-play-icon' />}
        </View>
        <View className='player__ctrl-btn' onClick={nextChapter}>
          <View className='player__ctrl-next' />
        </View>
      </View>

      {/* 背景音乐 */}
      <View className='player__bgm'>
        <View className='player__bgm-header'>
          <View className='player__bgm-title-row'>
            <Icon name='music' size={24} color='#6b7280' />
            <Text className='player__bgm-title'>背景音乐</Text>
            <Text className='player__bgm-current'>{bgmList.find(b => b.key === bgmType)?.label || '关闭'}</Text>
          </View>
        </View>
        <ScrollView className='player__bgm-scroll' scrollX enableFlex showScrollbar={false}>
          <View className='player__bgm-track'>
            {bgmList.map(b => (
              <View key={b.key} className={`player__bgm-chip ${bgmType === b.key ? 'player__bgm-chip--active' : ''}`} onClick={() => handleBgmChange(b.key)}>
                <Icon name={b.icon} size={20} color={bgmType === b.key ? '#ffffff' : '#71717a'} />
                <Text className='player__bgm-chip-text'>{b.label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        <View className='player__bgm-volume'>
          <Icon name='volume' size={24} color='#6b7280' />
          <Text className='player__bgm-volume-label'>背景音量</Text>
          <Slider
            className='player__bgm-slider'
            value={bgmVolume}
            min={0}
            max={100}
            activeColor='#18181b'
            backgroundColor='#e4e4e7'
            blockColor='#18181b'
            blockSize={28}
            onChange={handleBgmVolumeChange}
          />
          <Text className='player__bgm-volume-value'>{bgmVolume}%</Text>
        </View>
      </View>

      {/* 底部操作栏 */}
      <View className='player__actions'>
        {/* 定时 */}
        <View className='player__timer'>
          <Icon name='moon' size={28} color='#6b7280' className='player__timer-icon' />
          <Picker mode='selector' range={TIMER_OPTIONS} value={TIMER_VALUES.indexOf(sleepTimer)} onChange={handleTimerChange}>
            <View className='player__timer-picker'>
              <Text className='player__timer-text'>{sleepTimer > 0 ? `${sleepTimer}分钟` : '定时关'}</Text>
            </View>
          </Picker>
          {timerRemaining !== null && (
            <View className='player__timer-count'>
              <Text className='player__timer-count-text'>
                {Math.floor(timerRemaining / 60)}:{String(timerRemaining % 60).padStart(2, '0')}
              </Text>
            </View>
          )}
        </View>

        {/* 收藏 */}
        <View className='player__action' onClick={toggleFav}>
          <Icon name={story.isFavorite ? 'heart-filled' : 'heart'} size={32} color={story.isFavorite ? '#ef4444' : '#9ca3af'} className='player__action-icon' />
          <Text className='player__action-text'>收藏故事</Text>
        </View>

        {/* 分享 */}
        <Button className='player__share-btn' openType='share' plain>
          <Icon name='share' size={32} color='#6b7280' className='player__action-icon' />
          <Text className='player__action-text'>分享给好友</Text>
        </Button>
      </View>
      <BottomNav />
    </View>
  )
}
