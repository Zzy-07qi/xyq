<script setup>
/**
 * 家长首页（项目书 流程 1/2 / 表 3-1）
 *
 * 总体闭环的三个环节都在这一页作为入口：
 *   开始训练（交给儿童） → 家庭任务卡 → 训练记录与建议
 *
 * ⚠️ 图片资源约定
 * 首页用到的 4 张图，请放在 static/home/ 下，文件名如下：
 *   static/home/earth.png          星云地球（顶部背景）
 *   static/home/star-learning.png  黄色星星「学习」
 *   static/home/star-chatting.png  黄色星星「对话」
 *   static/home/moon-flower.png    月亮花「日记」
 *
 * 图片未就位时组件会自动降级为彩色底块 + emoji，页面不会破版。
 */
import { ref, computed } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { useAppStore } from '@/store/app'
import { DIFFICULTY_ADVICE } from '@/config/constants'
import { getNavMetrics } from '@/core/nav'
import * as api from '@/core/api'

const appStore = useAppStore()

/**
 * 内容从胶囊那一行下面开始。
 * 小程序里 env(safe-area-inset-top) 多数机型是 0，靠它会顶到胶囊下面。
 */
const nav = getNavMetrics()

/** 网页版：退出登录放在「隐私与账号」里 */
let isWeb = false
// #ifdef H5
isWeb = true
// #endif

/* ---------- 图片加载失败降级 ---------- */
const imgOk = ref({
  earth: true,
  learning: true,
  chatting: true,
  diary: true
})

function onImgError(key) {
  imgOk.value[key] = false
}

/* ---------- 三个主入口 ---------- */
const ENTRIES = [
  {
    key: 'learning',
    label: '学习',
    title: '开始训练',
    desc: '进入儿童模式，和孩子一起说',
    img: '/static/home/star-learning.png',
    fallbackIcon: '⭐',
    tint: '#fdf3d6',
    route: '/pages/child/home'
  },
  {
    key: 'chatting',
    label: '对话',
    title: '陪练介入',
    desc: '训练中查看提示、辅助或暂停',
    img: '/static/home/star-chatting.png',
    fallbackIcon: '⭐',
    tint: '#eef6d4',
    route: '/pages/parent/coaching'
  },
  {
    key: 'diary',
    label: '日记',
    title: '任务与记录',
    desc: '家庭任务卡，每张都能看那次训练',
    img: '/static/home/moon-flower.png',
    fallbackIcon: '🌙',
    tint: '#fbe9e3',
    route: '/pages/parent/task-cards'
  }
]

/* ---------- 任务卡 ---------- */
const taskCards = ref([])
const loading = ref(true)
const offline = ref(false)

const pendingCard = computed(() => taskCards.value.find((c) => !c.done) || null)
const doneCount = computed(() => taskCards.value.filter((c) => c.done).length)

/**
 * 下一次训练建议（流程 9）。
 * 后端没有建议接口，用最近一张已回填任务卡的结果在本地给出。
 */
const advice = computed(() => {
  const last = taskCards.value.find((c) => c.done && c.feedback)
  return last ? DIFFICULTY_ADVICE[last.feedback] : null
})

async function loadData() {
  loading.value = true
  offline.value = false
  try {
    // 每次进首页都向后端核对一次同意状态：别的设备上撤回了，这里也要跟着变
    const { consentConfirmed } = await appStore.syncFromServer()
    if (!consentConfirmed) {
      uni.reLaunch({ url: '/pages/parent/onboarding' })
      return
    }
    taskCards.value = await api.getTaskCardList()
  } catch (e) {
    console.warn('[home] 加载失败', e)
    offline.value = true
  } finally {
    loading.value = false
  }
}

/** onShow 在首次进入时也会触发，所以不用再写 onMounted */
onShow(() => {
  loadData()
})

onPullDownRefresh(async () => {
  await loadData()
  uni.stopPullDownRefresh()
})

/* ---------- 交互 ---------- */

function goEntry(entry) {
  // 训练入口需要先确认画像完整
  if (entry.key === 'learning' && !appStore.profile) {
    uni.showModal({
      title: '还差一步',
      content: '先花一分钟填一下孩子的情况，训练会更贴合他。',
      confirmText: '去填写',
      success: (res) => {
        if (res.confirm) uni.navigateTo({ url: '/pages/parent/profile' })
      }
    })
    return
  }
  uni.navigateTo({ url: entry.route })
}

