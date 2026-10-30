<script setup>
/**
 * 自定义导航栏
 *
 * 儿童端与家长端都用 navigationStyle: custom，需要自己补状态栏高度。
 * 儿童端额外约束：返回按钮做成大触控目标，避免误触。
 *
 * 微信右上角的胶囊按钮会一直浮在最上层，所以右侧插槽要让出胶囊的宽度，
 * 否则放在右边的按钮（比如停止信号）会被盖住、点不到。
 */
import { getNavMetrics } from '@/core/nav'

const props = defineProps({
  title: { type: String, default: '' },
  /** 是否显示返回箭头 */
  back: { type: Boolean, default: true },
  /** 主题：parent 家长端 / child 儿童端 */
  theme: { type: String, default: 'parent' },
  /** 背景是否透明（首页用） */
  transparent: { type: Boolean, default: false },
  /** 返回时的自定义行为，不传则 uni.navigateBack */
  onBack: { type: Function, default: null }
})

const emit = defineEmits(['back'])

const nav = getNavMetrics()

function handleBack() {
  if (props.onBack) {
    props.onBack()
    return
  }
  emit('back')
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    // 直接进入的页面，退回上一级首页而不是白屏
    uni.reLaunch({ url: '/pages/parent/home' })
  }
}
</script>

<template>
  <view
    class="navbar"
    :class="[`navbar--${theme}`, { 'navbar--transparent': transparent }]"
    :style="{ paddingTop: nav.statusBarHeight + 'px' }"
  >
    <view
      class="navbar__inner"
      :style="{ minHeight: nav.navHeight + 'px', paddingRight: nav.capsuleReserve + 'px' }"
    >
      <view v-if="back" class="navbar__back" :class="`navbar__back--${theme}`" @tap="handleBack">
        <text class="navbar__arrow">‹</text>
      </view>
      <view v-else class="navbar__placeholder" />

      <view class="navbar__title" :class="`navbar__title--${theme}`">
        <slot name="title">{{ title }}</slot>
      </view>

      <view class="navbar__right">
        <slot name="right" />
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.navbar {
  position: relative;
  width: 100%;
  z-index: 20;

  &--parent {
    background: $c-page;
  }

  &--child {
    background: $c-primary-mist;
  }

  &--transparent {
    background: transparent;
  }
}

/*
 * 高度不写死：最小高度由脚本按胶囊行设定（行内 style），
 * 儿童端的大按钮（120rpx）比胶囊行高时自动撑开，不会被裁掉。
 * 右侧内边距也由脚本给出，用来让出胶囊。
 */
.navbar__inner {
  display: flex;
  align-items: center;
  padding-left: $sp-3;
  padding-top: $sp-1;
  padding-bottom: $sp-1;
}

.navbar__back {
  width: $tap-min;
  height: $tap-min;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $r-pill;
  transition: background $t-fast $ease-soft;

  &:active {
    background: rgba(0, 0, 0, 0.05);
  }

  &--child {
    width: $tap-child;
    height: $tap-child;
    background: rgba(255, 255, 255, 0.82);
    box-shadow: $sh-soft;
  }
}

.navbar__arrow {
  font-size: 56rpx;
  line-height: 1;
  color: $c-primary-deep;
  margin-top: -6rpx;
}

.navbar__placeholder {
  width: $tap-min;
}

.navbar__title {
  flex: 1;
  text-align: center;
  font-size: $fs-h3;
  font-weight: 600;
  color: $c-text;

  &--child {
    font-size: $fs-h2;
    color: $c-primary-deep;
  }
}

.navbar__right {
  min-width: $tap-min;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: $sp-2;
}
</style>
