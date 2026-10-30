<script setup>
/**
 * 录音组件（项目书 4.2 / 5.3）
 *
 * 交互链路：倾听态（≥5 秒）→ 开口或点按开始录音 → 静音检测/手动停止 → 上传
 *
 * 关键设计：
 *  - 提供"点按即可说"的大按钮，也支持开口自动开始（依赖音量检测）
 *  - 录音中展示可视化波形与停止按钮
 *  - 上传失败保留现场，不打断当前轮次（由父组件决定是否重试）
 *  - 儿童端不做倒计时压力展示，只给柔和的呼吸动画
 */
import { ref, computed, watch, onUnmounted } from 'vue'
import * as recorder from '@/core/audio/recorder'
import { TIMING } from '@/config/constants'

const props = defineProps({
  /** 是否可录音（由状态机决定，只有 LISTENING 等态才允许） */
  enabled: { type: Boolean, default: true },
  /** 图文降级模式：不显示录音按钮 */
  textMode: { type: Boolean, default: false },
  /** 等待提示语 */
  tip: { type: String, default: '我在听，慢慢说' }
})

const emit = defineEmits(['start', 'stop', 'error', 'timeout'])

const recording = ref(false)
const waiting = ref(true)
const waveform = ref(new Array(16).fill(0.2))
const elapsed = ref(0)

let waitTimer = null
let uiTimer = null
let waveTimer = null
let unsubscribe = null

/** 倾听开始时间，用于计算"至少等待 5 秒" */
let listenStartedAt = 0

/** 开始倾听计时：AI 提问播放结束后调用 */
function startListening() {
  waiting.value = true
  recording.value = false
  elapsed.value = 0
  listenStartedAt = Date.now()

  // 订阅录音机状态，同步 UI
  if (!unsubscribe) {
    unsubscribe = recorder.subscribe((state, payload) => {
      if (state === recorder.RECORDER_STATE.RECORDING) {
        recording.value = true
        waiting.value = false
        startUiTimer()
        startWaveTimer()
        emit('start')
      } else if (state === recorder.RECORDER_STATE.STOPPED) {
        recording.value = false
        stopTimers()
        resumeWaveform()
        if (payload && payload.force) return
        emit('stop', payload)
      } else if (state === recorder.RECORDER_STATE.ERROR) {
        recording.value = false
        stopTimers()
        emit('error', payload)
      }
    })
  }

  // 超时未开口：交给父组件决定是否进入一级提示（流程 5）
  clearTimeout(waitTimer)
  waitTimer = setTimeout(() => {
    if (!recording.value && waiting.value) {
      emit('timeout')
    }
  }, TIMING.WAIT_BEFORE_HINT + 4000)
}

/** 点按开始/停止 */
async function toggleRecord() {
  if (!props.enabled || props.textMode) return

  if (recording.value) {
    recorder.stop()
    return
  }

  // #ifndef H5
  const granted = await recorder.requestPermission()
  if (!granted) {
    emit('error', { reason: 'permission_denied' })
    return
  }
  // #endif
  // 网页：不能在这里先 await 再开麦。iOS Safari 要求开麦克风发生在点按事件里，
  // 中间隔一个 await 就会被拒。环境检查和权限弹窗都在 recorder.start 内部完成，
  // 失败时会发 ERROR 事件。
  waiting.value = false
  // stop / error 统一由上面 subscribe 的回调发给父组件，这里不再重复发
  recorder.start()
}

/* ---------------- UI 计时与波形 ---------------- */

function startUiTimer() {
  elapsed.value = 0
  clearInterval(uiTimer)
  uiTimer = setInterval(() => {
    elapsed.value += 100
  }, 100)
}

function startWaveTimer() {
  clearInterval(waveTimer)
  waveTimer = setInterval(() => {
    // 按真实音量起伏：没声音时几乎是平的，孩子能看出「我说话它会动」
    const level = recorder.getLevel()
    waveform.value = waveform.value.map(() => 0.15 + level * (0.5 + Math.random() * 0.5))
  }, 180)
}

function resumeWaveform() {
  clearInterval(waveTimer)
  waveform.value = new Array(16).fill(0.2)
}

