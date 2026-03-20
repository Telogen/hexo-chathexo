# hexo-chathexo

A Hexo plugin that injects the ChatHexo chat widget into your blog pages.

## Installation

```bash
npm i hexo-chathexo
```

## Compatibility

- Node.js >= 14
- Peer dependency: `hexo ^7.0.0`

## Configuration

Add this to your Hexo site `_config.yml`:

```yml
chathexo:
  enable: true
  api: /api_chat_hexo/chathexo-api/chat
  title: Blog Q&A
  subtitle: AI assistant powered by your blog knowledge base
  assetsPath: chathexo
  indexFile: chathexo/index.json
```

## Usage

Frontend assets are injected automatically during `hexo generate`.

The backend service must be started and configured separately in the `chathexo-server` project.

Backend configuration:
- `../chathexo-server/README.md` in this repository
- Or the standalone backend repo: [chathexo-server](https://github.com/Telogen/chathexo-server)

After the backend is running and the reverse proxy is configured, run:

```bash
hexo clean && hexo generate
```

