<script setup>
/**
 * 任务卡回填页（项目书 流程 9）
 *
 * 后端取值 1~5：独立完成 / 提示后完成 / 家长代答 / 这次没完成 / 暂不适用
 * 每个选项都要说清"选完会发生什么"，否则家长会倾向于选看起来"好看"的那个。
 *
 * 网络异常时本地暂存，下次打开这一页时补传（项目书 7 网络异常）。
 *
 * 后端没有"单张任务卡"接口，只能从最近 10 张的列表里找。
 * 超出最近 10 张的旧卡这里找不到，会显示空态。
 */
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import * as api from '@/core/api'
import { ApiError } from '@/core/request'
import { TASK_FEEDBACK_OPTIONS, DIFFICULTY_ADVICE, STORAGE_KEYS } from '@/config/constants'

const cardId = ref(0)
const card = ref(null)
const loading = ref(true)

const selected = ref(0)
/** 可选备注，后端限制 500 字 */
const note = ref('')
const NOTE_MAX = 500
const submitting = ref(false)
const submitted = ref(false)
const advice = ref(null)

onLoad((options) => {
  // URL 参数是字符串，后端 id 是数字
  cardId.value = Number(options && options.id) || 0
})

onMounted(async () => {
  await flushPendingFeedback()
  await loadCard()
})

async function loadCard() {
  loading.value = true
  try {
    const list = await api.getTaskCardList()
    card.value = list.find((c) => c.id === cardId.value) || null
    if (card.value && card.value.feedback) {
      selected.value = card.value.feedback
      note.value = card.value.note || ''
    }
  } catch (e) {
    console.warn('[task-feedback] 加载失败', e)
  } finally {
    loading.value = false
  }
}

/* ---------- 选择 ---------- */

function pick(value) {
  selected.value = value
  advice.value = DIFFICULTY_ADVICE[value] || null
}

const canSubmit = computed(() => !!selected.value && !submitting.value)

/** 已选选项的中文标签，提交后回显用 */
const selectedLabel = computed(() => {
  const opt = TASK_FEEDBACK_OPTIONS.find((o) => o.value === selected.value)
  return opt ? opt.label : ''
})

/* ---------- 提交 ---------- */

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true

  const payload = {
    cardId: cardId.value,
    feedback: selected.value,
    note: note.value.trim().slice(0, NOTE_MAX)
  }

  try {
    await api.backfillTaskCard(payload.cardId, payload.feedback, payload.note)
    advice.value = DIFFICULTY_ADVICE[selected.value]
    submitted.value = true
  } catch (e) {
    // 只有网络断了才暂存重传；后端明确拒绝（参数错、卡不存在）的不暂存，重传也没用
    if (e instanceof ApiError && e.status === 0) {
      cacheFeedback(payload)
      advice.value = DIFFICULTY_ADVICE[selected.value]
      submitted.value = true
      uni.showToast({ title: '网络不太好，先存在本地了', icon: 'none' })
    } else {
      uni.showToast({ title: (e && e.message) || '没有保存成功', icon: 'none' })
    }
  } finally {
    submitting.value = false
  }
}

/** 本地暂存待重传的回填记录 */
function cacheFeedback(payload) {
  try {
    const cache = uni.getStorageSync(STORAGE_KEYS.TASK_FEEDBACK_CACHE) || []
    cache.push(payload)
    uni.setStorageSync(STORAGE_KEYS.TASK_FEEDBACK_CACHE, cache)
  } catch (e) {
    console.warn('[task-feedback] 暂存失败', e)
  }
}

/** 尝试把之前暂存的记录补传 */
async function flushPendingFeedback() {
  try {
    const cache = uni.getStorageSync(STORAGE_KEYS.TASK_FEEDBACK_CACHE) || []
    if (!cache.length) return
    const remain = []
    for (const item of cache) {
      try {
        await api.backfillTaskCard(item.cardId, item.feedback, item.note || '')
      } catch (e) {
        // 还是断网就留着下次再传；其他错误（卡已不存在等）直接丢弃
        if (e instanceof ApiError && e.status === 0) remain.push(item)
      }
    }
    uni.setStorageSync(STORAGE_KEYS.TASK_FEEDBACK_CACHE, remain)
  } catch (e) {
    console.warn('[task-feedback] 补传失败', e)
  }
}

