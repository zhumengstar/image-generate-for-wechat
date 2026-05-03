<template>
  <div class="mobile-shell">
    <main class="phone-page">
      <header class="mini-nav">
        <span class="nav-title">AI 图片工坊</span>
        <span class="nav-capsule">
          <i />
          <i />
          <i />
        </span>
      </header>

      <section class="hero">
        <div class="status-row">
          <span :class="['model-pill', { online: hasModelApi }]">{{ modelStatusText }}</span>
          <span>{{ mode === 'generate' ? '文生图' : '图片编辑' }}</span>
        </div>
        <h1>一句提示词，生成或修改图片</h1>
        <p>手机端优先的 AI 图片工具，适合直接嵌入微信生态页面。</p>
      </section>

      <section class="panel input-panel">
        <div class="mode-switch">
          <button :class="{ active: mode === 'generate' }" @click="switchMode('generate')">
            <span>文</span>
            文生图
          </button>
          <button :class="{ active: mode === 'edit' }" @click="switchMode('edit')">
            <span>图</span>
            图片编辑
          </button>
        </div>

        <div v-if="mode === 'edit'" class="upload-box" :class="{ filled: sourcePreview }">
          <img v-if="sourcePreview" :src="sourcePreview" alt="待编辑图片">
          <button v-else class="upload-empty" @click="$refs.fileInput.click()">
            <span>+</span>
            <strong>上传要编辑的图片</strong>
            <em>支持 JPG / PNG / WebP</em>
          </button>
          <div v-if="sourcePreview" class="upload-actions">
            <button @click="$refs.fileInput.click()">换图</button>
            <button class="danger" @click="clearImage">清除</button>
          </div>
          <input ref="fileInput" type="file" accept="image/*" class="file-input" @change="onFileChange">
        </div>

        <div class="section-head">
          <label class="field-label">{{ mode === 'generate' ? '图片提示词' : '编辑提示词' }}</label>
          <span>{{ prompt.length }}/800</span>
        </div>
        <el-input
          v-model="prompt"
          type="textarea"
          :rows="5"
          maxlength="800"
          resize="none"
          :placeholder="promptPlaceholder"
        />

        <div class="examples">
          <button v-for="item in promptExamples" :key="item" @click="useExample(item)">{{ item }}</button>
        </div>

        <template v-if="mode === 'generate'">
          <label class="field-label">负向提示词</label>
          <el-input v-model="negativePrompt" placeholder="不想出现的内容，可选" />
        </template>

        <label class="field-label">风格</label>
        <div class="style-list">
          <button
            v-for="item in stylePresets"
            :key="item.name"
            :class="{ selected: style === item.name }"
            @click="style = item.name"
          >
            <span :style="{ background: item.color }" />
            {{ item.name }}
          </button>
        </div>

        <div class="option-grid">
          <div>
            <label class="field-label compact">画幅</label>
            <el-select v-model="ratio" class="full-width" popper-class="mobile-select-popper">
              <el-option v-for="item in ratios" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </div>
          <div>
            <label class="field-label compact">质量</label>
            <el-select v-model="quality" class="full-width" popper-class="mobile-select-popper">
              <el-option v-for="item in qualities" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </div>
        </div>
      </section>

      <section v-if="loading" class="panel status-panel">
        <div class="spinner" />
        <div>
          <h3>{{ mode === 'generate' ? '正在生成图片' : '正在编辑图片' }}</h3>
          <p>{{ hasModelApi ? '图片模型处理中，请稍等' : '未配置模型接口，正在生成本地 mock 预览' }}</p>
        </div>
      </section>

      <section v-else-if="result" class="panel result-panel">
        <div class="result-header">
          <div>
            <p>{{ result.modeText }}</p>
            <h2>{{ result.title }}</h2>
          </div>
          <span>{{ result.status === 'succeeded' ? '已完成' : result.status }}</span>
        </div>

        <div v-if="result.imageUrl && result.type === 'generate'" class="real-image" :class="ratioClass">
          <img :src="result.imageUrl" alt="生成结果">
        </div>

        <div v-else-if="result.imageUrl && result.type === 'edit'" class="compare">
          <div class="compare-pane">
            <img :src="sourcePreview" alt="原图">
            <strong>原图</strong>
          </div>
          <div class="compare-pane">
            <img :src="result.imageUrl" alt="编辑结果">
            <strong>编辑后</strong>
          </div>
        </div>

        <div v-else-if="result.type === 'edit'" class="compare">
          <div class="compare-pane">
            <img :src="sourcePreview" alt="原图">
            <strong>原图</strong>
          </div>
          <div class="compare-pane generated" :style="{ background: result.palette.bg, color: result.palette.fg }">
            <b>{{ result.palette.text }}</b>
            <strong>编辑后</strong>
          </div>
        </div>

        <div v-else class="mock-image" :class="ratioClass" :style="{ background: result.palette.bg, color: result.palette.fg }">
          <b>{{ result.palette.text }}</b>
          <span>{{ result.style }} · {{ ratioLabel }} · {{ qualityLabel }}</span>
        </div>

        <div class="result-meta">
          <p>{{ result.prompt }}</p>
          <div>
            <span>{{ result.style }}</span>
            <span>{{ ratioLabel }}</span>
            <span>{{ qualityLabel }}</span>
          </div>
        </div>

        <div class="result-actions">
          <button @click="copyPrompt">复制提示词</button>
          <button @click="regenerate">重新生成</button>
          <button @click="saveImage">保存图片</button>
          <button @click="resetAll">重新开始</button>
        </div>
      </section>

      <section v-else class="panel empty-state">
        <div class="empty-visual">AI</div>
        <div>
          <h3>准备好创作了</h3>
          <p>{{ emptyStateText }}</p>
        </div>
      </section>

      <div class="bottom-action">
        <el-button class="submit-button" type="primary" :loading="loading" @click="submit">
          {{ mode === 'generate' ? '生成图片' : '编辑图片' }}
        </el-button>
      </div>
    </main>
  </div>
