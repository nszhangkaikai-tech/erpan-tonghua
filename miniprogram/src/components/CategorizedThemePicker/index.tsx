import { useState, useMemo, useCallback, memo } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Icon from '../Icon'
import type { ThemeCategory, ThemeItem } from '../../utils/storyConfig'
import './index.scss'

export interface CategorizedThemePickerProps {
  /** 分类（来自 storyConfig.categories）；为空时会自动归入默认分类 */
  categories: ThemeCategory[]
  /** 主题列表（来自 storyConfig.themes 或本地兜底） */
  themes: ThemeItem[]
  /** 当前选中的主题 key */
  value?: string
  /** 选中回调（key 为 '自定义' 时表示自定义入口） */
  onSelect: (key: string) => void
  /** 是否显示搜索框，默认 true */
  searchable?: boolean
  /** 是否在末尾显示「自定义主题」入口，默认 false */
  customEntry?: boolean
  /** 自定义入口是否处于选中态 */
  customActive?: boolean
}

interface Group {
  category: ThemeCategory
  items: ThemeItem[]
}

// 单个主题标签（memo：选中态变化只重渲染自身）
const ThemeTag = memo(({ item, active, onSelect }: { item: ThemeItem; active: boolean; onSelect: (k: string) => void }) => (
  <View className={`ctp__tag ${active ? 'ctp__tag--active' : ''}`} onClick={() => onSelect(item.key)}>
    <Text className='ctp__tag-text'>{item.key}</Text>
    {item.mood ? <Text className='ctp__tag-sub'>{item.mood}</Text> : null}
  </View>
))

// 单个分类分区（memo：仅展开态 / 选中态变化才重渲染）
const CategorySection = memo(({ group, expanded, onToggle, activeKey, onSelect }: {
  group: Group
  expanded: boolean
  onToggle: () => void
  activeKey?: string
  onSelect: (k: string) => void
}) => (
  <View className='ctp__section'>
    <View className='ctp__section-header' onClick={onToggle}>
      <Text className='ctp__section-title'>{group.category.name}</Text>
      <Text className='ctp__section-count'>{group.items.length}</Text>
      <Icon
        name='chevron-right'
        size={28}
        color='#a1a1aa'
        className={expanded ? 'ctp__chevron ctp__chevron--open' : 'ctp__chevron'}
      />
    </View>
    {expanded ? (
      <View className='ctp__tags'>
        {group.items.map(it => (
          <ThemeTag key={it.key} item={it} active={activeKey === it.key} onSelect={onSelect} />
        ))}
      </View>
    ) : null}
  </View>
))

const CategorizedThemePicker: React.FC<CategorizedThemePickerProps> = ({
  categories,
  themes,
  value,
  onSelect,
  searchable = true,
  customEntry = false,
  customActive = false,
}) => {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    // 默认展开：当前选中主题所属分类；无分类时展开默认分类；否则展开第一个
    const valCat = themes.find(t => t.key === value)?.category
    const cats = categories.length
      ? categories
      : [{ key: 'default', name: '故事主题', sortOrder: 0, enabled: true } as ThemeCategory]
    const init: Record<string, boolean> = {}
    cats.forEach((c, i) => { init[c.key] = i === 0 ? !valCat : c.key === valCat })
    return init
  })

  // 按分类分组 + 过滤（启用态 + 搜索）；未提供分类时全部归入默认分类
  const groups = useMemo<Group[]>(() => {
    const q = search.trim().toLowerCase()
    const cats = categories.length
      ? categories
      : [{ key: 'default', name: '故事主题', sortOrder: 0, enabled: true } as ThemeCategory]
    return cats
      .map(c => ({
        category: c,
        items: themes
          .filter(t => (categories.length ? t.category === c.key : true) && t.enabled !== false)
          .filter(t => !q || t.key.toLowerCase().includes(q) || (t.mood || '').toLowerCase().includes(q))
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
      }))
      .filter(g => g.items.length > 0)
  }, [categories, themes, search])

  // 搜索时自动展开所有命中分区；否则用户手动控制
  const isSearching = search.trim().length > 0
  const isOpen = useCallback((key: string) => isSearching || !!expanded[key], [isSearching, expanded])

  const toggle = useCallback((key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  return (
    <View className='ctp'>
      {searchable ? (
        <View className='ctp__search'>
          <Icon name='search' size={28} color='#9ca3af' className='ctp__search-icon' />
          <Input
            className='ctp__search-input'
            placeholder='搜索故事主题…'
            value={search}
            maxlength={40}
            confirmType='search'
            cursorSpacing={24}
            adjustPosition
            onInput={(e: any) => setSearch(e.detail.value)}
          />
        </View>
      ) : null}

      {/* 分类导航（横向）：点击即展开对应分区并定位 */}
      <ScrollView className='ctp__nav' scrollX enableFlex>
        <View className='ctp__nav-inner'>
          {groups.map(g => (
            <View
              key={g.category.key}
              className={`ctp__nav-item ${isOpen(g.category.key) ? 'ctp__nav-item--active' : ''}`}
              onClick={() => { if (!isSearching) toggle(g.category.key) }}
            >
              <Text className='ctp__nav-text'>{g.category.name}</Text>
            </View>
          ))}
          {customEntry ? (
            <View
              className={`ctp__nav-item ${customActive ? 'ctp__nav-item--active' : ''}`}
              onClick={() => onSelect('自定义')}
            >
              <Text className='ctp__nav-text'>自定义</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* 分类分区（折叠）：仅展开的分区渲染标签，减少节点、提升性能 */}
      <View className='ctp__sections'>
        {groups.map(g => (
          <CategorySection
            key={g.category.key}
            group={g}
            expanded={isOpen(g.category.key)}
            onToggle={() => toggle(g.category.key)}
            activeKey={value}
            onSelect={onSelect}
          />
        ))}
        {customEntry ? (
          <View
            className={`ctp__custom ${customActive ? 'ctp__custom--active' : ''}`}
            onClick={() => onSelect('自定义')}
          >
            <Icon name='edit' size={22} color={customActive ? '#ffffff' : '#6b7280'} />
            <Text className='ctp__custom-text'>自定义主题</Text>
          </View>
        ) : null}
        {groups.length === 0 ? (
          <View className='ctp__empty'>
            <Text className='ctp__empty-text'>没有匹配的故事主题</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

export default CategorizedThemePicker
