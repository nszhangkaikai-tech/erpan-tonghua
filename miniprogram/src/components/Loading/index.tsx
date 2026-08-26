import React from 'react'
import { View, Text } from '@tarojs/components'
import './index.scss'

interface LoadingProps {
  /** 加载类型 */
  type?: 'skeleton' | 'spinner' | 'dots'
  /** 文字提示（spinner/dots 模式） */
  text?: string
  /** 骨架行数（skeleton 模式） */
  rows?: number
  /** 是否显示卡片样式骨架 */
  card?: boolean
  className?: string
}

/**
 * 通用加载态组件
 * - skeleton: 骨架屏（列表/卡片占位）
 * - spinner: 旋转加载圈 + 文字
 * - dots: 三点跳动动画
 */
export default function Loading({
  type = 'skeleton',
  text = '加载中...',
  rows = 3,
  card = false,
  className = '',
}: LoadingProps) {
  if (type === 'spinner') {
    return (
      <View className={`loading loading--spinner ${className}`}>
        <View className='loading__spinner' />
        {text && <Text className='loading__text'>{text}</Text>}
      </View>
    )
  }

  if (type === 'dots') {
    return (
      <View className={`loading loading--dots ${className}`}>
        <View className='loading__dots'>
          <View className='loading__dot' />
          <View className='loading__dot' />
          <View className='loading__dot' />
        </View>
        {text && <Text className='loading__text'>{text}</Text>}
      </View>
    )
  }

  // skeleton 模式
  return (
    <View className={`loading loading--skeleton ${className}`}>
      {card ? (
        // 卡片骨架
        Array.from({ length: rows }).map((_, i) => (
          <View key={i} className='loading__card'>
            <View className='loading__card-cover' />
            <View className='loading__card-body'>
              <View className='loading__line loading__line--title' />
              <View className='loading__line loading__line--desc' />
              <View className='loading__line loading__line--short' />
            </View>
          </View>
        ))
      ) : (
        // 行骨架
        Array.from({ length: rows }).map((_, i) => (
          <View key={i} className='loading__row'>
            <View className='loading__line loading__line--full' />
          </View>
        ))
      )}
    </View>
  )
}
