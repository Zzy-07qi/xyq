import { API_BASE, STORAGE_KEYS } from '@/config/constants'

/**
 * 统一请求封装（对接 starlang-bridge）
 *
 * 后端响应外壳：
 *   成功  HTTP 200  { code: 0, message: "ok", data: {...} }
 *   失败  HTTP 4xx/5xx { code: <int>, message: "<中文>" }，没有 data 字段
 *
 * 登录方式按平台分：
 *   网页（H5）：家长在登录页用手机号 + 密码登录或注册，拿到 token。
 *               没有 token 或 token 过期时，跳到登录页，不自动登录。
 *   微信小程序：没有 token 时用 uni.login 静默登录；过期时重新登录并重试一次。
 *
 * 失败一律抛 ApiError，调用方 try/catch。
 */

const DEFAULT_TIMEOUT = 15000

/** 后端业务码（handler/response.go） */
export const CODE = {
  UNAUTHORIZED: 401,
  CONSENT_REQUIRED: 1002, // 未完成知情同意，孩子数据和训练接口返回这个
  CONFLICT: 409
}

export const LOGIN_PAGE = '/pages/auth/login'
const ONBOARDING_PAGE = '/pages/parent/onboarding'

/** 业务错误：带后端的 code 和中文 message */
export class ApiError extends Error {
  constructor(message, code, status) {
    super(message || '网络不太顺畅')
    this.name = 'ApiError'
    this.code = code // 后端业务码，网络失败时为 -1
    this.status = status // HTTP 状态码，网络失败时为 0
  }
}

/* ============================================================
 * token
 * ========================================================== */

export function getToken() {
  try {
    return uni.getStorageSync(STORAGE_KEYS.TOKEN) || ''
  } catch (e) {
    return ''
  }
}

export function setToken(token) {
  try {
    uni.setStorageSync(STORAGE_KEYS.TOKEN, token)
  } catch (e) {
    /* ignore */
  }
}

export function clearToken() {
  try {
    uni.removeStorageSync(STORAGE_KEYS.TOKEN)
  } catch (e) {
    /* ignore */
  }
}

/* ============================================================
 * 页面跳转（登录页 / 引导页）
 * ========================================================== */

function currentRoute() {
  try {
    const pages = getCurrentPages()
    const top = pages[pages.length - 1]
    return top ? '/' + top.route : ''
  } catch (e) {
    return ''
  }
}

/** 同一时间可能有好几个请求同时失败，只跳一次 */
let redirecting = false

function redirectTo(url) {
  if (redirecting || currentRoute() === url) return
  redirecting = true
  uni.reLaunch({
    url,
    complete: () => {
      setTimeout(() => {
        redirecting = false
      }, 500)
    }
  })
}

/* ============================================================
 * 小程序静默登录
 * ========================================================== */

let loginPromise = null

/**
 * 小程序：uni.login 拿 code，后端换 openid。
 * 同时发出的几个请求只登录一次。
 */
export function login() {
  // #ifdef MP-WEIXIN
  if (loginPromise) return loginPromise
  loginPromise = (async () => {
    try {
      const code = await new Promise((resolve, reject) => {
        uni.login({
          provider: 'weixin',
          success: (res) => resolve(res.code),
          fail: () => reject(new ApiError('微信登录没有成功', -1, 0))
        })
      })
      const data = await rawRequest({
        url: '/auth/login',
        method: 'POST',
        data: { code },
        auth: false
      })
      setToken(data.token)
      return data
    } finally {
      loginPromise = null
    }
  })()
  return loginPromise
  // #endif

  // #ifndef MP-WEIXIN
  // 网页不能静默登录，交给登录页
  redirectTo(LOGIN_PAGE)
  return Promise.reject(new ApiError('请先登录', CODE.UNAUTHORIZED, 401))
  // #endif
}

/** 确保有 token：小程序自动登录，网页跳登录页并抛错 */
export async function ensureLogin() {
  if (getToken()) return
  await login()
}

/* ============================================================
 * 底层请求
 * ========================================================== */

