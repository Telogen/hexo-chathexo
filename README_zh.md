# hexo-chathexo

Hexo 插件：在博客前端注入 ChatHexo 聊天组件。

## 安装

```bash
npm i hexo-chathexo
```

## 兼容性

- Node.js >= 14
- peer dependency: `hexo ^7.0.0`

## 配置

在 Hexo 站点 `_config.yml` 中添加：

```yml
chathexo:
  enable: true
  api: /api_chat_hexo/chathexo-api/chat
  title: 博客问答
  subtitle: 基于博客知识库的 AI 助手
  assetsPath: chathexo
  indexFile: chathexo/index.json
```

## 使用

执行 `hexo generate` 时插件会自动注入前端资源。

后端服务需要在 `chathexo-server` 项目中单独配置和启动。

后端配置请参考：
- 当前仓库中的 `../chathexo-server/README.md`
- 或独立后端仓库：[chathexo-server](https://github.com/Telogen/chathexo-server)

完成后端配置后，再执行：

```bash
hexo clean && hexo generate
```
