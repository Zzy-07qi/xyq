<script setup>
/**
 * 权限指引页（项目书 流程 2 / 表 3-1 / 7 权限异常）
 *
 * 图文方式降级的落点。
 * 分平台给步骤 —— 微信里 iOS 和 Android 的入口路径不一样，
 * 混在一起写会让家长在两个系统里都找不到。
 */
import { ref, computed } from 'vue'
import { useAppStore } from '@/store/app'
import * as permission from '@/core/audio/permission'

const appStore = useAppStore()
const platform = ref('ios')

const isDevtools = ref(false)

const PLATFORM_TABS = [
  { value: 'ios', label: '苹果手机' },
  { value: 'android', label: '安卓手机' }
]

const STEPS = {
  ios: [
    '打开手机的「设置」',
    '往下找到「微信」，点进去',
    '把「麦克风」右边的开关打开',
    '回到微信，重新进入小程序'
  ],
  android: [
    '打开手机的「设置」',
    '找到「应用管理」→「微信」',
    '点「权限」，把「麦克风」改成允许',
    '回到微信，重新进入小程序'
  ]
}

const steps = computed(() => STEPS[platform.value])

/** 尝试直接跳转设置页 */
async function tryOpenSetting() {
  const ok = await permission.openSettingForMic()
  if (ok) {
    uni.showToast({ title: '已经打开了', icon: 'success' })
    appStore.setAudioTest({ micGranted: true, speakerOk: appStore.speakerOk })
  } else {
    uni.showToast({ title: '还没打开，可以照着下面的步骤来', icon: 'none' })
  }
}

/** 降级：用文字模式继续 */
function useTextMode() {
  appStore.setAudioTest({ micGranted: false, speakerOk: true })
  appStore.setOnboardingStep('notice')
  uni.navigateTo({ url: '/pages/parent/notice' })
}

/** 用户自己确认已开启，继续引导 */
function confirmDone() {
  appStore.setAudioTest({ micGranted: true, speakerOk: appStore.speakerOk })
  appStore.setOnboardingStep('notice')
  uni.navigateTo({ url: '/pages/parent/notice' })
}
</script>

<template>
  <view class="page page--parent">
    <view class="pg__head">
      <text class="t-h1">怎么开启麦克风</text>
      <text class="pg__lead">
        打不开也没关系，下面还有别的办法。你先试试这几步。
      </text>
    </view>

    <!-- 平台切换 -->
    <view class="pg__tabs">
      <view
        v-for="tab in PLATFORM_TABS"
        :key="tab.value"
        class="pg__tab"
        :class="{ 'pg__tab--on': platform === tab.value }"
        @tap="platform = tab.value"
      >
        <text class="pg__tab-text">{{ tab.label }}</text>
      </view>
    </view>

    <!-- 步骤 -->
    <view class="card pg__card">
      <view
        v-for="(s, i) in steps"
        :key="i"
        class="pg__step"
      >
        <view class="pg__step-num">
          <text class="pg__step-num-text">{{ i + 1 }}</text>
        </view>
        <text class="pg__step-text">{{ s }}</text>
      </view>
    </view>

    <!-- 快捷入口 -->
    <view class="btn btn--ghost btn--block pg__btn" @tap="tryOpenSetting">
      <text>直接去设置里打开</text>
    </view>

    <view class="pg__divider">
      <view class="pg__divider-line" />
      <text class="pg__divider-text">或者</text>
      <view class="pg__divider-line" />
    </view>

    <!-- 降级说明 -->
    <view class="card pg__fallback">
      <text class="pg__fallback-title">先用文字模式也可以</text>
      <text class="pg__fallback-text">
        文字模式下，孩子用点一点的方式回答，训练的轮次和目标完全一样。
        等他状态好、或者你方便的时候，再回来打开麦克风就行。
      </text>
    </view>

    <view class="pg__pad" />

    <view class="pg__footer safe-bottom">
      <view class="btn btn--primary btn--block" @tap="useTextMode">
        <text>先用文字模式</text>
      </view>
      <view class="pg__confirm" @tap="confirmDone">
        <text class="pg__confirm-text">我已经打开了，继续下一步</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.pg__head {
  padding: $sp-4 0 $sp-4;
}

.pg__lead {
  display: block;
  margin-top: $sp-3;
  font-size: $fs-body;
  color: $c-text-sub;
  line-height: 1.8;
}

/* ---------- 平台切换 ---------- */
.pg__tabs {
  display: flex;
  gap: $sp-2;
  padding: 6rpx;
  background: $c-primary-mist;
  border-radius: $r-pill;
  margin-bottom: $sp-3;
}

.pg__tab {
  flex: 1;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $r-pill;
  transition: all $t-fast $ease-soft;

  &--on {
    background: #fff;
    box-shadow: $sh-soft;
  }
}

.pg__tab-text {
  font-size: $fs-sub;
  color: $c-text-sub;
}

.pg__tab--on .pg__tab-text {
  color: $c-primary;
  font-weight: 600;
}

/* ---------- 步骤 ---------- */
.pg__card {
  padding: $sp-2 $sp-4;
}

.pg__step {
  display: flex;
  align-items: flex-start;
  gap: $sp-3;
  padding: $sp-3 0;

  & + & {
    border-top: 2rpx solid $c-line;
  }
}

.pg__step-num {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: $c-primary-soft;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.pg__step-num-text {
  font-size: 26rpx;
  font-weight: 700;
  color: $c-primary-deep;
  line-height: 1;
}

.pg__step-text {
  flex: 1;
  font-size: $fs-body;
  color: $c-text;
  line-height: 1.7;
  padding-top: 4rpx;
}

.pg__btn {
  margin-top: $sp-3;
}

/* ---------- 分割 ---------- */
.pg__divider {
  display: flex;
  align-items: center;
  gap: $sp-3;
  padding: $sp-5 0;
}

.pg__divider-line {
  flex: 1;
  height: 2rpx;
  background: $c-line;
}

.pg__divider-text {
  font-size: $fs-cap;
  color: $c-text-weak;
}

/* ---------- 降级说明 ---------- */
.pg__fallback-title {
  display: block;
  font-size: $fs-h3;
  font-weight: 600;
  color: $c-text;
  margin-bottom: $sp-2;
}

.pg__fallback-text {
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.8;
}

/* ---------- 底部 ---------- */
.pg__pad {
  height: 220rpx;
}

.pg__footer {
  position: fixed;
  left: var(--window-left, 0);
  right: var(--window-right, 0);
  bottom: 0;
  background: #fff;
  padding: $sp-3 $sp-4;
  border-top: 2rpx solid $c-line;
  box-shadow: 0 -8rpx 32rpx rgba(34, 48, 63, 0.05);
}

.pg__confirm {
  padding: $sp-3;
  text-align: center;
}

.pg__confirm-text {
  font-size: $fs-sub;
  color: $c-text-weak;
}
</style>
