<script setup>
/**
 * 训练对话主页面（项目书 流程 3/4/5）
 *
 * 一次作答的完整链路：
 *   读题 → 等孩子回答 → 提交给后端 → 展示反馈 → 后端说下一步做什么
 *
 * 「下一步做什么」全听后端的 next_action：
 *   retry          同一题，请他再说一遍
 *   show_hint      同一题，出现词块
 *   parent_assist  同一题，出现完整句，请家长帮忙
 *   next_turn      换下一题
 *   finish         去奖励页
 *   risk_flag=true 去安全页
 *
 * 作答方式：
 *   语音：录音 → /speech/transcriptions 转文字 → 带置信度提交（后端置信度 < 0.6 时请孩子再说）
 *   点选 / 家长打字 / 「他没说话」：不能录音的环境（网页没有 https）或家长手动切换时用
 */
import { ref, computed, watch, onUnmounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useSessionStore } from '@/store/session'
import { useAppStore } from '@/store/app'
import { PHASE, VALIDITY, HINT_LEVEL, EXIT_REASON } from '@/config/constants'
import { HINT_LEAD, WAITING_TIPS } from '@/config/copywriting'
import { getOptions } from '@/config/scenarios'
import { errorMessage } from '@/core/request'
import { getNavMetrics } from '@/core/nav'
import * as api from '@/core/api'
import * as player from '@/core/audio/player'

const session = useSessionStore()
const appStore = useAppStore()

/** 顶栏让开微信右上角胶囊，否则「家长」和停止按钮会被盖住 */
const nav = getNavMetrics()

const recorderRef = ref(null)
const textInput = ref('')
/** 录音已结束、正在等转写结果 */
const transcribing = ref(false)
/** 转写没听出字时给的提示，下一次开口就清掉 */
const voiceHint = ref('')

/** 点选/文字作答模式 */
const textMode = computed(() => appStore.textMode)

/* ============================================================
 * 状态 → 界面
 * ========================================================== */

const showQuestion = computed(() =>
  [PHASE.QUESTION, PHASE.LISTENING, PHASE.SUBMITTING].includes(session.phase)
)
const showAnswerArea = computed(() => session.phase === PHASE.LISTENING)
const showSubmitting = computed(() => session.phase === PHASE.SUBMITTING)
const showFeedback = computed(() => session.phase === PHASE.FEEDBACK)

/** 顶部阶段文案（孩子看得懂的说法） */
const stageLabel = computed(() => {
  switch (session.phase) {
    case PHASE.QUESTION:
      return '听我说'
    case PHASE.LISTENING:
      if (session.hintLevel >= HINT_LEVEL.L3) return '请爸爸妈妈帮帮忙'
      if (session.hintLevel >= HINT_LEVEL.L1) return '我们一起说'
      return '换你说啦'
    case PHASE.SUBMITTING:
      return '我在听'
    case PHASE.FEEDBACK:
      return session.validity === VALIDITY.VALID ? '说得真好' : '慢慢来'
    default:
      return '慢慢来'
  }
})

/** 同一题再来时，题目下方的引导语 */
const hintLead = computed(() => {
  if (session.phase !== PHASE.LISTENING) return ''
  return HINT_LEAD[session.hintLevel] || ''
})

/** 本轮可点选的候选句 */
const options = computed(() => {
  if (!session.scenario) return []
  return getOptions(session.scenario.id, session.round, session.targetSentence)
})

/** 反馈卡片的配色 */
const feedbackTone = computed(() => {
  if (session.validity === VALIDITY.VALID) return 'valid'
  if (session.validity === VALIDITY.PARTIAL) return 'partial'
  return 'soft'
})

const feedbackIcon = computed(() => {
  if (feedbackTone.value === 'valid') return '✨'
  if (feedbackTone.value === 'partial') return '🌱'
  return '🌈'
})

/** 反馈页按钮文案 */
const continueText = computed(() => {
  if (session.stoppedByChild) return '好的'
  if (session.nextAction === 'finish') return '好啦，看看今天'
  if (session.pendingTurn) return '下一个'
  return '再试一次'
})

