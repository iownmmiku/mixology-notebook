# 调酒手册 · Mixology Notebook

一款离线的鸡尾酒配方手册 Android 应用：内置 **211 款配方**（IBA 官方 88 款、流行配方 83 款、无酒精 21 款、店家特调 19 款），支持全文搜索、按酒柜原料匹配可调配方、配方调整与自建，以及可接入 OpenAI 兼容接口的 AI 调酒师对话。

## 功能特性

- **配方库**：经典 / 现代 / 无酒精 / 特调 四大分类，含口味标签、酒精度、材料与份量、调制步骤、杯型/技法/装饰
- **全文搜索**：按酒名、基酒、口味、原料模糊检索
- **我的酒柜**：录入现有原料，即时计算「现在能调」与「差一点就能调」（先按缺少数量、再按已匹配数量排序）
- **配方编辑**：任意配方可复制并调整、从零新建，全部保存在本机
- **AI 调酒师**：支持 OpenAI Chat Completions 兼容接口（内置 DeepSeek / Kimi / 智谱 / 通义千问等国内直连提供商预设，含连接测试）；未配置时自动进入离线知识库模式
- **离线优先**：所有配方、酒柜、设置均存于本地，无需联网

## 技术栈

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- [Capacitor](https://capacitorjs.com/)（Android 原生壳，官方 `CapacitorHttp` 原生网络请求以绕过 WebView CORS）
- [lucide-react](https://lucide.dev/) 图标

## 目录结构

```
src/
  data/           配方数据（iba / extras / mocktails / signature）
  App.tsx         页面与交互
  api.ts          AI 接口调用（原生 HTTP + 连接测试）
  storage.ts      本地存储
  types.ts        类型定义
android/          Capacitor 生成的 Android 工程
```

## 本地开发

```bash
npm install
npm run dev        # 浏览器预览（http://localhost:5173）
```

## 构建 APK

```bash
npm run build          # 构建前端到 dist
npx cap sync android   # 将前端同步到 Android 工程
cd android
./gradlew assembleDebug    # 调试包
./gradlew assembleRelease  # 发布包（需配置签名）
```

> 发布签名：创建 `android/keystore.properties`（内容见 `.gitignore` 说明），
> 格式如下（此文件与 keystore 文件**切勿提交到仓库**）：
>
> ```properties
> storeFile=your.keystore
> storePassword=your-password
> keyAlias=your-alias
> keyPassword=your-key-password
> ```

## AI 调酒师配置

1. 打开「调酒师」→ 右上角设置
2. 选择提供商预设（OpenAI / DeepSeek / Kimi / 智谱 / 通义千问 / SiliconFlow / 自定义）
3. 填入该平台申请的 API 密钥
4. 点击「测试连接」确认连通后保存

## 数据与版权

- 内置配方整理自国际调酒师协会（IBA）官方名录及公开资料，仅供学习交流
- 调味与饮用量请根据个人情况调整，请理性饮酒

## License

[MIT](./LICENSE)
