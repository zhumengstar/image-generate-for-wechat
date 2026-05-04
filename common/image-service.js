import { imageModelConfig } from './config.js'

function trimSlash(value) {
  return (value || '').trim().replace(/\/$/, '')
}

const MODEL_API = trimSlash(imageModelConfig.baseUrl)
const MODEL_KEY = (imageModelConfig.token || '').trim()
const IMAGE_MODEL = imageModelConfig.model || 'gpt-image-2'

function first(value) {
  return Array.isArray(value) ? value[0] : value
}

function asImageUrl(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    return value.imageUrl || value.image_url || value.url || value.outputUrl || value.output_url || value.src || ''
  }
  return ''
}

function imageFromBase64(value) {
  if (!value) return ''
  const base64 = typeof value === 'string' ? value : value.b64_json || value.base64 || value.image_base64 || ''
  if (!base64) return ''
  if (base64.indexOf('data:image') === 0) return base64
  return `data:image/png;base64,${base64}`
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
    imageFromBase64(payload.image_base64) ||
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

function ratioToSize(ratio) {
  if (ratio === '16:9' || ratio === '4:3') return '1536x1024'
  if (ratio === '9:16' || ratio === '3:4') return '1024x1536'
  if (ratio === '1:1') return '1024x1024'
  return '1024x1024'
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
    createdAt: data.createdAt || data.created_at || Date.now(),
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
    url: `${MODEL_API}/v1/images/generations`,
    method: 'POST',
    header: {
      'content-type': 'application/json',
      ...authHeader()
    },
    data: {
      model: IMAGE_MODEL,
      prompt: params.prompt,
      n: params.count || params.n || 1,
      size: ratioToSize(params.ratio),
      response_format: 'b64_json',
      history_disabled: true
    }
  })

  return buildResult('generate', params, data)
}

export async function createEditTask(params) {
  if (!MODEL_API) {
    throw new Error('图片模型接口未配置，请先设置 common/config.js')
  }

  const data = await upload({
    url: `${MODEL_API}/v1/images/edits`,
    name: 'image',
    filePath: params.sourcePath,
    header: authHeader(),
    formData: {
      model: IMAGE_MODEL,
      prompt: params.prompt,
      n: params.count || params.n || 1,
      size: ratioToSize(params.ratio),
      response_format: 'b64_json'
    }
  })

  return buildResult('edit', params, data)
}
