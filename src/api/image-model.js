import axios from 'axios'

const MODEL_API = (process.env.VUE_APP_IMAGE_MODEL_API || '').trim().replace(/\/$/, '')
const MODEL_KEY = (process.env.VUE_APP_IMAGE_MODEL_KEY || '').trim()

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

function authHeaders() {
  if (!MODEL_KEY) return {}
  return {
    Authorization: `Bearer ${MODEL_KEY}`
  }
}

function ensureConfigured() {
  if (!MODEL_API) {
    throw new Error('图片模型接口未配置，请先设置 VUE_APP_IMAGE_MODEL_API')
  }
}

function buildResult(type, params, data) {
  const imageUrl = getImageUrl(data)
  if (!imageUrl) {
    throw new Error('图片模型已返回，但没有找到 imageUrl/url/base64 图片字段')
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

export async function generateImage(params) {
  ensureConfigured()

  const { data } = await axios.post(`${MODEL_API}/generate`, params, {
    headers: authHeaders(),
    timeout: 120000
  })

  return buildResult('generate', params, data)
}

export async function editImage(params) {
  ensureConfigured()

  const form = new FormData()
  form.append('image', params.file)
  form.append('prompt', params.prompt)
  form.append('style', params.style)
  form.append('ratio', params.ratio)
  form.append('quality', params.quality)

  const { data } = await axios.post(`${MODEL_API}/edit`, form, {
    headers: authHeaders(),
    timeout: 120000
  })

  return buildResult('edit', params, data)
}
