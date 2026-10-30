<script setup>
/**
 * 完成奖励页（项目书 流程 3/7/8，表 3-1）
 *
 * 这是训练闭环的收尾，也是任务卡生成的入口（流程 9）。
 *
 * 三条约束：
 *  1. 不出现失败类结论，总结只陈述"做了什么"，不做评价
 *  2. 奖励动画低刺激、慢速，无闪烁（项目书 5.4）
 *  3. 统计口径要说人话："自己说出来的" 而不是 "独立完成率"
 */
import { ref, computed } from 'vue'
import { useSessionStore } from '@/store/session'
import { SUMMARY_LABEL, REWARD_TITLE, REWARD_SUBTITLE } from '@/config/copywriting'

const session = useSessionStore()

/**
 * 任务卡由后端在训练结束那一刻自动生成，随最后一次作答的响应一起返回，
 * 已经存在 session.taskCard 里，不需要再请求。
 */
const taskCard = computed(() => session.taskCard)
const showTaskCard = ref(false)

/** 统计：只陈述做了什么，不做评价 */
const stats = computed(() => ({
  total: session.totalRounds,
  independent: session.independentRounds,
  withHelp: session.helpedRounds,
  skipped: session.skippedRounds
}))

function goParentHome() {
  session.reset()
  uni.reLaunch({ url: '/pages/parent/home' })
}

function again() {
  session.reset()
  uni.redirectTo({ url: '/pages/child/scenario-select' })
}

/** 去回填任务卡 */
function goFeedback() {
  if (!taskCard.value) return
  const id = taskCard.value.id
  session.reset()
  uni.redirectTo({ url: `/pages/parent/task-feedback?id=${id}` })
}
</script>

<template>
  <view class="reward">
    <!-- ============ 背景光晕 ============ -->
    <view class="reward__sky">
      <view v-for="i in 12" :key="i" class="reward__star" :class="`reward__star--${i}`" />
    </view>

    <view class="reward__body">
      <!-- ============ 奖励 ============ -->
      <view class="reward__hero anim-fade-up">
        <view class="reward__badge">
          <text class="reward__badge-icon">🌟</text>
        </view>
        <text class="reward__title">{{ REWARD_TITLE }}</text>
        <text class="reward__sub">{{ REWARD_SUBTITLE }}</text>
      </view>

      <!-- ============ 训练总结 ============ -->
      <view class="reward__summary card anim-fade-up">
        <view class="reward__stat">
          <text class="reward__stat-num">{{ stats.total }}</text>
          <text class="reward__stat-label">{{ SUMMARY_LABEL.rounds }}</text>
        </view>

        <view class="reward__stat-divider" />

        <view class="reward__stat">
          <text class="reward__stat-num reward__stat-num--gold">{{ stats.independent }}</text>
          <text class="reward__stat-label">{{ SUMMARY_LABEL.independent }}</text>
        </view>

        <view class="reward__stat-divider" />

        <view class="reward__stat">
          <text class="reward__stat-num reward__stat-num--leaf">{{ stats.withHelp }}</text>
          <text class="reward__stat-label">{{ SUMMARY_LABEL.withHelp }}</text>
        </view>
      </view>

      <!-- 有辅助时给一句温和的说明，不制造落差 -->
      <view v-if="stats.withHelp > 0" class="reward__note">
        <text class="reward__note-text">
          在帮助下说出来，也是很重要的一步。
        </text>
      </view>

      <!-- ============ 任务卡（后端在训练结束时自动生成） ============ -->
      <view v-if="taskCard" class="reward__task">
        <view class="reward__task-card card" @tap="showTaskCard = true">
          <view class="tag tag--leaf">
            <text>{{ taskCard.duration }}</text>
          </view>
          <text class="reward__task-title">{{ taskCard.title }}</text>

          <view class="reward__task-target">
            <text class="reward__task-target-label">想让他说的话</text>
            <text class="reward__task-target-text">{{ taskCard.targetSentence }}</text>
          </view>

          <text class="reward__task-scene">{{ taskCard.realScene }}</text>
        </view>
      </view>

      <view class="reward__pad" />
    </view>

    <!-- ============ 底部操作 ============ -->
    <view class="reward__footer safe-bottom">
      <template v-if="taskCard">
        <view class="btn btn--primary btn--child btn--block" @tap="goFeedback">
          <text>交给爸爸妈妈</text>
        </view>
        <view class="reward__footer-link" @tap="goParentHome">
          <text class="reward__footer-link-text">先回家长中心</text>
        </view>
      </template>

      <template v-else>
        <view class="btn btn--leaf btn--child btn--block" @tap="goParentHome">
          <text>好啦，回家长中心</text>
        </view>
        <view class="reward__footer-link" @tap="again">
          <text class="reward__footer-link-text">还想再玩一次</text>
        </view>
      </template>
    </view>

    <!-- ============ 任务卡浮层 ============ -->
    <x-sheet
      :visible="showTaskCard"
      title="这张任务卡给你"
      @close="showTaskCard = false"
    >
      <text class="reward__sheet-lead">
        这张卡是根据刚才的练习生成的，5 分钟以内就能做完，尽量贴近家里本来就会发生的事。
      </text>

      <template v-if="taskCard">
        <view class="reward__sheet-block">
          <text class="reward__sheet-label">目标表达</text>
          <text class="reward__sheet-target">{{ taskCard.targetSentence }}</text>
        </view>

        <view class="reward__sheet-block">
          <text class="reward__sheet-label">在什么场景做</text>
          <text class="reward__sheet-text">{{ taskCard.realScene }}</text>
        </view>

        <view class="reward__sheet-block">
          <text class="reward__sheet-label">你可以这样做</text>
          <view v-for="(s, i) in taskCard.steps" :key="i" class="reward__sheet-step">
            <text class="reward__sheet-step-num">{{ i + 1 }}</text>
            <text class="reward__sheet-step-text">{{ s }}</text>
          </view>
        </view>

        <view v-if="taskCard.observe" class="reward__sheet-block">
          <text class="reward__sheet-label">顺便看看这些</text>
          <text class="reward__sheet-text">{{ taskCard.observe }}</text>
        </view>
      </template>

      <template #foot>
        <view class="btn btn--primary btn--block" @tap="goFeedback">
          <text>知道了，我去试试</text>
        </view>
      </template>
    </x-sheet>
  </view>
