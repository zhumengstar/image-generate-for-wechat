# AI 图片工坊 uni-app 小程序

这是一个单页 uni-app 项目，可用 HBuilderX 运行到微信小程序模拟器。页面能力包含文生图、图片上传编辑、提示词复制、结果预览、重新生成和保存图片入口。

## 项目入口

- `manifest.json`：uni-app 应用配置
- `pages.json`：页面路由配置，目前只有 `pages/index/index`
- `App.vue` / `main.js`：uni-app 根入口
- `pages/index/index.vue`：单页 AI 图片工具
- `common/image-service.js`：图片模型服务层
- `common/config.js`：图片模型代理地址配置

旧的 `src/`、`vue.config.js`、`dist/` 等目录来自之前的 Web 版本，当前小程序运行不依赖它们。

## HBuilderX 运行

1. 用 HBuilderX 打开当前目录：`image-generate-for-wechat`
2. 打开 `manifest.json`
3. 微信小程序 AppID 可先使用测试号，或替换成你自己的 AppID
4. 选择：运行 -> 运行到小程序模拟器 -> 微信开发者工具

如果微信开发者工具没有自动打开，请先在微信开发者工具里开启“服务端口”。

## 图片模型接入

编辑 `common/config.js`：

```js
export const imageModelConfig = {
  baseUrl: 'https://your-backend.example.com/api/image',
  token: ''
}
```

前端会调用：

- `POST ${baseUrl}/generate`
- `POST ${baseUrl}/edit`

`/generate` 请求体是 JSON：

```json
{
  "prompt": "图片提示词",
  "negativePrompt": "负向提示词",
  "style": "电影感",
  "ratio": "1:1",
  "quality": "standard"
}
```

`/edit` 请求体是 `multipart/form-data`：

- `image`：上传图片文件
- `prompt`：编辑提示词
- `style`：风格
- `ratio`：画幅
- `quality`：质量

返回结果支持 `imageUrl`、`url`、`outputUrl`、`data.imageUrl`、`data.url`、`images[0].url`、`outputs[0].url`、`data[0].url`、`b64_json` 或 `base64`。

未配置 `baseUrl` 时，页面会使用本地 mock 预览，不会调用真实图片模型。
