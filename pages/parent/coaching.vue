<script setup>
/**
 * 陪练介入页（项目书 流程 6）
 *
 * 家长在训练过程中用这一页做三件事：看当前该做什么、帮孩子一把、决定跳过/暂停/结束。
 *
 * 「当前该做什么」的提示语来自后端每一轮的 parent_tip，
 * 只显示这一条，不叠加（项目书 3.4：只显示当前阶段唯一提示）。
 *
 * 后端没有「家长代答」「跳过」的专门接口：
 *   帮他说出来 → 家长示范后回到孩子那边，孩子自己再答一次
 *   跳过这一轮 → 连续提交空回答，直到后端换题（后端会记为跳过，不算没做好）
 */
import { ref, computed } from 'vue'
import { useSessionStore } from '@/store/session'
import { PHASE, HINT_LEVEL, EXIT_REASON, COACHING_TIPS } from '@/config/constants'
import { errorMessage } from '@/core/request'
import * as player from '@/core/audio/player'

const session = useSessionStore()

const showExitSheet = ref(false)
const skipping = ref(false)

/** 是否有正在进行的训练 */
const hasSession = computed(() => !!session.sessionId && session.isActive)

/** 当前这一步的唯一提示：优先用后端给的 parent_tip */
const currentHint = computed(() => session.parentTip || COACHING_TIPS.beforeRound)

/** 家长示范时照着说的句子 */
const targetSentence = computed(
  () => session.targetSentence || (session.scenario && session.scenario.targetSentences[0]) || ''
)

const isWaitingChild = computed(() => session.phase === PHASE.LISTENING)
const needsAssist = computed(() => session.hintLevel >= HINT_LEVEL.L3)

const progressText = computed(() => `第 ${session.round} / ${session.totalRounds} 轮`)

/** 这一题已经试了几次 */
const retryHint = computed(() => {
  if (session.retryCount === 0) return '这一题他还没试过'
  if (session.retryCount <= 2) return `这一题已经试了 ${session.retryCount} 次`
  return '试了好几次了，可以考虑跳过'
})

/* ---------- 动作 ---------- */

/** 家长示范：不提交任何东西，回到孩子那边让他自己再说一次 */
function doModel() {
  uni.showToast({ title: '你先说一遍，然后请他说', icon: 'none', duration: 2500 })
  setTimeout(backToChild, 800)
}

/** 跳过这一轮 */
async function doSkip() {
  if (skipping.value) return
  skipping.value = true
  try {
    await session.skipRound()
    if (session.phase === PHASE.SAFETY) {
      uni.redirectTo({ url: '/pages/child/safety' })
      return
    }
    // skipRound 结束时停在反馈阶段，直接替家长点「继续」
    const to = session.continueAfterFeedback()
    if (to === 'finished') {
      uni.redirectTo({ url: '/pages/child/reward' })
      return
    }
    uni.showToast({ title: '换下一题啦', icon: 'none' })
    setTimeout(backToChild, 600)
  } catch (err) {
    uni.showToast({ title: errorMessage(err), icon: 'none' })
  } finally {
    skipping.value = false
  }
}

/** 暂停：冻结音频与动画（流程 10） */
function doPause() {
  player.pause()
  session.pause()
  uni.showModal({
    title: '已暂停',
    content: '声音和动画都停下了。想继续的时候点「继续」。',
    confirmText: '继续',
    cancelText: '结束训练',
    success: (res) => {
      if (res.confirm) {
        session.resume()
        player.resume()
      } else {
        showExitSheet.value = true
      }
    }
  })
}

async function doExit(reason) {
  showExitSheet.value = false
  player.forceStop()
  await session.exit(reason)
  uni.redirectTo({ url: '/pages/child/exit' })
}

/** 孩子不舒服：走安全中止页，不走普通退出 */
async function doChildUnwell() {
  showExitSheet.value = false
  player.forceStop()
  await session.abortForSafety(EXIT_REASON.CHILD_UNWELL)
  uni.redirectTo({ url: '/pages/child/safety' })
}

function pickExit(opt) {
  if (opt.reason === EXIT_REASON.CHILD_UNWELL) doChildUnwell()
  else doExit(opt.reason)
}

function backToChild() {
  uni.navigateBack({
    fail: () => uni.redirectTo({ url: '/pages/child/training' })
  })
}

function startTraining() {
  uni.navigateTo({ url: '/pages/child/scenario-select' })
}