/** 进度星星 */
const progressProps = computed(() => ({
  total: session.totalRounds,
  done: session.doneRounds,
  current: session.phase === PHASE.FINISHED ? -1 : session.round
}))

/* ============================================================
 * 生命周期
 * ========================================================== */

onLoad(() => {
  if (!session.sessionId) {
    uni.redirectTo({ url: '/pages/child/scenario-select' })
    return
  }
  // 网页：检查能不能用麦克风（要 https），不能就用点选，不打断训练
  appStore.checkVoiceSupport()
  if (session.phase === PHASE.QUESTION) playQuestion()
})

/**
 * 集中处理「进入某个阶段」时要做的事。
 * 不用 question 文本做依据：「再来一次」时题目文字可能和上一题一样，那样不会重读。
 */
watch(
  () => session.phase,
  (p, old) => {
    if (p === old) return
    switch (p) {
      case PHASE.QUESTION:
        playQuestion()
        break
      case PHASE.LISTENING:
        if (recorderRef.value) recorderRef.value.startListening()
        break
      case PHASE.FEEDBACK:
        // 把后端那句反馈读给孩子听（网页里才读得出来）
        if (session.feedback) player.play({ url: '', text: session.feedback, tag: 'feedback' })
        break
      case PHASE.SAFETY:
        player.forceStop()
        if (recorderRef.value) recorderRef.value.abort()
        uni.redirectTo({ url: '/pages/child/safety' })
        break
    }
  }
)

onUnmounted(() => {
  player.stop()
})

/* ============================================================
 * 读题
 * ========================================================== */

/** 网页里能用浏览器朗读时，按钮叫「再听一遍」，否则「再看一遍」 */
const canSpeak = player.canSpeak()

/**
 * 网页里由浏览器朗读题目，读完进入作答。
 * 读不出来时（小程序、浏览器不支持）停 1.2 秒，给孩子看题的时间。
 */
function playQuestion() {
  player.play({
    url: '',
    text: session.question,
    tag: 'question',
    onEnded: () => session.onQuestionPlayed()
  })
}

function replayQuestion() {
  // 正在录音时先停掉录音，不然会把手机自己读题的声音录进去
  if (recorderRef.value) recorderRef.value.abort()
  player.play({
    url: '',
    text: session.question,
    tag: 'question',
    onEnded: () => {
      if (session.phase === PHASE.LISTENING && recorderRef.value) {
        recorderRef.value.startListening()
      }
    }
  })
}

/* ============================================================
 * 作答
 * ========================================================== */

async function submit(text, confidence = null) {
  try {
    await session.answer(text, confidence)
  } catch (err) {
    uni.showToast({ title: errorMessage(err), icon: 'none' })
  }
}

function pickOption(text) {
  if (session.busy) return
  submit(text)
}

function submitTyped() {
  const t = textInput.value.trim()
  if (!t) {
    uni.showToast({ title: '写一点就可以啦', icon: 'none' })
    return
  }
  textInput.value = ''
  submit(t)
}

/** 孩子没说话：交给后端判断（第一次请他再说，第二次换题并记为跳过） */
function submitSilence() {
  submit('')
}

/** 太短的录音多半是误触，不上传 */
const MIN_RECORD_MS = 500

/**
 * 录音结束：转文字 → 提交。
 * 转写只是把声音变成字，不算一次作答；转写失败时孩子这一题没有任何记录，可以直接再说。
 */
async function onRecordStop(payload) {
  if (!payload || !payload.tempFilePath) return
  if (session.phase !== PHASE.LISTENING || session.busy) return
  if (payload.duration < MIN_RECORD_MS) {
    voiceHint.value = '按住时间太短啦，再说一次'
    if (recorderRef.value) recorderRef.value.startListening()
    return
  }

  voiceHint.value = ''
  transcribing.value = true
  let result
  try {
    result = await api.transcribe(payload.tempFilePath)
  } catch (err) {
    transcribing.value = false
    voiceHint.value = '刚才没听清，再说一次吧'
    // 识别服务的问题不让孩子看到，给家长一句话就够
    uni.showToast({ title: errorMessage(err), icon: 'none' })
    if (recorderRef.value) recorderRef.value.startListening()
    return
  }
  transcribing.value = false

  // 没听出字：按「没说话」交给后端（第一次请他再说，第二次换题、记为跳过，不算没做好）
  await submit(result.text, result.confidence)
}

