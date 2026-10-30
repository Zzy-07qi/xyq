<script setup>
/**
 * 安全中止页（项目书 流程 4/10，表 3-1）
 *
 * 儿童端固定话术"请家长来帮忙"，不可改写（项目书 4.6）。
 * 家长端展示既定安全流程（流程 10）。
 *
 * 两条最容易做错的地方：
 *  1. 页面一定不能表现得像出了大事 —— 孩子看不懂风险，
 *     但看得懂大人的紧张。所以视觉用柔和陶土色，不用告警红。
 *  2. 中止不得生成失败结论。这里不展示任何训练统计。
 */
import { ref, onMounted } from 'vue'
import { useSessionStore } from '@/store/session'
import { SAFETY_CHILD_TIP, SAFETY_CHILD_TIP_SUB, PARENT_SAFETY_STEPS } from '@/config/copywriting'
import * as player from '@/core/audio/player'

const session = useSessionStore()

/**
 * 进这一页有两条路：
 *   后端检测到风险内容 → 后端已经把会话中止并记录（场景、时间、规则版本都在后端）
 *   家长选了「孩子不舒服」→ store.abortForSafety 已经调过 abort 接口
 * 所以这一页不再上报，只负责把收尾做好。
 */

/** 后端风险中止时会给一句家长提示，有就显示在最前面 */
const backendParentTip = session.safetyParentTip

/** 后端触发时默认展开家长说明，家长主动停下时收起 */
const showParentSteps = ref(!!backendParentTip)

onMounted(() => {
  // 急停一切音频与动画（流程 10 处理顺序第一步）
  player.forceStop()
})

function confirmParent() {
  session.reset()
  uni.reLaunch({ url: '/pages/parent/home' })
}

function backToChildHome() {
  session.reset()
  uni.reLaunch({ url: '/pages/child/home' })
}
</script>