const exitOptions = [
  { reason: EXIT_REASON.USER_PAUSE, label: '孩子想休息一下', desc: '这次先停在这里，下次重新开始' },
  { reason: EXIT_REASON.USER_STOP, label: '今天先到这里', desc: '正常结束，不会有任何"没做完"的记录' },
  { reason: EXIT_REASON.REPEATED_ASR_FAIL, label: '一直没听清', desc: '可能是环境太吵或者设备问题' },
  { reason: EXIT_REASON.CHILD_UNWELL, label: '孩子有点不舒服', desc: '立刻停下，进入安全流程' }
]
</script>

<template>
  <view class="coach">
    <x-navbar title="陪练中" theme="parent" :on-back="backToChild" />

    <!-- ============ 空态：没有进行中的训练 ============ -->
    <view v-if="!hasSession" class="coach__empty">
      <x-empty
        type="empty"
        title="现在没有正在进行的训练"
        desc="这一页是训练过程中用的。孩子开始说话之后，你可以在这里看到提示、帮他一把，或者随时暂停。"
      >
        <view class="coach__empty-actions">
          <view class="btn btn--primary" @tap="startTraining">
            <text>开始一次训练</text>
          </view>
        </view>
      </x-empty>
    </view>

    <view v-else class="coach__body">
      <!-- ============ 当前在做什么 ============ -->
      <view class="coach__status card">
        <view class="coach__status-head">
          <view class="tag">
            <text>{{ progressText }}</text>
          </view>
          <text class="coach__status-state">{{ session.scenario ? session.scenario.title : '' }}</text>
        </view>

        <view class="coach__question">
          <text class="coach__question-label">这一题</text>
          <text class="coach__question-text">{{ session.question }}</text>
        </view>

        <view class="coach__hint">
          <text class="coach__hint-label">你现在可以</text>
          <text class="coach__hint-text">{{ currentHint }}</text>
        </view>

        <view v-if="isWaitingChild" class="coach__waiting">
          <view class="coach__waiting-dot" />
          <text class="coach__waiting-text">在等孩子回答，先不要打断</text>
        </view>
      </view>

      <!-- ============ 目标句 ============ -->
      <view v-if="targetSentence" class="coach__target card">
        <text class="coach__target-label">想让他说的</text>
        <text class="coach__target-text">{{ targetSentence }}</text>
        <text class="coach__target-tip">你先完整说一遍给他听，然后把最后半句留给他</text>
      </view>

      <view v-if="needsAssist" class="notice notice--warn coach__notice">
        <text>他试了几次还没说出来，这时候你可以帮一下：示范一遍，或者直接跳过。</text>
      </view>

      <view class="coach__meta">
        <text class="coach__meta-text">{{ retryHint }}</text>
      </view>

      <view class="coach__pad" />
    </view>

    <!-- ============ 底部操作区 ============ -->
    <view v-if="hasSession" class="coach__footer safe-bottom">
      <view class="coach__actions">
        <view class="coach__action coach__action--main" @tap="doModel">
          <text class="coach__action-icon">🗣</text>
          <text class="coach__action-label">我示范一遍</text>
        </view>
        <view class="coach__action" :class="{ 'coach__action--busy': skipping }" @tap="doSkip">
          <text class="coach__action-icon">⏭</text>
          <text class="coach__action-label">{{ skipping ? '正在跳过' : '跳过这轮' }}</text>
        </view>
        <view class="coach__action" @tap="doPause">
          <text class="coach__action-icon">⏸</text>
          <text class="coach__action-label">暂停一下</text>
        </view>
        <view class="coach__action" @tap="showExitSheet = true">
          <text class="coach__action-icon">🛑</text>
          <text class="coach__action-label">结束训练</text>
        </view>
      </view>

      <view class="coach__back" @tap="backToChild">
        <text class="coach__back-text">回到孩子那边</text>
      </view>
    </view>

    <!-- ============ 退出原因 ============ -->
    <x-sheet :visible="showExitSheet" title="这次就到这里吗" @close="showExitSheet = false">
      <text class="coach__exit-lead">
        选一个最接近的原因就好。不管选哪个，我们都只会记下"这次结束了"，不会记"没做完"。
      </text>

      <view
        v-for="opt in exitOptions"
        :key="opt.reason"
        class="coach__option"
        :class="{ 'coach__option--warn': opt.reason === EXIT_REASON.CHILD_UNWELL }"
        @tap="pickExit(opt)"
      >
        <view class="coach__option-main">
          <text class="coach__option-title">{{ opt.label }}</text>
          <text class="coach__option-desc">{{ opt.desc }}</text>
        </view>
        <text class="coach__option-arrow">›</text>
      </view>

      <template #foot>
        <view class="btn btn--ghost btn--block" @tap="showExitSheet = false">
          <text>继续陪他练</text>
        </view>
      </template>
    </x-sheet>
  </view>
