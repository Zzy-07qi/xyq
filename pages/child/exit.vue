<script setup>
/**
 * 退出页（项目书 流程 5/10，表 3-1）
 *
 * "无失败结论的退出页"—— 这是项目书里的一句话，但实现起来要处处留意：
 * 不放进度条（进度条会暗示"没走完"）、不放统计、不用"结束"这类收束词，
 * 只陈述一件事实：我们今天说到这里。
 *
 * 退出原因已在调用方通过 session.exit(reason) 上报，
 * 这一页只负责把收尾做得体面。
 */
import { computed, onMounted } from 'vue'
import { useSessionStore } from '@/store/session'
import { EXIT_TITLE, EXIT_SUB } from '@/config/copywriting'
import { EXIT_REASON_LABEL } from '@/config/constants'
import * as player from '@/core/audio/player'

const session = useSessionStore()

onMounted(() => {
  player.forceStop()
})

/** 这次一起说了几轮 —— 正向陈述，不是"完成度" */
const saidRounds = computed(() => session.doneRounds)

const exitReasonText = computed(() =>
  session.exitReason ? EXIT_REASON_LABEL[session.exitReason] || '' : ''
)

function goHome() {
  session.reset()
  uni.reLaunch({ url: '/pages/parent/home' })
}

function goChildHome() {
  session.reset()
  uni.reLaunch({ url: '/pages/child/home' })
}
</script>

<template>
  <view class="exit">
    <view class="exit__sky">
      <view v-for="i in 10" :key="i" class="exit__star" :class="`exit__star--${i}`" />
    </view>

    <view class="exit__body">
      <view class="exit__icon-wrap">
        <text class="exit__icon">🌙</text>
      </view>

      <text class="exit__title">{{ EXIT_TITLE }}</text>
      <text class="exit__sub">{{ EXIT_SUB }}</text>

      <!-- 一起说了几轮：只陈述，不评价 -->
      <view v-if="saidRounds > 0" class="exit__said">
        <text class="exit__said-text">
          刚才我们一起说了 {{ saidRounds }} 次
        </text>
      </view>

      <!-- 退出原因回显：让家长确认系统记对了，但不放在显著位置 -->
      <text v-if="exitReasonText" class="exit__reason">
        这次结束的原因：{{ exitReasonText }}
      </text>

      <view class="exit__note">
        <text class="exit__note-text">
          这次就记到这里。没有说出来的那些，不算没做到。
        </text>
      </view>
    </view>

    <view class="exit__footer safe-bottom">
      <view class="btn btn--primary btn--child btn--block" @tap="goHome">
        <text>回家长中心</text>
      </view>
      <view class="exit__link" @tap="goChildHome">
        <text class="exit__link-text">回到小朋友的页面</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.exit {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: linear-gradient(178deg, #1e4a8a 0%, #345f9e 46%, #7fb4ee 100%);
  display: flex;
  flex-direction: column;
}

/* ---------- 星点：比首页更暗、更慢，配合收尾的安静感 ---------- */
.exit__sky {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.exit__star {
  position: absolute;
  width: 6rpx;
  height: 6rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.7);
  animation: twinkle 5.2s $ease-soft infinite;

  &--1 { left: 14%; top: 12%; animation-delay: 0s; }
  &--2 { left: 38%; top: 8%; animation-delay: 0.6s; }
  &--3 { left: 62%; top: 16%; animation-delay: 1.2s; }
  &--4 { left: 84%; top: 10%; animation-delay: 1.8s; }
  &--5 { left: 24%; top: 26%; animation-delay: 2.4s; }
  &--6 { left: 70%; top: 30%; animation-delay: 3s; }
  &--7 { left: 48%; top: 22%; animation-delay: 1s; }
  &--8 { left: 90%; top: 24%; animation-delay: 2s; }
  &--9 { left: 8%; top: 34%; animation-delay: 3.4s; }
  &--10 { left: 56%; top: 38%; animation-delay: 0.4s; }
}

@keyframes twinkle {
  0%,
  100% {
    opacity: 0.2;
    transform: scale(0.9);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.12);
  }
}

/* ================= 主体 ================= */
.exit__body {
  position: relative;
  z-index: 3;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 $sp-5;
  /* 小程序里 env() 多为 0，至少留出状态栏 + 胶囊那一行的高度 */
  padding-top: calc(env(safe-area-inset-top) + 160rpx);
}

.exit__icon-wrap {
  width: 200rpx;
  height: 200rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: $sp-5;
  animation: breath 3.4s $ease-soft infinite;
}

.exit__icon {
  font-size: 116rpx;
  line-height: 1;
}

.exit__title {
  font-size: 56rpx;
  font-weight: 700;
  color: #fff;
  letter-spacing: 3rpx;
}

.exit__sub {
  margin-top: $sp-3;
  font-size: $fs-child;
  color: rgba(255, 255, 255, 0.85);
  text-align: center;
  line-height: 1.7;
}

/* ---------- 说了几次 ---------- */
.exit__said {
  margin-top: $sp-5;
  padding: $sp-3 $sp-5;
  border-radius: $r-pill;
  background: rgba(255, 255, 255, 0.16);
}

.exit__said-text {
  font-size: $fs-body;
  color: #fff;
}

.exit__reason {
  margin-top: $sp-4;
  font-size: $fs-cap;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
}

/* ---------- 收尾说明 ---------- */
.exit__note {
  margin-top: $sp-5;
  padding: $sp-4;
  border-radius: $r-lg;
  background: rgba(255, 255, 255, 0.12);
  max-width: 560rpx;
}

.exit__note-text {
  font-size: $fs-sub;
  color: rgba(255, 255, 255, 0.88);
  line-height: 1.8;
  text-align: center;
}

/* ================= 底部 ================= */
.exit__footer {
  position: relative;
  z-index: 4;
  padding: $sp-3 $sp-4;
  display: flex;
  flex-direction: column;
  gap: $sp-2;
}

.exit__link {
  padding: $sp-2;
  text-align: center;
}

.exit__link-text {
  font-size: $fs-sub;
  color: rgba(255, 255, 255, 0.78);
}
</style>
