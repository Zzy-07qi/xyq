<script setup>
import { onLaunch } from '@dcloudio/uni-app'
import { useAppStore } from '@/store/app'

const appStore = useAppStore()

onLaunch(() => {
  // 只读本机的引导进度。同意状态和画像由各页面按需向后端同步，
  // 这样后端没启动时 App 也能正常打开到引导页。
  appStore.restoreLocal()
})
</script>

<style lang="scss">
/* 用相对路径而不是 @/ 别名：sass 的 @import 不走 vite 的别名解析 */
@import './styles/global.scss';

/* #ifdef H5 */
/* 电脑上打开时，页面限宽 480px 居中（pages.json maxWidth），两侧留白的颜色 */
body {
  background: #e3eaf3;
}
/* #endif */
</style>