function goBack() {
  uni.navigateBack({
    fail: () => uni.reLaunch({ url: '/pages/parent/home' })
  })
}

function goTaskCards() {
  uni.redirectTo({ url: '/pages/parent/task-cards' })
}

/** 查看这张任务卡来自的那次训练 */
function goSession() {
  if (!card.value || !card.value.sessionId) return
  uni.navigateTo({ url: `/pages/parent/session-detail?id=${card.value.sessionId}` })
}
</script>

<template>
  <view class="page page--parent">
    <x-empty v-if="loading" type="loading" />

    <x-empty
      v-else-if="!card"
      type="empty"
      title="没找到这张任务卡"
      desc="可能已经被删掉了"
      :retry="true"
      @retry="loadCard"
    />

    <template v-else>
      <!-- ============ 任务卡回顾 ============ -->
      <view class="fb__card card">
        <view class="fb__card-head">
          <view class="tag tag--leaf">
            <text>{{ card.duration }}</text>
          </view>
        </view>

        <text class="fb__card-title">{{ card.title }}</text>

        <view class="fb__target">
          <text class="fb__target-label">目标表达</text>
          <text class="fb__target-text">{{ card.targetSentence }}</text>
        </view>

        <view class="fb__scene">
          <text class="fb__scene-icon">📍</text>
          <text class="fb__scene-text">{{ card.realScene }}</text>
        </view>

        <view v-if="card.steps.length" class="fb__steps">
          <view v-for="(s, i) in card.steps" :key="i" class="fb__step">
            <text class="fb__step-num">{{ i + 1 }}</text>
            <text class="fb__step-text">{{ s }}</text>
          </view>
        </view>

        <view v-if="card.sessionId" class="fb__session" @tap="goSession">
          <text class="fb__session-text">看看这张卡来自的那次训练</text>
          <text class="fb__session-arrow">›</text>
        </view>
      </view>

      <!-- ============ 未提交：选择 ============ -->
      <template v-if="!submitted">
        <view class="fb__section">
          <text class="fb__section-title">这次做得怎么样</text>
          <text class="fb__section-desc">
            选最接近的就好。不同的选择会决定下一次的难度，所以请照着实际情况选。
          </text>
        </view>

        <view class="fb__options">
          <view
            v-for="opt in TASK_FEEDBACK_OPTIONS"
            :key="opt.value"
            class="fb__option"
            :class="[
              `fb__option--${opt.tone}`,
              { 'fb__option--on': selected === opt.value }
            ]"
            @tap="pick(opt.value)"
          >
            <view class="fb__option-radio" :class="{ 'fb__option-radio--on': selected === opt.value }">
              <text v-if="selected === opt.value" class="fb__option-radio-icon">✓</text>
            </view>

            <view class="fb__option-main">
              <text class="fb__option-label">{{ opt.label }}</text>
              <text class="fb__option-desc">{{ opt.desc }}</text>
            </view>

            <text class="fb__option-effect">{{ opt.effect }}</text>
          </view>
        </view>

        <!-- 可选备注 -->
        <view class="fb__note card">
          <text class="fb__note-title">想补充点什么吗（可以不写）</text>
          <textarea
            v-model="note"
            class="fb__note-input"
            :maxlength="NOTE_MAX"
            placeholder="比如：在超市试的，他指了指水，没有说出来"
            placeholder-class="fb__note-ph"
            auto-height
          />
          <text class="fb__note-count">{{ note.length }} / {{ NOTE_MAX }}</text>
        </view>

        <view class="fb__pad" />

        <view class="fb__footer safe-bottom">
          <view
            class="btn btn--primary btn--block"
            :class="{ 'btn--disabled': !canSubmit }"
            @tap="submit"
          >
            <text>{{ submitting ? '正在保存' : '填好了' }}</text>
          </view>
        </view>
      </template>

      <!-- ============ 已提交：建议 ============ -->
      <template v-else>
        <view class="fb__result anim-fade-up">
          <view class="fb__result-head">
            <text class="fb__result-icon">🌿</text>
            <text class="fb__result-title">记下了</text>
          </view>

          <view v-if="advice" class="fb__advice">
            <text class="fb__advice-title">{{ advice.title }}</text>
            <text class="fb__advice-desc">{{ advice.desc }}</text>
          </view>

          <view class="fb__result-note">
            <text class="fb__result-note-text">
              你刚才选的「{{ selectedLabel }}」已经记录下来了，下一次训练会参考这个结果调整。
            </text>
            <text v-if="note.trim()" class="fb__result-remark">备注：{{ note.trim() }}</text>
          </view>
        </view>

        <view class="fb__result-actions">
          <view class="btn btn--primary btn--block" @tap="goTaskCards">
            <text>看看其他任务卡</text>
          </view>
          <view class="btn btn--ghost btn--block" @tap="goBack">
            <text>回家长中心</text>
          </view>
        </view>
      </template>
    </template>
  </view>