</template>

<script>
import { editImage, generateImage, getImageModelEndpoint, hasImageModelApi } from '@/api/image-model'

const palettes = [
  { bg: 'linear-gradient(135deg, #111827 0%, #15b57a 100%)', fg: '#ffffff', text: 'AURA' },
  { bg: 'linear-gradient(135deg, #25324a 0%, #f05252 100%)', fg: '#ffffff', text: 'FILM' },
  { bg: 'linear-gradient(135deg, #0f766e 0%, #f4c430 100%)', fg: '#ffffff', text: 'FRESH' },
  { bg: 'linear-gradient(135deg, #374151 0%, #60a5fa 100%)', fg: '#ffffff', text: 'BLUE' },
  { bg: 'linear-gradient(135deg, #2f2f46 0%, #f59e0b 100%)', fg: '#ffffff', text: 'SUN' },
  { bg: 'linear-gradient(135deg, #164e63 0%, #d946ef 100%)', fg: '#ffffff', text: 'DREAM' }
]

function pickPalette(seedText = '') {
  const seed = seedText.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return palettes[Math.abs(seed) % palettes.length]
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default {
  name: 'Dashboard',
  data() {
    return {
      mode: 'generate',
      prompt: '',
      negativePrompt: '',
      sourcePreview: '',
      sourceFile: null,
      stylePresets: [
        { name: '电影感', color: '#111827' },
        { name: '水彩', color: '#60a5fa' },
        { name: '赛博朋克', color: '#e879f9' },
        { name: '国风', color: '#ef4444' },
        { name: '产品摄影', color: '#f59e0b' },
        { name: '写实摄影', color: '#10b981' }
      ],
      generateExamples: [
        '一只透明玻璃猫坐在霓虹窗边，电影感光影，细节丰富',
        '漂浮在云海上的玻璃花园，柔和晨光，梦幻插画',
        '复古海报风格的宇航员和玫瑰，颗粒质感，高级配色',
        '极简产品摄影，一瓶香水放在水面倒影中，干净柔光'
      ],
      editExamples: [
        '保留主体，把背景改成傍晚海边，整体变成水彩风格',
        '增强光影层次，让画面更像高端杂志封面',
        '替换为干净的白色产品摄影背景，保留原有细节',
        '把整体色调改成电影感暖色，增加浅景深'
      ],
      style: '电影感',
      ratios: [
        { label: '1:1 方图', value: '1:1' },
        { label: '3:4 竖图', value: '3:4' },
        { label: '4:3 横图', value: '4:3' },
        { label: '9:16 手机', value: '9:16' },
        { label: '16:9 横屏', value: '16:9' }
      ],
      ratio: '1:1',
      qualities: [
        { label: '标准', value: 'standard' },
        { label: '高清', value: 'hd' },
        { label: '精细', value: 'detail' }
      ],
      quality: 'standard',
      loading: false,
      result: null,
      hasModelApi: hasImageModelApi(),
      modelEndpoint: getImageModelEndpoint()
    }
  },
  computed: {
    promptExamples() {
      return this.mode === 'generate' ? this.generateExamples : this.editExamples
    },
    promptPlaceholder() {
      return this.mode === 'generate'
        ? '例如：一只透明玻璃猫坐在霓虹窗边，电影感光影，细节丰富'
        : '例如：保留主体，把背景改成傍晚海边，整体变成水彩风格'
    },
    modelStatusText() {
      return this.hasModelApi ? '模型已连接' : 'Mock 预览'
    },
    emptyStateText() {
      return this.hasModelApi
        ? `已连接图片模型代理${this.modelEndpoint ? `：${this.modelEndpoint}` : ''}`
        : '配置 VUE_APP_IMAGE_MODEL_API 后即可调用真实图片模型'
    },
    ratioLabel() {
      const item = this.ratios.find(item => item.value === this.ratio)
      return item ? item.label : this.ratio
    },
    qualityLabel() {
      const item = this.qualities.find(item => item.value === this.quality)
      return item ? item.label : this.quality
    },
    ratioClass() {
      return `ratio-${this.ratio.replace(':', '-')}`
    }
  },
  beforeDestroy() {
    if (this.sourcePreview) URL.revokeObjectURL(this.sourcePreview)
  },
  methods: {
    switchMode(mode) {
      this.mode = mode
      this.result = null
      this.loading = false
    },
    useExample(item) {
      this.prompt = item
      this.result = null
    },
    onFileChange(event) {
      const file = event.target.files && event.target.files[0]
      if (!file) return
      if (this.sourcePreview) URL.revokeObjectURL(this.sourcePreview)
      this.sourceFile = file
      this.sourcePreview = URL.createObjectURL(file)
      this.result = null
    },
    clearImage() {
      if (this.sourcePreview) URL.revokeObjectURL(this.sourcePreview)
      this.sourceFile = null
      this.sourcePreview = ''
      this.result = null
      if (this.$refs.fileInput) this.$refs.fileInput.value = ''
    },
    async submit() {
      const prompt = this.prompt.trim()
      if (!prompt) {
        this.$message.warning('请先输入提示词')
        return
      }
      if (this.mode === 'edit' && !this.sourceFile) {
        this.$message.warning('请先上传图片')
        return
      }

      this.loading = true
      this.result = null

      try {
        const now = Date.now()
        const palette = pickPalette(`${this.mode}${prompt}${this.style}${now}`)
        let modelResult = null

        if (this.hasModelApi) {
          modelResult = this.mode === 'generate'
            ? await generateImage({
              prompt,
              negativePrompt: this.negativePrompt.trim(),
              style: this.style,
              ratio: this.ratio,
              quality: this.quality
            })
            : await editImage({
              file: this.sourceFile,
              sourcePath: this.sourcePreview,
              prompt,
              style: this.style,
              ratio: this.ratio,
              quality: this.quality
            })
        } else {
          await wait(700)
        }

        this.result = {
          id: modelResult ? modelResult.id : `${this.mode}-${now}`,
          type: this.mode,
          modeText: this.mode === 'generate' ? '文生图' : '图片编辑',
          title: this.mode === 'generate' ? 'AI 生成图片' : '图片提示词编辑',
          prompt,
          imageUrl: modelResult ? modelResult.imageUrl : '',
          raw: modelResult ? modelResult.raw : null,
          sourcePath: this.sourcePreview,
          style: this.style,
          ratio: this.ratio,
          quality: this.quality,
          status: modelResult ? modelResult.status : 'succeeded',
          palette,
          createdAt: modelResult ? modelResult.createdAt : now
        }
        this.$message.success(this.result.imageUrl ? '图片模型处理完成' : 'mock 预览已生成')
      } catch (error) {
        this.$message.error(error.message || '图片模型调用失败')
      } finally {
        this.loading = false
      }
    },
    regenerate() {
      this.submit()
    },
    async copyPrompt() {
      const prompt = this.result ? this.result.prompt : this.prompt
      if (!prompt) return

      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(prompt)
        } else {
          const textarea = document.createElement('textarea')
          textarea.value = prompt
          document.body.appendChild(textarea)
          textarea.select()
          document.execCommand('copy')
          document.body.removeChild(textarea)
        }
        this.$message.success('提示词已复制')
      } catch (error) {
        this.$message.warning('复制失败，请手动复制提示词')
      }
    },
    saveImage() {
      if (!this.result) return
      if (!this.result.imageUrl) {
        this.$message.info('mock 预览图暂不支持保存，接入真实 imageUrl 后可下载')
        return
      }

      const link = document.createElement('a')
      link.href = this.result.imageUrl
      link.download = `ai-image-${Date.now()}.png`
      link.target = '_blank'
      link.rel = 'noopener'
      link.click()
      this.$message.success('已打开图片保存入口')
    },
    resetAll() {
      this.prompt = ''
      this.negativePrompt = ''
      this.clearImage()
      this.result = null
      this.loading = false
    }
  }
}
</script>

