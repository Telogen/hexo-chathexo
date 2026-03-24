(() => {
  const getMeta = (name, fallback = '') => document.querySelector(`meta[name="${name}"]`)?.content || fallback;
  const api = getMeta('chathexo-api', '/chathexo-api/chat');
  const title = getMeta('chathexo-title', '博客问答');
  const subtitle = getMeta('chathexo-subtitle', '基于博客知识库的 AI 助手');

  let threadId = null;
  let currentModel = null;
  let availableModels = [];

  // 引入 marked.js 用于 Markdown 渲染，使用多个 CDN 备用
  function loadMarked() {
    const cdns = [
      'https://cdn.bootcdn.net/ajax/libs/marked/11.1.1/marked.min.js',
      'https://unpkg.com/marked@11.1.1/marked.min.js',
      'https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js'
    ];
    
    let currentIndex = 0;
    
    function tryLoad() {
      if (currentIndex >= cdns.length) {
        console.warn('所有 marked.js CDN 都加载失败，将使用简单文本渲染');
        return;
      }
      
      const script = document.createElement('script');
      script.src = cdns[currentIndex];
      script.onload = () => {
        console.log('marked.js 加载成功:', cdns[currentIndex]);
      };
      script.onerror = () => {
        console.warn('marked.js 加载失败:', cdns[currentIndex]);
        currentIndex++;
        tryLoad();
      };
      document.head.appendChild(script);
    }
    
    tryLoad();
  }
  
  loadMarked();

  // 生成唯一的 thread_id
  function generateThreadId() {
    return 'thread_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 加载可用模型列表
  async function loadModels() {
    try {
      // 从 /api_chat_hexo/chathexo-api/chat 转换为 /api_chat_hexo/chathexo-api/models
      const modelsApi = api.replace(/\/chat$/, '/models');
      console.log('加载模型列表，API 地址:', modelsApi);
      const res = await fetch(modelsApi);
      const data = await res.json();
      console.log('模型列表加载成功:', data);
      availableModels = data.models || [];
      currentModel = data.default || (availableModels[0]?.id);
      return data;
    } catch (err) {
      console.error('加载模型列表失败:', err);
      return { models: [], default: null };
    }
  }

  // Markdown 渲染函数
  function renderMarkdown(text) {
    if (!text) return '';

    // 使用 marked.js 渲染 markdown
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        breaks: true,  // 支持换行
        gfm: true      // 启用 GitHub Flavored Markdown
      });
      return marked.parse(text);
    }

    // 降级处理：如果 marked 未加载，简单转换换行
    return text.replace(/\n/g, '<br>');
  }

  async function boot() {
    if (document.getElementById('chathexo-toggle')) return;

    // 加载模型列表
    await loadModels();

    const button = document.createElement('button');
    button.id = 'chathexo-toggle';
    button.textContent = title;

    const panel = document.createElement('section');
    panel.id = 'chathexo-panel';
    panel.innerHTML = `
      <div class="chathexo-header">
        <div>
          <div class="chathexo-title">${title}</div>
          <div class="chathexo-subtitle">${subtitle}</div>
        </div>
        <button class="chathexo-close" aria-label="关闭">×</button>
      </div>
      <div id="chathexo-messages"></div>
      <div class="chathexo-suggestions">
        <button class="chathexo-chip" data-q="帮我总结最近更新的博客">最近更新</button>
        <button class="chathexo-chip" data-q="OpenClaw 是什么">OpenClaw 是什么</button>
        <button class="chathexo-chip" data-q="有哪些关于 LLM 的文章">LLM 相关文章</button>
      </div>
      <form class="chathexo-form">
        <textarea placeholder="输入问题"></textarea>
        <div class="chathexo-actions">
          <button class="chathexo-model-toggle" type="button" title="切换模型">
            <span class="model-label">模型：</span>
            <span class="chathexo-current-model"></span>
          </button>
          <button class="chathexo-send" type="submit">发送</button>
        </div>
      </form>`;

    document.body.appendChild(button);
    document.body.appendChild(panel);

    // 创建模型选择器（独立于 panel）
    const modelSelector = document.createElement('div');
    modelSelector.className = 'chathexo-model-selector';
    modelSelector.style.display = 'none';
    modelSelector.innerHTML = `<div class="model-selector-list"></div>`;
    document.body.appendChild(modelSelector);

    const messages = panel.querySelector('#chathexo-messages');
    const textarea = panel.querySelector('textarea');
    const form = panel.querySelector('form');
    const modelToggle = panel.querySelector('.chathexo-model-toggle');
    const currentModelDisplay = panel.querySelector('.chathexo-current-model');
    const modelList = modelSelector.querySelector('.model-selector-list');

    const addMsg = (role, text, meta) => {
      const div = document.createElement('div');
      div.className = `chathexo-msg ${role}`;
      
      // 如果是 bot 消息，使用 Markdown 渲染
      if (role === 'bot') {
        div.innerHTML = renderMarkdown(text);
      } else {
        div.textContent = text;
      }
      
      if (meta) {
        const metaEl = document.createElement('span');
        metaEl.className = 'meta';
        metaEl.textContent = meta;
        div.appendChild(metaEl);
      }
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
      return div;
    };

    const addToolCalls = (toolCalls) => {
      if (!toolCalls || toolCalls.length === 0) return;
      
      const div = document.createElement('div');
      div.className = 'chathexo-msg bot tool-calls';
      
      const header = document.createElement('div');
      header.className = 'tool-calls-header';
      header.innerHTML = '🔧 工具调用记录 <span class="toggle-icon">▼</span>';
      header.style.cursor = 'pointer';
      header.style.userSelect = 'none';
      div.appendChild(header);
      
      const content = document.createElement('div');
      content.className = 'tool-calls-content';
      content.style.display = 'none'; // 默认折叠
      
      toolCalls.forEach((call) => {
        const callDiv = document.createElement('div');
        callDiv.className = 'tool-call-item';
        
        // 获取当前时间
        const now = new Date();
        const timeStr = now.toTimeString().slice(0, 8); // HH:MM:SS
        
        // 格式化参数
        const argsStr = call.args && Object.keys(call.args).length > 0 
          ? JSON.stringify(call.args).slice(1, -1) // 去掉外层的 {}
          : '';
        
        const callText = document.createElement('div');
        callText.className = 'tool-call-text';
        callText.textContent = `${timeStr} ${call.name}(${argsStr})`;
        callDiv.appendChild(callText);
        
        // 添加工具返回结果（如果有）
        if (call.result) {
          const resultDiv = document.createElement('div');
          resultDiv.className = 'tool-call-result';
          resultDiv.textContent = call.result;
          callDiv.appendChild(resultDiv);
        }
        
        content.appendChild(callDiv);
      });
      
      div.appendChild(content);
      
      // 点击标题切换展开/折叠
      header.addEventListener('click', () => {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        header.querySelector('.toggle-icon').textContent = isHidden ? '▲' : '▼';
      });
      
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    };

    // 渲染模型选择器
    function renderModelSelector() {
      modelList.innerHTML = '';
      console.log('渲染模型列表，可用模型数量:', availableModels.length);
      availableModels.forEach(model => {
        const item = document.createElement('div');
        item.className = 'model-item';
        if (model.id === currentModel) {
          item.classList.add('active');
        }
        item.innerHTML = `
          <span class="model-name">${model.name}</span>
          ${model.id === currentModel ? '<span class="model-check">✓</span>' : ''}
        `;
        item.addEventListener('click', () => {
          currentModel = model.id;
          modelSelector.style.display = 'none';
          renderModelSelector();
          updateCurrentModelDisplay();
          // 切换模型时重置会话
          threadId = generateThreadId();
          addMsg('bot', `已切换到 ${model.name} 模型 🎉`);
        });
        modelList.appendChild(item);
      });
    }

    // 更新当前模型显示
    function updateCurrentModelDisplay() {
      const model = availableModels.find(m => m.id === currentModel);
      if (model && currentModelDisplay) {
        currentModelDisplay.textContent = model.name;
      }
    }

    renderModelSelector();
    updateCurrentModelDisplay();

    // 模型切换按钮事件
    modelToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isVisible = modelSelector.style.display === 'block';
      
      console.log('点击模型切换按钮，当前状态:', isVisible ? '显示' : '隐藏');
      
      if (isVisible) {
        modelSelector.style.display = 'none';
      } else {
        // 显示选择器
        modelSelector.style.display = 'block';
        
        // 获取按钮位置
        const rect = modelToggle.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        console.log('按钮位置:', rect);
        console.log('面板位置:', panelRect);
        
        // 将选择器定位到按钮上方（在面板内部）
        const top = rect.top - 250; // 选择器高度约240px，留点余量
        const left = panelRect.left + 12; // 与面板左边距对齐
        
        modelSelector.style.top = top + 'px';
        modelSelector.style.left = left + 'px';
        modelSelector.style.bottom = 'auto';
        
        console.log('选择器定位:', { top, left });
        console.log('选择器样式:', modelSelector.style.cssText);
      }
    });

    // 点击其他地方关闭模型选择器
    document.addEventListener('click', (e) => {
      if (!modelSelector.contains(e.target) && e.target !== modelToggle) {
        modelSelector.style.display = 'none';
      }
    });

    addMsg('bot', '你好！我是小小毛，田小毛博客的知识助手。有什么想了解的博客内容吗？');

    // 初始化 thread_id
    if (!threadId) {
      threadId = generateThreadId();
    }

    async function sendQuery(query) {
      const q = query.trim();
      if (!q) return;
      addMsg('user', q);
      textarea.value = '';
      let loading = addMsg('bot', '思考中...');

      try {
        // 使用流式方式显示工具调用进度
        const res = await fetch(api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: q, 
            thread_id: threadId,
            model: currentModel,
          })
        });
        const data = await res.json();
        loading.remove();
        
        // 构建元信息（放在最前面）
        const metaParts = [];
        if (data.mode) metaParts.push(`模式: ${data.mode}`);
        if (data.tool_calls?.length) metaParts.push(`使用了 ${data.tool_calls.length} 个工具`);
        const metaText = metaParts.join(' · ');
        
        // 显示工具调用信息
        if (data.tool_calls && data.tool_calls.length > 0) {
          addToolCalls(data.tool_calls);
        }
        
        // 显示最终回答（元信息在前）
        const answerDiv = document.createElement('div');
        answerDiv.className = 'chathexo-msg bot';
        
        if (metaText) {
          const metaEl = document.createElement('span');
          metaEl.className = 'meta';
          metaEl.textContent = metaText;
          answerDiv.appendChild(metaEl);
        }
        
        // 使用 Markdown 渲染回答内容
        const answerContent = document.createElement('div');
        answerContent.innerHTML = renderMarkdown(data.answer || '没有拿到回答。');
        answerDiv.appendChild(answerContent);
        
        messages.appendChild(answerDiv);
        messages.scrollTop = messages.scrollHeight;
      } catch (err) {
        loading.remove();
        addMsg('bot', `后端服务暂时不可用，请稍后再试。（${err.message}）`);
      }
    }

    button.addEventListener('click', () => panel.classList.toggle('open'));
    panel.querySelector('.chathexo-close').addEventListener('click', () => panel.classList.remove('open'));
    panel.querySelectorAll('.chathexo-chip').forEach(chip => chip.addEventListener('click', () => sendQuery(chip.dataset.q || '')));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      sendQuery(textarea.value);
    });

    textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') form.requestSubmit();
    });
  }

  function reportVisit() {
    const visitApi = api.replace(/\/chat$/, '/visit');
    fetch(visitApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageUrl: window.location.href })
    }).catch(() => {});
  }

  const mount = () => { reportVisit(); boot(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
  document.addEventListener('pjax:complete', mount);
})();
