<script setup>
/**
 * 空状态 / 加载失败兜底（项目书 表 3-1 loading-error 组件）
 *
 * 措辞约束：不使用"错误""失败"作为标题。
 * 加载失败时给的是"没加载出来"，并提供重试入口。
 */
const props = defineProps({
  /** loading / empty / offline */
  type: { type: String, default: 'empty' },
  title: { type: String, default: '' },
  desc: { type: String, default: '' },
  /** 是否展示重试按钮 */
  retry: { type: Boolean, default: false },
  retryText: { type: String, default: '再试一次' }
})

const emit = defineEmits(['retry'])

const defaultTitle = {
  loading: '正在准备',
  empty: '这里还没有内容',
  offline: '没有连上网络'
}

const defaultDesc = {
  loading: '',
  empty: '等有新的内容，就会出现在这里',
  offline: '检查一下网络，然后我们再试一次'
}
</script>

<template>
  <view class="empty">
    <view v-if="type === 'loading'" class="empty__spinner">
      <view class="empty__dot" />
      <view class="empty__dot" />
      <view class="empty__dot" />
    </view>
    <text v-else class="empty__icon">{{ type === 'offline' ? '☁️' : '🌱' }}</text>

    <text class="empty__title">{{ title || defaultTitle[type] }}</text>
    <text v-if="desc || defaultDesc[type]" class="empty__desc">
      {{ desc || defaultDesc[type] }}
    </text>

    <view v-if="retry" class="empty__retry" @tap="emit('retry')">
      <text class="empty__retry-text">{{ retryText }}</text>
    </view>

    <!-- 默认插槽：允许调用方追加操作按钮 -->
    <slot />
  </view>
</template>

<style lang="scss" scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $sp-7 $sp-4;
  gap: $sp-2;
}

.empty__icon {
  font-size: 88rpx;
  line-height: 1;
  opacity: 0.7;
  margin-bottom: $sp-2;
}

/* 三点加载：慢速，避免闪烁 */
.empty__spinner {
  display: flex;
  gap: 12rpx;
  margin-bottom: $sp-3;
}

.empty__dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: $c-primary;
  opacity: 0.35;
  animation: dot 1.4s $ease-soft infinite;

  &:nth-child(2) {
    animation-delay: 0.2s;
  }
  &:nth-child(3) {
    animation-delay: 0.4s;
  }
}

@keyframes dot {
  0%,
  100% {
    opacity: 0.25;
    transform: translateY(0);
  }
  50% {
    opacity: 0.9;
    transform: translateY(-8rpx);
  }
}

.empty__title {
  font-size: $fs-h3;
  color: $c-text-sub;
  font-weight: 500;
}

.empty__desc {
  font-size: $fs-sub;
  color: $c-text-weak;
  text-align: center;
  line-height: 1.6;
  max-width: 480rpx;
}

.empty__retry {
  margin-top: $sp-3;
  height: $tap-min;
  padding: 0 $sp-5;
  border-radius: $r-pill;
  background: #fff;
  border: 2rpx solid $c-primary-soft;
  display: flex;
  align-items: center;
  justify-content: center;

  &:active {
    background: $c-primary-mist;
  }
}

.empty__retry-text {
  font-size: $fs-body;
  color: $c-primary;
  font-weight: 500;
}
</style>
