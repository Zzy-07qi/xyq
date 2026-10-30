<script setup>
/**
 * 网页版登录 / 注册（只在 H5 里注册这个页面，小程序走微信静默登录）
 *
 * 接口：POST /auth/login/password、POST /auth/register（后端需 WEB_LOGIN_ENABLED=true）
 * 规则和后端 server/web_auth_validation.go 保持一致：
 *   手机号：大陆 11 位，允许 +86 / 空格 / 横线，提交前去掉
 *   密码：8–64 位，同时有字母和数字
 * 前端先校验一遍，是为了少一次来回；最终以后端返回为准。
 *
 * 登录或注册成功后都回到引导页，由引导页按同意状态和画像决定去哪。
 */
import { ref, computed } from 'vue'
import { useAppStore } from '@/store/app'
import { useSessionStore } from '@/store/session'
import * as api from '@/core/api'
import { ApiError, CODE, errorMessage } from '@/core/request'

const appStore = useAppStore()
const session = useSessionStore()

/** login / register */
const mode = ref('login')
const isRegister = computed(() => mode.value === 'register')

const phone = ref('')
const password = ref('')
const password2 = ref('')
const nickname = ref('')
const showPassword = ref(false)
const submitting = ref(false)
const formError = ref('')

function switchMode(m) {
  mode.value = m
  formError.value = ''
  password2.value = ''
}

/** 和后端 NormalizePhone 同样的归一化 */
function normalizePhone(raw) {
  let v = (raw || '').replace(/[\s\-()]/g, '')
  if (v.startsWith('+86')) v = v.slice(3)
  else if (v.startsWith('0086')) v = v.slice(4)
  else if (v.length === 13 && v.startsWith('86')) v = v.slice(2)
  return v
}

function validate() {
  const p = normalizePhone(phone.value)
  if (!/^1[3-9]\d{9}$/.test(p)) return '请填写 11 位手机号'
  if (!password.value) return '请填写密码'
  if (isRegister.value) {
    const len = [...password.value].length
    if (len < 8 || len > 64) return '密码需要 8 到 64 位'
    if (!/[A-Za-z]/.test(password.value) || !/\d/.test(password.value)) {
      return '密码需要同时包含字母和数字'
    }
    if (password.value !== password2.value) return '两次输入的密码不一样'
    if ([...nickname.value.trim()].length > 64) return '昵称太长了'
  }
  return ''
}

const canSubmit = computed(() => !!phone.value && !!password.value && !submitting.value)

