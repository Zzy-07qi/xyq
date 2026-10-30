<script setup>
/**
 * 设备权限测试页（项目书 流程 2 / 表 3-1）
 *
 * 三项依次测：麦克风权限 → 实际试录 → 扬声器试播。
 *
 * 关键态度：这个页面允许失败。
 * 权限被拒时不是死胡同，而是给一条图文降级的出路 ——
 * 项目书 7 明确要求"保证无麦克风设备也能使用"，
 * 所以"先用文字模式"必须是和"去开启权限"平级的选项。
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/store/app'
import * as permission from '@/core/audio/permission'
import * as player from '@/core/audio/player'

const appStore = useAppStore()

/** 三个测试项的结果状态 */
const steps = ref([
  { key: 'mic', label: '麦克风', desc: '看看能不能听到孩子说话', status: 'idle' },
  { key: 'mic-device', label: '试录一小段', desc: '确认录音设备工作正常', status: 'idle' },
  { key: 'speaker', label: '声音播放', desc: '确认能听到提示语音', status: 'idle' }
])

const testing = ref(false)
const allDone = ref(false)
const micFailed = ref(false)

/** status: idle / testing / ok / failed / denied / skipped */
function setStep(key, status) {
  const s = steps.value.find((x) => x.key === key)
  if (s) s.status = status
}

function stepIcon(status) {
  return {
    idle: '○',
    testing: '◌',
    ok: '✓',
    failed: '!',
    denied: '!',
    skipped: '—'
  }[status]
}

const hasFailure = ref(false)

onMounted(() => {
  runTest()
})

async function runTest() {
  if (testing.value) return
  testing.value = true
  allDone.value = false
  hasFailure.value = false

  // 重置
  steps.value.forEach((s) => {
    s.status = 'idle'
  })

  const result = await permission.runAudioTest({
    onStep: (key, status) => setStep(key, status)
  })

  // 测试结果只存在本机：后端没有设备测试上报接口
  appStore.setAudioTest(result)
  micFailed.value = !result.micGranted
  hasFailure.value = !result.micGranted || !result.speakerOk
  testing.value = false
  allDone.value = true
}

/** 权限正常：进入须知 */
function goNext() {
  appStore.setOnboardingStep('notice')
  uni.navigateTo({ url: '/pages/parent/notice' })
}

/** 权限异常：进图文指引，但仍允许继续 */
function goGuide() {
  uni.navigateTo({ url: '/pages/parent/permission-guide' })
}

/** 降级：不修权限，直接用文字模式（项目书 7） */
function useTextMode() {
  appStore.setAudioTest({ micGranted: false, speakerOk: true })
  uni.showModal({
    title: '改用文字模式',
    content: '接下来孩子可以用点选的方式回答，训练一样可以做完。你可以随时去开启麦克风。',
    confirmText: '就这样',
    cancelText: '再试一次',
    success: (res) => {
      if (res.confirm) {
        appStore.setOnboardingStep('notice')
        uni.navigateTo({ url: '/pages/parent/notice' })
      } else {
        runTest()
      }
    }
  })
}

onUnmounted(() => {
  player.forceStop()
})
</script>

