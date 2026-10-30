<script setup>
/**
 * 启动页 / 知情同意入口（项目书 流程 2，表 3-1 首行）
 *
 * 这里是产品第一屏。ASD 儿童家长第一次打开时通常带着试探和疲惫，
 * 所以这一屏不做功能罗列，只做三件事：说清这是什么、说清数据怎么用、
 * 给一个门槛很低的开始动作。
 *
 * 已完成的家长再次进入时直接进家长首页，不重复引导。
 */
import { ref, onMounted } from 'vue'
import { useAppStore } from '@/store/app'
import { COACHING_TIPS } from '@/config/constants'
import { isAuthError } from '@/core/request'

const appStore = useAppStore()
const ready = ref(false)
/** 后端连不上时给个提示，但不挡住家长阅读引导内容 */
const offline = ref(false)

onMounted(async () => {
  try {
    const { consentConfirmed, profile } = await appStore.syncFromServer()
    // 已同意且已有画像：直接进家长首页
    if (consentConfirmed && profile) {
      uni.reLaunch({ url: '/pages/parent/home' })
      return
    }
    // 已同意但还没填画像：从画像这一步接着走
    if (consentConfirmed) {
      uni.redirectTo({ url: '/pages/parent/profile' })
      return
    }
  } catch (e) {
    // 网页没登录时 request 层已经在跳登录页，不用再提示「没连上」
    if (isAuthError(e)) return
    console.warn('[onboarding] 同步失败', e)
    offline.value = true
  }
  ready.value = true
})

function goConsent() {
  appStore.setOnboardingStep('consent')
  uni.navigateTo({ url: '/pages/parent/consent' })
}

/** 「我已经设置过了」：重新向后端确认一次 */
async function skipToHome() {
  try {
    const { consentConfirmed, profile } = await appStore.syncFromServer()
    if (consentConfirmed && profile) {
      uni.reLaunch({ url: '/pages/parent/home' })
      return
    }
    uni.showToast({ title: '还没找到你的设置，先完成一次就好', icon: 'none' })
  } catch (e) {
    uni.showToast({ title: '没连上服务，等一下再试', icon: 'none' })
  }
}
</script>

<template>
  <view class="ob">
    <!-- 顶部视觉：用首页那套水彩星空的意象，不直接放地球图以免喧宾夺主 -->
    <view class="ob__hero">
      <view class="ob__glow ob__glow--a" />
      <view class="ob__glow ob__glow--b" />
      <view class="ob__glow ob__glow--c" />

      <view class="ob__hero-inner">
        <text class="ob__brand">星语</text>
        <text class="ob__slogan">陪孩子，把想说的话说出来</text>
      </view>
    </view>

    <view class="ob__body anim-fade-up">
      <text class="t-h1 ob__title">欢迎你来</text>

      <text class="t-body ob__intro">
        这里是一个安静的地方。孩子可以和你一起，在一个熟悉的小场景里，慢慢把想说的话说出来。
      </text>

      <view class="ob__points">
        <view class="ob__point">
          <text class="ob__point-icon">🌿</text>
          <view class="ob__point-main">
            <text class="ob__point-title">不会有对错</text>
            <text class="ob__point-desc">说不出来、不想说，都可以，我们不会记录"没做好"</text>
          </view>
        </view>

        <view class="ob__point">
          <text class="ob__point-icon">⏳</text>
          <view class="ob__point-main">
            <text class="ob__point-title">节奏由孩子定</text>
            <text class="ob__point-desc">{{ COACHING_TIPS.beforeRound }}</text>
          </view>
        </view>

        <view class="ob__point">
          <text class="ob__point-icon">🛑</text>
          <view class="ob__point-main">
            <text class="ob__point-title">随时可以停</text>
            <text class="ob__point-desc">孩子不想继续的时候，直接停下就好</text>
          </view>
        </view>
      </view>

      <view class="ob__spacer" />

      <view class="ob__actions">
        <view class="btn btn--primary btn--block" @tap="goConsent">
          <text>开始了解</text>
        </view>
        <view class="ob__skip" @tap="skipToHome">
          <text class="ob__skip-text">我已经设置过了</text>
        </view>
      </view>

      <text class="ob__privacy">
        继续之前，我们会说明需要用到哪些信息，以及它们怎么被保管
      </text>

      <view v-if="offline" class="notice notice--warn ob__offline">
        <text>暂时没连上服务。可以先看看介绍，等网络好了再继续。</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.ob {
  min-height: 100vh;
  background: $c-page;
  display: flex;
  flex-direction: column;
}

/* ---------- 顶部视觉 ---------- */
.ob__hero {
  position: relative;
  height: 520rpx;
  background: linear-gradient(168deg, #1e4a8a 0%, #3d7edb 52%, #7fb4ee 100%);
  border-radius: 0 0 $r-xl $r-xl;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  padding-bottom: $sp-7;
}

/* 三团柔和光斑，模拟首页水彩的晕染感 */
.ob__glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(60rpx);
  opacity: 0.5;

  &--a {
    width: 420rpx;
    height: 420rpx;
    background: #6fa6ef;
    top: -120rpx;
    left: -80rpx;
  }

  &--b {
    width: 340rpx;
    height: 340rpx;
    background: #b9d94a;
    bottom: -140rpx;
    right: -60rpx;
    opacity: 0.32;
  }

  &--c {
    width: 260rpx;
    height: 260rpx;
    background: #a8dcf0;
    bottom: 40rpx;
    left: 30%;
    opacity: 0.36;
  }
}

.ob__hero-inner {
  position: relative;
  padding: 0 $sp-5;
  padding-top: 120rpx;
  width: 100%;
}

.ob__brand {
  display: block;
  font-size: 72rpx;
  font-weight: 700;
  color: #fff;
  letter-spacing: 8rpx;
}

.ob__slogan {
  display: block;
  margin-top: $sp-2;
  font-size: $fs-body;
  color: rgba(255, 255, 255, 0.82);
  letter-spacing: 2rpx;
}

/* ---------- 主体 ---------- */
.ob__body {
  flex: 1;
  padding: $sp-5 $sp-5 $sp-4;
  display: flex;
  flex-direction: column;
}

.ob__title {
  margin-bottom: $sp-3;
}

.ob__intro {
  color: $c-text-sub;
  line-height: 1.8;
}

/* ---------- 三个要点 ---------- */
.ob__points {
  margin-top: $sp-5;
  display: flex;
  flex-direction: column;
  gap: $sp-4;
}

.ob__point {
  display: flex;
  gap: $sp-3;
  align-items: flex-start;
}

.ob__point-icon {
  font-size: 44rpx;
  line-height: 1.2;
  flex-shrink: 0;
}

.ob__point-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.ob__point-title {
  font-size: $fs-h3;
  font-weight: 600;
  color: $c-text;
}

.ob__point-desc {
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.65;
}

.ob__spacer {
  flex: 1;
  min-height: $sp-5;
}

/* ---------- 底部操作 ---------- */
.ob__actions {
  display: flex;
  flex-direction: column;
  gap: $sp-3;
  align-items: center;
}

.ob__skip {
  padding: $sp-2 $sp-4;
}

.ob__skip-text {
  font-size: $fs-sub;
  color: $c-text-weak;
}

.ob__offline {
  margin-top: $sp-3;
}

.ob__privacy {
  margin-top: $sp-4;
  font-size: $fs-cap;
  color: $c-text-weak;
  line-height: 1.6;
  text-align: center;
}
</style>
