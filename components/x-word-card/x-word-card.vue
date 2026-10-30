<script setup>
/**
 * 词卡浮层（项目书 流程 5 二级/三级提示、流程 7/8）
 *
 * 二级提示：只展示关键词/句式开头，儿童自己补完
 * 三级提示：展示完整句，同时提示家长辅助
 *
 * 设计约束：
 *  - 不使用"正确答案"这类措辞，词卡定位是"帮手"不是"答案"
 *  - 出现动画慢速，避免突然弹出造成惊吓
 *  - 点击可朗读（接 TTS 后生效）
 */
const props = defineProps({
  visible: { type: Boolean, default: false },
  /** 关键词数组，如 ['我想搭一个……'] */
  words: { type: Array, default: () => [] },
  /** 完整句，三级提示才有 */
  fullSentence: { type: String, default: '' },
  /** 提示层级 2 / 3，影响标题措辞 */
  level: { type: Number, default: 2 }
})

const emit = defineEmits(['close', 'pick'])

function handlePick(word) {
  emit('pick', word)
}
</script>

<template>
  <view v-if="visible" class="wordcard">
    <!-- 遮罩：点击关闭 -->
    <view class="wordcard__mask" @tap="emit('close')" />

    <view class="wordcard__panel anim-fade-up">
      <view class="wordcard__head">
        <text class="wordcard__title">
          {{ level >= 3 ? '跟着我这样说' : '可以这样说' }}
        </text>
        <view class="wordcard__close" @tap="emit('close')">
          <text class="wordcard__close-icon">×</text>
        </view>
      </view>

      <!-- 关键词 -->
      <view v-if="words && words.length" class="wordcard__words">
        <view
          v-for="(w, i) in words"
          :key="i"
          class="wordcard__word"
          @tap="handlePick(w)"
        >
          <text class="wordcard__word-text">{{ w }}</text>
        </view>
      </view>

      <!-- 完整句：三级提示 -->
      <view v-if="fullSentence" class="wordcard__full">
        <text class="wordcard__full-label">完整的一句话</text>
        <text class="wordcard__full-text">{{ fullSentence }}</text>
      </view>

      <!-- 三级提示时给家长一句话 -->
      <view v-if="level >= 3" class="wordcard__parent-tip">
        <text class="wordcard__parent-text">
          家长可以自己先读一遍，然后把最后一句留给孩子
        </text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.wordcard {
  position: fixed;
  left: var(--window-left, 0);
  right: var(--window-right, 0);
  top: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
}

.wordcard__mask {
  position: absolute;
  inset: 0;
  background: rgba(34, 48, 63, 0.32);
}

.wordcard__panel {
  position: relative;
  width: 100%;
  background: #fff;
  border-radius: $r-xl $r-xl 0 0;
  padding: $sp-4 $sp-4 calc(#{$sp-5} + env(safe-area-inset-bottom));
  box-shadow: $sh-float;
}

.wordcard__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $sp-4;
}

.wordcard__title {
  font-size: $fs-h3;
  font-weight: 600;
  color: $c-primary-deep;
}

.wordcard__close {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $r-pill;
  background: $c-primary-mist;
}

.wordcard__close-icon {
  font-size: 44rpx;
  color: $c-text-sub;
  line-height: 1;
}

/* ---------- 关键词 ---------- */
.wordcard__words {
  display: flex;
  flex-direction: column;
  gap: $sp-2;
}

.wordcard__word {
  padding: $sp-3 $sp-4;
  border-radius: $r-md;
  background: $c-primary-mist;
  border: 2rpx solid $c-primary-soft;
  transition: background $t-fast $ease-soft;

  &:active {
    background: $c-primary-soft;
  }
}

.wordcard__word-text {
  font-size: $fs-child;
  color: $c-primary-deep;
  font-weight: 500;
}

/* ---------- 完整句 ---------- */
.wordcard__full {
  margin-top: $sp-3;
  padding: $sp-4;
  border-radius: $r-md;
  background: $c-leaf-soft;
}

.wordcard__full-label {
  display: block;
  font-size: $fs-cap;
  color: $c-leaf-deep;
  margin-bottom: $sp-1;
}

.wordcard__full-text {
  font-size: 38rpx;
  color: #4a5c1f;
  font-weight: 600;
  line-height: 1.6;
}

/* ---------- 家长提示 ---------- */
.wordcard__parent-tip {
  margin-top: $sp-3;
  padding: $sp-3;
  border-radius: $r-md;
  background: $c-sun-soft;
}

.wordcard__parent-text {
  font-size: $fs-sub;
  color: #96682a;
  line-height: 1.6;
}
</style>
