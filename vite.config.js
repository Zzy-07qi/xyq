import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

/**
 * 网页版开发时，接口请求经 dev server 转发到后端。
 * 后端没有 CORS，要求网页和接口同源，所以浏览器只请求 /api/v1/...，
 * 由这里转给真正的后端。
 *
 * 默认转到部署好的服务器；想连本机后端时：
 *   PowerShell:  $env:API_TARGET = 'http://127.0.0.1:8080'; npm run dev:h5
 */
const API_TARGET = process.env.API_TARGET || 'http://8.133.213.83'

// uni-app 会把 uni.scss 自动注入每个组件的 style 块，不需要 additionalData
export default defineConfig({
  plugins: [uni()],
  css: {
    preprocessorOptions: {
      scss: {
        // 只关掉这两类弃用提示，别的 Sass 警告和报错照常显示：
        //   import         uni-app 靠 @import 把 uni.scss 变量注入每个组件，改 @use 会断
        //   legacy-js-api  uni-app 内部调用 Sass 的旧接口，要等 DCloud 升级
        silenceDeprecations: ['import', 'legacy-js-api']
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true
      }
    }
  }
})
