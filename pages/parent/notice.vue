<script setup>
/**
 * 陪练须知页（项目书 流程 2 / 表 3-1）
 *
 * 项目书要求的三条：等待 5 秒、不要代答、发现不适可停止。
 *
 * 这一页是全流程里最容易被划过去的一页，所以刻意做得少而重：
 * 只有三条，每条一句话，配一张"家长最容易做错的事"的反例说明。
 */
import { ref } from 'vue'
import { useAppStore } from '@/store/app'
import { PARENT_NOTICE } from '@/config/copywriting'

const appStore = useAppStore()
const expanded = ref(-1)

function toggle(i) {
  expanded.value = expanded.value === i ? -1 : i
}

/** 每条须知配的反例，帮助家长理解"为什么这么说" */
const EXAMPLES = {
  wait: '常见的情况是：孩子刚沉默两秒，我们就忍不住说"快说呀"。这一催，孩子可能就不说了。',
  'no-answer-for-child':
    '常见的情况是：孩子说不出来，我们直接把整句说完了。孩子听到了，但没练到自己说这一遍。',
  'can-stop': '常见的情况是：觉得来了就要做完。其实做三轮和做一轮，效果差别远小于情绪被破坏的代价。'
}

function finish() {
  appStore.finishOnboarding()
  uni.reLaunch({ url: '/pages/parent/home' })
}
</script>

<template>
  <view class="page page--parent">
    <view class="nt__head">
      <text class="t-h1">陪着他，就是这样三件事</text>
      <text class="nt__lead">
        这几句话看起来简单，但真正做到不容易。开始之前先看一遍。
      </text>
    </view>

    <!-- 三条须知 -->
    <view
      v-for="(item, i) in PARENT_NOTICE"
      :key="item.key"
      class="card nt__card"
    >
      <view class="nt__card-head" @tap="toggle(i)">
        <text class="nt__icon">{{ item.icon }}</text>
        <view class="nt__card-main">
          <text class="nt__title">{{ item.title }}</text>
          <text class="nt__desc">{{ item.desc }}</text>
        </view>
        <text class="nt__expand">{{ expanded === i ? '−' : '+' }}</text>
      </view>

      <view v-if="expanded === i" class="nt__example anim-fade-up">
        <text class="nt__example-text">{{ EXAMPLES[item.key] }}</text>
      </view>
    </view>

    <!-- 一句话总结 -->
    <view class="nt__summary">
      <text class="nt__summary-text">
        做到这三件事，剩下的交给孩子。他愿意开口的次数，比说得标不标准更重要。
      </text>
    </view>

    <view class="nt__pad" />

    <view class="nt__footer safe-bottom">
      <view class="btn btn--primary btn--block" @tap="finish">
        <text>记住了，开始吧</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.nt__head {
  padding: $sp-4 0 $sp-4;
}

.nt__lead {
  display: block;
  margin-top: $sp-3;
  font-size: $fs-body;
  color: $c-text-sub;
  line-height: 1.8;
}

/* ---------- 卡片 ---------- */
.nt__card {
  margin-bottom: $sp-3;
  padding: 0;
  overflow: hidden;
}

.nt__card-head {
  display: flex;
  align-items: flex-start;
  gap: $sp-3;
  padding: $sp-4;
}

.nt__icon {
  font-size: 56rpx;
  line-height: 1.15;
  flex-shrink: 0;
}

.nt__card-main {
  flex: 1;
}

.nt__title {
  display: block;
  font-size: $fs-h3;
  font-weight: 600;
  color: $c-text;
}

.nt__desc {
  display: block;
  margin-top: $sp-1;
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.7;
}

.nt__expand {
  font-size: 44rpx;
  color: $c-text-weak;
  line-height: 1;
  padding: 0 $sp-1;
  flex-shrink: 0;
}

/* ---------- 展开的反例 ---------- */
.nt__example {
  padding: $sp-3 $sp-4;
  background: $c-sun-soft;
  border-top: 2rpx solid rgba(245, 205, 92, 0.35);
}

.nt__example-text {
  font-size: $fs-sub;
  color: #8a6420;
  line-height: 1.75;
}

/* ---------- 总结 ---------- */
.nt__summary {
  margin-top: $sp-4;
  padding: $sp-4;
  border-radius: $r-lg;
  background: $c-leaf-soft;
}

.nt__summary-text {
  font-size: $fs-body;
  color: #556b24;
  line-height: 1.8;
  font-weight: 500;
}

/* ---------- 底部 ---------- */
.nt__pad {
  height: 180rpx;
}

.nt__footer {
  position: fixed;
  left: var(--window-left, 0);
  right: var(--window-right, 0);
  bottom: 0;
  background: #fff;
  padding: $sp-3 $sp-4;
  border-top: 2rpx solid $c-line;
  box-shadow: 0 -8rpx 32rpx rgba(34, 48, 63, 0.05);
}
</style>