</template>

<style lang="scss" scoped>
/* ================= 任务卡回顾 ================= */
.fb__card {
  margin-top: $sp-3;
}

.fb__steps {
  margin-top: $sp-3;
}

.fb__step {
  display: flex;
  gap: $sp-2;
  align-items: flex-start;

  & + & {
    margin-top: $sp-2;
  }
}

.fb__step-num {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: $c-primary-soft;
  color: $c-primary-deep;
  font-size: 24rpx;
  font-weight: 700;
  text-align: center;
  line-height: 40rpx;
  flex-shrink: 0;
}

.fb__step-text {
  flex: 1;
  font-size: $fs-sub;
  color: $c-text;
  line-height: 1.65;
}

.fb__session {
  margin-top: $sp-3;
  padding-top: $sp-3;
  border-top: 2rpx solid $c-line;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.fb__session-text {
  font-size: $fs-sub;
  color: $c-primary;
}

.fb__session-arrow {
  font-size: 36rpx;
  color: $c-primary;
  line-height: 1;
}

/* ================= 备注 ================= */
.fb__note {
  margin-top: $sp-3;
}

.fb__note-title {
  display: block;
  font-size: $fs-body;
  font-weight: 500;
  color: $c-text;
  margin-bottom: $sp-2;
}

.fb__note-input {
  width: 100%;
  min-height: 160rpx;
  padding: $sp-3;
  border-radius: $r-md;
  background: $c-page;
  font-size: $fs-sub;
  color: $c-text;
  line-height: 1.6;
  box-sizing: border-box;
}

.fb__note-ph {
  color: $c-text-weak;
}

.fb__note-count {
  display: block;
  margin-top: $sp-1;
  text-align: right;
  font-size: $fs-cap;
  color: $c-text-weak;
}

.fb__result-remark {
  display: block;
  margin-top: $sp-2;
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.7;
}

.fb__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $sp-2;
}

.fb__card-title {
  display: block;
  font-size: $fs-h2;
  font-weight: 600;
  color: $c-text;
}

.fb__target {
  margin-top: $sp-3;
  padding: $sp-3;
  border-radius: $r-md;
  background: $c-leaf-soft;
}

.fb__target-label {
  display: block;
  font-size: $fs-cap;
  color: $c-leaf-deep;
  margin-bottom: 4rpx;
}

.fb__target-text {
  font-size: 38rpx;
  font-weight: 600;
  color: #4a5c1f;
  line-height: 1.5;
}

.fb__scene {
  margin-top: $sp-3;
  display: flex;
  gap: $sp-2;
  align-items: flex-start;
}

.fb__scene-icon {
  font-size: 28rpx;
  line-height: 1.7;
  flex-shrink: 0;
}

