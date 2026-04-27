// Star AI — Chat widget. Adds a floating bubble + chat panel to any page that loads this script.
(function () {
  if (window.__starAILoaded) return;
  window.__starAILoaded = true;

  const STORAGE_KEY = 'starAI_history';
  const MAX_HISTORY = 30;

  // ===== CSS =====
  const css = `
    .sai-fab {
      position: fixed; right: 20px; bottom: 20px;
      width: 60px; height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1B6CA8, #00B4D8);
      color: #fff; border: none; cursor: pointer;
      box-shadow: 0 8px 24px rgba(27,108,168,0.35);
      z-index: 9998;
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .sai-fab:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(27,108,168,0.45); }
    .sai-fab svg { width: 28px; height: 28px; }
    .sai-fab-pulse {
      position: absolute; inset: 0; border-radius: 50%;
      background: rgba(0,180,216,0.4); animation: sai-pulse 2.5s infinite;
      pointer-events: none;
    }
    @keyframes sai-pulse {
      0% { transform: scale(1); opacity: 0.8; }
      100% { transform: scale(1.5); opacity: 0; }
    }
    .sai-tip {
      position: fixed; right: 90px; bottom: 30px;
      background: #fff; color: #2C2C2C;
      padding: 10px 16px; border-radius: 24px;
      font-size: 0.88rem; font-weight: 600;
      box-shadow: 0 6px 20px rgba(0,0,0,0.12);
      z-index: 9997; max-width: 240px;
      font-family: 'Inter', system-ui, sans-serif;
      white-space: nowrap;
      opacity: 0; transform: translateX(8px);
      transition: opacity 0.3s, transform 0.3s;
      pointer-events: none;
    }
    .sai-tip.show { opacity: 1; transform: translateX(0); }
    .sai-tip::after {
      content: ''; position: absolute; right: -6px; top: 50%; transform: translateY(-50%);
      width: 0; height: 0;
      border-top: 6px solid transparent; border-bottom: 6px solid transparent;
      border-left: 6px solid #fff;
    }

    .sai-panel {
      position: fixed; right: 20px; bottom: 20px;
      width: 380px; max-width: calc(100vw - 24px);
      height: 580px; max-height: calc(100vh - 40px);
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 16px 48px rgba(0,0,0,0.22);
      z-index: 9999;
      display: none;
      flex-direction: column;
      overflow: hidden;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .sai-panel.open { display: flex; animation: sai-slide-up 0.28s ease; }
    @keyframes sai-slide-up {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .sai-header {
      background: linear-gradient(135deg, #1B6CA8, #00B4D8);
      color: #fff;
      padding: 18px 20px;
      display: flex; align-items: center; gap: 12px;
    }
    .sai-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.3rem; flex-shrink: 0;
    }
    .sai-header-text { flex: 1; min-width: 0; }
    .sai-header-name { font-weight: 800; font-size: 1rem; line-height: 1.2; }
    .sai-header-sub {
      font-size: 0.74rem; opacity: 0.85;
      display: flex; align-items: center; gap: 6px;
    }
    .sai-online-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #6ee7b7; box-shadow: 0 0 0 0 rgba(110,231,183,0.6);
      animation: sai-online 2s infinite;
    }
    @keyframes sai-online {
      0% { box-shadow: 0 0 0 0 rgba(110,231,183,0.6); }
      70% { box-shadow: 0 0 0 8px rgba(110,231,183,0); }
      100% { box-shadow: 0 0 0 0 rgba(110,231,183,0); }
    }
    .sai-close {
      background: rgba(255,255,255,0.15);
      border: none; color: #fff;
      width: 30px; height: 30px;
      border-radius: 50%; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
    }
    .sai-close:hover { background: rgba(255,255,255,0.28); }

    .sai-messages {
      flex: 1; overflow-y: auto;
      padding: 20px 18px;
      background: #F8F9FB;
      display: flex; flex-direction: column; gap: 12px;
    }
    .sai-msg {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 16px;
      font-size: 0.92rem;
      line-height: 1.55;
      word-wrap: break-word;
      white-space: pre-wrap;
    }
    .sai-msg-bot {
      background: #fff;
      color: #2C2C2C;
      align-self: flex-start;
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05);
    }
    .sai-msg-user {
      background: #1B6CA8;
      color: #fff;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }
    .sai-typing {
      align-self: flex-start;
      display: flex; gap: 4px;
      padding: 14px 16px; background: #fff;
      border-radius: 16px; border-bottom-left-radius: 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05);
    }
    .sai-typing span {
      width: 7px; height: 7px; border-radius: 50%;
      background: #1B6CA8;
      animation: sai-typing 1.2s infinite;
    }
    .sai-typing span:nth-child(2) { animation-delay: 0.18s; }
    .sai-typing span:nth-child(3) { animation-delay: 0.36s; }
    @keyframes sai-typing {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
      30% { transform: translateY(-5px); opacity: 1; }
    }

    .sai-suggestions {
      display: flex; flex-wrap: wrap; gap: 6px;
      padding: 0 18px 8px;
      background: #F8F9FB;
    }
    .sai-suggest-btn {
      background: #fff;
      border: 1px solid #e5e7eb;
      color: #1B6CA8;
      padding: 8px 14px;
      border-radius: 20px;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s;
    }
    .sai-suggest-btn:hover {
      background: #1B6CA8; color: #fff; border-color: #1B6CA8;
    }

    .sai-input-row {
      padding: 14px 16px;
      background: #fff;
      border-top: 1px solid #e5e7eb;
      display: flex; gap: 10px;
      align-items: flex-end;
    }
    .sai-input {
      flex: 1;
      padding: 12px 16px;
      border: 1.5px solid #e5e7eb;
      border-radius: 24px;
      font-size: 0.92rem;
      font-family: inherit;
      color: #2C2C2C;
      background: #F8F9FB;
      resize: none;
      outline: none;
      max-height: 100px;
      min-height: 44px;
      line-height: 1.4;
      transition: border-color 0.2s, background 0.2s;
    }
    .sai-input:focus { border-color: #1B6CA8; background: #fff; }
    .sai-send {
      background: #1B6CA8;
      color: #fff; border: none;
      width: 44px; height: 44px;
      border-radius: 50%;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s, transform 0.2s;
    }
    .sai-send:hover:not(:disabled) { background: #155a8a; transform: scale(1.05); }
    .sai-send:disabled { opacity: 0.5; cursor: not-allowed; }
    .sai-send svg { width: 20px; height: 20px; }

    .sai-footer {
      text-align: center; padding: 6px 0 8px;
      font-size: 0.7rem; color: #9ca3af;
      background: #fff;
    }
    .sai-footer a { color: #1B6CA8; text-decoration: underline; }

    @media (max-width: 480px) {
      .sai-panel {
        right: 0; bottom: 0; left: 0;
        width: 100%; max-width: 100%;
        height: 100%; max-height: 100%;
        border-radius: 0;
      }
      .sai-tip { display: none; }
    }
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ===== HTML =====
  const fab = document.createElement('button');
  fab.className = 'sai-fab';
  fab.setAttribute('aria-label', 'Chat with Star AI');
  fab.innerHTML = `
    <span class="sai-fab-pulse"></span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  `;
  document.body.appendChild(fab);

  const tip = document.createElement('div');
  tip.className = 'sai-tip';
  tip.textContent = 'Ask Star AI anything →';
  document.body.appendChild(tip);

  const panel = document.createElement('div');
  panel.className = 'sai-panel';
  panel.innerHTML = `
    <div class="sai-header">
      <div class="sai-avatar">🧠</div>
      <div class="sai-header-text">
        <div class="sai-header-name">Star AI</div>
        <div class="sai-header-sub"><span class="sai-online-dot"></span> Trained on Star's work</div>
      </div>
      <button class="sai-close" aria-label="Close chat">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="sai-messages" id="saiMessages"></div>
    <div class="sai-suggestions" id="saiSuggestions"></div>
    <div class="sai-input-row">
      <textarea class="sai-input" id="saiInput" placeholder="Ask anything about Emotional Fitness..." rows="1"></textarea>
      <button class="sai-send" id="saiSend" aria-label="Send">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
      </button>
    </div>
    <div class="sai-footer">AI guide trained on Star's teachings · Not a therapist</div>
  `;
  document.body.appendChild(panel);

  // ===== Logic =====
  const messagesEl = panel.querySelector('#saiMessages');
  const suggestionsEl = panel.querySelector('#saiSuggestions');
  const inputEl = panel.querySelector('#saiInput');
  const sendEl = panel.querySelector('#saiSend');
  const closeBtn = panel.querySelector('.sai-close');

  let history = [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) history = JSON.parse(raw);
  } catch (_) {}

  const SUGGESTIONS = [
    "What's Emotional Fitness?",
    "What's the Value Garden?",
    "I struggle with anxiety",
    "Where should I start?",
    "Tell me about coaching"
  ];

  function saveHistory() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
    } catch (_) {}
  }

  function addMessage(role, text) {
    const div = document.createElement('div');
    div.className = 'sai-msg ' + (role === 'user' ? 'sai-msg-user' : 'sai-msg-bot');
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'sai-typing';
    div.id = 'saiTyping';
    div.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  function hideTyping() {
    const t = document.getElementById('saiTyping');
    if (t) t.remove();
  }

  function renderSuggestions() {
    suggestionsEl.innerHTML = '';
    if (history.length > 1) return;
    SUGGESTIONS.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'sai-suggest-btn';
      btn.textContent = s;
      btn.addEventListener('click', () => {
        inputEl.value = s;
        sendMessage();
      });
      suggestionsEl.appendChild(btn);
    });
  }

  function renderHistory() {
    messagesEl.innerHTML = '';
    if (history.length === 0) {
      addMessage('assistant', "Hey! I'm Star AI — trained on the Emotional Fitness framework. Ask me anything: how to build emotional fitness, what the Value Garden is, where to start, which offer fits where you are. What's on your mind?");
      history.push({ role: 'assistant', content: "Hey! I'm Star AI — trained on the Emotional Fitness framework. Ask me anything: how to build emotional fitness, what the Value Garden is, where to start, which offer fits where you are. What's on your mind?" });
      saveHistory();
    } else {
      history.forEach(m => addMessage(m.role, m.content));
    }
    renderSuggestions();
  }

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || sendEl.disabled) return;
    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendEl.disabled = true;

    addMessage('user', text);
    history.push({ role: 'user', content: text });
    saveHistory();
    suggestionsEl.innerHTML = '';

    showTyping();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history })
      });
      hideTyping();

      if (!res.ok) {
        addMessage('assistant', "I had trouble connecting. Try again in a moment, or email starjessetaylor@gmail.com if it keeps happening.");
        sendEl.disabled = false;
        return;
      }
      const data = await res.json();
      const reply = (data && data.reply) || "Sorry, I had trouble responding. Try again.";
      addMessage('assistant', reply);
      history.push({ role: 'assistant', content: reply });
      saveHistory();
    } catch (err) {
      hideTyping();
      addMessage('assistant', "Connection issue. Check your internet and try again.");
    }
    sendEl.disabled = false;
    inputEl.focus();
  }

  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
  });
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  sendEl.addEventListener('click', sendMessage);

  let tipTimer;
  fab.addEventListener('click', () => {
    panel.classList.add('open');
    fab.style.display = 'none';
    tip.classList.remove('show');
    clearTimeout(tipTimer);
    renderHistory();
    setTimeout(() => inputEl.focus(), 240);
  });
  closeBtn.addEventListener('click', () => {
    panel.classList.remove('open');
    fab.style.display = 'flex';
  });

  // Show "Ask Star AI" tooltip after 4 seconds, hide after 6 more
  tipTimer = setTimeout(() => {
    if (!panel.classList.contains('open')) {
      tip.classList.add('show');
      setTimeout(() => tip.classList.remove('show'), 6000);
    }
  }, 4000);
})();
