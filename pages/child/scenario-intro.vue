<script setup>
/**
 * 场景介绍页（项目书 流程 3 / 表 3-1）
 *
 * 进入正式对话前，先让孩子熟悉场景：看场景图、听目标说明、可以反复试听。
 *
 * 这一页的存在意义是"降低不可预期性" —— ASD 儿童对即将发生的事
 * 有强烈需求，所以这里必须把"接下来会怎样"讲清楚：
 * 会有人问一个问题，他来说，一共说 3 次左右。
 *
 * 目标说明支持语音试听（项目书 3.3 明确要求）。
 */
import { ref, computed, onUnmounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useSessionStore } from '@/store/session'
import { errorMessage } from '@/core/request'
import * as player from '@/core/audio/player'

const session = useSessionStore()

/** 情境详情已在选择页拉好，存在 session 里 */
const scenario = computed(() => session.scenario)
const introOk = ref(true)
const loading = ref(false)
const starting = ref(false)

onLoad(() => {
  if (!session.scenario) {
    uni.redirectTo({ url: '/pages/child/scenario-select' })
  }
})

/** 开始：创建后端训练会话，拿到第一题 */
async function start() {
  if (starting.value) return
  starting.value = true
  player.stop()
  try {
    await session.start()
    uni.redirectTo({ url: '/pages/child/training' })
  } catch (err) {
    uni.showToast({ title: errorMessage(err), icon: 'none' })
  } finally {
    starting.value = false
  }
}

/** 还没开始训练，直接回儿童首页 */
function handleStop() {
  player.forceStop()
  session.reset()
  uni.reLaunch({ url: '/pages/child/home' })
}

function goBack() {
  player.stop()
  uni.navigateBack({
    fail: () => uni.reLaunch({ url: '/pages/child/scenario-select' })
  })
}

/** 预告接下来的流程，降低焦虑 */
const preview = computed(() => {
  const n = scenario.value ? scenario.value.roundCount || 3 : 3
  return [
    { icon: '👂', text: '我会先问你一句话' },
    { icon: '🗣', text: '你来说说看，说什么都行' },
    { icon: '⭐', text: `这样说 ${n} 次就好` }
  ]
})

onUnmounted(() => {
  player.stop()
})
</script>

<template>
  <view class="intro page--child">
    <x-navbar :title="''" theme="child" :on-back="goBack">
      <template #right>
        <x-stop-signal @stop="handleStop" />
      </template>
    </x-navbar>

    <x-empty v-if="loading" type="loading" />

    <template v-else-if="scenario">
      <!-- ============ 场景图 ============ -->
      <view class="intro__cover" :style="{ background: scenario.themeColor + '26' }">
        <image
          v-if="introOk && scenario.cover"
          class="intro__cover-img"
          :src="scenario.cover"
          mode="aspectFill"
          @error="introOk = false"
        />
        <view v-else class="intro__cover-fallback">
          <text class="intro__cover-emoji">{{ scenario.emoji }}</text>
        </view>
      </view>

      <!-- ============ 场景说明 ============ -->
      <view class="intro__body">
        <text class="intro__title">{{ scenario.title }}</text>
        <text class="intro__scene">{{ scenario.sceneDesc }}</text>

        <!-- 目标说明 + 试听 -->
        <view class="intro__goal">
          <text class="intro__goal-label">我们来练这个</text>
          <text class="intro__goal-text">{{ scenario.goal }}</text>
          <!-- 「听一听」按钮等接了语音合成再加回来，现在按了没有声音，反而让孩子困惑 -->
        </view>

        <!-- ============ 接下来会怎样 ============ -->
        <view class="intro__preview">
          <text class="intro__preview-title">接下来是这样</text>
          <view
            v-for="(p, i) in preview"
            :key="i"
            class="intro__preview-item"
          >
            <text class="intro__preview-icon">{{ p.icon }}</text>
            <text class="intro__preview-text">{{ p.text }}</text>
          </view>
        </view>
      </view>

      <view class="intro__pad" />

      <!-- ============ 主按钮 ============ -->
      <view class="intro__footer safe-bottom">
        <view
          class="btn btn--leaf btn--child btn--block"
          :class="{ 'btn--disabled': starting }"
          @tap="start"
        >
          <text>{{ starting ? '正在准备' : '准备好了，开始吧' }}</text>
        </view>
      </view>
    </template>

    <x-empty
      v-else
      type="empty"
      title="这个场景暂时看不到"
      desc="换一个试试吧"
    />
  </view>
</template>

<style lang="scss" scoped>
.intro {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ================= 场景图 ================= */
.intro__cover {
  margin: 0 $sp-4;
  height: 420rpx;
  border-radius: $r-lg;
  overflow: hidden;
  box-shadow: $sh-card;
}

.intro__cover-img {
  width: 100%;
  height: 100%;
}

.intro__cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.intro__cover-emoji {
  font-size: 200rpx;
  line-height: 1;
}

/* ================= 主体 ================= */
.intro__body {
  flex: 1;
  padding: $sp-4;
}

.intro__title {
  display: block;
  font-size: 56rpx;
  font-weight: 700;
  color: $c-primary-deep;
  letter-spacing: 2rpx;
}

.intro__scene {
  display: block;
  margin-top: $sp-2;
  font-size: $fs-child;
  color: $c-text-sub;
  line-height: 1.75;
}

/* ---------- 目标 ---------- */
.intro__goal {
  margin-top: $sp-4;
  padding: $sp-4;
  border-radius: $r-lg;
  background: #fff;
  box-shadow: $sh-soft;
}

.intro__goal-label {
  display: block;
  font-size: $fs-cap;
  color: $c-text-weak;
  margin-bottom: $sp-1;
}

.intro__goal-text {
  display: block;
  font-size: 38rpx;
  font-weight: 600;
  color: $c-primary-deep;
  line-height: 1.55;
}

.intro__listen {
  margin-top: $sp-3;
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: $sp-2;
  height: 88rpx;
  padding: 0 $sp-4;
  border-radius: $r-pill;
  background: $c-primary-mist;
  transition: background $t-fast $ease-soft;

  &:active {
    background: $c-primary-soft;
  }

  &--on {
    background: $c-sun-soft;
  }
}

.intro__listen-icon {
  font-size: 36rpx;
  line-height: 1;
}

.intro__listen-text {
  font-size: $fs-body;
  color: $c-primary;
  font-weight: 500;
}

/* ---------- 流程预告 ---------- */
.intro__preview {
  margin-top: $sp-4;
  padding: $sp-4;
  border-radius: $r-lg;
  background: $c-leaf-soft;
}

.intro__preview-title {
  display: block;
  font-size: $fs-body;
  font-weight: 600;
  color: #4a5c1f;
  margin-bottom: $sp-3;
}

.intro__preview-item {
  display: flex;
  align-items: center;
  gap: $sp-3;

  & + & {
    margin-top: $sp-3;
  }
}

.intro__preview-icon {
  font-size: 44rpx;
  line-height: 1;
  flex-shrink: 0;
}

.intro__preview-text {
  flex: 1;
  font-size: $fs-child;
  color: #556b24;
  line-height: 1.6;
}

/* ================= 底部 ================= */
.intro__pad {
  height: 180rpx;
}

.intro__footer {
  position: fixed;
  left: var(--window-left, 0);
  right: var(--window-right, 0);
  bottom: 0;
  padding: $sp-3 $sp-4;
  background: linear-gradient(180deg, rgba(238, 245, 254, 0) 0%, #eef5fe 40%);
}
</style>
