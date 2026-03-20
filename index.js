'use strict';

const path = require('path');
const fs = require('fs');

const DEFAULTS = {
  enable: true,
  api: '/chathexo-api/chat',
  title: '博客问答',
  subtitle: '基于博客知识库的 AI 助手',
  assetsPath: 'chathexo',
  indexFile: 'chathexo/index.json',
};

const PLUGIN_NAME = 'chathexo';
const ASSETS_DIR = path.join(__dirname, 'src');

// ── 配置合并 ─────────────────────────────────────────────
hexo.extend.filter.register('before_generate', function () {
  const userCfg = hexo.config[PLUGIN_NAME] || {};
  hexo.config[PLUGIN_NAME] = Object.assign({}, DEFAULTS, userCfg);
  hexo.log.info('[chathexo] config loaded');
});

// ── 注入 head 资源 ────────────────────────────────────────
hexo.extend.injector.register('head_end', function () {
  const cfg = hexo.config[PLUGIN_NAME] || DEFAULTS;
  if (!cfg.enable) return '';
  const root = hexo.config.root || '/';
  return [
    `<link rel="stylesheet" href="${root}${cfg.assetsPath}/chathexo.css">`,
    `<meta name="chathexo-api" content="${cfg.api}">`,
    `<meta name="chathexo-index" content="${root}${cfg.indexFile}">`,
    `<meta name="chathexo-title" content="${cfg.title}">`,
    `<meta name="chathexo-subtitle" content="${cfg.subtitle}">`
  ].join('\n');
}, 'default');

// ── 注入 body 末尾 JS ─────────────────────────────────────
hexo.extend.injector.register('body_end', function () {
  const cfg = hexo.config[PLUGIN_NAME] || DEFAULTS;
  if (!cfg.enable) return '';
  const root = hexo.config.root || '/';
  return `<script src="${root}${cfg.assetsPath}/chathexo.js" defer></script>`;
}, 'default');

// ── 静态资源 generator ────────────────────────────────────
hexo.extend.generator.register('chathexo_assets', function () {
  const cfg = hexo.config[PLUGIN_NAME] || DEFAULTS;
  if (!cfg.enable) return [];

  const cssPath = path.join(ASSETS_DIR, 'chathexo.css');
  const jsPath  = path.join(ASSETS_DIR, 'chathexo.js');

  const result = [];

  if (fs.existsSync(cssPath)) {
    result.push({
      path: `${cfg.assetsPath}/chathexo.css`,
      data: () => fs.createReadStream(cssPath)
    });
  }

  if (fs.existsSync(jsPath)) {
    result.push({
      path: `${cfg.assetsPath}/chathexo.js`,
      data: () => fs.createReadStream(jsPath)
    });
  }

  return result;
});
