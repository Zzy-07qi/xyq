<script setup>
/**
 * 全局停止信号入口（项目书 3.4 / 5.4）
 *
 * "停止信号"既是儿童画像里的一个字段，也是一个全局常驻能力：
 * 任何页面、任何时刻，儿童都能自己表达"我想休息一下"。
 *
 * 位置固定在儿童端右上角，触控目标 120rpx，家长端不显示。
 * 样式刻意做得不显眼但不难找 —— 太显眼会诱导点击，太隐蔽则形同虚设。
 */
const emit = defineEmits(['stop'])

function handleTap() {
  uni.showModal({
    title: '想休息一下吗？',
    content: '我们可以停下来，等你想说的时候再说',
    confirmText: '好，休息一下',
    cancelText: '继续说',
    success: (res) => {
      if (res.confirm) emit('stop')
    }
  })
}
</script>

<template>
  <view class="stop" @tap="handleTap">
    <text class="stop__icon">⏸</text>
  </view>
</template>

<style lang="scss" scoped>
.stop {
  width: $tap-child;
  height: $tap-child;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $r-pill;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: $sh-soft;
  transition: transform $t-fast $ease-soft;

  &:active {
    transform: scale(0.94);
  }
}

.stop__icon {
  font-size: 44rpx;
  line-height: 1;
  color: $c-text-sub;
}
</style>