</template>

<style lang="scss" scoped>
.reward {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: linear-gradient(178deg, #1e4a8a 0%, #3d7edb 40%, #9ec9f2 100%);
  display: flex;
  flex-direction: column;
}

/* ---------- 星点 ---------- */
.reward__sky {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.reward__star {
  position: absolute;
  width: 6rpx;
  height: 6rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.8);
  animation: twinkle 4.4s $ease-soft infinite;

  &--1 { left: 12%; top: 8%; animation-delay: 0s; }
  &--2 { left: 34%; top: 4%; animation-delay: 0.5s; }
  &--3 { left: 58%; top: 11%; animation-delay: 1s; }
  &--4 { left: 80%; top: 6%; animation-delay: 1.5s; }
  &--5 { left: 22%; top: 18%; animation-delay: 2s; }
  &--6 { left: 66%; top: 20%; animation-delay: 2.5s; }
  &--7 { left: 90%; top: 16%; animation-delay: 0.8s; }
  &--8 { left: 46%; top: 24%; animation-delay: 1.8s; }
  &--9 { left: 8%; top: 28%; animation-delay: 2.8s; }
  &--10 { left: 74%; top: 30%; animation-delay: 0.3s; }
  &--11 { left: 28%; top: 34%; animation-delay: 1.3s; }
  &--12 { left: 54%; top: 36%; animation-delay: 2.3s; }
}

@keyframes twinkle {
  0%,
  100% {
    opacity: 0.22;
    transform: scale(0.9);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.15);
  }
}

/* ================= 主体 ================= */
.reward__body {
  position: relative;
  z-index: 3;
  flex: 1;
  padding: 0 $sp-4;
  padding-top: calc(env(safe-area-inset-top) + 100rpx);
}

/* ---------- 奖励 ---------- */
.reward__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $sp-2;
  margin-bottom: $sp-5;
}

.reward__badge {
  width: 200rpx;
  height: 200rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: $sp-2;
  animation: breath 3s $ease-soft infinite;
}

.reward__badge-icon {
  font-size: 120rpx;
  line-height: 1;
}

.reward__title {
  font-size: 60rpx;
  font-weight: 700;
  color: #fff;
  letter-spacing: 4rpx;
}

.reward__sub {
  font-size: $fs-child;
  color: rgba(255, 255, 255, 0.85);
}

