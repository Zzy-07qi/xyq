<script setup>
/**
 * 语音播放器组件（项目书 4.3 / 5.3）
 *
 * 三件事：
 *  1. 统一播放入口，支持试听 / 打断 / 急停
 *  2. 播放状态与 UI 动画同步（波纹随播放起伏）
 *  3. 无音频地址时降级为纯文字，不阻断流程
 *
 * 设计约束（5.4）：所有语音内容可重复试听；动画慢速、无闪烁。
 */
import { ref, computed, onUnmounted } from 'vue'
import * as player from '@/core/audio/player'

const props = defineProps({
  /** 音频地址，为空则只展示文字 */
  url: { type: String, default: '' },
  /** 对应文本，无音频时直接展示 */
  text: { type: String, default: '' },
  /** 来源标记：intro / question / feedback / wordcard / safety */
  tag: { type: String, default: '' },
  /** 是否自动播放（AI 提问需要自动播） */
  autoplay: { type: Boolean, default: false },
  /** 是否展示重播按钮 */
  replayable: { type: Boolean, default: true },
  /** 儿童端更大的展示尺寸 */
  size: { type: String, default: 'child' }
})

const emit = defineEmits(['ended', 'start'])

const state = ref(player.PLAYER_STATE.IDLE)
const failed = ref(false)

let unsubscribe = null

/** 播放/暂停切换 */
async function toggle() {
  if (state.value === player.PLAYER_STATE.PLAYING) {
    player.stop()
    return
  }
  await doPlay()
}

async function doPlay() {
  failed.value = false
  emit('start')
  const ok = await player.play({
    url: props.url,
    text: props.text,
    tag: props.tag,
    onEnded: () => {
      state.value = player.PLAYER_STATE.STOPPED
      emit('ended')
    }
  })
  if (!ok && props.text) {
    // 无音频：降级为文字展示，延时后仍触发 ended 让流程继续
    failed.value = true
  }
}

/** 父组件可调用：立即开始播放 */
function playNow() {
  doPlay()
}

/** 父组件可调用：急停（安全中止时） */
function forceStop() {
  player.forceStop()
  state.value = player.PLAYER_STATE.STOPPED
}

/** 订阅播放器状态 */
function bind() {
  if (unsubscribe) return
  unsubscribe = player.subscribe((s) => {
    state.value = s
    if (s === player.PLAYER_STATE.ERROR && props.text) {
      failed.value = true
    }
  })
}
bind()

const playing = computed(() => state.value === player.PLAYER_STATE.PLAYING)
const loading = computed(() => state.value === player.PLAYER_STATE.LOADING)

/** 播放中的波纹条数 */
const bars = computed(() => (playing.value ? 5 : 5))

if (props.autoplay) {
  // 等组件挂载完再播，避免首帧被系统音频策略拦住
  setTimeout(() => doPlay(), 260)
}

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})

defineExpose({ playNow, forceStop, isPlaying: player.isPlaying })
</script>

<template>
  <view class="player" :class="[`player--${size}`, { 'player--playing': playing }]">
    <!-- 语音气泡：文本始终可见，无音频时它就是唯一载体 -->
    <view v-if="text" class="player__bubble">
      <text class="player__text">{{ text }}</text>
    </view>

    <!-- 播放控制条：只在有音频时出现 -->
    <view v-if="url" class="player__bar" @tap="toggle">
      <view class="player__wave">
        <view
          v-for="(b, i) in bars"
          :key="i"
          class="player__wave-bar"
          :class="{ 'player__wave-bar--on': playing }"
          :style="{ animationDelay: i * 0.16 + 's' }"
        />
      </view>
      <text class="player__action">
        {{ playing ? '停一下' : replayable ? '再听一次' : '听一听' }}
      </text>
    </view>

    <!-- 无音频时的重播提示 -->
    <view v-else-if="replayable" class="player__bar player__bar--plain">
      <text class="player__action player__action--plain">我可以再读一遍</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.player {
  display: flex;
  flex-direction: column;
  gap: $sp-3;
  width: 100%;
}

/* ---------- 文本气泡 ---------- */
.player__bubble {
  background: #fff;
  border-radius: $r-lg;
  padding: $sp-4;
  box-shadow: $sh-soft;
}

.player__text {
  font-size: $fs-body;
  line-height: 1.7;
  color: $c-text;
}

.player--child .player__text {
  font-size: $fs-child;
  line-height: 1.8;
  color: $c-primary-deep;
  font-weight: 500;
}

/* ---------- 控制条 ---------- */
.player__bar {
  display: flex;
  align-items: center;
  gap: $sp-3;
  height: 72rpx;
  padding: 0 $sp-4;
  align-self: flex-start;
  border-radius: $r-pill;
  background: $c-primary-mist;
  transition: background $t-base $ease-soft;

  &:active {
    background: $c-primary-soft;
  }

  &--plain {
    background: transparent;
    padding: 0;
  }
}

.player--child .player__bar {
  height: $tap-min;
}

.player__wave {
  display: flex;
  align-items: center;
  gap: 6rpx;
  height: 36rpx;
}

.player__wave-bar {
  width: 6rpx;
  height: 12rpx;
  border-radius: $r-pill;
  background: $c-primary;
  opacity: 0.5;
  transition: height $t-base $ease-soft;

  /* 播放中：慢速起伏，不闪烁 */
  &--on {
    opacity: 1;
    animation: wave 1.1s $ease-soft infinite;
  }
}

@keyframes wave {
  0%,
  100% {
    height: 12rpx;
  }
  50% {
    height: 32rpx;
  }
}

.player__action {
  font-size: $fs-sub;
  color: $c-primary;
  font-weight: 500;

  &--plain {
    color: $c-text-weak;
    font-weight: 400;
  }
}
</style>