<style lang="scss" scoped>
.mobile-shell {
  min-height: 100vh;
  padding: 18px 0;
  background: #dfe5ec;
  color: #1f2329;
}

.phone-page {
  width: min(100%, 430px);
  min-height: calc(100vh - 36px);
  margin: 0 auto;
  padding: 12px 12px 104px;
  overflow: hidden;
  background: #f6f7f9;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 30px;
  box-shadow: 0 26px 62px rgba(20, 28, 42, 0.18);
}

.mini-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 42px;
  padding: 0 6px 8px;
}

.nav-title {
  font-size: 16px;
  font-weight: 900;
}

.nav-capsule {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 58px;
  height: 30px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
}

.nav-capsule i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #333;
}

.hero {
  padding: 18px 18px 20px;
  border-radius: 8px;
  color: #fff;
  background: linear-gradient(135deg, #17202f 0%, #0f8f62 100%);
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
  color: rgba(255, 255, 255, 0.74);
  font-size: 12px;
  font-weight: 800;
}

.model-pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
}

.model-pill.online {
  color: #042416;
  background: #98f1c8;
}

.hero h1 {
  margin: 0;
  max-width: 330px;
  font-size: 27px;
  line-height: 1.16;
  letter-spacing: 0;
}

.hero p {
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.82);
}

