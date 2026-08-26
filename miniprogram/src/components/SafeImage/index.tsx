import React, { useState, useCallback, useEffect } from 'react'
import { View, Image } from '@tarojs/components'
import Icon from '../Icon'
import './index.scss'

interface SafeImageProps {
  src: string
  className?: string
  imgClassName?: string
  placeholderClassName?: string
  mode?: 'aspectFill' | 'aspectFit' | 'widthFix' | 'scaleToFill' | 'top' | 'bottom' | 'center' | 'left' | 'right' | 'top left' | 'top right' | 'bottom left' | 'bottom right'
  placeholder?: React.ReactNode
  /** 懒加载（小程序 Image 原生支持 lazy-load） */
  lazyLoad?: boolean
  /** 占位图标的图标名（默认 library） */
  fallbackIcon?: 'library' | 'book-open'
  /** 占位图标颜色 */
  fallbackColor?: string
}

/**
 * 安全图片组件
 * - 加载失败时显示占位元素（统一使用 Icon 组件）
 * - 兼容 Taro 双线程架构（不直接操作 DOM）
 * - React.memo 包裹：src/mode 不变时不重渲染
 * - 支持 lazyLoad 懒加载
 */
function SafeImageInner({
  src,
  className = '',
  imgClassName = '',
  placeholderClassName = '',
  mode = 'aspectFill',
  placeholder,
  lazyLoad = true,
  fallbackIcon = 'library',
  fallbackColor = '#9ca3af',
}: SafeImageProps) {
  const [failed, setFailed] = useState(false)

  // 稳定回调，避免每次渲染创建新函数
  const handleError = useCallback(() => {
    setFailed(true)
  }, [])

  // src 变化时重置 failed 状态
  useEffect(() => {
    setFailed(false)
  }, [src])

  if (!src || failed) {
    return (
      <View className={`safe-image safe-image--placeholder ${className} ${placeholderClassName}`}>
        {placeholder || <Icon name={fallbackIcon} size={48} color={fallbackColor} className='safe-image__fallback-icon' />}
      </View>
    )
  }

  return (
    <View className={`safe-image ${className}`}>
      <Image
        className={`safe-image__img ${imgClassName}`}
        src={src}
        mode={mode}
        lazyLoad={lazyLoad}
        onError={handleError}
      />
    </View>
  )
}

// 自定义对比函数：src/mode/fallbackIcon 不变时跳过重渲染
function areEqual(prevProps: SafeImageProps, nextProps: SafeImageProps) {
  return (
    prevProps.src === nextProps.src &&
    prevProps.mode === nextProps.mode &&
    prevProps.className === nextProps.className &&
    prevProps.fallbackIcon === nextProps.fallbackIcon
  )
}

const SafeImage = React.memo(SafeImageInner, areEqual)

export default SafeImage