.fb__scene-text {
  flex: 1;
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.7;
}

/* ================= 选择区 ================= */
.fb__section {
  margin-top: $sp-5;
  margin-bottom: $sp-3;
}

.fb__section-title {
  display: block;
  font-size: $fs-h2;
  font-weight: 600;
  color: $c-text;
}

.fb__section-desc {
  display: block;
  margin-top: $sp-2;
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.7;
}

.fb__options {
  display: flex;
  flex-direction: column;
  gap: $sp-2;
}

.fb__option {
  display: flex;
  align-items: center;
  gap: $sp-3;
  padding: $sp-3 $sp-4;
  border-radius: $r-lg;
  background: #fff;
  border: 3rpx solid transparent;
  box-shadow: $sh-card;
  transition: all $t-base $ease-soft;

  &--on {
    border-color: $c-primary;
    box-shadow: 0 8rpx 32rpx rgba(61, 126, 219, 0.16);
  }
}

/* 不同完成情况给不同的浅底色，帮助家长一眼分辨 */
.fb__option--safe {
  background: linear-gradient(0deg, rgba(230, 246, 239, 0.6), rgba(230, 246, 239, 0.6)), #fff;
}

.fb__option--leaf {
  background: linear-gradient(0deg, rgba(238, 246, 212, 0.6), rgba(238, 246, 212, 0.6)), #fff;
}

.fb__option--warn {
  background: linear-gradient(0deg, rgba(253, 241, 222, 0.6), rgba(253, 241, 222, 0.6)), #fff;
}

.fb__option-radio {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  border: 3rpx solid $c-primary-soft;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &--on {
    background: $c-primary;
    border-color: $c-primary;
  }
}

.fb__option-radio-icon {
  font-size: 26rpx;
  color: #fff;
  font-weight: 700;
  line-height: 1;
}

.fb__option-main {
  flex: 1;
}

.fb__option-label {
  display: block;
  font-size: $fs-body;
  font-weight: 600;
  color: $c-text;
}

.fb__option-desc {
  display: block;
  margin-top: 4rpx;
  font-size: $fs-cap;
  color: $c-text-sub;
}

.fb__option-effect {
  font-size: 22rpx;
  color: $c-text-weak;
  text-align: right;
  flex-shrink: 0;
  max-width: 160rpx;
  line-height: 1.4;
}

/* ================= 提交后 ================= */
.fb__result {
  margin-top: $sp-4;
  padding: $sp-5 $sp-4;
  border-radius: $r-lg;
  background: #fff;
  box-shadow: $sh-card;
}

.fb__result-head {
  display: flex;
  align-items: center;
  gap: $sp-2;
  margin-bottom: $sp-4;
}

.fb__result-icon {
  font-size: 48rpx;
  line-height: 1;
}

.fb__result-title {
  font-size: $fs-h2;
  font-weight: 700;
  color: $c-primary-deep;
}

.fb__advice {
  padding: $sp-4;
  border-radius: $r-md;
  background: $c-leaf-soft;
}

.fb__advice-title {
  display: block;
  font-size: $fs-h3;
  font-weight: 600;
  color: #4a5c1f;
  line-height: 1.5;
}

.fb__advice-desc {
  display: block;
  margin-top: $sp-2;
  font-size: $fs-sub;
  color: #556b24;
  line-height: 1.75;
}

.fb__result-note {
  margin-top: $sp-3;
}

.fb__result-note-text {
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.75;
}

.fb__result-actions {
  margin-top: $sp-4;
  display: flex;
  flex-direction: column;
  gap: $sp-2;
}

/* ================= 底部 ================= */
.fb__pad {
  height: 180rpx;
}

.fb__footer {
  position: fixed;
  left: var(--window-left, 0);
  right: var(--window-right, 0);
  bottom: 0;
  background: #fff;
  padding: $sp-3 $sp-4;
  border-top: 2rpx solid $c-line;
  box-shadow: 0 -8rpx 32rpx rgba(34, 48, 63, 0.05);
}
</style>
