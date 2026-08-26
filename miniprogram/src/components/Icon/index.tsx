import React from 'react'
import { View } from '@tarojs/components'
import { LUCIDE_ICONS } from './lucide-icons'
import './index.scss'

/**
 * Icon 组件 — 内联 SVG（lucide）版本
 *
 * 渲染方式：把 lucide 的 SVG 内部路径包成
 *   <svg viewBox="0 0 24 24" fill/stroke=color> 后转 data URI，
 *   用 View 的 background-image 显示。
 * 这样保留原字体方案的全部能力：
 *   - 尺寸用 rpx（size 属性，默认 32）
 *   - 颜色动态着色（color 属性，默认 #18181b，等价于原 currentColor）
 *   - 视觉风格延续 24×24 / 线性 / 圆角端点
 * 且不再依赖字体域名白名单、不再需要字体文件。
 *
 * 注意：微信 WXML 不支持原生 <svg> 与 <text> 内嵌套非 text 节点，
 * 因此图标用 View + background-image 实现，且不要再把本组件放进 <Text> 内。
 *
 * API:
 *   name      - 图标名（见 lucide-icons.ts，与原 36 个名一一对应）
 *   size      - 尺寸 rpx，默认 32
 *   color     - 图标颜色，默认 #18181b
 *   className - 额外类名
 *   onClick   - 点击回调
 */

// 图标名从 lucide 映射自动推导，保证与图标定义一一对应
export type IconName = keyof typeof LUCIDE_ICONS

const DEFAULT_SIZE = 32
const DEFAULT_COLOR = '#18181b'

export interface IconProps {
  name: IconName
  size?: number   // rpx
  color?: string
  className?: string
  onClick?: (e: any) => void
}

// 按 名称|颜色 缓存 data URI，避免每次渲染重复编码
const uriCache = new Map<string, string>()

function buildDataUri(name: string, color: string): string {
  const key = name + '|' + color
  const cached = uriCache.get(key)
  if (cached) return cached
  const def = LUCIDE_ICONS[name]
  const fill = def && def.filled ? color : 'none'
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="' + fill +
    '" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    (def ? def.body : '') + '</svg>'
  const uri = 'data:image/svg+xml,' + encodeURIComponent(svg)
  uriCache.set(key, uri)
  return uri
}

const Icon: React.FC<IconProps> = React.memo(({
  name,
  size = DEFAULT_SIZE,
  color = DEFAULT_COLOR,
  className = '',
  onClick,
}) => {
  const uri = buildDataUri(name, color)
  return (
    <View
      className={'bm-icon icon icon--' + name + (className ? ' ' + className : '')}
      style={{
        width: size + 'rpx',
        height: size + 'rpx',
        backgroundColor: 'transparent',
        backgroundImage: 'url("' + uri + '")',
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      }}
      onClick={onClick}
    />
  )
}, (prev, next) => (
  prev.name === next.name &&
  prev.size === next.size &&
  prev.color === next.color &&
  prev.className === next.className
))

Icon.displayName = 'Icon'

export default Icon
