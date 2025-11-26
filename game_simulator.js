// ===================================
//  PART 5: 游戏状态模拟器 (WebSocket 客户端)
// ===================================
// 连接到 C++ WebSocket 服务器，接收游戏状态变化并转发给音频引擎。

(() => {
  "use strict";

  const STATE_DISPLAY = document.getElementById("sim-current-state");
  const TOGGLE_BTN = document.getElementById("sim-toggle-btn");

  let ws = null;
  let isConnected = false;

  // 状态标签映射
  const STATE_LABELS = {
    reset: "🌲 正常探索 (Reset)",
    epic: "⚔️ 激烈战斗 (Epic)",
    anxiety: "❤️ 生命垂危 (Anxiety)",
    lofi: "📜 回忆杀 (Lo-Fi)",
    claustro: "🕳️ 钻入地道 (Claustro)"
  };

  // 连接 WebSocket 服务器
  function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log("[WebSocket] 已连接，无需重复连接");
      return;
    }

    const wsUrl = "ws://localhost:9002";
    console.log(`[WebSocket] 正在连接到 ${wsUrl}...`);

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      isConnected = true;
      console.log("[WebSocket] 连接成功");
      if (STATE_DISPLAY) {
        STATE_DISPLAY.textContent = "✅ 已连接到服务器";
        STATE_DISPLAY.style.color = "#2e8b57";
      }
      if (TOGGLE_BTN) {
        TOGGLE_BTN.textContent = "⏹ 断开连接";
        TOGGLE_BTN.style.backgroundColor = "#ffcccc";
      }
    };

    ws.onmessage = (event) => {
      const state = event.data.trim(); // 接收到的状态字符串
      console.log(`[WebSocket] 收到状态: ${state}`);

      // 转发给音频引擎
      if (window.GameAudioInterface) {
        window.GameAudioInterface.sendSignal(state);
      }

      // 更新 UI
      if (STATE_DISPLAY) {
        const label = STATE_LABELS[state] || state;
        STATE_DISPLAY.textContent = label;
        STATE_DISPLAY.style.color = state === "reset" ? "#2e8b57" : "#d9534f";
      }
    };

    ws.onerror = (error) => {
      console.error("[WebSocket] 连接错误:", error);
      if (STATE_DISPLAY) {
        STATE_DISPLAY.textContent = "❌ 连接错误";
        STATE_DISPLAY.style.color = "#d9534f";
      }
    };

    ws.onclose = () => {
      isConnected = false;
      console.log("[WebSocket] 连接已关闭");
      if (STATE_DISPLAY) {
        STATE_DISPLAY.textContent = "🔌 连接已断开";
        STATE_DISPLAY.style.color = "#aaa";
      }
      if (TOGGLE_BTN) {
        TOGGLE_BTN.textContent = "▶ 启动 游戏模拟器";
        TOGGLE_BTN.style.backgroundColor = "";
      }
    };
  }

  // 断开连接
  function disconnect() {
    if (ws) {
      ws.close();
      ws = null;
    }
    isConnected = false;

    // 停止时自动重置回正常
    if (window.GameAudioInterface) {
      window.GameAudioInterface.sendSignal("reset");
    }
    if (STATE_DISPLAY) {
      STATE_DISPLAY.textContent = "🛑 已停止";
      STATE_DISPLAY.style.color = "#aaa";
    }
  }

  // 控制逻辑
  if (TOGGLE_BTN) {
    TOGGLE_BTN.addEventListener("click", () => {
      if (isConnected) {
        // 断开连接
        disconnect();
      } else {
        // 连接服务器
        connect();
      }
    });
  }
})();

