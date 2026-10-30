<script setup>
/**
 * 儿童模式首页（项目书 流程 3 / 表 3-1）
 *
 * 面向 ASD 儿童的首页有一条硬规则：一屏只做一件事。
 * 所以这一页没有功能列表、没有数据统计、没有入口矩阵 ——
 * 只有一个大按钮，和一句温柔的话。
 *
 * 视觉参考首页那套水彩星空：深蓝渐变的夜空 + 一颗地球，
 * 但整体比家长首页更亮、更柔和，避免压迫感。
 */
import { ref, computed } from 'vue'
import { useAppStore } from '@/store/app'
import { getNavMetrics } from '@/core/nav'
import * as player from '@/core/audio/player'

const appStore = useAppStore()

/** 停止按钮放在左上角：右上角是微信胶囊的位置，放那儿会被盖住 */
const nav = getNavMetrics()

/** 地球图是否可用 */
const earthOk = ref(true)

/** 点选作答模式 */
const textMode = computed(() => appStore.textMode)

function startTraining() {
  uni.navigateTo({ url: '/pages/child/scenario-select' })
}

/**
 * 孩子说想休息。
 * 这一页还没开始训练，没有要退出的会话，回到家长端就好。
 * （之前这里会误走中止流程，导致没训练也跳到安全页。）
 */
function handleStop() {
  player.forceStop()
  uni.reLaunch({ url: '/pages/parent/home' })
}

/** 回到家长端 */
function backToParent() {
  uni.reLaunch({ url: '/pages/parent/home' })
}

function onImgError() {
  earthOk.value = false
}

// 阻止页面滚动回弹，给儿童一个稳定的画面
function noop() {}
</script>

