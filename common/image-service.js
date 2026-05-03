import { imageModelConfig } from './config.js'

function trimSlash(value) {
  return (value || '').trim().replace(/\/$/, '')
}

const MODEL_API = trimSlash(imageModelConfig.baseUrl)
const MODEL_KEY = (imageModelConfig.token || '').trim()

function first(value) {
  return Array.isArray(value) ? value[0] : value
}

function asImageUrl(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    return value.imageUrl || value.url || value.outputUrl || value.src || ''
  }
  return ''
}

function imageFromBase64(value) {
  if (!value) return ''
  const base64 = typeof value === 'string' ? value : value.b64_json || value.base64 || ''
  return base64 ? `data:image/png;base64,${base64}` : ''
}

function getImageUrl(payload) {
  if (!payload) return ''
  return (
    asImageUrl(payload) ||
    asImageUrl(payload.data) ||
    asImageUrl(payload.result) ||
    asImageUrl(payload.output) ||
    asImageUrl(first(payload.images)) ||
    asImageUrl(first(payload.outputs)) ||
    asImageUrl(first(payload.data)) ||
    imageFromBase64(payload.b64_json) ||
    imageFromBase64(payload.base64) ||
    imageFromBase64(first(payload.data)) ||
    ''
  )
}

function authHeader() {
  if (!MODEL_KEY) return {}
  return {
    Authorization: `Bearer ${MODEL_KEY}`
  }
}

function request(options) {
  return new Promise((resolve, reject) => {
    uni.request({
      timeout: 120000,
      ...options,
      success: res => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
          return
        }
        reject(new Error(`图片模型接口异常：${res.statusCode}`))
      },
      fail: err => {
        reject(new Error(err.errMsg || '图片模型请求失败'))
      }
    })
  })
}

function upload(options) {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      timeout: 120000,
      ...options,
      success: res => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`图片编辑接口异常：${res.statusCode}`))
          return
        }
        try {
          resolve(typeof res.data === 'string' ? JSON.parse(res.data) : res.data)
        } catch (error) {
          reject(new Error('图片编辑接口返回不是有效 JSON'))
        }
      },
      fail: err => {
        reject(new Error(err.errMsg || '图片编辑请求失败'))
      }
    })
  })
}

function buildResult(type, params, data) {
  const imageUrl = getImageUrl(data)
  if (!imageUrl) {
    throw new Error('图片模型已返回，但没有找到 imageUrl、url 或 base64 图片字段')
  }

  return {
    id: data.id || `${type}-${Date.now()}`,
    type,
    prompt: params.prompt,
    imageUrl,
    sourcePath: params.sourcePath || '',
    style: params.style,
    ratio: params.ratio,
    quality: params.quality,
    createdAt: data.createdAt || Date.now(),
    status: data.status || 'succeeded',
    raw: data
  }
}

export function hasImageModelApi() {
  return Boolean(MODEL_API)
}

export function getImageModelEndpoint() {
  return MODEL_API
}

export async function createArtwork(params) {
  if (!MODEL_API) {
    throw new Error('图片模型接口未配置，请先设置 common/config.js')
  }

  const data = await request({
    url: `${MODEL_API}/generate`,
    method: 'POST',
    header: {
      'content-type': 'application/json',
      ...authHeader()
    },
    data: params
  })

  return buildResult('generate', params, data)
}

export async function createEditTask(params) {
  if (!MODEL_API) {
    throw new Error('图片模型接口未配置，请先设置 common/config.js')
  }

  const data = await upload({
    url: `${MODEL_API}/edit`,
    name: 'image',
    filePath: params.sourcePath,
    header: authHeader(),
    formData: {
      prompt: params.prompt,
      style: params.style,
      ratio: params.ratio,
      quality: params.quality
    }
  })

  return buildResult('edit', params, data)
}
