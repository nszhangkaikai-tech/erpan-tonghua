import { useState, useEffect, useMemo } from 'react'
import { View, Text, Input, Textarea, Button, ScrollView, Slider } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useStore } from '../../store'
import Icon from '../../components/Icon'
import CategorizedThemePicker from '../../components/CategorizedThemePicker'
import SafeImage from '../../components/SafeImage'
import BottomNav from '../../components/BottomNav'
import NavBar from '../../components/NavBar'
import request from '../../utils/request'
import { fetchStoryConfig } from '../../utils/storyConfig'
import type { StoryConfig, ThemeItem } from '../../utils/storyConfig'
import './index.scss'

// 主题/场景/教育目标选项优先来自「主题单一数据源配置」（storyConfig，方案 B）。
// 该配置由管理后台统一维护，前后端一致；首屏/离线时回退到本地兜底或 db.templates，保证 UI 不空白。
const FALLBACK_THEME_OPTIONS = ['睡前安抚', '勇敢自信', '友情人际', '情绪管理', '习惯养成', '认知启蒙']
const FALLBACK_SCENE_OPTIONS = ['静谧森林', '温馨家庭', '太空星球', '海底世界', '魔法城堡', '恐龙乐园']
interface Character {
  id: string
  name: string
  role: string
  personality: string
}