function onRecordError(err) {
  console.warn('[training] 录音异常', err)
  const reason = err && err.reason
  if (reason === 'permission_denied' || reason === 'unsupported') {
    // 拿不到麦克风：本次改用点选，告诉家长原因
    appStore.markVoiceDenied(err.errMsg || '没有拿到麦克风权限')
    uni.showToast({ title: '先用点一点的方式回答', icon: 'none' })
    return
  }
  voiceHint.value = '刚才没录上，再说一次吧'
  if (recorderRef.value) recorderRef.value.startListening()
}

/** 家长手动切换：环境太吵或孩子不愿意对着手机说时用 */
function useTextInstead() {
  if (recorderRef.value) recorderRef.value.abort()
  appStore.setPreferText(true)
}

function useVoiceAgain() {
  appStore.setPreferText(false)
}

/** 等了很久都没开口，按沉默提交，由后端决定是再问一次还是换题 */
function onListenTimeout() {
  if (session.phase === PHASE.LISTENING && !session.busy) submitSilence()
}

/* ============================================================
 * 反馈之后
 * ========================================================== */

function onContinue() {
  player.stop()
  const to = session.continueAfterFeedback()
  if (to === 'finished') {
    uni.redirectTo({ url: '/pages/child/reward' })
  } else if (to === 'stopped') {
    // 孩子说了停止信号，后端已经结束本次训练
    uni.redirectTo({ url: '/pages/child/exit' })
  }
}

/* ============================================================
 * 家长 / 暂停 / 退出
 * ========================================================== */

function goCoaching() {
  player.pause()
  uni.navigateTo({ url: '/pages/parent/coaching' })
}

function handleStop() {
  player.pause()
  uni.showModal({
    title: '想休息一下吗',
    content: '我们可以停下来，等你想说的时候再说',
    confirmText: '好，休息一下',
    cancelText: '继续说',
    success: async (res) => {
      if (res.confirm) {
        player.forceStop()
        if (recorderRef.value) recorderRef.value.abort()
        await session.exit(EXIT_REASON.USER_PAUSE)
        uni.redirectTo({ url: '/pages/child/exit' })
      } else {
        player.resume()
      }
    }
  })
}
</script>

