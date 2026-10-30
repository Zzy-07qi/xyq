<script setup>
/**
 * 通用按钮
 *
 * 儿童端与家长端的关键差异在尺寸：儿童端最小触控目标 120rpx（项目书 5.4），
 * 且必须避免连点造成误操作 —— 内部做了 300ms 节流。
 */
import { ref } from 'vue'

const props = defineProps({
  text: { type: String, default: '' },
  /** primary / ghost / plain / leaf / danger(柔和陶土，非告警红) */
  type: { type: String, default: 'primary' },
  size: { type: String, default: 'normal' }, // normal / child
  block: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  /** 前置图标，emoji 或文字 */
  icon: { type: String, default: '' }
})

const emit = defineEmits(['tap'])

const locked = ref(false)

function handleTap() {
  if (props.disabled || props.loading || locked.value) return
  // 防连点：儿童端误触概率高
  locked.value = true
  setTimeout(() => {
    locked.value = false
  }, 300)
  emit('tap')
}
</script>

<template>
  <view
    class="xbtn"
    :class="[
      `xbtn--${type}`,
      { 'xbtn--child': size === 'child', 'xbtn--block': block, 'xbtn--disabled': disabled || loading }
    ]"
    @tap="handleTap"
  >
    <text v-if="loading" class="xbtn__icon">◌</text>
    <text v-else-if="icon" class="xbtn__icon">{{ icon }}</text>
    <text class="xbtn__text"><slot>{{ text }}</slot></text>
  </view>
</template>

<style lang="scss" scoped>
.xbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: $sp-2;
  height: $tap-min;
  padding: 0 $sp-5;
  border-radius: $r-pill;
  font-size: $fs-body;
  font-weight: 500;
  transition: opacity $t-fast $ease-soft, transform $t-fast $ease-soft, background $t-fast;

  &:active {
    transform: scale(0.97);
    opacity: 0.88;
  }

  &--block {
    display: flex;
    width: 100%;
  }

  &--child {
    height: $tap-child;
    padding: 0 $sp-6;
    font-size: $fs-child;
    font-weight: 600;
    border-radius: $r-xl;
  }

  &--disabled {
    opacity: 0.4;
    pointer-events: none;
  }
}

.xbtn__icon {
  font-size: 1.1em;
  line-height: 1;
}

.xbtn__text {
  line-height: 1.3;
}

/* ---------- 类型 ---------- */
.xbtn--primary {
  background: $c-primary;
  color: #fff;
  box-shadow: 0 8rpx 24rpx rgba(61, 126, 219, 0.26);
}

.xbtn--ghost {
  background: #fff;
  color: $c-primary;
  border: 2rpx solid $c-primary-soft;
}

.xbtn--plain {
  background: transparent;
  color: $c-text-sub;
  font-weight: 400;
}

.xbtn--leaf {
  background: $c-leaf;
  color: #40521a;
  box-shadow: 0 8rpx 24rpx rgba(185, 217, 74, 0.32);
}

/* 中止按钮用柔和陶土色，避免告警红刺激儿童 */
.xbtn--danger {
  background: $c-abort-soft;
  color: #a05a49;
  border: 2rpx solid rgba(201, 139, 125, 0.3);
}
</style>