<template>
  <view class="page page--parent">
    <view class="pt__head">
      <text class="t-h1">先检查一下设备</text>
      <text class="pt__lead">
        训练需要听孩子说话，所以要先确认麦克风和声音都正常。
      </text>
    </view>

    <!-- 测试项 -->
    <view class="card">
      <view
        v-for="(s, i) in steps"
        :key="s.key"
        class="pt__step"
        :class="{ 'pt__step--last': i === steps.length - 1 }"
      >
        <view
          class="pt__status"
          :class="[
            `pt__status--${s.status}`,
            { 'pt__status--spin': s.status === 'testing' }
          ]"
        >
          <text class="pt__status-icon">{{ stepIcon(s.status) }}</text>
        </view>
        <view class="pt__step-main">
          <text class="pt__step-label">{{ s.label }}</text>
          <text class="pt__step-desc">{{ s.desc }}</text>
        </view>
        <text v-if="s.status === 'ok'" class="pt__step-result pt__step-result--ok">正常</text>
        <text v-else-if="s.status === 'denied'" class="pt__step-result">没打开</text>
        <text v-else-if="s.status === 'failed'" class="pt__step-result">没测到</text>
        <text v-else-if="s.status === 'skipped'" class="pt__step-result">已跳过</text>
      </view>
    </view>

    <!-- 结果提示 -->
    <view v-if="allDone && !hasFailure" class="notice notice--safe pt__notice">
      <text>都正常，可以开始了</text>
    </view>

    <view v-if="allDone && hasFailure" class="notice notice--warn pt__notice">
      <text>有一项没有通过。这不影响使用，你可以按提示开启权限，也可以先用文字模式。</text>
    </view>

    <!-- 图文降级说明 -->
    <view v-if="allDone && micFailed" class="card pt__fallback">
      <text class="pt__fallback-title">如果暂时打不开麦克风</text>
      <text class="pt__fallback-text">
        我们准备了文字模式：孩子可以用点选的方式回答，回合一模一样，
        只是不用说话。等权限方便了再回来打开就行。
      </text>
    </view>

    <view class="pt__pad" />

    <!-- 底部操作 -->
    <view class="pt__footer safe-bottom">
      <template v-if="!allDone || testing">
        <view class="btn btn--ghost btn--block" @tap="runTest">
          <text>{{ testing ? '正在测试' : '重新测一次' }}</text>
        </view>
      </template>

      <template v-else-if="hasFailure">
        <view class="btn btn--primary btn--block" @tap="goGuide">
          <text>看怎么开启麦克风</text>
        </view>
        <view class="btn btn--ghost btn--block" @tap="useTextMode">
          <text>先用文字模式</text>
        </view>
        <view class="pt__retry-link" @tap="goNext">
          <text class="pt__retry-text">都弄好了，直接下一步</text>
        </view>
      </template>

      <template v-else>
        <view class="btn btn--primary btn--block" @tap="goNext">
          <text>下一步</text>
        </view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.pt__head {
  padding: $sp-4 0 $sp-4;
}

.pt__lead {
  display: block;
  margin-top: $sp-3;
  font-size: $fs-body;
  color: $c-text-sub;
  line-height: 1.8;
}

/* ---------- 步骤 ---------- */
.pt__step {
  display: flex;
  align-items: center;
  gap: $sp-3;
  padding-bottom: $sp-3;
  border-bottom: 2rpx solid $c-line;
  margin-bottom: $sp-3;

  &--last {
    padding-bottom: 0;
    border-bottom: none;
    margin-bottom: 0;
  }
}

.pt__status {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: $c-page;
  transition: background $t-base $ease-soft;

  &--ok {
    background: $c-safe-soft;
  }

  &--failed,
  &--denied {
    background: $c-warn-soft;
  }

  &--testing {
    background: $c-primary-soft;
  }
}

.pt__status-icon {
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1;
  color: $c-text-sub;
}

.pt__status--ok .pt__status-icon {
  color: #3f8f6d;
}

.pt__status--failed .pt__status-icon,
.pt__status--denied .pt__status-icon {
  color: #b8860b;
}

.pt__status--testing .pt__status-icon {
  color: $c-primary;
}

/* 测试中的旋转：慢速，不刺眼 */
.pt__status--spin {
  animation: spin 1.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.pt__step-main {
  flex: 1;
}

.pt__step-label {
  display: block;
  font-size: $fs-body;
  font-weight: 500;
  color: $c-text;
}

.pt__step-desc {
  display: block;
  margin-top: 2rpx;
  font-size: $fs-cap;
  color: $c-text-weak;
}

.pt__step-result {
  font-size: $fs-sub;
  color: #b8860b;

  &--ok {
    color: #3f8f6d;
  }
}

/* ---------- 提示 ---------- */
.pt__notice {
  margin-top: $sp-3;
  font-size: $fs-sub;
  line-height: 1.7;
}

.pt__fallback {
  margin-top: $sp-3;
}

.pt__fallback-title {
  display: block;
  font-size: $fs-h3;
  font-weight: 600;
  color: $c-text;
  margin-bottom: $sp-2;
}

.pt__fallback-text {
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.75;
}

/* ---------- 底部 ---------- */
.pt__pad {
  height: 240rpx;
}

.pt__footer {
  position: fixed;
  left: var(--window-left, 0);
  right: var(--window-right, 0);
  bottom: 0;
  background: #fff;
  padding: $sp-3 $sp-4;
  border-top: 2rpx solid $c-line;
  display: flex;
  flex-direction: column;
  gap: $sp-2;
  box-shadow: 0 -8rpx 32rpx rgba(34, 48, 63, 0.05);
}

.pt__retry-link {
  padding: $sp-2;
  text-align: center;
}

.pt__retry-text {
  font-size: $fs-sub;
  color: $c-text-weak;
}
</style>