function stopTimers() {
  clearInterval(uiTimer)
  clearInterval(waveTimer)
  clearTimeout(waitTimer)
}

/** 录音时长展示：只给秒数，不做倒计时压迫 */
const secondsText = computed(() => {
  const s = Math.floor(elapsed.value / 1000)
  return s > 0 ? `已经说了 ${s} 秒` : '正在听'
})

/** 停止并清理，供父组件在退出/中止时调用 */
function abort() {
  stopTimers()
  recorder.forceStop()
  recording.value = false
  waiting.value = false
}

watch(
  () => props.enabled,
  (v) => {
    if (!v) {
      // 不可录音时清掉等待态，避免动画一直转
      waiting.value = false
    }
  }
)

onUnmounted(() => {
  stopTimers()
  if (unsubscribe) unsubscribe()
})

defineExpose({ startListening, abort, toggleRecord })
</script>

<template>
  <view class="recorder">
    <!-- 图文降级：不显示录音，交由父组件放文字输入 -->
    <view v-if="textMode" class="recorder__fallback">
      <text class="recorder__fallback-text">这一次我们用点一点的方式</text>
    </view>

    <template v-else>
      <!-- 波形：只在录音中出现 -->
      <view class="recorder__wave" :class="{ 'recorder__wave--on': recording }">
        <view
          v-for="(h, i) in waveform"
          :key="i"
          class="recorder__bar"
          :style="{ height: (recording ? h * 72 : 12) + 'rpx' }"
        />
      </view>

      <!-- 主按钮 -->
      <view
        class="recorder__btn"
        :class="{
          'recorder__btn--recording': recording,
          'recorder__btn--waiting': waiting && !recording,
          'recorder__btn--disabled': !enabled
        }"
        @tap="toggleRecord"
      >
        <text class="recorder__btn-icon">{{ recording ? '■' : '🎤' }}</text>
      </view>

      <!-- 状态文案：等待态不催促 -->
      <view class="recorder__tip">
        <text v-if="recording" class="recorder__tip-text">{{ secondsText }}</text>
        <text v-else-if="waiting" class="recorder__tip-text">{{ tip }}</text>
        <text v-else class="recorder__tip-text">点一下，说给我听</text>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.recorder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $sp-3;
  padding: $sp-3 0;
}

/* ---------- 波形 ---------- */
.recorder__wave {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  height: 80rpx;
  opacity: 0.35;
  transition: opacity $t-base $ease-soft;

  &--on {
    opacity: 1;
  }
}

.recorder__bar {
  width: 8rpx;
  min-height: 12rpx;
  border-radius: $r-pill;
  background: $c-primary;
  transition: height $t-fast linear;
}

/* ---------- 录音按钮 ---------- */
.recorder__btn {
  width: 220rpx;
  height: 220rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #6fa6ef 0%, #3d7edb 100%);
  box-shadow: 0 16rpx 48rpx rgba(61, 126, 219, 0.34);
  transition: transform $t-base $ease-soft, box-shadow $t-base $ease-soft;

  &:active {
    transform: scale(0.95);
  }

  /* 录音中：加一圈柔和的呼吸光，不闪烁 */
  &--recording {
    background: linear-gradient(160deg, #f5cd5c 0%, #e0a95c 100%);
    box-shadow: 0 16rpx 48rpx rgba(224, 169, 92, 0.4);
    animation: breath $t-breath $ease-soft infinite;
  }

  &--waiting {
    animation: breath $t-breath $ease-soft infinite;
  }

  &--disabled {
    opacity: 0.4;
    pointer-events: none;
    animation: none;
  }
}

.recorder__btn-icon {
  font-size: 88rpx;
  line-height: 1;
  color: #fff;
}

/* ---------- 文案 ---------- */
.recorder__tip {
  min-height: 48rpx;
  display: flex;
  align-items: center;
}

.recorder__tip-text {
  font-size: $fs-sub;
  color: $c-text-sub;
}

.recorder__fallback {
  padding: $sp-3;
  border-radius: $r-md;
  background: $c-primary-mist;
}

.recorder__fallback-text {
  font-size: $fs-sub;
  color: $c-text-sub;
}
</style>
