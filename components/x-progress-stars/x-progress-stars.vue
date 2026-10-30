<script setup>
/**
 * 进度星星（项目书 3.3）
 *
 * 儿童端的进度展示刻意回避"第 2/3 轮"这种计数式压力，
 * 改用星星填充表达"我们一起说了几件事"。
 * 已完成的星星是亮的，当前轮是半亮，未开始的是淡的。
 */
const props = defineProps({
  total: { type: Number, default: 3 },
  done: { type: Number, default: 0 },
  /** 当前进行到第几轮（1 起） */
  current: { type: Number, default: 1 }
})

function starState(index) {
  // index 从 0 开始
  if (index < props.done) return 'done'
  if (index === props.current - 1) return 'current'
  return 'todo'
}
</script>

<template>
  <view class="stars">
    <view
      v-for="i in total"
      :key="i"
      class="stars__item"
      :class="`stars__item--${starState(i - 1)}`"
    >
      <text class="stars__icon">★</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.stars {
  display: flex;
  align-items: center;
  gap: $sp-2;
}

.stars__item {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform $t-base $ease-soft, opacity $t-base $ease-soft;
}

.stars__icon {
  font-size: 44rpx;
  line-height: 1;
}

/* 已完成：暖阳黄 */
.stars__item--done .stars__icon {
  color: $c-sun;
}

/* 当前轮：淡一点的黄，带柔和呼吸 */
.stars__item--current {
  transform: scale(1.12);
  animation: breath $t-breath $ease-soft infinite;
}

.stars__item--current .stars__icon {
  color: rgba(245, 205, 92, 0.55);
}

/* 未开始：极淡的蓝 */
.stars__item--todo .stars__icon {
  color: rgba(61, 126, 219, 0.18);
}
</style>