function goTaskCards() {
  uni.navigateTo({ url: '/pages/parent/task-cards' })
}

function goFeedback(card) {
  uni.navigateTo({ url: `/pages/parent/task-feedback?id=${card.id}` })
}

/** 底部设置入口跳转 */
function goSettings(url) {
  uni.navigateTo({ url })
}

/** 孩子的称呼：家长在画像里填的昵称 */
const childLabel = computed(() => {
  const p = appStore.profile
  return p && p.name ? p.name : '孩子'
})

const voiceStatus = computed(() => {
  if (appStore.textMode) return { text: '点选作答', tone: 'warn' }
  return { text: '语音作答', tone: 'safe' }
})
</script>

<template>
  <view class="home">
    <!-- ================= 顶部：星云地球 ================= -->
    <view class="home__hero">
      <!-- 地球图作为背景，铺满顶部区域 -->
      <image
        v-if="imgOk.earth"
        class="home__earth"
        src="/static/home/earth.png"
        mode="aspectFill"
        @error="onImgError('earth')"
      />
      <!-- 图片缺失时的降级底色 -->
      <view v-else class="home__earth home__earth--fallback" />

      <!-- 压一层渐变，保证文字可读 -->
      <view class="home__hero-veil" />

      <view
        class="home__hero-content"
        :style="{ paddingTop: nav.totalHeight + 12 + 'px' }"
      >
        <view class="home__hero-top">
          <text class="home__greet">今天也来陪他说说话</text>
          <view class="home__status" :class="`home__status--${voiceStatus.tone}`">
            <text class="home__status-text">{{ voiceStatus.text }}</text>
          </view>
        </view>

        <text class="home__hero-title">{{ childLabel }}，我们准备好了</text>

        <!-- 训练入口：主行动按钮压在图上 -->
        <view class="home__cta" @tap="goEntry(ENTRIES[0])">
          <view class="home__cta-icon">
            <image
              v-if="imgOk.learning"
              class="home__cta-img"
              src="/static/home/star-learning.png"
              mode="aspectFit"
              @error="onImgError('learning')"
            />
            <text v-else class="home__cta-emoji">⭐</text>
          </view>
          <view class="home__cta-main">
            <text class="home__cta-title">开始训练</text>
            <text class="home__cta-desc">交给孩子，他来说</text>
          </view>
          <text class="home__cta-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- ================= 三个入口 ================= -->
    <view class="home__body">
      <view class="home__entries">
        <view
          v-for="entry in ENTRIES.slice(1)"
          :key="entry.key"
          class="home__entry"
          :style="{ background: entry.tint }"
          @tap="goEntry(entry)"
        >
          <view class="home__entry-sticker">
            <image
              v-if="imgOk[entry.key]"
              class="home__entry-img"
              :src="entry.img"
              mode="aspectFit"
              @error="onImgError(entry.key)"
            />
            <text v-else class="home__entry-emoji">{{ entry.fallbackIcon }}</text>
          </view>
          <text class="home__entry-label">{{ entry.label }}</text>
          <text class="home__entry-title">{{ entry.title }}</text>
          <text class="home__entry-desc">{{ entry.desc }}</text>
        </view>
      </view>

      <!-- ================= 待回填任务卡 ================= -->
      <view class="home__section">
        <view class="home__section-head">
          <text class="home__section-title">家庭任务卡</text>
          <text class="home__section-more" @tap="goTaskCards">
            全部 {{ taskCards.length }} 张 ›
          </text>
        </view>

        <view v-if="loading" class="home__skeleton">
          <text class="home__skeleton-text">正在取任务卡</text>
        </view>

        <view v-else-if="offline" class="notice notice--warn">
          <text>没连上网络，任务卡暂时看不到。下拉可以重试。</text>
        </view>

        <!-- 有未回填的 -->
        <view v-else-if="pendingCard" class="home__task card" @tap="goFeedback(pendingCard)">
          <view class="home__task-head">
            <view class="tag tag--sun">
              <text>待回填</text>
            </view>
            <text class="home__task-duration">{{ pendingCard.duration }}</text>
          </view>

          <text class="home__task-title">{{ pendingCard.title }}</text>

          <view class="home__task-target">
            <text class="home__task-target-label">想让他说的话</text>
            <text class="home__task-target-text">{{ pendingCard.targetSentence }}</text>
          </view>

          <text class="home__task-scene">{{ pendingCard.realScene }}</text>

          <view class="home__task-action">
            <text class="home__task-action-text">做完之后点这里回填</text>
            <text class="home__task-arrow">›</text>
          </view>
        </view>

        <!-- 都填完了 -->
        <view v-else class="card home__task-empty">
          <text class="home__task-empty-icon">🌿</text>
          <text class="home__task-empty-title">
            {{ doneCount ? '这几张都填过了' : '还没有任务卡' }}
          </text>
          <text class="home__task-empty-desc">
            {{ doneCount ? '做完一次训练，就会有新的任务卡' : '先带孩子做一次训练吧' }}
          </text>
          <view class="btn btn--ghost home__task-empty-btn" @tap="goEntry(ENTRIES[0])">
            <text>去训练</text>
          </view>
        </view>
      </view>

      <!-- ================= 下一次建议 ================= -->
      <view v-if="advice" class="home__section">
        <view class="home__section-head">
          <text class="home__section-title">下一次的建议</text>
        </view>
        <view class="card home__advice">
          <text class="home__advice-title">{{ advice.title }}</text>
          <text class="home__advice-desc">{{ advice.desc }}</text>
        </view>
      </view>

      <!-- ================= 底部设置入口 ================= -->
      <view class="home__footer">
        <text class="home__footer-link" @tap="goSettings('/pages/parent/profile')">
          孩子的情况
        </text>
        <!-- 设备检查只测麦克风；网页版目前不用语音作答，先不显示 -->
        <!-- #ifndef H5 -->
        <text class="home__footer-sep">·</text>
        <text class="home__footer-link" @tap="goSettings('/pages/parent/permission-test')">
          设备检查
        </text>
        <!-- #endif -->
        <text class="home__footer-sep">·</text>
        <text class="home__footer-link" @tap="goSettings('/pages/parent/notice')">
          陪练须知
        </text>
        <text class="home__footer-sep">·</text>
        <text class="home__footer-link" @tap="goSettings('/pages/parent/privacy')">
          {{ isWeb ? '隐私与账号' : '隐私与授权' }}
        </text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.home {
  min-height: 100vh;
  background: $c-page;
}

