export default {
  navigationBarTitleText: '首页',
  // 注意：不要开 enablePullDownRefresh。本项目首页在 useDidShow 里已每次刷新数据，
  // 且没有 onPullDownRefresh 处理函数；开启原生下拉刷新会触发 Taro 4.x 页面 loader
  // 的 waiting 状态机被重复 setWaiting，真机报
  // "LifeCycle.load fail: Cannot set a non-pending waiting value"。
}
