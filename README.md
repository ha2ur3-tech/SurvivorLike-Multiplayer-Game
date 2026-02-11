# SurvivorLike Multiplayer (WeChat Mini Game)

本仓库包含：
- `client/`：微信小游戏客户端（Phaser + TypeScript，代码工作流）
- `server/`：联机服务端（Colyseus + TypeScript）
- `wechat-mini-game-checklist/`：策划规格与数值文档

## 本地开发（快速跑通）

### 1) 安装依赖

在仓库根目录执行：

```bash
npm install
```

### 2) 构建客户端（生成微信小游戏 bundle）

```bash
npm run build
```

构建产物在 `client/minigame/js/bundle.js`。

### 3) 用微信开发者工具打开

在微信开发者工具里选择“导入项目”，目录选择：
- `client/minigame`

然后运行/预览即可。

### 4) 服务端（v0 房间骨架）

```bash
npm -w server run build
node server/dist/index.js
```

默认端口：`2567`，健康检查：`/health`。