<template>
  <view class="train page--child">
    <!-- ============ 顶部：进度 + 家长入口 + 停止信号 ============ -->
    <view
      class="train__top"
      :style="{
        paddingTop: Math.max(nav.statusBarHeight, 12) + 'px',
        paddingRight: nav.capsuleReserve ? nav.capsuleReserve + 'px' : '32rpx',
        minHeight: nav.navHeight + 'px'
      }"
    >
      <view class="train__top-left">
        <x-progress-stars
          :total="progressProps.total"
          :done="progressProps.done"
          :current="progressProps.current"
        />
      </view>
      <view class="train__top-right">
        <view class="train__coach" @tap="goCoaching">
          <text class="train__coach-text">家长</text>
        </view>
        <x-stop-signal @stop="handleStop" />
      </view>
    </view>

    <view class="train__stage">
      <text class="train__stage-text">{{ stageLabel }}</text>
    </view>

    <view class="train__body">
      <!-- ---------- 题目 ---------- -->
      <view v-if="showQuestion" class="train__question">
        <view class="train__avatar">
          <text class="train__avatar-icon">🌟</text>
        </view>
        <view class="train__bubble">
          <text class="train__bubble-text">{{ session.question }}</text>
          <view class="train__replay" @tap="replayQuestion">
            <text class="train__replay-icon">{{ canSpeak ? '🔊' : '👀' }}</text>
            <text class="train__replay-text">{{ canSpeak ? '再听一遍' : '再看一遍' }}</text>
          </view>
        </view>
      </view>

      <!-- ---------- 同一题再来时的引导 ---------- -->
      <view v-if="hintLead" class="train__hint">
        <text class="train__hint-text">{{ hintLead }}</text>
      </view>

      <!-- ---------- 词块（show_hint 起出现） ---------- -->
      <view v-if="session.showWordBlocks && session.wordBlocks.length" class="train__blocks">
        <view v-for="(w, i) in session.wordBlocks" :key="i" class="train__block">
          <text class="train__block-text">{{ w }}</text>
        </view>
      </view>

      <!-- ---------- 完整句 + 请家长（parent_assist） ---------- -->
      <view v-if="showAnswerArea && session.needsParent" class="train__assist">
        <text v-if="session.targetSentence" class="train__assist-sentence">
          {{ session.targetSentence }}
        </text>
        <text class="train__assist-tip">
          {{ session.parentTip || '家长可以先说一遍，再请孩子跟着说' }}
        </text>
      </view>

      <!-- ---------- 提交中 ---------- -->
      <view v-if="showSubmitting" class="train__processing">
        <view class="train__dots">
          <view class="train__dot" />
          <view class="train__dot" />
          <view class="train__dot" />
        </view>
        <text v-if="session.lastAnswer" class="train__asr-preview">
          {{ session.lastAnswer }}
        </text>
      </view>

      <!-- ---------- 反馈 ---------- -->
      <view v-if="showFeedback" class="train__feedback">
        <view class="train__feedback-card" :class="`train__feedback-card--${feedbackTone}`">
          <text class="train__feedback-icon">{{ feedbackIcon }}</text>
          <text class="train__feedback-text">{{ session.feedback }}</text>
        </view>
        <view class="train__feedback-next" @tap="onContinue">
          <text class="train__feedback-next-text">{{ continueText }}</text>
        </view>
      </view>
    </view>

    <!-- ============ 底部：作答区 ============ -->
    <view class="train__footer safe-bottom">
      <!-- 录完了、等转文字 -->
      <view v-if="showAnswerArea && transcribing" class="train__processing train__processing--inline">
        <view class="train__dots">
          <view class="train__dot" />
          <view class="train__dot" />
          <view class="train__dot" />
        </view>
        <text class="train__processing-text">我在听你说的话</text>
      </view>

      <!-- 语音作答 -->
      <view v-else-if="showAnswerArea && !textMode" class="train__voice">
        <text v-if="voiceHint" class="train__voice-hint">{{ voiceHint }}</text>
        <x-recorder
          ref="recorderRef"
          :enabled="!session.busy"
          :tip="WAITING_TIPS[0]"
          @start="voiceHint = ''"
          @stop="onRecordStop"
          @error="onRecordError"
          @timeout="onListenTimeout"
        />
        <view class="train__switch" @tap="useTextInstead">
          <text class="train__switch-text">太吵了？改成点一点</text>
        </view>
      </view>

      <!-- 点选 / 文字作答 -->
      <view v-else-if="showAnswerArea" class="train__textmode">
        <!-- 网页没有 https 等原因录不了音时，告诉家长为什么没有录音按钮 -->
        <text
          v-if="appStore.voiceUnavailableReason && !appStore.preferText"
          class="train__voice-off"
        >{{ appStore.voiceUnavailableReason }}，先用点一点的方式回答</text>
        <view class="train__options">
          <view
            v-for="(opt, i) in options"
            :key="i"
            class="train__option"
            :class="{ 'train__option--disabled': session.busy }"
            @tap="pickOption(opt)"
          >
            <text class="train__option-text">{{ opt }}</text>
          </view>
        </view>

        <view class="train__textmode-input">
          <input
            v-model="textInput"
            class="train__input"
            type="text"
            maxlength="255"
            placeholder="孩子说了别的？家长帮忙写下来"
            placeholder-class="train__input-ph"
            confirm-type="done"
            @confirm="submitTyped"
          />
          <view class="btn btn--primary train__input-btn" @tap="submitTyped">
            <text>好了</text>
          </view>
        </view>

        <view class="train__silence" @tap="submitSilence">
          <text class="train__silence-text">他这次没说话</text>
        </view>

        <view v-if="appStore.preferText" class="train__switch" @tap="useVoiceAgain">
          <text class="train__switch-text">换回说话</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.train {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #eef5fe 0%, #ffffff 40%);
}