/* ---------- 总结 ---------- */
.reward__summary {
  display: flex;
  align-items: center;
  padding: $sp-4 0;
  background: rgba(255, 255, 255, 0.96);
}

.reward__stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
}

.reward__stat-num {
  font-size: 64rpx;
  font-weight: 700;
  color: $c-primary-deep;
  line-height: 1.1;

  &--gold {
    color: #c99a1a;
  }

  &--leaf {
    color: #7a9a1f;
  }
}

.reward__stat-label {
  font-size: $fs-cap;
  color: $c-text-sub;
  text-align: center;
}

.reward__stat-divider {
  width: 2rpx;
  height: 72rpx;
  background: $c-line;
}

/* ---------- 说明 ---------- */
.reward__note {
  margin-top: $sp-3;
  padding: $sp-3 $sp-4;
  border-radius: $r-md;
  background: rgba(255, 255, 255, 0.16);
}

.reward__note-text {
  font-size: $fs-sub;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.7;
}

/* ---------- 任务卡入口 ---------- */
.reward__task {
  margin-top: $sp-4;
}

.reward__task-cta {
  display: flex;
  align-items: center;
  gap: $sp-3;
  padding: $sp-4;
  border-radius: $r-lg;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 12rpx 40rpx rgba(15, 36, 70, 0.2);

  &:active {
    transform: scale(0.98);
  }
}

.reward__task-cta-icon {
  font-size: 56rpx;
  line-height: 1;
}

.reward__task-cta-main {
  flex: 1;
}

.reward__task-cta-title {
  display: block;
  font-size: $fs-h3;
  font-weight: 600;
  color: $c-primary-deep;
}

.reward__task-cta-desc {
  display: block;
  margin-top: 4rpx;
  font-size: $fs-cap;
  color: $c-text-sub;
}

.reward__task-card {
  background: rgba(255, 255, 255, 0.97);
}

.reward__task-title {
  display: block;
  margin-top: $sp-2;
  font-size: $fs-h3;
  font-weight: 600;
  color: $c-text;
}

.reward__task-target {
  margin-top: $sp-3;
  padding: $sp-3;
  border-radius: $r-md;
  background: $c-leaf-soft;
}

.reward__task-target-label {
  display: block;
  font-size: $fs-cap;
  color: $c-leaf-deep;
  margin-bottom: 4rpx;
}

.reward__task-target-text {
  font-size: 38rpx;
  font-weight: 600;
  color: #4a5c1f;
  line-height: 1.5;
}

.reward__task-scene {
  display: block;
  margin-top: $sp-2;
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.7;
}

.reward__pad {
  height: 260rpx;
}

/* ================= 底部 ================= */
.reward__footer {
  position: relative;
  z-index: 4;
  padding: $sp-3 $sp-4;
  display: flex;
  flex-direction: column;
  gap: $sp-2;
}

.reward__footer-link {
  padding: $sp-2;
  text-align: center;
}

.reward__footer-link-text {
  font-size: $fs-sub;
  color: rgba(255, 255, 255, 0.82);
}

/* ================= 任务卡浮层 ================= */
.reward__sheet-lead {
  display: block;
  margin-bottom: $sp-3;
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.7;
}

.reward__sheet-block {
  margin-bottom: $sp-3;
}

.reward__sheet-label {
  display: block;
  font-size: $fs-cap;
  color: $c-text-weak;
  margin-bottom: $sp-2;
}

.reward__sheet-target {
  display: block;
  padding: $sp-3;
  border-radius: $r-md;
  background: $c-leaf-soft;
  font-size: 38rpx;
  font-weight: 600;
  color: #4a5c1f;
  line-height: 1.5;
}

.reward__sheet-text {
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.7;
}

.reward__sheet-step {
  display: flex;
  gap: $sp-2;
  align-items: flex-start;

  & + & {
    margin-top: $sp-2;
  }
}

.reward__sheet-step-num {
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

.reward__sheet-step-text {
  flex: 1;
  font-size: $fs-sub;
  color: $c-text;
  line-height: 1.65;
}

.reward__sheet-observe {
  display: flex;
  gap: $sp-2;
  align-items: flex-start;
}

.reward__sheet-observe-dot {
  color: $c-primary;
  font-size: $fs-body;
  line-height: 1.6;
}

.reward__sheet-observe-text {
  flex: 1;
  font-size: $fs-sub;
  color: $c-text-sub;
  line-height: 1.65;
}
</style>