.panel {
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 10px 24px rgba(20, 28, 42, 0.055);
}

.input-panel {
  margin-top: 14px;
  padding: 16px;
}

.mode-switch {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  background: #f0f2f5;
}

button {
  font-family: inherit;
}

.mode-switch button,
.style-list button,
.examples button,
.upload-actions button,
.upload-empty,
.result-actions button {
  border: 0;
  cursor: pointer;
}

.mode-switch button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  border-radius: 8px;
  color: #666;
  background: transparent;
  font-weight: 800;
}

.mode-switch button span {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: #fff;
  background: #c7ccd5;
  line-height: 22px;
  text-align: center;
  font-size: 12px;
}

.mode-switch button.active {
  color: #fff;
  background: #111827;
  box-shadow: 0 8px 18px rgba(17, 24, 39, 0.16);
}

.mode-switch button.active span {
  color: #06351f;
  background: #7df0b0;
}

.upload-box {
  position: relative;
  height: 190px;
  margin-top: 14px;
  overflow: hidden;
  border: 1px dashed #cfd5df;
  border-radius: 8px;
  background: #f3f5f8;
}

.upload-box img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.upload-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: #7a8290;
  background: transparent;
}

.upload-empty span {
  width: 54px;
  height: 54px;
  margin-bottom: 12px;
  border-radius: 50%;
  color: #fff;
  background: #111827;
  font-size: 36px;
  line-height: 50px;
}

.upload-empty strong {
  font-size: 15px;
}

.upload-empty em {
  margin-top: 6px;
  font-style: normal;
  font-size: 12px;
  color: #a1a8b3;
}

.upload-actions {
  position: absolute;
  right: 14px;
  bottom: 14px;
  display: flex;
  gap: 10px;
}

.upload-actions button {
  height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  font-weight: 800;
}

.upload-actions .danger {
  color: #e5484d;
}

.file-input {
  display: none;
}

