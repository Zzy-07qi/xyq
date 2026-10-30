/**
 * 自定义导航栏的尺寸计算
 *
 * 用了 navigationStyle: custom 之后，微信右上角的胶囊按钮（··· ◎）
 * 依然浮在页面最上层，会盖住放在右上角的按钮。
 * 这里读出胶囊的实际位置，让顶栏：
 *   1. 高度和胶囊那一行对齐
 *   2. 右侧让出胶囊占的宽度，自己的按钮放在胶囊左边
 *
 * 不同手机胶囊位置不一样，所以不能写死，只能运行时读。
 * H5 和 App 没有胶囊，返回 0，不影响布局。
 */

let cached = null

export function getNavMetrics() {
  if (cached) return cached

  let statusBarHeight = 20
  let windowWidth = 375
  try {
    const info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()
    statusBarHeight = info.statusBarHeight || 20
    windowWidth = info.windowWidth || 375
  } catch (e) {
    /* 取不到就用默认值 */
  }

  // 没有胶囊时的默认值（H5 / App）
  let navHeight = 44
  let capsuleReserve = 0

  // #ifdef MP
  try {
    const rect = uni.getMenuButtonBoundingClientRect()
    if (rect && rect.width) {
      // 胶囊上下留白和它到状态栏的距离一致，顶栏高度 = 胶囊高度 + 上下两份留白
      const gap = rect.top - statusBarHeight
      navHeight = rect.height + gap * 2
      // 右侧要让出：胶囊宽度 + 胶囊到屏幕右边的距离 + 胶囊左边再留一点空
      capsuleReserve = windowWidth - rect.left + 8
    }
  } catch (e) {
    /* 读不到胶囊就按默认值，最差只是没对齐 */
  }
  // #endif

  cached = {
    statusBarHeight, // 状态栏高度（px）
    navHeight, // 顶栏本身高度（px），不含状态栏
    capsuleReserve, // 右侧需要让出的宽度（px）
    totalHeight: statusBarHeight + navHeight // 顶栏连状态栏的总高度（px）
  }
  return cached
}