/* ================= 顶部 ================= */
.train__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: $sp-4;
  padding-right: $sp-4;
  padding-bottom: $sp-2;
  gap: $sp-2;
}

.train__top-left {
  flex: 1;
}

.train__top-right {
  display: flex;
  align-items: center;
  gap: $sp-2;
}

.train__coach {
  height: $tap-min;
  padding: 0 $sp-3;
  border-radius: $r-pill;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: $sh-soft;
  display: flex;
  align-items: center;
  justify-content: center;
}

.train__coach-text {
  font-size: $fs-cap;
  color: $c-text-sub;
}

.train__stage {
  padding: $sp-2 $sp-4 0;
}

.train__stage-text {
  font-size: $fs-h3;
  color: $c-text-weak;
  letter-spacing: 2rpx;
}

/* ================= 主体 ================= */
.train__body {
  flex: 1;
  padding: $sp-3 $sp-4 0;
  display: flex;
  flex-direction: column;
}

/* ---------- 题目 ---------- */
.train__question {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $sp-3;
}

.train__avatar {
  width: 140rpx;
  height: 140rpx;
  border-radius: 50%;
  background: linear-gradient(160deg, #a8dcf0 0%, #6fa6ef 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12rpx 40rpx rgba(61, 126, 219, 0.28);
  animation: breath $t-breath $ease-soft infinite;
}

.train__avatar-icon {
  font-size: 76rpx;
  line-height: 1;
}

.train__bubble {
  width: 100%;
  padding: $sp-4;
  border-radius: $r-lg;
  background: #fff;
  box-shadow: $sh-card;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $sp-3;
}

.train__bubble-text {
  font-size: 44rpx;
  font-weight: 600;
  color: $c-primary-deep;
  line-height: 1.7;
  text-align: center;
}

.train__replay {
  display: inline-flex;
  align-items: center;
  gap: $sp-2;
  height: 72rpx;
  padding: 0 $sp-4;
  border-radius: $r-pill;
  background: $c-primary-mist;

  &:active {
    background: $c-primary-soft;
  }
}

.train__replay-icon {
  font-size: 32rpx;
  line-height: 1;
}

.train__replay-text {
  font-size: $fs-sub;
  color: $c-primary;
}

/* ---------- 引导语 ---------- */
.train__hint {
  margin-top: $sp-3;
  text-align: center;
}

.train__hint-text {
  font-size: 38rpx;
  font-weight: 600;
  color: $c-primary-deep;
}

/* ---------- 词块 ---------- */
.train__blocks {
  margin-top: $sp-3;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: $sp-2;
}

.train__block {
  padding: $sp-2 $sp-3;
  border-radius: $r-md;
  background: $c-sun-soft;
  border: 3rpx solid rgba(245, 205, 92, 0.5);
}

.train__block-text {
  font-size: 40rpx;
  font-weight: 600;
  color: #8a6420;
}

/* ---------- 完整句 + 家长 ---------- */
.train__assist {
  margin-top: $sp-3;
  padding: $sp-4;
  border-radius: $r-lg;
  background: $c-leaf-soft;
  display: flex;
  flex-direction: column;
  gap: $sp-2;
}

.train__assist-sentence {
  font-size: 42rpx;
  font-weight: 700;
  color: #4a5c1f;
  text-align: center;
  line-height: 1.6;
}

.train__assist-tip {
  font-size: $fs-sub;
  color: #556b24;
  text-align: center;
  line-height: 1.6;
}

/* ---------- 提交中 ---------- */
.train__processing {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $sp-3;
  padding-top: $sp-4;
}

.train__dots {
  display: flex;
  gap: 16rpx;
}

.train__dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background: $c-primary;
  animation: dot 1.4s $ease-soft infinite;

  &:nth-child(2) {
    animation-delay: 0.22s;
  }
  &:nth-child(3) {
    animation-delay: 0.44s;
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
    transform: translateY(-10rpx);
  }
}