<template>
  <view class="child" @touchmove="noop">
    <!-- ============ 夜空背景 ============ -->
    <view class="child__sky">
      <!-- 星点：纯 CSS 生成，不引入额外图片 -->
      <view v-for="i in 18" :key="i" class="child__star" :class="`child__star--${i}`" />

      <!-- 地球：放在底部，只露出上半部分 -->
      <view class="child__earth-wrap">
        <image
          v-if="earthOk"
          class="child__earth"
          src="/static/home/earth.png"
          mode="aspectFill"
          @error="onImgError"
        />
        <view v-else class="child__earth child__earth--fallback" />
      </view>
    </view>

    <!-- ============ 顶部：停止信号 ============ -->
    <view class="child__top" :style="{ paddingTop: nav.statusBarHeight + 8 + 'px' }">
      <x-stop-signal @stop="handleStop" />
    </view>

    <!-- ============ 主体内容 ============ -->
    <view class="child__content">
      <view class="child__hello">
        <text class="child__hi">嗨，你好呀</text>
        <text class="child__sub">
          {{ textMode ? '今天我们用点一点的方式说话' : '今天想说什么都可以' }}
        </text>
      </view>

      <!-- 唯一的主按钮 -->
      <view class="child__start" @tap="startTraining">
        <view class="child__start-ring" />
        <view class="child__start-inner">
          <text class="child__start-icon">💬</text>
          <text class="child__start-text">开始说</text>
        </view>
      </view>

      <!-- 主按钮下的一句话：把预期说清楚，降低焦虑 -->
      <text class="child__note">选一个你想玩的，我们慢慢说</text>
    </view>

    <!-- ============ 底部：回家长端 ============ -->
    <view class="child__bottom safe-bottom">
      <view class="child__parent" @tap="backToParent">
        <text class="child__parent-text">找爸爸妈妈</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.child {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: linear-gradient(178deg, #1e4a8a 0%, #3d7edb 44%, #9ec9f2 100%);
  display: flex;
  flex-direction: column;
}

/* ================= 夜空 ================= */
.child__sky {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* 星点：各自不同的位置与闪烁节奏，但都是慢速 */
.child__star {
  position: absolute;
  width: 6rpx;
  height: 6rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  animation: twinkle 4s $ease-soft infinite;

  &--1 { left: 8%; top: 12%; animation-delay: 0s; }
  &--2 { left: 22%; top: 6%; animation-delay: 0.4s; }
  &--3 { left: 38%; top: 15%; animation-delay: 0.8s; }
  &--4 { left: 56%; top: 9%; animation-delay: 1.2s; }
  &--5 { left: 72%; top: 18%; animation-delay: 1.6s; }
  &--6 { left: 88%; top: 8%; animation-delay: 2s; }
  &--7 { left: 14%; top: 26%; animation-delay: 2.4s; }
  &--8 { left: 46%; top: 30%; animation-delay: 0.6s; }
  &--9 { left: 66%; top: 34%; animation-delay: 1.4s; }
  &--10 { left: 92%; top: 28%; animation-delay: 2.2s; }
  &--11 { left: 30%; top: 40%; animation-delay: 0.2s; }
  &--12 { left: 78%; top: 44%; animation-delay: 1s; }
  &--13 { left: 6%; top: 48%; animation-delay: 1.8s; }
  &--14 { left: 52%; top: 20%; animation-delay: 2.6s; }
  &--15 { left: 84%; top: 52%; animation-delay: 0.9s; }
  &--16 { left: 26%; top: 54%; animation-delay: 1.7s; }
  &--17 { left: 62%; top: 58%; animation-delay: 2.5s; }
  &--18 { left: 94%; top: 38%; animation-delay: 0.5s; }
}

@keyframes twinkle {
  0%,
  100% {
    opacity: 0.25;
    transform: scale(0.9);
  }
  50% {
    opacity: 0.95;
    transform: scale(1.15);
  }
}

/* ---------- 地球 ---------- */
.child__earth-wrap {
  position: absolute;
  left: -12%;
  bottom: -18%;
  width: 124%;
  height: 62%;
  border-radius: 50% 50% 0 0 / 60% 60% 0 0;
  overflow: hidden;
  opacity: 0.92;
}

.child__earth {
  width: 100%;
  height: 100%;
}

.child__earth--fallback {
  background: radial-gradient(circle at 40% 30%, #b9d94a 0%, #6fbf9a 38%, #3d7edb 100%);
}

/* ================= 顶部 ================= */
.child__top {
  position: relative;
  z-index: 5;
  display: flex;
  justify-content: flex-start;
  padding-left: $sp-4;
  padding-bottom: $sp-3;
}

/* ================= 内容 ================= */
.child__content {
  position: relative;
  z-index: 4;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 $sp-5;
}

.child__hello {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $sp-2;
  margin-bottom: $sp-7;
}

.child__hi {
  font-size: 64rpx;
  font-weight: 700;
  color: #fff;
  letter-spacing: 4rpx;
}

.child__sub {
  font-size: $fs-child;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.6;
}

/* ---------- 主按钮 ---------- */
.child__start {
  position: relative;
  width: 360rpx;
  height: 360rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  &:active .child__start-inner {
    transform: scale(0.94);
  }
}

/* 外圈：慢速呼吸，暗示"可以点我"，但不催促 */
.child__start-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  animation: ring 3.2s $ease-soft infinite;
}

@keyframes ring {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.55;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.28;
  }
}

.child__start-inner {
  position: relative;
  width: 280rpx;
  height: 280rpx;
  border-radius: 50%;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $sp-2;
  box-shadow: 0 20rpx 60rpx rgba(15, 36, 70, 0.32);
  transition: transform $t-base $ease-soft;
}

.child__start-icon {
  font-size: 84rpx;
  line-height: 1;
}

.child__start-text {
  font-size: 46rpx;
  font-weight: 700;
  color: $c-primary-deep;
  letter-spacing: 2rpx;
}

.child__note {
  margin-top: $sp-6;
  font-size: $fs-body;
  color: rgba(255, 255, 255, 0.82);
  text-align: center;
  line-height: 1.6;
}

/* ================= 底部 ================= */
.child__bottom {
  position: relative;
  z-index: 5;
  padding: $sp-4;
  display: flex;
  justify-content: center;
}

.child__parent {
  height: 88rpx;
  padding: 0 $sp-5;
  border-radius: $r-pill;
  background: rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;

  &:active {
    background: rgba(255, 255, 255, 0.28);
  }
}

.child__parent-text {
  font-size: $fs-sub;
  color: #fff;
}
</style>