/* ================= 顶部地球 ================= */
.home__hero {
  position: relative;
  min-height: 640rpx;
  overflow: hidden;
  border-radius: 0 0 $r-xl $r-xl;
}

.home__earth {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}

/* 图片缺失时的星空降级底色 */
.home__earth--fallback {
  background: linear-gradient(165deg, #1e4a8a 0%, #3d7edb 46%, #b9d94a 130%);
}

/* 自上而下的暗色渐变，保证白字可读 */
.home__hero-veil {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    180deg,
    rgba(15, 36, 70, 0.62) 0%,
    rgba(15, 36, 70, 0.3) 42%,
    rgba(15, 36, 70, 0.55) 100%
  );
}

.home__hero-content {
  position: relative;
  z-index: 2;
  padding-left: $sp-4;
  padding-right: $sp-4;
  padding-bottom: $sp-5;
}

.home__hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $sp-2;
}

.home__greet {
  font-size: $fs-sub;
  color: rgba(255, 255, 255, 0.82);
}

.home__status {
  height: 48rpx;
  padding: 0 $sp-3;
  border-radius: $r-pill;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.18);

  &--safe {
    background: rgba(111, 191, 154, 0.28);
  }

  &--warn {
    background: rgba(224, 169, 92, 0.3);
  }
}

.home__status-text {
  font-size: $fs-cap;
  color: #fff;
}

.home__hero-title {
  display: block;
  margin-top: $sp-2;
  font-size: 52rpx;
  font-weight: 700;
  color: #fff;
  line-height: 1.35;
}

/* ---------- 训练主按钮 ---------- */
.home__cta {
  margin-top: $sp-5;
  display: flex;
  align-items: center;
  gap: $sp-3;
  padding: $sp-3 $sp-4;
  border-radius: $r-lg;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 12rpx 40rpx rgba(15, 36, 70, 0.24);
  transition: transform $t-base $ease-soft;

  &:active {
    transform: scale(0.98);
  }
}

