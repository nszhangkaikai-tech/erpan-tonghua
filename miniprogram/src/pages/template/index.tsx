import { useState, useMemo, useEffect } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useStore } from '../../store'
import Icon from '../../components/Icon'
import SafeImage from '../../components/SafeImage'
import Loading from '../../components/Loading'
import BottomNav from '../../components/BottomNav'
import NavBar from '../../components/NavBar'
import { fetchStoryConfig } from '../../utils/storyConfig'
import type { StoryConfig } from '../../utils/storyConfig'
import './index.scss'

// 主题筛选优先使用「主题单一数据源配置」（storyConfig）的分类，与向导页保持一致。
// 配置不可用（离线/首屏）时回退到由 db.templates 真实数据派生的扁平主题列表。

export default function Template() {
  const { state, refreshDb } = useStore()
  const { db, loading } = state
  const [search, setSearch] = useState('')
  const [themeFilter, setThemeFilter] = useState('all') // 'all' 或分类 key
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 6

  // 主题配置（用于分类筛选，与向导页同源）
  const [config, setConfig] = useState<StoryConfig>({ categories: [], themes: [], scenes: [] })
  const [configLoaded, setConfigLoaded] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetchStoryConfig()
      .then(cfg => { if (!cancelled) { setConfig(cfg); setConfigLoaded(true) } })
      .catch(() => { if (!cancelled) setConfigLoaded(true) })
    return () => { cancelled = true }
  }, [])

  useDidShow(() => {
    refreshDb()
  })

  const templates = db?.templates || []

  // 从真实模板库派生去重主题列表；首屏/离线无数据时回退本地兜底（配置不可用时的筛选回退）。
  const themeOptions = useMemo(() => {
    const fromTpl = Array.from(new Set(templates.map(t => t.theme).filter(Boolean)))
    return fromTpl.length ? fromTpl : ['睡前安抚', '勇敢自信', '友情人际', '情绪管理', '习惯养成', '认知启蒙']
  }, [templates])

  // 使用配置分类作为主筛选（配置有数据才启用，否则走扁平主题回退）
  const useConfigFilter = configLoaded && config.themes.length > 0
  const categoryTabs = useMemo(() => {
    if (!useConfigFilter) return []
    return [...config.categories].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }, [useConfigFilter, config.categories])
  const filtered = templates.filter(tpl => {
    const matchSearch = !search || tpl.name.toLowerCase().includes(search.toLowerCase()) || tpl.description.toLowerCase().includes(search.toLowerCase())
    let matchTheme: boolean
    if (useConfigFilter) {
      // 按分类筛选：将模板的 theme 解析为配置中的分类
      if (themeFilter === 'all') matchTheme = true
      else matchTheme = config.themes.find(t => t.key === tpl.theme)?.category === themeFilter
    } else {
      matchTheme = themeFilter === 'all' || tpl.theme === themeFilter
    }
    return matchSearch && matchTheme
  })

  // 搜索/筛选变化时重置到第一页
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const pageItems = filtered.slice(startIndex, startIndex + PAGE_SIZE)

  const resetPage = () => setCurrentPage(1)
  const prevPage = () => setCurrentPage(p => Math.max(1, p - 1))
  const nextPage = () => setCurrentPage(p => Math.min(totalPages, p + 1))

  // 搜索和筛选变化时自动回到第一页
  const handleSearch = (e: any) => {
    setSearch(e.detail.value)
    resetPage()
  }
  const handleThemeFilter = (theme: string) => {
    setThemeFilter(theme)
    resetPage()
  }

  const applyTemplate = (tpl: any) => {
    Taro.setStorageSync('bm_apply_template', tpl)
    Taro.navigateTo({ url: '/pages/wizard/index' })
  }

  return (
    <View className='template'>
      <NavBar title='推荐绘本模板库' />
      {/* 搜索和筛选 */}
      <View className='template__header'>
        <View className='template__search'>
          <Icon name='search' size={28} color='#9ca3af' className='template__search-icon' />
          <Input
            className='template__search-input'
            placeholder='搜索推荐绘本模板...'
            value={search}
            maxlength={40}
            confirmType='search'
            cursorSpacing={24}
            adjustPosition
            onInput={handleSearch}
          />
        </View>

        <ScrollView className='template__filters' scrollX>
          <View
            className={`template__filter ${themeFilter === 'all' ? 'template__filter--active' : ''}`}
            onClick={() => handleThemeFilter('all')}
          >
            <Text className='template__filter-text'>全部主题</Text>
          </View>
          {useConfigFilter
            ? categoryTabs.map(c => (
              <View
                key={c.key}
                className={`template__filter ${themeFilter === c.key ? 'template__filter--active' : ''}`}
                onClick={() => handleThemeFilter(c.key)}
              >
                <Text className='template__filter-text'>{c.name}</Text>
              </View>
              ))
            : themeOptions.map(t => (
              <View
                key={t}
                className={`template__filter ${themeFilter === t ? 'template__filter--active' : ''}`}
                onClick={() => handleThemeFilter(t)}
              >
                <Text className='template__filter-text'>{t}</Text>
              </View>
              ))}
        </ScrollView>
      </View>

      {/* 模板列表 */}
      {loading && !db ? (
        <Loading type='skeleton' card rows={3} />
      ) : (
      <ScrollView className='template__list' scrollY enableFlex>
          {pageItems.length === 0 ? (
            <View className='template__empty'>
              <Icon name='compass' size={64} color='#d1d5db' className='template__empty-icon' />
              <Text className='template__empty-text'>没有找到匹配的绘本模板</Text>
            </View>
          ) : (
            pageItems.map(tpl => (
            <View key={tpl.id} className='template__card'>
              <View className='template__card-cover'>
                <SafeImage
                  src={tpl.cover}
                  className='template__card-img'
                  mode='aspectFill'
                  placeholder={<Icon name='book-open' size={48} color='#9ca3af' />}
                  placeholderClassName='template__card-placeholder'
                />
              </View>

              <View className='template__card-body'>
                <View className='template__card-top'>
                  <View className='template__card-name-row'>
                    <Text className='template__card-name'>{tpl.name}</Text>
                    <View className='template__card-age'>
                      <Text className='template__card-age-text'>{tpl.ageGroup}</Text>
                    </View>
                    <View className='template__card-theme'>
                      <Text className='template__card-theme-text'>{tpl.theme}</Text>
                    </View>
                  </View>
                  <Text className='template__card-desc'>{tpl.description}</Text>
                  <View className='template__card-meta'>
                    <View className='template__card-meta-text'><Icon name='info' size={18} color='#9ca3af' /><Text>目标：{tpl.educationalGoal}</Text></View>
                    <Text className='template__card-meta-sep'>•</Text>
                    <View className='template__card-meta-text'><Icon name='compass' size={18} color='#9ca3af' /><Text>场景：{tpl.scene}</Text></View>
                  </View>
                </View>

                <View className='template__card-bottom'>
                  <View className='template__card-count'><Icon name='headphones' size={18} color='#a1a1aa' /><Text>{tpl.useCount} 位宝贝已听</Text></View>
                  <View className='template__card-use' onClick={() => applyTemplate(tpl)}>
                    <Text className='template__card-use-text'>套用此模板 ›</Text>
                  </View>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
      )}
      {/* 分页（仅当存在多页数据时显示） */}
      {filtered.length > PAGE_SIZE && (
        <View className='template__pagination'>
          <View
            className={`template__page-btn ${currentPage <= 1 ? 'template__page-btn--disabled' : ''}`}
            onClick={prevPage}
          >
            <Text className='template__page-btn-text'>‹</Text>
          </View>

          <Text className='template__page-info'>
            <Text className='template__page-current'>{currentPage}</Text>
            <Text className='template__page-sep'>/</Text>
            <Text className='template__page-total'>{totalPages}</Text>
          </Text>

          <View
            className={`template__page-btn ${currentPage >= totalPages ? 'template__page-btn--disabled' : ''}`}
            onClick={nextPage}
          >
            <Text className='template__page-btn-text'>›</Text>
          </View>
        </View>
      )}

      <BottomNav />
    </View>
  )
}