</template>

<style lang="scss" scoped>
.coach {
  min-height: 100vh;
  background: $c-page;
  display: flex;
  flex-direction: column;
}

.coach__body {
  flex: 1;
  padding: $sp-3 $sp-4 0;
}

.coach__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.coach__empty-actions {
  margin-top: $sp-4;
  display: flex;
  justify-content: center;
}

.coach__status-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $sp-3;
}

.coach__status-state {
  font-size: $fs-sub;
  color: $c-text-sub;
}

.coach__question {
  margin-bottom: $sp-3;
}

.coach__question-label {
  display: block;
  font-size: $fs-cap;
  color: $c-text-weak;
  margin-bottom: 4rpx;
}

.coach__question-text {
  font-size: $fs-body;
  color: $c-text;
  line-height: 1.6;
}

.coach__hint {
  padding: $sp-4;
  border-radius: $r-md;
  background: $c-primary-mist;
}

.coach__hint-label {
  display: block;
  font-size: $fs-cap;
  color: $c-text-weak;
  margin-bottom: $sp-1;
}

.coach__hint-text {
  display: block;
  font-size: $fs-h3;
  font-weight: 600;
  color: $c-primary-deep;
  line-height: 1.5;
}

.coach__waiting {
  margin-top: $sp-3;
  display: flex;
  align-items: center;
  gap: $sp-2;
}

.coach__waiting-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: $c-leaf;
  animation: breath $t-breath $ease-soft infinite;
}

.coach__waiting-text {
  font-size: $fs-sub;
  color: $c-text-sub;
}

.coach__target {
  margin-top: $sp-3;
  background: $c-leaf-soft;
  box-shadow: none;
}

.coach__target-label {
  display: block;
  font-size: $fs-cap;
  color: $c-leaf-deep;
  margin-bottom: $sp-2;
}

.coach__target-text {
  display: block;
  font-size: 40rpx;
  font-weight: 600;
  color: #4a5c1f;
  line-height: 1.55;
}

.coach__target-tip {
  display: block;
  margin-top: $sp-2;
  font-size: $fs-sub;
  color: #556b24;
  line-height: 1.65;
}

.coach__notice {
  margin-top: $sp-3;
  line-height: 1.7;
}

.coach__meta {
  margin-top: $sp-4;
  text-align: center;
}

.coach__meta-text {
  font-size: $fs-cap;
  color: $c-text-weak;
}

.coach__pad {
  height: 280rpx;
}

.coach__footer {
  position: fixed;
  left: var(--window-left, 0);
  right: var(--window-right, 0);
  bottom: 0;
  background: #fff;
  padding: $sp-3 $sp-4;
  border-top: 2rpx solid $c-line;
  box-shadow: 0 -8rpx 32rpx rgba(34, 48, 63, 0.06);
}

.coach__actions {
  display: flex;
  gap: $sp-2;
}

.coach__action {
  flex: 1;
  padding: $sp-2 0;
  border-radius: $r-md;
  background: $c-page;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;

  &:active {
    transform: scale(0.96);
  }

  &--main {
    background: $c-primary-mist;
    border: 2rpx solid $c-primary-soft;
  }

  &--busy {
    opacity: 0.5;
    pointer-events: none;
  }
}

.coach__action-icon {
  font-size: 40rpx;
  line-height: 1;
}

.coach__action-label {
  font-size: 22rpx;
  color: $c-text-sub;
}

.coach__action--main .coach__action-label {
  color: $c-primary;
  font-weight: 600;
}

.coach__back {
  margin-top: $sp-2;
  padding: $sp-2;
  text-align: center;
}

.coach__back-text {
  font-size: $fs-sub;
  color: $c-text-weak;
}

.coach__exit-lead {
  display: block;
  margin-bottom: $sp-3;
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.7;
}

.coach__option {
  display: flex;
  align-items: flex-start;
  gap: $sp-3;
  padding: $sp-3;
  border-radius: $r-md;
  background: $c-page;

  & + & {
    margin-top: $sp-2;
  }

  &:active {
    background: $c-primary-mist;
  }

  &--warn {
    background: $c-abort-soft;
  }
}

.coach__option-main {
  flex: 1;
}

.coach__option-title {
  display: block;
  font-size: $fs-body;
  font-weight: 500;
  color: $c-text;
}

.coach__option-desc {
  display: block;
  margin-top: 4rpx;
  font-size: $fs-cap;
  color: $c-text-sub;
  line-height: 1.6;
}

.coach__option-arrow {
  font-size: 36rpx;
  color: $c-text-weak;
  line-height: 1.4;
}
</style>