function rawRequest({ url, method = 'GET', data, header = {}, auth = true }) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json', ...header }
    if (auth) {
      const token = getToken()
      if (token) headers.Authorization = `Bearer ${token}`
    }

    uni.request({
      url: `${API_BASE}${url}`,
      method,
      data,
      header: headers,
      timeout: DEFAULT_TIMEOUT,
      success: (res) => {
        const body = res.data
        if (body && typeof body === 'object' && body.code === 0) {
          resolve(body.data)
          return
        }
        // gin 对不存在的路由返回纯文本 "404 page not found"
        const isJson = body && typeof body === 'object'
        const message = isJson && body.message ? body.message : '服务暂时不可用'
        const code = isJson ? body.code : res.statusCode
        reject(new ApiError(message, code, res.statusCode))
      },
      fail: () => {
        reject(new ApiError('网络好像断了，等一下再试', -1, 0))
      }
    })
  })
}

/**
 * 对外请求入口
 * @param {object} options
 * @param {string} options.url        相对 /api/v1 的路径，如 '/scenarios'
 * @param {string} [options.method='GET']
 * @param {object} [options.data]
 * @param {object} [options.header]   额外请求头
 * @param {boolean} [options.auth=true] 是否需要登录
 * @returns {Promise<any>} 后端的 data
 * @throws {ApiError}
 */
export async function request(options) {
  const { auth = true } = options
  if (!auth) return rawRequest(options)

  await ensureLogin()
  try {
    return await rawRequest(options)
  } catch (err) {
    if (!(err instanceof ApiError)) throw err

    // token 过期或账号已不存在
    if (err.status === 401) {
      clearToken()
      // #ifdef MP-WEIXIN
      await login()
      return rawRequest(options)
      // #endif
      // #ifndef MP-WEIXIN
      redirectTo(LOGIN_PAGE)
      throw err
      // #endif
    }

    // 后端判定还没同意：回引导页走同意流程
    if (err.code === CODE.CONSENT_REQUIRED) {
      redirectTo(ONBOARDING_PAGE)
    }
    throw err
  }
}

/* ============================================================
 * 音频上传（multipart/form-data）
 * 后端要求：字段 audio 一个文件 + 字段 format=mp3，且只能有这两个字段
 * ========================================================== */

const UPLOAD_TIMEOUT = 30000

function parseBody(raw) {
  if (raw && typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

function toResult(body, status, resolve, reject) {
  if (body && body.code === 0) {
    resolve(body.data)
    return
  }
  const message = body && body.message ? body.message : '服务暂时不可用'
  const code = body ? body.code : status
  reject(new ApiError(message, code, status))
}

/**
 * @param {string} url  相对 /api/v1 的路径
 * @param {Blob|string} file  网页是 Blob，小程序是临时文件路径
 */
function rawUpload(url, file) {
  const token = getToken()

  // #ifdef H5
  // uni.uploadFile 在 H5 上要先把 Blob 转成 blob: URL，还会多带字段；直接用 fetch 更可控
  const form = new FormData()
  form.append('audio', file, 'answer.mp3')
  form.append('format', 'mp3')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT)
  return fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
    signal: controller.signal
  })
    .then(async (res) => {
      const body = parseBody(await res.text())
      return new Promise((resolve, reject) => toResult(body, res.status, resolve, reject))
    })
    .catch((err) => {
      if (err instanceof ApiError) throw err
      throw new ApiError('网络好像断了，等一下再试', -1, 0)
    })
    .finally(() => clearTimeout(timer))
  // #endif

  // #ifndef H5
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${API_BASE}${url}`,
      filePath: file,
      name: 'audio',
      formData: { format: 'mp3' },
      header: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: UPLOAD_TIMEOUT,
      success: (res) => toResult(parseBody(res.data), res.statusCode, resolve, reject),
      fail: () => reject(new ApiError('网络好像断了，等一下再试', -1, 0))
    })
  })
  // #endif
}

/** 上传录音，登录过期处理和 request 一致 */
export async function upload(url, file) {
  await ensureLogin()
  try {
    return await rawUpload(url, file)
  } catch (err) {
    if (!(err instanceof ApiError)) throw err
    if (err.status === 401) {
      clearToken()
      // #ifdef MP-WEIXIN
      await login()
      return rawUpload(url, file)
      // #endif
      // #ifndef MP-WEIXIN
      redirectTo(LOGIN_PAGE)
      throw err
      // #endif
    }
    if (err.code === CODE.CONSENT_REQUIRED) redirectTo(ONBOARDING_PAGE)
    throw err
  }
}

/** 是否是「需要登录」导致的失败。页面据此不显示「网络异常」之类的提示 */
export function isAuthError(err) {
  return err instanceof ApiError && err.status === 401
}

/** 把错误转成能直接给家长看的一句话 */
export function errorMessage(err) {
  if (err instanceof ApiError) return err.message
  return '网络不太顺畅，等一下再试'
}