.home__cta-icon {
  width: 96rpx;
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.home__cta-img,
.home__entry-img {
  width: 100%;
  height: 100%;
}

.home__cta-emoji {
  font-size: 60rpx;
  line-height: 1;
}

.home__cta-main {
  flex: 1;
}

.home__cta-title {
  display: block;
  font-size: $fs-h2;
  font-weight: 700;
  color: $c-primary-deep;
}

.home__cta-desc {
  display: block;
  margin-top: 2rpx;
  font-size: $fs-cap;
  color: $c-text-sub;
}

.home__cta-arrow {
  font-size: 52rpx;
  color: $c-primary;
  line-height: 1;
}

/* ================= 主体 ================= */
.home__body {
  padding: 0 $sp-4 $sp-6;
}

/* ---------- 三个入口 ---------- */
.home__entries {
  display: flex;
  gap: $sp-2;
  margin-top: -$sp-6;
  position: relative;
  z-index: 3;
}

.home__entry {
  flex: 1;
  border-radius: $r-lg;
  padding: $sp-3 $sp-2 $sp-4;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: $sh-card;
  transition: transform $t-base $ease-soft;

  &:active {
    transform: translateY(-4rpx) scale(0.98);
  }
}

.home__entry-sticker {
  width: 112rpx;
  height: 112rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: $sp-1;
}

.home__entry-emoji {
  font-size: 64rpx;
  line-height: 1;
}

.home__entry-label {
  font-size: $fs-cap;
  color: $c-text-weak;
  letter-spacing: 2rpx;
}

.home__entry-title {
  display: block;
  margin-top: 2rpx;
  font-size: $fs-body;
  font-weight: 600;
  color: $c-text;
}

.home__entry-desc {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: $c-text-sub;
  line-height: 1.5;
}

/* ---------- 区块 ---------- */
.home__section {
  margin-top: $sp-5;
}

.home__section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: $sp-3;
}

.home__section-title {
  font-size: $fs-h3;
  font-weight: 600;
  color: $c-text;
}

.home__section-more {
  font-size: $fs-sub;
  color: $c-text-weak;
}

/* ---------- 骨架 ---------- */
.home__skeleton {
  padding: $sp-5;
  border-radius: $r-lg;
  background: #fff;
  text-align: center;
}

.home__skeleton-text {
  font-size: $fs-sub;
  color: $c-text-weak;
}

/* ---------- 任务卡 ---------- */
.home__task {
  transition: transform $t-base $ease-soft;

  &:active {
    transform: scale(0.99);
  }
}

.home__task-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.home__task-duration {
  font-size: $fs-cap;
  color: $c-text-weak;
}

.home__task-title {
  display: block;
  margin-top: $sp-2;
  font-size: $fs-h3;
  font-weight: 600;
  color: $c-text;
}

.home__task-target {
  margin-top: $sp-3;
  padding: $sp-3;
  border-radius: $r-md;
  background: $c-leaf-soft;
}

.home__task-target-label {
  display: block;
  font-size: $fs-cap;
  color: $c-leaf-deep;
  margin-bottom: 4rpx;
}

.home__task-target-text {
  font-size: 36rpx;
  font-weight: 600;
  color: #4a5c1f;
  line-height: 1.5;
}

.home__task-scene {
  display: block;
  margin-top: $sp-2;
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.7;
}

.home__task-action {
  margin-top: $sp-3;
  padding-top: $sp-3;
  border-top: 2rpx solid $c-line;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.home__task-action-text {
  font-size: $fs-sub;
  color: $c-primary;
  font-weight: 500;
}

.home__task-arrow {
  font-size: 36rpx;
  color: $c-primary;
  line-height: 1;
}

/* ---------- 空任务卡 ---------- */
.home__task-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $sp-5 $sp-4;
}

.home__task-empty-icon {
  font-size: 72rpx;
  line-height: 1;
  margin-bottom: $sp-2;
}

.home__task-empty-title {
  font-size: $fs-h3;
  font-weight: 600;
  color: $c-text-sub;
}

.home__task-empty-desc {
  margin-top: $sp-1;
  font-size: $fs-sub;
  color: $c-text-weak;
  text-align: center;
}

.home__task-empty-btn {
  margin-top: $sp-3;
}

/* ---------- 建议 ---------- */
.home__advice-title {
  display: block;
  font-size: $fs-h3;
  font-weight: 600;
  color: $c-primary-deep;
}

.home__advice-desc {
  display: block;
  margin-top: $sp-2;
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.75;
}

/* ---------- 底部链接 ---------- */
.home__footer {
  margin-top: $sp-6;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $sp-2;
  flex-wrap: wrap;
}

.home__footer-link {
  font-size: $fs-sub;
  color: $c-text-weak;
  padding: $sp-2;
}

.home__footer-sep {
  color: $c-line;
}
</style>
