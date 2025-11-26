// ===================================
//  PART 4: 规则引擎 - 场景化驱动
// ===================================

(() => {
  "use strict";

  // -----------------------------------
  //  常量与工具函数
  // -----------------------------------
  const RESET_RAMP_TIME = 0.5; // 所有效果归零的统一过渡时间
  const APPLY_DELAY_MS = 120; // 切换场景前的缓冲时间，避免突兀叠加
  const RESET_LOG_DELAY_MS = 600; // 重置完成后记录状态的延迟
  const SCENE_LOG_DELAY_MS = 1100; // 场景应用完后记录状态的延迟

  const FX_DEFAULTS = Object.freeze({
    eq3: { low: 0, mid: 0, high: 0 },
    distortion: { distortion: 0.4, wet: 0 },
    bitCrusher: { bits: 8, wet: 0 },
    tremolo: { frequency: 10, depth: 0.5, wet: 0 },
    vibrato: { frequency: 5, depth: 0.1, wet: 0 },
    chorus: { frequency: 10, depth: 0.9, delayTime: 0.1, spread: 180, wet: 0 },
    feedbackDelay: { delayTime: "8n", feedback: 0.2, wet: 0 },
    autoPanner: { frequency: 1, depth: 1, wet: 0 },
    stereoWidener: { width: 0.5, wet: 0 },
    jcReverb: { roomSize: 0.3, wet: 0 }
  });

  const BUTTON_TO_SCENE = Object.freeze({
    "scene-epic": "epic",
    "scene-lofi": "lofi",
    "scene-claustro": "claustro",
    "scene-anxiety": "anxiety",
    "scene-heroic": "heroic",
    "scene-warmth": "warmth",
    "scene-intimacy": "intimacy",
    "scene-cold": "cold",
    "scene-panic": "panic",
    "scene-suspense": "suspense",
    "scene-horror": "horror",
    "scene-test": "test"
  });

  // 当前等待执行的场景定时器 ID，用于实现“打断并覆盖”的交互
  let pendingScenarioTimeoutId = null;

  function ensureModuleAvailable() {
    if (typeof MusicFXModule === "undefined") {
      console.error("[Scene] MusicFXModule 未加载，场景引擎无法初始化。");
      return false;
    }
    return true;
  }

  // -----------------------------------
  //  更智能的参数设置函数 (核心修复)
  // -----------------------------------
  /**
   * 通用参数设置器
   * @param {Object} node - 效果器节点 (如 chorus)
   * @param {string} param - 参数名 (如 'depth', 'frequency')
   * @param {number|string} value - 目标值
   * @param {number} [rampTime] - 过渡时间，缺省立即设置
   */
  function setParam(node, param, value, rampTime) {
    if (!node || typeof node[param] === "undefined") return;

    const target = node[param];

    // 情况 A: Tone.Signal 或带 rampTo 的参数
    if (target && typeof target.rampTo === "function") {
      if (typeof rampTime === "number" && rampTime > 0) {
        target.rampTo(value, rampTime);
      } else {
        target.value = value;
      }
      return;
    }

    // 情况 B: 具有 value 属性的对象 (AudioParam 等)
    if (target && typeof target === "object" && "value" in target) {
      target.value = value;
      return;
    }

    // 情况 C: 普通数值属性
    node[param] = value;
  }

  /**
   * 设置播放速度的辅助函数
   * @param {number} value - 目标速度 (如 1.0)
   * @param {number} [rampTime] - 过渡时间 (秒)
   */
  function setRate(value, rampTime) {
    if (ensureModuleAvailable() && typeof MusicFXModule.setPlaybackRate === "function") {
      MusicFXModule.setPlaybackRate(value, rampTime);
    }
  }

  function logStateLater(delayMs) {
    if (!ensureModuleAvailable()) return;
    if (typeof MusicFXModule.logCurrentState === "function") {
      setTimeout(() => MusicFXModule.logCurrentState(), delayMs);
    }
  }

  // -----------------------------------
  //  重置逻辑
  // -----------------------------------
  function resetEq(eq) {
    if (!eq) return;
    setParam(eq, "low", FX_DEFAULTS.eq3.low, RESET_RAMP_TIME);
    setParam(eq, "mid", FX_DEFAULTS.eq3.mid, RESET_RAMP_TIME);
    setParam(eq, "high", FX_DEFAULTS.eq3.high, RESET_RAMP_TIME);
  }

  function resetDistortion(dist) {
    if (!dist) return;
    setParam(dist, "distortion", FX_DEFAULTS.distortion.distortion);
    setParam(dist, "wet", FX_DEFAULTS.distortion.wet, RESET_RAMP_TIME);
  }

  function resetBitCrusher(node) {
    if (!node) return;
    setParam(node, "bits", FX_DEFAULTS.bitCrusher.bits);
    setParam(node, "wet", FX_DEFAULTS.bitCrusher.wet, RESET_RAMP_TIME);
  }

  function resetTremolo(node) {
    if (!node) return;
    setParam(node, "frequency", FX_DEFAULTS.tremolo.frequency);
    setParam(node, "depth", FX_DEFAULTS.tremolo.depth);
    setParam(node, "wet", FX_DEFAULTS.tremolo.wet, RESET_RAMP_TIME);
  }

  function resetVibrato(node) {
    if (!node) return;
    setParam(node, "frequency", FX_DEFAULTS.vibrato.frequency);
    setParam(node, "depth", FX_DEFAULTS.vibrato.depth);
    setParam(node, "wet", FX_DEFAULTS.vibrato.wet, RESET_RAMP_TIME);
  }

  function resetChorus(chorus) {
    if (!chorus) return;
    setParam(chorus, "frequency", FX_DEFAULTS.chorus.frequency);
    setParam(chorus, "depth", FX_DEFAULTS.chorus.depth);
    setParam(chorus, "delayTime", FX_DEFAULTS.chorus.delayTime);
    setParam(chorus, "spread", FX_DEFAULTS.chorus.spread);
    setParam(chorus, "wet", FX_DEFAULTS.chorus.wet, RESET_RAMP_TIME);
  }

  function resetDelay(delay) {
    if (!delay) return;
    setParam(delay, "delayTime", FX_DEFAULTS.feedbackDelay.delayTime);
    setParam(delay, "feedback", FX_DEFAULTS.feedbackDelay.feedback);
    setParam(delay, "wet", FX_DEFAULTS.feedbackDelay.wet, RESET_RAMP_TIME);
  }

  function resetReverb(reverb) {
    if (!reverb) return;
    setParam(reverb, "roomSize", FX_DEFAULTS.jcReverb.roomSize);
    setParam(reverb, "wet", FX_DEFAULTS.jcReverb.wet, RESET_RAMP_TIME);
  }

  function resetAutoPanner(node) {
    if (!node) return;
    setParam(node, "frequency", FX_DEFAULTS.autoPanner.frequency);
    setParam(node, "depth", FX_DEFAULTS.autoPanner.depth);
    setParam(node, "wet", FX_DEFAULTS.autoPanner.wet, RESET_RAMP_TIME);
  }

  function resetStereoWidener(node) {
    if (!node) return;
    setParam(node, "width", FX_DEFAULTS.stereoWidener.width);
    setParam(node, "wet", FX_DEFAULTS.stereoWidener.wet, RESET_RAMP_TIME);
  }

  function resetAllEffects() {
    if (!ensureModuleAvailable()) return;
    console.log("[Scene] 重置所有效果(含速度)...");

    // 重置速度回 1.0
    setRate(1.0, 5);

    resetEq(MusicFXModule.getEffect("eq3"));
    resetDistortion(MusicFXModule.getEffect("distortion"));
    resetBitCrusher(MusicFXModule.getEffect("bitCrusher"));
    resetTremolo(MusicFXModule.getEffect("tremolo"));
    resetVibrato(MusicFXModule.getEffect("vibrato"));
    resetChorus(MusicFXModule.getEffect("chorus"));
    resetDelay(MusicFXModule.getEffect("feedbackDelay"));
    resetReverb(MusicFXModule.getEffect("jcReverb"));
    resetAutoPanner(MusicFXModule.getEffect("autoPanner"));
    resetStereoWidener(MusicFXModule.getEffect("stereoWidener"));

    logStateLater(RESET_LOG_DELAY_MS);
  }

  // -----------------------------------
  //  场景配置 (声明式“配方书”)
  // -----------------------------------
  const SCENARIOS = Object.freeze({
    epic: {
      on: () => {
        console.log("[Scene] 切换到: 史诗感 (Epic)");

        // 史诗感：稍微减速，增加庄重感 (0.96x)
        setRate(0.985, 5);

        const eq = MusicFXModule.getEffect("eq3");
        if (eq) {
          // 1. 修正 EQ：克制增益，防止"破碎"和"下沉"
          setParam(eq, "low", 2, 1);   // 原4 -> 2 (太大的低频会压扁声音)
          setParam(eq, "mid", 0, 1);   // 原-2 -> 0 (找回躯干，防止中空)
          setParam(eq, "high", 1, 1);  // 原3 -> 1 (消除高频失真的"破碎感")
        }

        const rev = MusicFXModule.getEffect("jcReverb");
        if (rev) {
          setParam(rev, "roomSize", 0.5); 
          setParam(rev, "wet", 0.1, 1);   // 稍微增加一点湿润度
        }

        const stereo = MusicFXModule.getEffect("stereoWidener");
        if (stereo) {
          setParam(stereo, "width", 0.8, 1);
          setParam(stereo, "wet", 0.5, 1);
        }

        const chorus = MusicFXModule.getEffect("chorus");
        if (chorus) {
          // 3. 修正合唱：让它作为"宽底座"而不是特效
          setParam(chorus, "frequency", 0.5);
          setParam(chorus, "depth", 0.8); // 稍微减小深度，防止高音发飘
          setParam(chorus, "wet", 0.2, 1); // 稍微减小音量，不抢戏
        }
      },
      off: () => resetAllEffects()
    },
    lofi: {
      on: () => {
        console.log("[Scene] 切换到: 怀旧感 (Lo-Fi)");

        const eq = MusicFXModule.getEffect("eq3");
        if (eq) {
          setParam(eq, "low", -12, 1);
          setParam(eq, "mid", 0, 1);
          setParam(eq, "high", -12, 1);
        }

        const dist = MusicFXModule.getEffect("distortion");
        if (dist) {
          setParam(dist, "distortion", 0.2);
          setParam(dist, "wet", 0.2, 1);
        }

        const chorus = MusicFXModule.getEffect("chorus");
        if (chorus) {
          setParam(chorus, "frequency", 3.0);
          setParam(chorus, "depth", 0.7);
          setParam(chorus, "wet", 0.3, 1);
        }
      },
      off: () => resetAllEffects()
    },
    claustro: {
      on: () => {
        console.log("[Scene] 切换到: 幽闭感 (Claustrophobia)");

        const eq = MusicFXModule.getEffect("eq3");
        if (eq) {
          setParam(eq, "low", -5, 1);
          setParam(eq, "mid", 0, 1);
          setParam(eq, "high", -40, 1);
        }

        const rev = MusicFXModule.getEffect("jcReverb");
        if (rev) {
          setParam(rev, "roomSize", 0.2);
          setParam(rev, "wet", 0.2, 1);
        }
      },
      off: () => resetAllEffects()
    },
    anxiety: {
      on: () => {
        console.log("[Scene] 切换到: 焦虑感 (Anxiety)");

        // 焦虑感：稍微加速，制造紧迫感 (1.04x)
        setRate(1.015, 5);

        const eq = MusicFXModule.getEffect("eq3");
        if (eq) {
          // 1. 修正 EQ：从中频入手制造紧张，而不是用高音刺耳
          setParam(eq, "low", -1, 0.5); 
          setParam(eq, "mid", 1, 0.5);   
          setParam(eq, "high", -1, 0.5); 
        }

        const dist = MusicFXModule.getEffect("distortion");
        if (dist) {
          // 2. 修正失真：点到为止
          setParam(dist, "distortion", 0.5); // 原0.8 -> 0.5 (降低硬度)
          setParam(dist, "wet", 0.1, 0.2);   // 原0.4 -> 0.2 (融入背景)
        }

        const tremolo = MusicFXModule.getEffect("tremolo");
        if (tremolo) {
          setParam(tremolo, "frequency", 10, 0.5);
          setParam(tremolo, "depth", 0.8, 0.5);
          setParam(tremolo, "wet", 0.3, 0.5);
        }

        const delay = MusicFXModule.getEffect("feedbackDelay");
        if (delay) {
          setParam(delay, "delayTime", "8n");
          setParam(delay, "feedback", 0.15, 0.5); // 原0.6 -> 0.15 (只重复一下，像心慌)
          setParam(delay, "wet", 0.2, 0.5);       // 原0.4 -> 0.2 (微量)
        }
      },
      off: () => resetAllEffects()
    },
    heroic: {
      on: () => {
        console.log("[Scene] 切换到: 英雄时刻 (Heroic)");

        setRate(1.0, 1);

        const eq = MusicFXModule.getEffect("eq3");
        if (eq) {
          setParam(eq, "low", 0, 1);
          setParam(eq, "mid", 2, 1);
          setParam(eq, "high", 2, 1);
        }

        const dist = MusicFXModule.getEffect("distortion");
        if (dist) {
          setParam(dist, "distortion", 0.1);
          setParam(dist, "wet", 0.05, 1);
        }

        const rev = MusicFXModule.getEffect("jcReverb");
        if (rev) {
          setParam(rev, "roomSize", 0.4);
          setParam(rev, "wet", 0.15, 1);
        }
      },
      off: () => resetAllEffects()
    },
    warmth: {
      on: () => {
        console.log("[Scene] 切换到: 温暖感 (Warmth)");

        setRate(0.99, 5);

        const eq = MusicFXModule.getEffect("eq3");
        if (eq) {
          setParam(eq, "low", 2, 1);
          setParam(eq, "mid", 1, 1);
          setParam(eq, "high", -2, 1);
        }

        const dist = MusicFXModule.getEffect("distortion");
        if (dist) {
          setParam(dist, "distortion", 0.05);
          setParam(dist, "wet", 0.1, 1);
        }

        const chorus = MusicFXModule.getEffect("chorus");
        if (chorus) {
          setParam(chorus, "depth", 0.3);
          setParam(chorus, "wet", 0.1, 1);
        }
      },
      off: () => resetAllEffects()
    },
    intimacy: {
      on: () => {
        console.log("[Scene] 切换到: 亲密感 (Intimacy)");

        setRate(1.0, 1);

        const eq = MusicFXModule.getEffect("eq3");
        if (eq) {
          setParam(eq, "high", -2, 1);
          setParam(eq, "mid", 3, 1);
        }

        const stereo = MusicFXModule.getEffect("stereoWidener");
        if (stereo) {
          setParam(stereo, "width", 0.5, 1);
          setParam(stereo, "wet", 1, 1);
        }
      },
      off: () => resetAllEffects()
    },
    cold: {
      on: () => {
        console.log("[Scene] 切换到: 冰冷感 (Cold)");

        setRate(1.0, 1);

        const eq = MusicFXModule.getEffect("eq3");
        if (eq) {
          setParam(eq, "low", -5, 1);
          setParam(eq, "high", 2, 1);
        }

        const bit = MusicFXModule.getEffect("bitCrusher");
        if (bit) {
          setParam(bit, "bits", 12);
          setParam(bit, "wet", 0.1, 1);
        }

        const rev = MusicFXModule.getEffect("jcReverb");
        if (rev) {
          setParam(rev, "roomSize", 0.2);
          setParam(rev, "wet", 0.1, 1);
        }
      },
      off: () => resetAllEffects()
    },
    panic: {
      on: () => {
        console.log("[Scene] 切换到: 恐慌感 (Panic)");

        setRate(1.008, 5);

        const pan = MusicFXModule.getEffect("autoPanner");
        if (pan) {
          setParam(pan, "frequency", 10);
          setParam(pan, "depth", 1);
          setParam(pan, "wet", 0.2, 0.2);
        }

        const dist = MusicFXModule.getEffect("distortion");
        if (dist) {
          setParam(dist, "distortion", 0.2);
          setParam(dist, "wet", 0.05, 0.2);
        }
      },
      off: () => resetAllEffects()
    },
    suspense: {
      on: () => {
        console.log("[Scene] 切换到: 悬疑感 (Suspense)");

        setRate(0.975, 5);

        const eq = MusicFXModule.getEffect("eq3");
        if (eq) {
          setParam(eq, "low", -3, 1);
          setParam(eq, "high", -5, 1);
        }

        const vib = MusicFXModule.getEffect("vibrato");
        if (vib) {
          setParam(vib, "frequency", 2);
          setParam(vib, "depth", 0.1);
          setParam(vib, "wet", 0.3, 1);
        }

        const delay = MusicFXModule.getEffect("feedbackDelay");
        if (delay) {
          setParam(delay, "delayTime", "4n");
          setParam(delay, "feedback", 0.3);
          setParam(delay, "wet", 0.25, 1);
        }
      },
      off: () => resetAllEffects()
    },
    horror: {
      on: () => {
        console.log("[Scene] 切换到: 恐怖感 (Horror)");

        setRate(0.972, 5);

        const bit = MusicFXModule.getEffect("bitCrusher");
        if (bit) {
          setParam(bit, "bits", 8);
          setParam(bit, "wet", 0.08, 2);
        }

        const rev = MusicFXModule.getEffect("jcReverb");
        if (rev) {
          setParam(rev, "roomSize", 0.8);
          setParam(rev, "wet", 0.07, 2);
        }

        const trem = MusicFXModule.getEffect("tremolo");
        if (trem) {
          setParam(trem, "frequency", 2);
          setParam(trem, "depth", 0.8);
          setParam(trem, "wet", 0.07, 2);
        }
      },
      off: () => resetAllEffects()
    },
    test: {
      on: () => {
        console.log("[Scene] 切换到: 测试场景 (Test Scenario)");

        // 该场景专用于单独调试任意效果参数
        // 默认示例：调节 JCReverb 作为占位，请根据需要修改
        const tremolo = MusicFXModule.getEffect("tremolo");
        if (tremolo) {
          setParam(tremolo, "frequency", 10, 0.5);
          setParam(tremolo, "depth", 0.8, 0.5);
          setParam(tremolo, "wet", 0.2, 0.5);
        }
      },
      off: () => resetAllEffects()
    }
  });

  // -----------------------------------
  //  事件绑定与调度
  // -----------------------------------
  function applyScenario(key) {
    if (!ensureModuleAvailable()) return;
    if (!SCENARIOS[key]) {
      console.warn(`[Scene] 未找到场景: ${key}`);
      return;
    }

    if (pendingScenarioTimeoutId !== null) {
      clearTimeout(pendingScenarioTimeoutId);
      pendingScenarioTimeoutId = null;
    }

    resetAllEffects();

    pendingScenarioTimeoutId = setTimeout(() => {
      try {
        SCENARIOS[key].on();
        logStateLater(SCENE_LOG_DELAY_MS);
      } catch (error) {
        console.error(`[Scene] 应用场景 ${key} 失败:`, error);
      } finally {
        pendingScenarioTimeoutId = null;
      }
    }, APPLY_DELAY_MS);
  }

  function bindSceneButtons() {
    Object.entries(BUTTON_TO_SCENE).forEach(([buttonId, sceneKey]) => {
      const button = document.getElementById(buttonId);
      if (!button) return;
      button.addEventListener("click", () => applyScenario(sceneKey));
    });

    const resetButton = document.getElementById("scene-reset");
    if (resetButton) {
      resetButton.addEventListener("click", () => {
        const activeElement = document.activeElement || null;
        const activeSceneId = activeElement ? activeElement.id : null;
        if (activeSceneId && BUTTON_TO_SCENE[activeSceneId]) {
          const sceneConfig = SCENARIOS[BUTTON_TO_SCENE[activeSceneId]];
          if (sceneConfig && typeof sceneConfig.off === "function") {
            sceneConfig.off();
          }
          return;
        }
        resetAllEffects();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!ensureModuleAvailable()) return;
    bindSceneButtons();
    console.log("规则引擎 (Scene Mode) 已加载完毕。");
  });

  // [新] 暴露公共接口给外部 (模拟器或真实游戏)
  window.GameAudioInterface = {
    /**
     * 发送场景标签
     * @param {string} sceneKey - 场景ID ('epic', 'anxiety', 'reset'...)
     */
    sendSignal: (sceneKey) => {
      if (sceneKey === "reset") {
        // 重置场景：直接调用内部函数
        resetAllEffects();
      } else if (SCENARIOS[sceneKey]) {
        // 应用场景：直接调用内部函数
        applyScenario(sceneKey);
      } else {
        console.warn(`[GameAudioInterface] 未知的场景标签: ${sceneKey}`);
      }
    }
  };

  console.log("规则引擎 (Scene Mode) 已加载完毕，接口已暴露: window.GameAudioInterface");
})();


