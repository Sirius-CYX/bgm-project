// ===================================
//  PART 5: 游戏状态模拟器 (Game Simulator)
// ===================================
// 这个模块模拟"真实游戏"的行为，随机生成状态标签并发送给音频引擎。

(() => {
  "use strict";

  const STATE_DISPLAY = document.getElementById("sim-current-state");
  const TOGGLE_BTN = document.getElementById("sim-toggle-btn");

  let isRunning = false;
  let timerId = null;

  // 1. 定义状态池与权重 (权重越高，出现概率越大)
  const GAME_STATES = [
    { key: "reset", weight: 50, label: "🌲 正常探索 (Reset)" },
    { key: "epic", weight: 15, label: "⚔️ 激烈战斗 (Epic)" },
    { key: "anxiety", weight: 15, label: "❤️ 生命垂危 (Anxiety)" },
    { key: "lofi", weight: 10, label: "📜 回忆杀 (Lo-Fi)" },
    { key: "claustro", weight: 10, label: "🕳️ 钻入地道 (Claustro)" }
  ];

  // 辅助：加权随机选择器
  function pickRandomState() {
    const totalWeight = GAME_STATES.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (const state of GAME_STATES) {
      if (random < state.weight) return state;
      random -= state.weight;
    }
    return GAME_STATES[0]; // 兜底
  }

  // 2. 模拟循环 (Game Loop)
  function gameLoop() {
    if (!isRunning) return;

    // A. 生成状态
    const nextState = pickRandomState();

    // B. 发送信号给规则引擎 (模拟网络包或内存事件)
    if (window.GameAudioInterface) {
      console.log(`[Simulator] 游戏状态变更 -> ${nextState.key}`);
      window.GameAudioInterface.sendSignal(nextState.key);
    }

    // C. 更新 UI
    if (STATE_DISPLAY) {
      STATE_DISPLAY.textContent = nextState.label;
      // 给一点视觉反馈
      STATE_DISPLAY.style.color = nextState.key === "reset" ? "#2e8b57" : "#d9534f";
    }

    // D. 随机等待下一次变更 (5秒 ~ 15秒)
    const nextDelay = Math.floor(Math.random() * (15000 - 5000) + 5000);
    timerId = setTimeout(gameLoop, nextDelay);
  }

  // 3. 控制逻辑
  if (TOGGLE_BTN) {
    TOGGLE_BTN.addEventListener("click", () => {
      isRunning = !isRunning;
      if (isRunning) {
        TOGGLE_BTN.textContent = "⏹ 停止模拟";
        TOGGLE_BTN.style.backgroundColor = "#ffcccc";
        gameLoop(); // 启动
      } else {
        TOGGLE_BTN.textContent = "▶ 启动 游戏模拟器";
        TOGGLE_BTN.style.backgroundColor = "";
        if (timerId) clearTimeout(timerId);
        // 停止时自动重置回正常
        if (window.GameAudioInterface) window.GameAudioInterface.sendSignal("reset");
        if (STATE_DISPLAY) STATE_DISPLAY.textContent = "🛑 已停止";
      }
    });
  }
})();