<template>
  <view class="safety">
    <view class="safety__body">
      <!-- ============ 儿童端固定话术（不可改写） ============ -->
      <view class="safety__child">
        <view class="safety__icon-wrap">
          <text class="safety__icon">🤝</text>
        </view>

        <text class="safety__title">{{ SAFETY_CHILD_TIP }}</text>
        <text class="safety__sub">{{ SAFETY_CHILD_TIP_SUB }}</text>
      </view>

      <!-- ============ 家长端安全流程 ============ -->
      <view class="safety__parent card">
        <view class="safety__parent-head" @tap="showParentSteps = !showParentSteps">
          <view class="safety__parent-head-main">
            <text class="safety__parent-title">给家长的话</text>
            <text class="safety__parent-desc">这次训练已经停下了，先看看这里</text>
          </view>
          <text class="safety__parent-toggle">{{ showParentSteps ? '−' : '+' }}</text>
        </view>

        <view v-if="showParentSteps" class="safety__steps anim-fade-up">
          <view v-if="backendParentTip" class="safety__backend-tip">
            <text class="safety__backend-tip-text">{{ backendParentTip }}</text>
          </view>

          <view
            v-for="(s, i) in PARENT_SAFETY_STEPS"
            :key="i"
            class="safety__step"
          >
            <text class="safety__step-num">{{ i + 1 }}</text>
            <text class="safety__step-text">{{ s }}</text>
          </view>

          <view class="safety__rule">
            <text class="safety__rule-text">
              这次停下的场景和时间已经记录下来，方便你和康复老师沟通
            </text>
          </view>
        </view>
      </view>

      <!-- ============ 明确说明不会记录什么 ============ -->
      <view class="safety__promise">
        <text class="safety__promise-text">
          这次中止不会记成"没做好"，也不会影响之后的训练难度。
        </text>
      </view>
    </view>

    <!-- ============ 底部 ============ -->
    <view class="safety__footer safe-bottom">
      <view class="btn btn--primary btn--block" @tap="confirmParent">
        <text>我知道了，回家长中心</text>
      </view>
      <view class="safety__link" @tap="backToChildHome">
        <text class="safety__link-text">孩子状态还好，回儿童模式</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.safety {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  /* 柔和陶土色底，刻意避开告警红 */
  background: linear-gradient(178deg, #f7e9e5 0%, #f4f8fd 60%);
}

/* ================= 儿童端 ================= */
.safety__child {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: calc(env(safe-area-inset-top) + 120rpx) $sp-5 $sp-6;
}

.safety__icon-wrap {
  width: 220rpx;
  height: 220rpx;
  border-radius: 50%;
  background: rgba(217, 129, 104, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: $sp-5;
  /* 呼吸动画慢到几乎察觉不到，避免加剧紧张 */
  animation: breath 4s $ease-soft infinite;
}

.safety__icon {
  font-size: 120rpx;
  line-height: 1;
}

.safety__title {
  font-size: 64rpx;
  font-weight: 700;
  color: #8a4a38;
  letter-spacing: 4rpx;
}

.safety__sub {
  margin-top: $sp-3;
  font-size: $fs-child;
  color: #a06653;
  text-align: center;
  line-height: 1.7;
}

/* ================= 家长端 ================= */
.safety__parent {
  margin: 0 $sp-4;
  padding: 0;
  overflow: hidden;
}

.safety__parent-head {
  display: flex;
  align-items: center;
  gap: $sp-3;
  padding: $sp-4;
}

.safety__parent-head-main {
  flex: 1;
}

.safety__parent-title {
  display: block;
  font-size: $fs-h3;
  font-weight: 600;
  color: $c-text;
}

.safety__parent-desc {
  display: block;
  margin-top: 4rpx;
  font-size: $fs-sub;
  color: $c-text-sub;
}

.safety__parent-toggle {
  font-size: 44rpx;
  color: $c-text-weak;
  line-height: 1;
}

/* ---------- 步骤 ---------- */
.safety__steps {
  padding: 0 $sp-4 $sp-4;
}

.safety__backend-tip {
  padding: $sp-3;
  margin-bottom: $sp-3;
  border-radius: $r-md;
  background: $c-abort-soft;
}

.safety__backend-tip-text {
  font-size: $fs-sub;
  color: #8a4a38;
  line-height: 1.7;
}

.safety__step {
  display: flex;
  gap: $sp-3;
  align-items: flex-start;
  padding: $sp-2 0;

  & + & {
    border-top: 2rpx solid $c-line;
    margin-top: $sp-2;
    padding-top: $sp-3;
  }
}

.safety__step-num {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: $c-abort-soft;
  color: #8a4a38;
  font-size: 24rpx;
  font-weight: 700;
  text-align: center;
  line-height: 40rpx;
  flex-shrink: 0;
}

.safety__step-text {
  flex: 1;
  font-size: $fs-sub;
  color: $c-text;
  line-height: 1.75;
}

.safety__rule {
  margin-top: $sp-3;
  padding: $sp-3;
  border-radius: $r-md;
  background: $c-page;
}

.safety__rule-text {
  font-size: $fs-cap;
  color: $c-text-weak;
  line-height: 1.6;
}

/* ---------- 承诺 ---------- */
.safety__promise {
  margin: $sp-4 $sp-4 0;
  padding: $sp-4;
  border-radius: $r-lg;
  background: rgba(111, 191, 154, 0.14);
}

.safety__promise-text {
  font-size: $fs-sub;
  color: #3f8f6d;
  line-height: 1.75;
  font-weight: 500;
}

/* ================= 底部 ================= */
.safety__footer {
  margin-top: auto;
  padding: $sp-3 $sp-4;
  display: flex;
  flex-direction: column;
  gap: $sp-2;
}

.safety__link {
  padding: $sp-2;
  text-align: center;
}

.safety__link-text {
  font-size: $fs-sub;
  color: $c-text-weak;
}
</style>