.field-label {
  display: block;
  margin: 18px 0 10px;
  color: #333;
  font-size: 14px;
  font-weight: 900;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-head span {
  margin-top: 18px;
  color: #a0a6b2;
  font-size: 12px;
}

.compact {
  margin-top: 0;
}

.examples,
.style-list {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.examples::-webkit-scrollbar,
.style-list::-webkit-scrollbar {
  display: none;
}

.examples {
  margin-top: 12px;
}

.examples button,
.style-list button {
  max-width: 270px;
  height: 34px;
  padding: 0 13px;
  overflow: hidden;
  border-radius: 999px;
  color: #5d6470;
  background: #f4f5f8;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
}

.style-list button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.style-list button span {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.style-list button.selected {
  color: #fff;
  background: #111827;
}

.option-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin-top: 18px;
}

.full-width,
.submit-button {
  width: 100%;
}

.status-panel,
.empty-state {
  min-height: 132px;
  margin-top: 14px;
  padding: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #747b87;
}

.status-panel h3,
.empty-state h3 {
  margin: 0 0 8px;
  color: #1f2329;
  font-size: 17px;
}

.status-panel p,
.empty-state p {
  margin: 0;
  line-height: 1.5;
  font-size: 13px;
}

.spinner {
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  border: 4px solid #d6f7e7;
  border-top-color: #07c160;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-visual {
  flex: 0 0 auto;
  width: 72px;
  height: 72px;
  border-radius: 8px;
  display: flex;
  align-items: flex-end;
  padding: 12px;
  color: #fff;
  background: linear-gradient(135deg, #111827, #07c160);
  font-size: 26px;
  font-weight: 900;
}

.result-panel {
  margin-top: 14px;
  overflow: hidden;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
}

.result-header p {
  margin: 0 0 6px;
  color: #07a85a;
  font-size: 13px;
  font-weight: 900;
}

.result-header h2 {
  margin: 0;
  font-size: 19px;
}

.result-header span {
  padding: 7px 12px;
  border-radius: 999px;
  color: #07a85a;
  background: #e8fff1;
  font-size: 13px;
  font-weight: 800;
}

.mock-image,
.real-image {
  position: relative;
  width: 100%;
  min-height: 300px;
  background: #f0f2f5;
}

.real-image img {
  width: 100%;
  height: 100%;
  min-height: inherit;
  object-fit: cover;
  display: block;
}

.ratio-1-1 {
  aspect-ratio: 1 / 1;
}

.ratio-3-4 {
  aspect-ratio: 3 / 4;
}

.ratio-4-3 {
  aspect-ratio: 4 / 3;
}

.ratio-9-16 {
  aspect-ratio: 9 / 16;
}

.ratio-16-9 {
  aspect-ratio: 16 / 9;
}

.mock-image b,
.generated b {
  position: absolute;
  left: 28px;
  bottom: 62px;
  font-size: 40px;
  line-height: 1;
}

.mock-image span {
  position: absolute;
  left: 30px;
  right: 24px;
  bottom: 30px;
  opacity: 0.78;
}

.compare {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2px;
  height: 250px;
  background: #f0f0f0;
}

.compare-pane {
  position: relative;
  overflow: hidden;
  background: #eef1f5;
}

.compare-pane img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.compare-pane strong {
  position: absolute;
  left: 12px;
  top: 12px;
  padding: 7px 11px;
  border-radius: 999px;
  color: #333;
  background: rgba(255, 255, 255, 0.9);
  font-size: 12px;
}

.result-meta {
  padding: 16px 16px 0;
}

.result-meta p {
  margin: 0;
  color: #5d6470;
  line-height: 1.7;
}

.result-meta div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.result-meta span {
  padding: 6px 10px;
  border-radius: 999px;
  color: #515965;
  background: #f2f4f7;
  font-size: 12px;
  font-weight: 800;
}

.result-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 16px;
}

.result-actions button {
  height: 42px;
  border-radius: 8px;
  color: #1f2329;
  background: #f3f5f8;
  font-weight: 800;
}

.bottom-action {
  position: fixed;
  left: 50%;
  bottom: 22px;
  z-index: 5;
  width: min(calc(100% - 28px), 406px);
  padding: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 12px 32px rgba(20, 28, 42, 0.14);
  transform: translateX(-50%);
}

::v-deep .el-textarea__inner,
::v-deep .el-input__inner {
  border: 0;
  border-radius: 8px;
  background: #f4f5f7;
  color: #1f2329;
  font-size: 14px;
}

::v-deep .el-textarea .el-input__count {
  display: none;
}

::v-deep .el-select .el-input__inner {
  font-weight: 800;
}

::v-deep .el-textarea__inner {
  line-height: 1.6;
}

::v-deep .el-button {
  height: 48px;
  border: 0;
  border-radius: 999px;
  font-weight: 900;
}

::v-deep .submit-button {
  background: #111827;
  box-shadow: 0 8px 18px rgba(17, 24, 39, 0.18);
}

@media (max-width: 520px) {
  .mobile-shell {
    padding: 0;
    background: #f6f7f9;
  }

  .phone-page {
    width: 100%;
    min-height: 100vh;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .bottom-action {
    bottom: 10px;
  }
}
</style>
