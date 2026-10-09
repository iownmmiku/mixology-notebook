# 调酒手册 · Mixology Notebook

一个离线优先的个人调酒手册，支持 Android 与响应式浏览器界面。1.4 版重做了配方库、酒柜、调酒师和个人手册，并保留原有个人配方及酒柜数据。

## 日常使用

- **配方库**：271 款内置配方，按名称、基酒、风味和材料搜索；收藏常用配方，查看材料、份量、步骤和来源。
- **我的酒柜**：录入现有材料，识别常见别名和原料类别；计算完整匹配与缺少材料，并查看补买一种材料能解锁哪些配方。
- **制作与记录**：缩放份量，逐步勾选制作步骤，使用计时器，记录评分、口味笔记和最近调制的配方。
- **个人配方**：复制内置配方后调整，或从零建立自己的配方；保存失败会明确提示。
- **调酒师**：未配置接口时使用本地推荐；先遵守无酒精与排除原料条件，再匹配风味。联网模式使用 OpenAI Chat Completions 兼容接口，提供商可自定义。
- **备份与恢复**：在个人手册中导出或导入 JSON 备份，恢复上次本机快照。浏览器直接下载，Android 通过系统分享面板保存或发送文件。备份包含个人配方、酒柜、收藏和记录，**不包含 API 密钥**。

## 数据与配方说明

1.4.1 新增 60 款逐页核对出处的配方：20 款经典与开胃酒、20 款现代与热带款、20 款无酒精款。完整目录与链接见 [新增配方来源](./RECIPE_SOURCES.md)。oz 换算率在来源标签中注明：多数酒款按 1 oz≈30 ml，部分无酒精款按美制 fl oz≈29.6 ml；“补满”保留适量，不会随杯数显示成虚构毫升数。自制糖浆的批量做法与单杯取用量分别说明。

原有 v1 本地数据可直接读取，新写入的数据带有版本信息。读取失败时保留原始内容，不会在启动时用空数据覆盖；损坏数据需要通过有效备份恢复。导入是完整替换，操作前会保留本机快照，失败时尝试回滚。

配方由公开资料整理，部分为家用调整版本。本轮核对了 Hanky Panky 与 Singapore Sling 的当前 IBA 配方，并修正了若干水果材料的单位。带来源链接的配方可打开原文核对；没有来源链接的条目不代表已逐项核验当前官方版本。材料别名、类别包含和替代关系不同，例如通用“威士忌”可由具体威士忌满足，但不同樱桃利口酒不会一律互换。

API 密钥仍存放在本设备的 localStorage，未使用 Android Keystore；请使用专用于此应用的密钥。切换提供商会清空旧密钥，导出备份会排除密钥。浏览器直连接口仍取决于提供商的 CORS 支持；Android 使用 CapacitorHttp。HTTPS 为默认要求，本机 localhost 调试接口允许 HTTP。取消原生请求会停止等待并忽略晚到的回复，底层连接由超时结束。

## 开发与验证

需要 Node.js 20 或以上。

```bash
npm ci
npm run dev
```

```bash
npm test                         # 数据、推荐、存储和接口回归
npm run build                    # TypeScript 检查与生产构建
npx playwright install chromium # 首次安装测试浏览器
npm run test:e2e                  # 先完成 build；桌面、手机与窄屏流程
```

浏览器测试使用独立上下文和模拟接口，不会调用真实付费 AI 服务。失败时的截图与 trace 位于 `test-results/`。

## Android 构建

需要 Java 21、Android SDK 35，以及本机 `android/local.properties` 中的 SDK 路径。

```bash
npm run android:sync
cd android
./gradlew assembleDebug
./gradlew assembleRelease
```

Windows 使用 `gradlew.bat`。本机发布签名通过 `android/keystore.properties` 配置，文件与 keystore 均不应提交：

```properties
storeFile=mixology.keystore
storePassword=your-password
keyAlias=your-alias
keyPassword=your-key-password
```

升级已有安装时必须使用相同签名，并提高 `versionCode`。切换签名前先导出备份。

## 持续集成与发布

Pull Request、推送 `main` 和手动运行会执行回归测试、生产构建、浏览器流程验证与 APK 构建。推送 `v*` 标签时，必须配置全部四个签名 Secret：`KEYSTORE_BASE64`、`KEYSTORE_PASSWORD`、`KEY_ALIAS`、`KEY_PASSWORD`。标签发布只上传正式签名的 release APK；缺少签名配置或 release 产物会失败，不会退回发布 debug APK。

## 技术结构

```text
src/App.tsx       页面与交互
src/styles.css    响应式界面
src/domain.ts     原料规范化、匹配、推荐与配方检索
src/storage.ts    校验、持久化、备份与恢复
src/backupExport.ts 浏览器下载与原生文件分享
src/api.ts        请求预算、取消、超时与错误处理
src/data/         内置配方
tests/            核心逻辑回归
e2e/              浏览器流程回归
android/          Capacitor Android 工程
```

配方仅供学习交流，请根据个人情况调整饮用量。代码采用 [MIT](./LICENSE) 协议。
