<script setup>
/**
 * 任务卡列表页（项目书 流程 9 / 表 3-1）
 *
 * 任务卡是训练往真实生活迁移的落点，所以列表不按时间排序，
 * 而是按状态排：待做的排前面，已完成的收在下面。
 * 家长打开这一页时最想知道的只有一件事 —— "今天要做什么"。
 */
import { ref, computed, onMounted } from 'vue'
import * as api from '@/core/api'
import { DIFFICULTY_ADVICE, TASK_FEEDBACK_OPTIONS } from '@/config/constants'

const cards = ref([])
const loading = ref(true)
const offline = ref(false)

const pendingCards = computed(() => cards.value.filter((c) => !c.done))
const doneCards = computed(() => cards.value.filter((c) => c.done))

/** 回填结果（1~5）对应的中文标签 */
function feedbackLabel(value) {
  const opt = TASK_FEEDBACK_OPTIONS.find((o) => o.value === value)
  return opt ? opt.label : ''
}

function adviceTitle(value) {
  return DIFFICULTY_ADVICE[value] ? DIFFICULTY_ADVICE[value].title : ''
}

async function load() {
  loading.value = true
  offline.value = false
  try {
    const res = await api.getTaskCardList()
    cards.value = Array.isArray(res) ? res : []
  } catch (e) {
    console.warn('[task-cards] 加载失败', e)
    offline.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)

function goFeedback(card) {
  uni.navigateTo({ url: `/pages/parent/task-feedback?id=${card.id}` })
}

/** 每张任务卡都来自一次训练，从这里查看那次训练的详细过程 */
function goSession(card) {
  uni.navigateTo({ url: `/pages/parent/session-detail?id=${card.sessionId}` })
}

function goTraining() {
  uni.navigateTo({ url: '/pages/child/scenario-select' })
}
</script>

<template>
  <view class="page page--parent">
    <!-- 加载中 -->
    <x-empty v-if="loading" type="loading" />

    <!-- 断网 -->
    <x-empty
      v-else-if="offline"
      type="offline"
      :retry="true"
      @retry="load"
    />

    <template v-else>
      <!-- 空态 -->
      <x-empty
        v-if="!cards.length"
        type="empty"
        title="还没有任务卡"
        desc="带孩子做一次训练，结束时会自动生成一张适合家里的任务"
      >
        <view class="tc__empty-btn">
          <view class="btn btn--primary" @tap="goTraining">
            <text>去训练</text>
          </view>
        </view>
      </x-empty>

      <template v-else>
        <!-- ============ 待回填 ============ -->
        <view v-if="pendingCards.length" class="tc__section">
          <view class="tc__section-head">
            <text class="tc__section-title">等着你去试的</text>
            <text class="tc__section-count">{{ pendingCards.length }} 张</text>
          </view>

          <view
            v-for="card in pendingCards"
            :key="card.id"
            class="tc__card card"
            @tap="goFeedback(card)"
          >
            <view class="tc__card-head">
              <view class="tag tag--sun">
                <text>待回填</text>
              </view>
              <text class="tc__card-duration">{{ card.duration }}</text>
            </view>

            <text class="tc__card-title">{{ card.title }}</text>

            <view class="tc__target">
              <text class="tc__target-label">目标表达</text>
              <text class="tc__target-text">{{ card.targetSentence }}</text>
            </view>

            <view class="tc__scene">
              <text class="tc__scene-icon">📍</text>
              <text class="tc__scene-text">{{ card.realScene }}</text>
            </view>

            <view class="tc__card-foot">
              <text
                v-if="card.sessionId"
                class="tc__card-session"
                @tap.stop="goSession(card)"
              >看这次训练</text>
              <view class="tc__card-foot-main">
                <text class="tc__card-foot-text">做完点这里回填</text>
                <text class="tc__card-arrow">›</text>
              </view>
            </view>
          </view>
        </view>

        <!-- ============ 已完成 ============ -->
        <view v-if="doneCards.length" class="tc__section">
          <view class="tc__section-head">
            <text class="tc__section-title">已经试过的</text>
            <text class="tc__section-count">{{ doneCards.length }} 张</text>
          </view>

          <view
            v-for="card in doneCards"
            :key="card.id"
            class="tc__done card"
            @tap="goFeedback(card)"
          >
            <view class="tc__done-main">
              <text class="tc__done-title">{{ card.title }}</text>
              <view class="tc__done-meta">
                <text class="tc__done-badge">{{ feedbackLabel(card.feedback) }}</text>
                <text class="tc__done-advice">{{ adviceTitle(card.feedback) }}</text>
              </view>
            </view>
            <text class="tc__card-arrow">›</text>
          </view>
        </view>

        <!-- 底部说明 -->
        <view class="tc__note">
          <text class="tc__note-text">
            任务卡都由人工审核过的模板生成，控制在 5 分钟以内，尽量贴近家里本来就会发生的事。
          </text>
        </view>
      </template>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.tc__empty-btn {
  margin-top: $sp-4;
  display: flex;
  justify-content: center;
}

/* ---------- 区块 ---------- */
.tc__section {
  margin-bottom: $sp-5;
}

.tc__section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: $sp-3;
}