.train__asr-preview {
  font-size: $fs-sub;
  color: $c-primary;
  padding: $sp-2 $sp-3;
  border-radius: $r-md;
  background: $c-primary-mist;
}

/* ---------- 反馈 ---------- */
.train__feedback {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $sp-5;
}

.train__feedback-card {
  width: 100%;
  padding: $sp-5 $sp-4;
  border-radius: $r-lg;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $sp-3;
  animation: fade-up $t-slow $ease-soft both;

  &--valid {
    background: linear-gradient(160deg, #fdf3d6 0%, #fbe9b8 100%);
  }

  &--partial {
    background: linear-gradient(160deg, #eef6d4 0%, #e0eeb8 100%);
  }

  &--soft {
    background: linear-gradient(160deg, #eef5fe 0%, #dcebfb 100%);
  }
}

.train__feedback-icon {
  font-size: 92rpx;
  line-height: 1;
}

.train__feedback-text {
  font-size: 48rpx;
  font-weight: 700;
  color: $c-primary-deep;
  line-height: 1.6;
  text-align: center;
}

.train__feedback-next {
  height: $tap-child;
  padding: 0 $sp-6;
  border-radius: $r-xl;
  background: $c-primary;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12rpx 36rpx rgba(61, 126, 219, 0.3);

  &:active {
    transform: scale(0.97);
  }
}

.train__feedback-next-text {
  font-size: $fs-child;
  font-weight: 600;
  color: #fff;
}

/* ================= 底部作答区 ================= */
.train__footer {
  padding: $sp-3 $sp-4 $sp-4;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.train__textmode {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: $sp-2;
}

.train__options {
  display: flex;
  flex-direction: column;
  gap: $sp-2;
}

.train__option {
  min-height: $tap-child;
  padding: $sp-2 $sp-4;
  border-radius: $r-lg;
  background: #fff;
  border: 3rpx solid $c-primary-soft;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: $sh-soft;

  &:active {
    background: $c-primary-mist;
  }

  &--disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}

.train__option-text {
  font-size: 36rpx;
  font-weight: 500;
  color: $c-primary-deep;
  text-align: center;
  line-height: 1.4;
}

.train__textmode-input {
  display: flex;
  gap: $sp-2;
  align-items: center;
  margin-top: $sp-1;
}

.train__input {
  flex: 1;
  height: $tap-min;
  padding: 0 $sp-4;
  border-radius: $r-pill;
  background: #fff;
  border: 3rpx solid $c-line;
  font-size: $fs-sub;
  color: $c-text;
}

.train__input-ph {
  color: $c-text-weak;
}

.train__input-btn {
  flex-shrink: 0;
}

.train__silence {
  padding: $sp-2;
  text-align: center;
}

/* ---------- 语音作答 ---------- */
.train__voice {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.train__voice-hint {
  font-size: 34rpx;
  font-weight: 600;
  color: $c-primary-deep;
  text-align: center;
}

.train__switch {
  padding: $sp-2 $sp-3;
  text-align: center;
}

.train__switch-text {
  font-size: $fs-sub;
  color: $c-text-weak;
}

.train__voice-off {
  display: block;
  font-size: $fs-cap;
  color: $c-text-sub;
  text-align: center;
  line-height: 1.6;
  padding: $sp-2;
  border-radius: $r-md;
  background: $c-warn-soft;
}

.train__processing--inline {
  flex: none;
  padding: $sp-5 0;
}

.train__processing-text {
  font-size: $fs-body;
  color: $c-text-sub;
}

.train__silence-text {
  font-size: $fs-sub;
  color: $c-text-weak;
}
</style>