async function submit() {
  if (!canSubmit.value) return
  const msg = validate()
  if (msg) {
    formError.value = msg
    return
  }
  formError.value = ''
  submitting.value = true

  const payload = { phone: normalizePhone(phone.value), password: password.value }
  try {
    if (isRegister.value) {
      await api.register({ ...payload, nickname: nickname.value.trim() })
    } else {
      await api.passwordLogin(payload)
    }
    // 新账号：清掉本机上一个账号的引导进度和训练现场
    appStore.resetForAccountChange()
    session.reset()
    uni.reLaunch({ url: '/pages/parent/onboarding' })
  } catch (err) {
    if (err instanceof ApiError && err.code === CODE.CONFLICT && isRegister.value) {
      // 已注册：切到登录，手机号保留
      switchMode('login')
      formError.value = '这个手机号已经注册过了，直接登录就好'
    } else {
      formError.value = errorMessage(err)
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="auth">
    <view class="auth__hero">
      <view class="auth__glow auth__glow--a" />
      <view class="auth__glow auth__glow--b" />
      <view class="auth__hero-inner">
        <text class="auth__brand">星语</text>
        <text class="auth__slogan">陪孩子，把想说的话说出来</text>
      </view>
    </view>

    <view class="auth__body">
      <!-- 登录 / 注册切换 -->
      <view class="auth__tabs">
        <view
          class="auth__tab"
          :class="{ 'auth__tab--on': !isRegister }"
          @tap="switchMode('login')"
        >
          <text class="auth__tab-text">登录</text>
        </view>
        <view
          class="auth__tab"
          :class="{ 'auth__tab--on': isRegister }"
          @tap="switchMode('register')"
        >
          <text class="auth__tab-text">注册</text>
        </view>
      </view>

      <view class="card auth__form">
        <view class="auth__field">
          <text class="auth__label">手机号</text>
          <input
            v-model="phone"
            class="auth__input"
            type="number"
            maxlength="11"
            placeholder="11 位手机号"
            placeholder-class="auth__ph"
          />
        </view>

        <view class="auth__field">
          <text class="auth__label">密码</text>
          <view class="auth__pw">
            <input
              v-model="password"
              class="auth__input auth__input--pw"
              type="text"
              :password="!showPassword"
              maxlength="64"
              :placeholder="isRegister ? '8 位以上，字母和数字都要有' : '密码'"
              placeholder-class="auth__ph"
              @confirm="submit"
            />
            <text class="auth__eye" @tap="showPassword = !showPassword">
              {{ showPassword ? '隐藏' : '显示' }}
            </text>
          </view>
        </view>

        <template v-if="isRegister">
          <view class="auth__field">
            <text class="auth__label">再输一次密码</text>
            <input
              v-model="password2"
              class="auth__input"
              type="text"
              :password="!showPassword"
              maxlength="64"
              placeholder="和上面一样"
              placeholder-class="auth__ph"
            />
          </view>

          <view class="auth__field">
            <text class="auth__label">怎么称呼你（可以不填）</text>
            <input
              v-model="nickname"
              class="auth__input"
              type="text"
              maxlength="64"
              placeholder="比如：豆豆妈妈"
              placeholder-class="auth__ph"
            />
          </view>
        </template>

        <view v-if="formError" class="notice notice--warn auth__error">
          <text>{{ formError }}</text>
        </view>

        <view
          class="btn btn--primary btn--block auth__submit"
          :class="{ 'btn--disabled': !canSubmit }"
          @tap="submit"
        >
          <text>{{ submitting ? '请稍等' : isRegister ? '注册并进入' : '登录' }}</text>
        </view>

        <view class="auth__switch">
          <text v-if="!isRegister" class="auth__switch-text" @tap="switchMode('register')">
            第一次来？注册一个账号
          </text>
          <text v-else class="auth__switch-text" @tap="switchMode('login')">
            已经有账号了？去登录
          </text>
        </view>
      </view>

      <!-- 后端文档注明网页登录仅供演示、不支持找回密码 -->
      <text class="auth__note">
        这是演示版本，暂时不能找回密码，请不要使用常用密码。
      </text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.auth {
  min-height: 100vh;
  background: $c-page;
  display: flex;
  flex-direction: column;
}

.auth__hero {
  position: relative;
  height: 400rpx;
  background: linear-gradient(168deg, #1e4a8a 0%, #3d7edb 52%, #7fb4ee 100%);
  border-radius: 0 0 $r-xl $r-xl;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  padding-bottom: $sp-6;
}

.auth__glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(60rpx);

  &--a {
    width: 380rpx;
    height: 380rpx;
    background: #6fa6ef;
    top: -120rpx;
    left: -80rpx;
    opacity: 0.5;
  }

  &--b {
    width: 300rpx;
    height: 300rpx;
    background: #b9d94a;
    bottom: -140rpx;
    right: -60rpx;
    opacity: 0.3;
  }
}

.auth__hero-inner {
  position: relative;
  padding: 0 $sp-5;
}

.auth__brand {
  display: block;
  font-size: 68rpx;
  font-weight: 700;
  color: #fff;
  letter-spacing: 8rpx;
}

.auth__slogan {
  display: block;
  margin-top: $sp-2;
  font-size: $fs-body;
  color: rgba(255, 255, 255, 0.82);
}

.auth__body {
  padding: $sp-4 $sp-4 $sp-6;
}

/* ---------- 切换 ---------- */
.auth__tabs {
  display: flex;
  gap: $sp-2;
  padding: 6rpx;
  background: $c-primary-mist;
  border-radius: $r-pill;
  margin-bottom: $sp-3;
}

.auth__tab {
  flex: 1;
  height: 76rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $r-pill;
  transition: all $t-fast $ease-soft;

  &--on {
    background: #fff;
    box-shadow: $sh-soft;
  }
}

.auth__tab-text {
  font-size: $fs-body;
  color: $c-text-sub;
}

.auth__tab--on .auth__tab-text {
  color: $c-primary;
  font-weight: 600;
}

/* ---------- 表单 ---------- */
.auth__field {
  & + & {
    margin-top: $sp-3;
  }
}

.auth__label {
  display: block;
  font-size: $fs-sub;
  color: $c-text-sub;
  margin-bottom: $sp-1;
}

.auth__input {
  height: $tap-min;
  padding: 0 $sp-3;
  border-radius: $r-md;
  background: $c-page;
  font-size: $fs-body;
  color: $c-text;
}

.auth__ph {
  color: $c-text-weak;
}

.auth__pw {
  position: relative;
  display: flex;
  align-items: center;
}

.auth__input--pw {
  flex: 1;
  padding-right: 120rpx;
}

.auth__eye {
  position: absolute;
  right: $sp-3;
  font-size: $fs-sub;
  color: $c-primary;
  padding: $sp-1 0;
}

.auth__error {
  margin-top: $sp-3;
  line-height: 1.6;
}

.auth__submit {
  margin-top: $sp-4;
}

.auth__switch {
  margin-top: $sp-3;
  text-align: center;
}

.auth__switch-text {
  font-size: $fs-sub;
  color: $c-text-sub;
  padding: $sp-1 $sp-2;
}

.auth__note {
  display: block;
  margin-top: $sp-4;
  font-size: $fs-cap;
  color: $c-text-weak;
  text-align: center;
  line-height: 1.6;
}
</style>