.tc__section-title {
  font-size: $fs-h2;
  font-weight: 600;
  color: $c-text;
}

.tc__section-count {
  font-size: $fs-sub;
  color: $c-text-weak;
}

/* ---------- 待做卡片 ---------- */
.tc__card {
  margin-bottom: $sp-3;
  transition: transform $t-base $ease-soft;

  &:active {
    transform: scale(0.99);
  }
}

.tc__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tc__card-duration {
  font-size: $fs-cap;
  color: $c-text-weak;
}

.tc__card-title {
  display: block;
  margin-top: $sp-2;
  font-size: $fs-h3;
  font-weight: 600;
  color: $c-text;
}

.tc__target {
  margin-top: $sp-3;
  padding: $sp-3;
  border-radius: $r-md;
  background: $c-leaf-soft;
}

.tc__target-label {
  display: block;
  font-size: $fs-cap;
  color: $c-leaf-deep;
  margin-bottom: 4rpx;
}

.tc__target-text {
  font-size: 38rpx;
  font-weight: 600;
  color: #4a5c1f;
  line-height: 1.5;
}

.tc__scene {
  margin-top: $sp-3;
  display: flex;
  gap: $sp-2;
  align-items: flex-start;
}

.tc__scene-icon {
  font-size: 28rpx;
  line-height: 1.65;
  flex-shrink: 0;
}

.tc__scene-text {
  flex: 1;
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.7;
}

.tc__card-foot {
  margin-top: $sp-3;
  padding-top: $sp-3;
  border-top: 2rpx solid $c-line;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tc__card-foot-main {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: $sp-1;
}

.tc__card-session {
  font-size: $fs-sub;
  color: $c-text-sub;
  padding: $sp-1 0;
}

.tc__card-foot-text {
  font-size: $fs-sub;
  color: $c-primary;
  font-weight: 500;
}

.tc__card-arrow {
  font-size: 40rpx;
  color: $c-primary;
  line-height: 1;
}

/* ---------- 已完成 ---------- */
.tc__done {
  display: flex;
  align-items: center;
  gap: $sp-3;
  padding: $sp-3 $sp-4;
  margin-bottom: $sp-2;

  &:active {
    opacity: 0.9;
  }
}

.tc__done-main {
  flex: 1;
}

.tc__done-title {
  display: block;
  font-size: $fs-body;
  font-weight: 500;
  color: $c-text;
}

.tc__done-meta {
  margin-top: 6rpx;
  display: flex;
  align-items: center;
  gap: $sp-2;
  flex-wrap: wrap;
}

.tc__done-badge {
  font-size: $fs-cap;
  color: #3f8f6d;
  background: $c-safe-soft;
  padding: 4rpx 12rpx;
  border-radius: $r-pill;
}

.tc__done-advice {
  font-size: $fs-cap;
  color: $c-text-weak;
}

/* ---------- 底部说明 ---------- */
.tc__note {
  margin-top: $sp-4;
  padding: $sp-4;
  border-radius: $r-lg;
  background: $c-primary-mist;
}

.tc__note-text {
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.75;
}
</style>
