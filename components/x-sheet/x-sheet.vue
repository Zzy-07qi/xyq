<script setup>
/**
 * 底部弹层（家长端的介入操作面板、退出原因选择等复用）
 */
const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  /** 点击遮罩是否关闭 */
  maskClosable: { type: Boolean, default: true }
})

const emit = defineEmits(['close'])

function onMask() {
  if (props.maskClosable) emit('close')
}
</script>

<template>
  <view v-if="visible" class="sheet">
    <view class="sheet__mask" @tap="onMask" />
    <view class="sheet__panel anim-fade-up">
      <view class="sheet__grip" />
      <view v-if="title" class="sheet__head">
        <text class="sheet__title">{{ title }}</text>
      </view>
      <view class="sheet__body">
        <slot />
      </view>
      <view class="sheet__foot safe-bottom">
        <slot name="foot" />
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.sheet {
  position: fixed;
  top: 0;
  bottom: 0;
  left: var(--window-left, 0);
  right: var(--window-right, 0);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.sheet__mask {
  position: absolute;
  inset: 0;
  background: rgba(34, 48, 63, 0.32);
}

.sheet__panel {
  position: relative;
  width: 100%;
  background: #fff;
  border-radius: $r-xl $r-xl 0 0;
  padding: $sp-2 $sp-4 0;
  box-shadow: $sh-float;
  max-height: 80vh;
  overflow-y: auto;
}

.sheet__grip {
  width: 72rpx;
  height: 8rpx;
  border-radius: $r-pill;
  background: $c-line;
  margin: $sp-2 auto $sp-3;
}

.sheet__head {
  margin-bottom: $sp-3;
}

.sheet__title {
  font-size: $fs-h3;
  font-weight: 600;
  color: $c-text;
}

.sheet__body {
  padding-bottom: $sp-3;
}

.sheet__foot {
  padding: $sp-3 0;
  border-top: 2rpx solid $c-line;
}
</style>