export default function Wizard() {
  const { state } = useStore()
  const { db } = state

  // 主题/场景/教育目标单一数据源配置（方案 B：管理后台统一维护，前后端一致）
  const [config, setConfig] = useState<StoryConfig>({ categories: [], themes: [], scenes: [] })
  const [configLoaded, setConfigLoaded] = useState(false)

  // 拉取主题配置（带 TTL 缓存，离线/首屏也不阻塞）
  useEffect(() => {
    let cancelled = false
    fetchStoryConfig()
      .then(cfg => { if (!cancelled) { setConfig(cfg); setConfigLoaded(true) } })
      .catch(() => { if (!cancelled) setConfigLoaded(true) })
    return () => { cancelled = true }
  }, [])

  // 拉取故事作者列表（后台可维护；小程序端用于第二步选择）
  useEffect(() => {
    let cancelled = false
    request({ url: '/api/story/authors' })
      .then((res: any) => { if (!cancelled && res?.authors) setAuthors(res.authors) })
      .catch(() => { /* 作者列表非关键，失败静默 */ })
    return () => { cancelled = true }
  }, [])

  // 使用配置作为主来源（配置有数据才启用，否则走模板/兜底回退）
  const useConfig = configLoaded && config.themes.length > 0

  // 分类 Tab：全部 + 配置中的分类（按 sortOrder 排序）
  const categoryTabs = useMemo(() => {
    if (!useConfig) return []
    const sorted = [...config.categories].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    return sorted
  }, [useConfig, config.categories])

  // 无配置（离线/首屏）时的扁平主题回退列表
  const fallbackThemeList = useMemo(() => {
    const fromTpl = Array.from(new Set((db?.templates || []).map(t => t.theme).filter(Boolean)))
    return fromTpl.length ? fromTpl : FALLBACK_THEME_OPTIONS
  }, [db?.templates])

  // 统一成 ThemeItem[] 供 CategorizedThemePicker 使用
  const fallbackThemeItems = useMemo<ThemeItem[]>(() => {
    return fallbackThemeList.map((t, i) => ({
      key: t,
      name: t,
      category: 'default',
      enabled: true,
      sortOrder: i,
    }))
  }, [fallbackThemeList])

  // 场景选项：优先配置，回退模板派生
  const sceneOptions = useMemo(() => {
    if (useConfig) {
      return config.scenes
        .filter(s => s.enabled !== false)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map(s => s.key)
    }
    const fromTpl = Array.from(new Set((db?.templates || []).map(t => t.scene).filter(Boolean)))
    return fromTpl.length ? fromTpl : FALLBACK_SCENE_OPTIONS
  }, [useConfig, config.scenes, db?.templates])

  // 主题 → 教育目标 映射：优先配置，回退模板派生
  const goalsByTheme = useMemo(() => {
    const map: Record<string, string[]> = {}
    if (useConfig) {
      config.themes.forEach(t => {
        if (t.key && t.educationalGoals?.length) map[t.key] = t.educationalGoals
      })
    } else {
      ;(db?.templates || []).forEach(t => {
        if (!t.theme || !t.educationalGoal) return
        if (!map[t.theme]) map[t.theme] = []
        if (!map[t.theme].includes(t.educationalGoal)) map[t.theme].push(t.educationalGoal)
      })
    }
    return map
  }, [useConfig, config.themes, db?.templates])

  // 主题选中：设置 theme 并联动默认教育目标
  const handleThemeSelect = (key: string) => {
    if (key === '自定义') {
      setTheme('自定义')
      setGoal('自定义')
    } else {
      setTheme(key)
      setGoal(goalsByTheme[key]?.[0] || '')
    }
  }

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const [theme, setTheme] = useState('')
  const [goal, setGoal] = useState('')
  const [customTheme, setCustomTheme] = useState('')
  const [customGoal, setCustomGoal] = useState('')

  const [scene, setScene] = useState('')
  const [customScene, setCustomScene] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [characters, setCharacters] = useState<Character[]>([
    { id: 'char_1', name: '', role: '', personality: '' },
  ])

  const [duration, setDuration] = useState<'short' | 'medium' | 'long'>('short')
  const [customDurationMinutes, setCustomDurationMinutes] = useState(10) // 长篇自定义时长：10~30分钟
  const [voiceId, setVoiceId] = useState('')
  const [voiceMode, setVoiceMode] = useState<'single' | 'multi' | 'narrator_ai'>('single')
  const [bgmType, setBgmType] = useState('none')

  // 故事适用年龄范围（第三步录入/选择；可空，空则回退宝宝档案年龄）
  const AGE_RANGES = ['0-3岁', '3-6岁', '6-9岁', '9-12岁']
  const [targetAgeRange, setTargetAgeRange] = useState('')

  // 故事作者体系（第二步选择；从后台接口拉取）
  const [authorId, setAuthorId] = useState('')
  const [authors, setAuthors] = useState<any[]>([])

  // 将适龄范围解析为提示词用的单一代表年龄（如「3-6岁」→ 4）
  const resolveAgeNum = (range: string): number => {
    if (range) {
      const m = range.match(/(\d+)\s*-\s*(\d+)/)
      if (m) return Math.round((Number(m[1]) + Number(m[2])) / 2)
      const s = range.match(/(\d+)/)
      if (s) return Number(s[1])
    }
    return db?.profile?.age || 4
  }

  // ②③ 模式（多角色分音 / 旁白+AI）当前 StepFun TTS 不支持，降级为单一音色（①）行为，仅前端提示"开发中"
  const isVoiceModeDegraded = voiceMode === 'multi' || voiceMode === 'narrator_ai'

  // 回填模板
  useEffect(() => {
    const tpl = Taro.getStorageSync('bm_apply_template')
    if (tpl) {
      setTemplateId(tpl.id || '')
      setTheme(tpl.theme || '')
      setGoal(tpl.educationalGoal || '')
      setScene(tpl.scene || '')
      if (tpl.mainCharacter) {
        setCharacters([{ id: 'char_tpl', name: tpl.mainCharacter.name || '', role: tpl.mainCharacter.role || '', personality: tpl.mainCharacter.personality || '' }])
      }
      if (tpl.duration) setDuration(tpl.duration)
      setStep(2)
      Taro.removeStorageSync('bm_apply_template')
    }
  }, [])

  // 默认选中第一个声音
  useEffect(() => {
    if (db?.voiceClones?.length && !voiceId) {
      setVoiceId(db.voiceClones[0].id)
    }
  }, [db?.voiceClones])

  const updateChar = (idx: number, key: keyof Character, value: string) => {
    setCharacters(prev => prev.map((c, i) => i === idx ? { ...c, [key]: value } : c))
  }

  const addChar = () => {
    if (characters.length < 4) {
      setCharacters(prev => [...prev, { id: `char_${Date.now()}`, name: '', role: '', personality: '' }])
    }
  }

  const removeChar = (idx: number) => {
    if (characters.length > 1) {
      setCharacters(prev => prev.filter((_, i) => i !== idx))
    }
  }

  const applyRecommendedTemplate = (tpl: any) => {
    setTemplateId(tpl.id || '')
    setTheme(tpl.theme || '')
    setGoal(tpl.educationalGoal || '')
    setScene(tpl.scene || '')
    if (tpl.mainCharacter) {
      setCharacters([{ id: `char_tpl_${tpl.id || Date.now()}`, name: tpl.mainCharacter.name || '', role: tpl.mainCharacter.role || '', personality: tpl.mainCharacter.personality || '' }])
    }
    if (tpl.duration) setDuration(tpl.duration)
    setStep(2)
  }

  // 内容安全：拦截弹窗 / 改写建议弹窗
  const [safetyBlock, setSafetyBlock] = useState<any>(null)
  const [safetyRewrite, setSafetyRewrite] = useState<any>(null)

  // 统一生成入口；override 用于安全改写后「一键重试」，绕过 React 异步 state 时序
  const doGenerate = async (override: any = {}) => {
    const finalTheme = override.theme !== undefined ? override.theme
      : (theme === '自定义' ? customTheme.trim() : theme)
    const finalGoal = override.educationalGoal !== undefined ? override.educationalGoal
      : ((theme === '自定义' || goal === '自定义') ? customGoal.trim() : goal)
    const finalScene = override.scene !== undefined ? override.scene
      : (scene === '自定义' ? customScene.trim() : scene)
    const finalChars = override.mainCharacters !== undefined ? override.mainCharacters
      : characters.filter(c => c.name.trim()).map(c => ({
        name: c.name.trim(), role: c.role.trim(), personality: c.personality.trim(),
      }))

    if (!finalTheme) {
      Taro.showToast({ title: '请选择故事主题', icon: 'none' })
      return
    }

    setSubmitting(true)
    Taro.showLoading({ title: 'AI 正在创作...', mask: true })

    try {
      const result = await request({
        url: '/api/story/generate-text',
        method: 'POST',
        data: {
          theme: finalTheme,
          templateId: templateId || undefined,
          educationalGoal: finalGoal,
          scene: finalScene,
          mainCharacters: finalChars,
          duration,
          age: resolveAgeNum(targetAgeRange),
          targetAgeRange: targetAgeRange || undefined,
          authorId: authorId || undefined,
          isRetry: !!override.isRetry,
        },
      })

      Taro.hideLoading()

      if (result?.story) {
        Taro.setStorageSync('bm_draft_story', result.story)
        Taro.setStorageSync('bm_wizard_voice', { voiceId, voiceMode, bgmType })
        Taro.navigateTo({ url: '/pages/story-preview/index' })
      } else if (result?.safetyBlocked) {
        // 高危阻断（政治/色情等），不消耗额度，仅提示家长改用温和词汇
        setSafetyBlock(result)
      } else if (result?.safetyRewriteSuggestion) {
        // 儿童友好改写建议（暴力/脏话等），可一键应用后重新生成
        setSafetyRewrite(result)
      } else {
        Taro.showToast({ title: result?.message || '生成失败，请重试', icon: 'none' })
      }
    } catch (e: any) {
      Taro.hideLoading()
      Taro.showToast({ title: e?.data?.error || '生成失败，请重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = () => doGenerate()

  // 安全改写：一键把命中字段替换为建议值，并立即重新生成
  const applyRewriteAndRetry = (s: any) => {
    const { fieldPath, replacedValue } = s || {}
    if (fieldPath === 'theme') {
      setTheme('自定义'); setCustomTheme(replacedValue)
      return doGenerate({ theme: replacedValue })
    }
    if (fieldPath === 'educationalGoal') {
      setGoal('自定义'); setCustomGoal(replacedValue)
      return doGenerate({ educationalGoal: replacedValue })
    }
    if (fieldPath === 'scene') {
      setScene('自定义'); setCustomScene(replacedValue)
      return doGenerate({ scene: replacedValue })
    }
    const m = /^mainCharacters\[(\d+)\]\.(\w+)$/.exec(fieldPath || '')
    if (m) {
      const idx = Number(m[1]); const key = m[2] as keyof Character
      const newChars = characters.map((c, i) => i === idx ? { ...c, [key]: replacedValue } : c)
      setCharacters(newChars)
      const finalChars = newChars.filter(c => c.name.trim()).map(c => ({
        name: c.name.trim(), role: c.role.trim(), personality: c.personality.trim(),
      }))
      return doGenerate({ mainCharacters: finalChars })
    }
    // 兜底：无法定位字段时仅关闭弹窗，由家长手动修改
    setSafetyRewrite(null)
  }

  const goals = goalsByTheme[theme] || []
  const voiceClones = db?.voiceClones || []

  return (
    <View className='wizard'>
      {/* 顶部导航（统一 NavBar，无右侧图标，避免与微信胶囊重叠） */}
      <NavBar title={`有声绘本定制（步骤 ${step}/5）`} showBack />

      {/* 步骤进度条 */}
      <View className='wizard__steps'>
        {[1, 2, 3, 4, 5].map(s => (
          <View key={s} className='wizard__step-item'>
            <View className={`wizard__step-dot ${step >= s ? 'wizard__step-dot--active' : ''}`}>
              <Text className={`wizard__step-num ${step >= s ? 'wizard__step-num--active' : ''}`}>{s}</Text>
            </View>
            {s < 5 && <View className={`wizard__step-line ${step > s ? 'wizard__step-line--done' : ''}`} />}
          </View>
        ))}
      </View>

      <ScrollView className='wizard__content' scrollY enableFlex>
        <View className='wizard__content-inner'>
          <Text className='wizard__page-title'>宝宝资料</Text>

        {/* Step 1: 创作方式 */}
        {step === 1 && (
          <View className='wizard__panel'>
            <Text className='wizard__panel-title'>请选择定制创作方式</Text>
            <View className='wizard__choice-card' onClick={() => { setTemplateId(''); setStep(2) }}>
              <View className='wizard__choice-title'><Icon name='edit' size={24} color='#18181b' /><Text>自定义新创作</Text></View>
              <Text className='wizard__choice-desc'>完全自由选择或手动输入故事主题、教养痛点、故事场景及主角设定，由 AI 极速为你编写专属绘本。</Text>
            </View>

            <View className='wizard__recommend-header'>
              <Text className='wizard__recommend-title'>🌟 推荐直接套用精选模板：</Text>
              <Text className='wizard__recommend-hint'>一键快捷定制</Text>
            </View>
            <View className='wizard__recommendations'>
              {(db?.templates || []).slice(0, 3).map(tpl => (
                <View key={tpl.id} className='wizard__recommend-card'>
                  <View className='wizard__recommend-cover'>
                    <SafeImage
                      src={tpl.cover}
                      className='wizard__recommend-img'
                      mode='aspectFill'
                      placeholder={<Icon name='book-open' size={36} color='#9ca3af' />}
                      placeholderClassName='wizard__recommend-placeholder'
                    />
                  </View>
                  <View className='wizard__recommend-body'>
                    <View className='wizard__recommend-name-row'>
                      <Text className='wizard__recommend-name'>{tpl.name}</Text>
                      <Text className='wizard__recommend-age'>{tpl.ageGroup}</Text>
                    </View>
                    <Text className='wizard__recommend-desc'>{tpl.description}</Text>
                    <View className='wizard__recommend-bottom'>
                      <Text className='wizard__recommend-goal'>🎯 {tpl.educationalGoal}</Text>
                      <View className='wizard__recommend-use' onClick={() => applyRecommendedTemplate(tpl)}>
                        <Text className='wizard__recommend-use-text'>套用 →</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Step 2: 主题+目标 */}
        {step === 2 && (
          <View className='wizard__panel'>
            <View className='wizard__section'>
            <Text className='wizard__label'>1. 选择故事主题</Text>
            <CategorizedThemePicker
              categories={categoryTabs}
              themes={config.themes.length ? config.themes : fallbackThemeItems}
              value={theme}
              onSelect={handleThemeSelect}
              searchable
              customEntry
              customActive={theme === '自定义'}
            />

              {theme === '自定义' && (
                <View className='wizard__custom-panel'>
                  <View className='wizard__custom-field'>
                    <Text className='wizard__custom-label'>输入自定义主题：</Text>
                    <Input className='wizard__custom-input' placeholder='例如：财商教育、克服挑食' value={customTheme} maxlength={40} confirmType='done' cursorSpacing={24} adjustPosition onInput={e => setCustomTheme(e.detail.value)} />
                  </View>
                  <View className='wizard__custom-field'>
                    <Text className='wizard__custom-label'>输入自定义教育目标：</Text>
                    <Input className='wizard__custom-input' placeholder='例如：不乱花钱、按时吃饭' value={customGoal} maxlength={60} confirmType='done' cursorSpacing={24} adjustPosition onInput={e => setCustomGoal(e.detail.value)} />
                  </View>
                </View>
              )}
            </View>

            {theme !== '自定义' && theme && (
              <View className='wizard__section'>
                <Text className='wizard__label'>2. 定制教育目标（故事导向）</Text>
                <View className='wizard__goals'>
                  {goals.map(g => (
                    <View key={g} className={`wizard__goal ${goal === g ? 'wizard__goal--active' : ''}`} onClick={() => setGoal(g)}>
                      <Text className='wizard__goal-text'>{g}</Text>
                      {goal === g && <Text className='wizard__goal-check'>✓</Text>}
                    </View>
                  ))}
                  <View className={`wizard__goal wizard__goal--custom ${goal === '自定义' ? 'wizard__goal--active' : ''}`} onClick={() => setGoal('自定义')}>
                    <View className='wizard__goal-text'><Icon name='edit' size={20} color='#6b7280' /><Text>自定义教育目标...</Text></View>
                    {goal === '自定义' && <Text className='wizard__goal-check'>✓</Text>}
                  </View>
                </View>

                {goal === '自定义' && (
                  <View className='wizard__custom-panel'>
                    <Text className='wizard__custom-label'>输入自定义教育目标：</Text>
                    <Input className='wizard__custom-input' placeholder='如：学会如何向别人打招呼' value={customGoal} maxlength={60} confirmType='done' cursorSpacing={24} adjustPosition onInput={e => setCustomGoal(e.detail.value)} />
                  </View>
                )}
              </View>
            )}

            {/* 故事作者选择（第二步新增） */}
            <View className='wizard__section'>
              <Text className='wizard__label'>3. 选择故事作者</Text>
              <View className='wizard__tags'>
                <View className={`wizard__tag ${authorId === '' ? 'wizard__tag--active' : ''}`} onClick={() => setAuthorId('')}>
                  <Text className='wizard__tag-text'>系统默认</Text>
                </View>
                {authors.filter(a => a.enabled !== false).map(a => (
                  <View key={a.id} className={`wizard__tag ${authorId === a.id ? 'wizard__tag--active' : ''}`} onClick={() => setAuthorId(a.id)}>
                    <Text className='wizard__tag-text'>{a.name}{a.title ? `（${a.title}）` : ''}</Text>
                  </View>
                ))}
              </View>
              {authorId && authors.find(a => a.id === authorId)?.bio && (
                <Text className='wizard__custom-label'>{authors.find(a => a.id === authorId)?.bio}</Text>
              )}
            </View>
          </View>
        )}

        {/* Step 3: 适用年龄 + 场景 + 角色 */}
        {step === 3 && (
          <View className='wizard__panel'>
            {/* 故事适用年龄（第三步新增） */}
            <View className='wizard__section'>
              <Text className='wizard__label'>1. 故事适用年龄</Text>
              <View className='wizard__tags'>
                {AGE_RANGES.map(r => (
                  <View key={r} className={`wizard__tag ${targetAgeRange === r ? 'wizard__tag--active' : ''}`} onClick={() => setTargetAgeRange(r)}>
                    <Text className='wizard__tag-text'>{r}</Text>
                  </View>
                ))}
                <View className={`wizard__tag ${targetAgeRange === '' ? 'wizard__tag--active' : ''}`} onClick={() => setTargetAgeRange('')}>
                  <Text className='wizard__tag-text'>随宝宝档案（{db?.profile?.age || 4}岁）</Text>
                </View>
              </View>
              <Text className='wizard__custom-label'>未选择时，将使用宝宝档案中的年龄（{db?.profile?.age || 4}岁）自动适配内容难度。</Text>
            </View>

            <View className='wizard__section'>
              <Text className='wizard__label'>2. 选择故事发生场景</Text>
              <View className='wizard__tags'>
                {sceneOptions.map(s => (
                  <View key={s} className={`wizard__tag ${scene === s ? 'wizard__tag--active' : ''}`} onClick={() => setScene(s)}>
                    <Text className='wizard__tag-text'>{s}</Text>
                  </View>
                ))}
                <View className={`wizard__tag wizard__tag--custom ${scene === '自定义' ? 'wizard__tag--active' : ''}`} onClick={() => setScene('自定义')}>
                  <View className='wizard__tag-text'><Icon name='edit' size={20} color='#6b7280' /><Text>自定义场景</Text></View>
                </View>
              </View>
              {scene === '自定义' && (
                <View className='wizard__custom-panel'>
                  <Text className='wizard__custom-label'>输入自定义故事场景：</Text>
                  <Input className='wizard__custom-input' placeholder='例如：糖果王国、太空城堡' value={customScene} maxlength={60} confirmType='done' cursorSpacing={24} adjustPosition onInput={e => setCustomScene(e.detail.value)} />
                </View>
              )}
            </View>

            <View className='wizard__section'>
              <View className='wizard__char-header'>
                <Text className='wizard__label'>3. 主人公设定（支持多个）</Text>
                {characters.length < 4 && (
                  <View className='wizard__char-add' onClick={addChar}>
                    <Text className='wizard__char-add-text'>+ 添加角色</Text>
                  </View>
                )}
              </View>

              {characters.map((char, idx) => (
                <View key={char.id} className='wizard__char-card'>
                  <View className='wizard__char-card-header'>
                    <View className='wizard__char-card-title'><Icon name='user' size={22} color='#18181b' /><Text>主人公 #{idx + 1}{idx === 0 ? '（主导）' : ''}</Text></View>
                    {characters.length > 1 && (
                      <Text className='wizard__char-card-del' onClick={() => removeChar(idx)}>删除</Text>
                    )}
                  </View>
                  <Input className='wizard__char-input' placeholder='名字/昵称，如：刺刺、皮皮' value={char.name} maxlength={20} confirmType='done' cursorSpacing={24} adjustPosition onInput={e => updateChar(idx, 'name', e.detail.value)} />
                  <View className='wizard__char-row'>
                    <Input className='wizard__char-input wizard__char-input--half' placeholder='种族/身份，如：小刺猬' value={char.role} maxlength={30} confirmType='done' cursorSpacing={24} adjustPosition onInput={e => updateChar(idx, 'role', e.detail.value)} />
                    <Input className='wizard__char-input wizard__char-input--half' placeholder='性格特征，如：善良懂事' value={char.personality} maxlength={30} confirmType='done' cursorSpacing={24} adjustPosition onInput={e => updateChar(idx, 'personality', e.detail.value)} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Step 4: 时长+声音+模式+BGM */}
        {step === 4 && (
          <View className='wizard__panel'>
            <View className='wizard__section'>
              <Text className='wizard__label'>1. 选择期望播放时长 ⏳</Text>
              <View className='wizard__duration'>
                {(['short', 'medium', 'long'] as const).map(d => (
                  <View key={d} className={`wizard__duration-btn ${duration === d ? 'wizard__duration-btn--active' : ''}`} onClick={() => setDuration(d)}>
                    <Text className='wizard__duration-text'>{d === 'short' ? '短篇(约3分)' : d === 'medium' ? '中篇(约5分)' : '长篇(可自定义)'}</Text>
                  </View>
                ))}
              </View>
              {/* 长篇自定义时长面板 */}
              {duration === 'long' && (
                <View className='wizard__custom-duration'>
                  <View className='wizard__custom-duration-header'>
                    <Text className='wizard__custom-duration-label'>设定长篇时长：</Text>
                    <Text className='wizard__custom-duration-value'>{customDurationMinutes} 分钟（不超过30分钟）</Text>
                  </View>
                  <View className='wizard__custom-duration-slider-row'>
                    <Slider
                      className='wizard__custom-duration-slider'
                      min={10}
                      max={30}
                      step={1}
                      value={customDurationMinutes}
                      activeColor='#18181b'
                      backgroundColor='#e4e4e7'
                      blockSize={28}
                      blockColor='#18181b'
                      onChange={(e) => setCustomDurationMinutes(e.detail.value)}
                    />
                    <Input
                      className='wizard__custom-duration-input'
                      type='number'
                      value={String(customDurationMinutes)}
                      onInput={(e) => {
                        const val = parseInt(e.detail.value, 10)
                        if (!isNaN(val)) setCustomDurationMinutes(Math.min(30, Math.max(10, val)))
                      }}
                    />
                    <Text className='wizard__custom-duration-unit'>分钟</Text>
                  </View>
                </View>
              )}
            </View>

            <View className='wizard__section'>
              <View className='wizard__label icon-inline'>2. 选择讲故事配音 <Icon name='volume' size={24} /></View>
              {voiceClones.length > 0 ? (
                <View className='wizard__voices'>
                  {voiceClones.map(v => (
                    <View key={v.id} className={`wizard__voice ${voiceId === v.id ? 'wizard__voice--active' : ''}`} onClick={() => setVoiceId(v.id)}>
                      <View className='wizard__voice-icon icon-inline'><Icon name='volume' size={24} /></View>
                      <View className='wizard__voice-info'>
                        <Text className='wizard__voice-name'>{v.name}</Text>
                        <Text className='wizard__voice-type'>{v.speakerType === 'mother' ? '妈妈' : v.speakerType === 'father' ? '爸爸' : '其他'}</Text>
                      </View>
                      {voiceId === v.id && <Text className='wizard__voice-check'>✓</Text>}
                    </View>
                  ))}
                </View>
              ) : (
                <View className='wizard__no-voice'>
                  <View className='wizard__no-voice-text'><Icon name='info' size={20} color='#6b7280' /><Text>暂无保存的家庭声音，请先去克隆声音</Text></View>
                  <View className='wizard__no-voice-btn' onClick={() => Taro.reLaunch({ url: '/pages/studio/index' })}>
                    <Icon name='mic' size={24} color='#6C8EEF' />
                    <Text className='wizard__no-voice-btn-text'>立即去录制克隆</Text>
                  </View>
                </View>
              )}
            </View>

            <View className='wizard__section'>
            <Text className='wizard__label'>3. 有声发声模式</Text>
              <View className='wizard__modes'>
                {([
                  { key: 'single', label: '单一声音讲完整故事' },
                  { key: 'multi', label: '不同角色不同声音' },
                  { key: 'narrator_ai', label: '家长旁白+AI角色声音' },
                ] as const).map(m => (
                  <View key={m.key} className={`wizard__mode ${voiceMode === m.key ? 'wizard__mode--active' : ''}`} onClick={() => setVoiceMode(m.key)}>
                    <Text className='wizard__mode-text'>{m.label}</Text>
                  </View>
                ))}
              </View>
              {isVoiceModeDegraded && (
                <View className='wizard__mode-hint'>
                  <Icon name='info' size={22} color='#d97706' />
                  <Text className='wizard__mode-hint-text'>该模式正在开发中，当前使用单一音色</Text>
                </View>
              )}
            </View>

          </View>
        )}

        {/* Step 5: 确认 */}
        {step === 5 && (
          <View className='wizard__panel'>
            <View className='wizard__panel-title'><Icon name='book-open' size={26} color='#18181b' /><Text>确认绘本定制需求</Text></View>

            <View className='wizard__summary'>
              <View className='wizard__summary-row'>
                <Text className='wizard__summary-label'>故事主题</Text>
                <Text className='wizard__summary-value'>{theme === '自定义' ? `自定义 (${customTheme || '未填写'})` : theme}</Text>
              </View>
              <View className='wizard__summary-row'>
                <Text className='wizard__summary-label'>教养引导目标</Text>
                <Text className='wizard__summary-value'>{(theme === '自定义' || goal === '自定义') ? `自定义 (${customGoal || '未填写'})` : goal}</Text>
              </View>
              <View className='wizard__summary-row'>
                <Text className='wizard__summary-label'>故事场景</Text>
                <Text className='wizard__summary-value'>{scene === '自定义' ? `自定义 (${customScene || '未填写'})` : scene}</Text>
              </View>
              <View className='wizard__summary-row'>
                <Text className='wizard__summary-label'>主角人设</Text>
                <Text className='wizard__summary-value'>{characters.filter(c => c.name).map(c => c.name).join('、') || '宝贝'}</Text>
              </View>
              <View className='wizard__summary-row'>
                <Text className='wizard__summary-label'>故事篇幅</Text>
                <Text className='wizard__summary-value'>{duration === 'short' ? '短篇(约3分)' : duration === 'medium' ? '中篇(约5分)' : `长篇(${customDurationMinutes}分钟)`}</Text>
              </View>
              <View className='wizard__summary-row'>
                <Text className='wizard__summary-label'>配音声音</Text>
                <Text className='wizard__summary-value'>{voiceClones.find(v => v.id === voiceId)?.name || '默认声音'}</Text>
              </View>
              <View className='wizard__summary-row'>
                <Text className='wizard__summary-label'>发声模式</Text>
                <Text className='wizard__summary-value'>{voiceMode === 'single' ? '单一声音' : voiceMode === 'multi' ? '角色分音（开发中·单一音色）' : '旁白+AI角色（开发中·单一音色）'}</Text>
              </View>
              <View className='wizard__summary-row'>
                <Text className='wizard__summary-label'>适用年龄</Text>
                <Text className='wizard__summary-value'>{targetAgeRange || `${db?.profile?.age || 4} 岁`}</Text>
              </View>
              <View className='wizard__summary-row wizard__summary-row--last'>
                <Text className='wizard__summary-label'>故事作者</Text>
                <Text className='wizard__summary-value'>{authors.find(a => a.id === authorId)?.name || '系统默认'}</Text>
              </View>
            </View>

            <View className='wizard__quota-tip'>
              <View className='wizard__quota-tip-text'><Icon name='info' size={20} color='#d97706' /><Text>本次操作将扣除 <Text className='wizard__quota-tip-bold'>1 次</Text> 故事生成额度</Text></View>
            </View>
          </View>
        )}
        </View>
      </ScrollView>

      {/* 底部按钮 */}
      <View className='wizard__footer'>
        {step > 1 && (
          <View className='wizard__footer-back' onClick={() => setStep(prev => prev - 1)}>
            <Text className='wizard__footer-back-text'>上一步</Text>
          </View>
        )}
        {step < 5 ? (
          <View className='wizard__footer-next' onClick={() => setStep(prev => prev + 1)}>
            <Text className='wizard__footer-next-text'>继续下一步 ›</Text>
          </View>
        ) : (
          <Button className='wizard__footer-submit' loading={submitting} disabled={submitting} onClick={handleSubmit}>
            <Icon name='sparkles' size={24} color='#ffffff' />
            <Text>开始生成文本故事</Text>
          </Button>
        )}
      </View>
      <BottomNav />

      {/* 内容安全拦截弹窗（高危阻断，不消耗额度） */}
      {safetyBlock && (
        <View className='safety-modal safety-modal--block' onClick={() => setSafetyBlock(null)}>
          <View className='safety-modal__panel' onClick={e => e.stopPropagation()}>
            <View className='safety-modal__icon safety-modal__icon--block'>
              <Icon name='lock' size={40} color='#ffffff' />
            </View>
            <Text className='safety-modal__title'>安全守护拦截</Text>
            <Text className='safety-modal__desc'>{safetyBlock.message}</Text>
            <View className='safety-modal__actions'>
              <View className='safety-modal__btn safety-modal__btn--primary' onClick={() => setSafetyBlock(null)}>
                <Text>我知道了</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 温馨安全改写建议弹窗（一键改写） */}
      {safetyRewrite && (
        <View className='safety-modal safety-modal--rewrite' onClick={() => setSafetyRewrite(null)}>
          <View className='safety-modal__panel' onClick={e => e.stopPropagation()}>
            <View className='safety-modal__icon safety-modal__icon--rewrite'>
              <Icon name='sparkles' size={40} color='#ffffff' />
            </View>
            <Text className='safety-modal__title'>温馨安全改写建议</Text>
            <Text className='safety-modal__desc'>{safetyRewrite.message}</Text>
            <View className='safety-modal__compare'>
              <View className='safety-modal__compare-row'>
                <Text className='safety-modal__compare-label'>原设定</Text>
                <Text className='safety-modal__compare-old'>{safetyRewrite.originalValue}</Text>
              </View>
              <View className='safety-modal__compare-row'>
                <Text className='safety-modal__compare-label'>建议改为</Text>
                <Text className='safety-modal__compare-new'>{safetyRewrite.replacedValue}</Text>
              </View>
            </View>
            <View className='safety-modal__actions'>
              <View className='safety-modal__btn safety-modal__btn--ghost' onClick={() => setSafetyRewrite(null)}>
                <Text>我自己修改</Text>
              </View>
              <View className='safety-modal__btn safety-modal__btn--primary' onClick={() => applyRewriteAndRetry(safetyRewrite)}>
                <Text>一键应用并生成</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
