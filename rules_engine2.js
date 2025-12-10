// ===================================
//  PART 4: 规则引擎 - 场景化驱动
// ===================================

(() => {
  "use strict";

  // -----------------------------------
  //  常量与工具函数
  // -----------------------------------
  const RESET_RAMP_TIME = 1; // 所有效果归零的统一过渡时间
  const APPLY_DELAY_MS = 120; // 切换场景前的缓冲时间，避免突兀叠加
  const RESET_LOG_DELAY_MS = 600; // 重置完成后记录状态的延迟
  const SCENE_LOG_DELAY_MS = 1100; // 场景应用完后记录状态的延迟

  const FX_DEFAULTS = Object.freeze({
    compressor: { threshold: -24, ratio: 3, attack: 0.05, release: 0.2 },
    eq3: { low: 0, mid: 0, high: 0 },
    distortion: { distortion: 0.4, wet: 0 },
    bitCrusher: { bits: 8, wet: 0 },
    highpass: { frequency: 10, Q: 1 }, // 高通：默认 10Hz 全开
    lowpass: { frequency: 20000, Q: 1 }, // 低通：默认 20000Hz 全开
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
    "scene-empty": "empty",
    "scene-underwater": "underwater",
    "scene-dreamy": "dreamy",
    "scene-ethereal": "ethereal",
    "scene-retro": "retro",
    "scene-dirty": "dirty",
    "scene-robotic": "robotic",
    "scene-glitch": "glitch",
    "scene-psychedelic": "psychedelic",
    "scene-memory": "memory",
    "scene-test1": "test1",
    "scene-test2": "test2",
    "scene-test3": "test3",
    "scene-test4": "test4",
    "scene-test5": "test5",
    "scene-test6": "test6",
    "scene-test7": "test7",
    "scene-test8": "test8",
    "scene-test9": "test9",
    "scene-test10": "test10",
    "scene-test11": "test11",
    "scene-test12": "test12",
    "scene-test13": "test13",
    "scene-test14": "test14",
    "scene-test15": "test15",
    "scene-test16": "test16",
    "scene-test17": "test17",
    "scene-test18": "test18",
    "scene-test19": "test19",
    "scene-test20": "test20",
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
  function resetCompressor(comp) {
    if (!comp) return;
    // 使用 setParam 平滑回归默认值
    setParam(comp, "threshold", FX_DEFAULTS.compressor.threshold, RESET_RAMP_TIME);
    setParam(comp, "ratio", FX_DEFAULTS.compressor.ratio, RESET_RAMP_TIME);
    setParam(comp, "attack", FX_DEFAULTS.compressor.attack, RESET_RAMP_TIME);
    setParam(comp, "release", FX_DEFAULTS.compressor.release, RESET_RAMP_TIME);
  }

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

  function resetFilters() {
    // 重置高通滤波器：频率回到 10Hz (全开)
    const highpass = MusicFXModule.getEffect("highpass");
    if (highpass) {
      setParam(highpass, "Q", FX_DEFAULTS.highpass.Q, 2);
      setParam(highpass, "frequency", FX_DEFAULTS.highpass.frequency, 2);
    }
    
    // 重置低通滤波器：频率回到 20000Hz (全开)
    const lowpass = MusicFXModule.getEffect("lowpass");
    if (lowpass) {
      setParam(lowpass, "Q", FX_DEFAULTS.lowpass.Q, 2);
      setParam(lowpass, "frequency", FX_DEFAULTS.lowpass.frequency, 2);
    }
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

    resetCompressor(MusicFXModule.getEffect("compressor"));
    resetEq(MusicFXModule.getEffect("eq3"));
    resetDistortion(MusicFXModule.getEffect("distortion"));
    resetBitCrusher(MusicFXModule.getEffect("bitCrusher"));
    resetFilters(); // 重置高通和低通滤波器
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
        setRate(1, 5);

        const eq = MusicFXModule.getEffect("eq3");
        if (eq) {
          // 1. 修正 EQ：克制增益，防止"破碎"和"下沉"
          setParam(eq, "low", 3, 1);   // 原4 -> 2 (太大的低频会压扁声音)
          setParam(eq, "mid", 3, 1);   // 原-2 -> 0 (找回躯干，防止中空)
          setParam(eq, "high", 3, 1);  // 原3 -> 1 (消除高频失真的"破碎感")
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
        const crusher = MusicFXModule.getEffect("bitCrusher");
        if (crusher) {
          setParam(crusher, "bits", 8, 1); // 8bit 轻微破碎
          setParam(crusher, "wet", 0.05, 1); 
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
        const comp = MusicFXModule.getEffect("compressor");
        if (comp) {
          setParam(comp, "threshold", -20, 1); // 压得更深
          setParam(comp, "ratio", 10, 1);       // 稍微用力
          setParam(comp, "attack", 0.1, 1);    // 【关键】慢启动，保留冲击力
          setParam(comp, "release", 0.1, 1);   // 快释放
        }
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
    empty: {
      on: () => {
        console.log("[Scene] 切换到: 空旷感 (Empty)");

        setRate(0.995, 5);

        const eq = MusicFXModule.getEffect("eq3");
        if (eq) {
          setParam(eq, "mid", -7, 1); // 挖空中频
        }

        const delay = MusicFXModule.getEffect("feedbackDelay");
        if (delay) {
          setParam(delay, "delayTime", "2n");
          setParam(delay, "feedback", 0.2);
          setParam(delay, "wet", 0.15, 1);
        }

        const rev = MusicFXModule.getEffect("jcReverb");
        if (rev) {
          setParam(rev, "roomSize", 0.8);
          setParam(rev, "wet", 0.1, 1);
        }
      },
      off: () => resetAllEffects()
    },
    underwater: {
      on: () => {
        console.log("[Scene] 切换到: 水下感 (Underwater)");

        setRate(0.985, 5);

        // 使用低通滤波器切掉高频，模拟水下闷响
        const lowpass = MusicFXModule.getEffect("lowpass");
        if (lowpass) {
          setParam(lowpass, "frequency", 400, 2); // 2秒内频率降到400Hz (非常闷)
          setParam(lowpass, "Q", 5, 2);
        }

        const trem = MusicFXModule.getEffect("tremolo");
        if (trem) {
          setParam(trem, "frequency", 0.2);
          setParam(trem, "depth", 0.7);
          setParam(trem, "wet", 0.2, 2); // 水流感
        }
        // 5. 【新增】音高折射 (模拟水中听音的晕眩感)
       const vib = MusicFXModule.getEffect("vibrato");
       if (vib) {
       setParam(vib, "frequency", 0.5);
         setParam(vib, "depth", 0.1); // 轻微的音高飘移
       setParam(vib, "wet", 0.2, 2);
      }
        const rev = MusicFXModule.getEffect("jcReverb");
        if (rev) {
          setParam(rev, "roomSize", 0.7);
          setParam(rev, "wet", 0.05, 2);
        }
      },
      off: () => resetAllEffects()
    },
    dreamy: {
      on: () => {
        console.log("[Scene] 切换到: 梦幻感 (Dreamy)");

        setRate(0.99, 5);

        const chorus = MusicFXModule.getEffect("chorus");
        if (chorus) {
          setParam(chorus, "frequency", 0.3);
          setParam(chorus, "depth", 1);
          setParam(chorus, "wet", 0.3, 3);
        }

        const rev = MusicFXModule.getEffect("jcReverb");
        if (rev) {
          setParam(rev, "roomSize", 0.7);
          setParam(rev, "wet", 0.2, 3);
        }
      },
      off: () => resetAllEffects()
    },
    ethereal: {
      on: () => {
        console.log("[Scene] 切换到: 缥缈感 (Ethereal)");

        setRate(0.985, 5);

        const eq = MusicFXModule.getEffect("eq3");
        if (eq) {
          setParam(eq, "high", 1, 3);
          setParam(eq, "low", -15, 3);
        }

        const rev = MusicFXModule.getEffect("jcReverb");
        if (rev) {
          setParam(rev, "roomSize", 0.9);
          setParam(rev, "wet", 0.05, 3); // 极湿
        }

        const wide = MusicFXModule.getEffect("stereoWidener");
        if (wide) {
          setParam(wide, "width", 1.0);
          setParam(wide, "wet", 0.2, 3);
        }
      },
      off: () => resetAllEffects()
    },
    retro: {
      on: () => {
        console.log("[Scene] 切换到: 复古未来 (Retro)");

        setRate(1.0, 1);

        const chorus = MusicFXModule.getEffect("chorus");
        if (chorus) {
          setParam(chorus, "frequency", 2);
          setParam(chorus, "depth", 0.5);
          setParam(chorus, "wet", 0.5, 1);
        }

        const delay = MusicFXModule.getEffect("feedbackDelay");
        if (delay) {
          setParam(delay, "delayTime", "8n.");
          setParam(delay, "feedback", 0.4);
          setParam(delay, "wet", 0.2, 1);
        }
      },
      off: () => resetAllEffects()
    },
    dirty: {
      on: () => {
        console.log("[Scene] 切换到: 肮脏工业 (Dirty)");

        setRate(1.0, 0.5);

        const dist = MusicFXModule.getEffect("distortion");
        if (dist) {
          setParam(dist, "distortion", 0.6);
          setParam(dist, "wet", 0.1, 0.5);
        }

        const bit = MusicFXModule.getEffect("bitCrusher");
        if (bit) {
          setParam(bit, "bits", 8);
          setParam(bit, "wet", 0.15, 0.5);
        }

        const eq = MusicFXModule.getEffect("eq3");
        if (eq) {
          setParam(eq, "high", -5, 0.5);
        }
      },
      off: () => resetAllEffects()
    },
    robotic: {
      on: () => {
        console.log("[Scene] 切换到: 机械断续 (Robotic)");

        setRate(1.0, 1);

        const bit = MusicFXModule.getEffect("bitCrusher");
        if (bit) {
          setParam(bit, "bits", 8);
          setParam(bit, "wet", 0.15, 0.2);
        }

        const trem = MusicFXModule.getEffect("tremolo");
        if (trem) {
          setParam(trem, "frequency", 10);
          setParam(trem, "type", "sine");
          setParam(trem, "depth", 1.0);
          setParam(trem, "wet", 0.2, 0.2);
        }
      },
      off: () => resetAllEffects()
    },
    glitch: {
      on: () => {
        console.log("[Scene] 切换到: 故障感 (Glitch)");

        setRate(1.02, 5);

        const pan = MusicFXModule.getEffect("autoPanner");
        if (pan) {
          setParam(pan, "frequency", 50);
          setParam(pan, "depth", 1);
          setParam(pan, "wet", 0.3, 0.1);
        }

        const bit = MusicFXModule.getEffect("bitCrusher");
        if (bit) {
          setParam(bit, "bits", 6);
          setParam(bit, "wet", 0.2, 0.1);
        }
      },
      off: () => resetAllEffects()
    },
    psychedelic: {
      on: () => {
        console.log("[Scene] 切换到: 迷幻感 (Psychedelic)");

        setRate(0.99, 5);

        const pan = MusicFXModule.getEffect("autoPanner");
        if (pan) {
          setParam(pan, "frequency", 0.5);
          setParam(pan, "depth", 1);
          setParam(pan, "wet", 0.5, 2);
        }

        const chorus = MusicFXModule.getEffect("chorus");
        if (chorus) {
          setParam(chorus, "frequency", 0.2);
          setParam(chorus, "depth", 1);
          setParam(chorus, "wet", 0.7, 2);
        }
      },
      off: () => resetAllEffects()
    },
    memory: {
      on: () => {
        console.log("[Scene] 切换到: 内心独白 (Memory)");

        setRate(0.985, 5);

        const rev = MusicFXModule.getEffect("jcReverb");
        if (rev) {
          setParam(rev, "roomSize", 0.6);
          setParam(rev, "wet", 0.1, 3);
        }

        const eq = MusicFXModule.getEffect("eq3");
        if (eq) {
          setParam(eq, "high", -7, 3);
          setParam(eq, "mid", 3, 3);
        }
      },
      off: () => resetAllEffects()
    },
    test1: {
      on: () => {
        console.log("[Scene] 切换到: 冰雪长空 ");
        setRate(1, 5); // 慢动作的宏大感

        const highpass = MusicFXModule.getEffect("highpass");
        if (highpass) {
          setParam(highpass, "frequency", 500, 2); // 切掉 500Hz 以下的低频
          setParam(highpass, "Q", 2, 2);
        }
        // EQ: 切掉低频(鼓点)，挖空中频(弦乐律动)，大幅提亮高频(主旋律)
        const eq = MusicFXModule.getEffect("eq3");
        if(eq) { 
          setParam(eq, "low", -30, 1); 
          setParam(eq, "mid", 2, 1); 
          setParam(eq, "high", 3, 1); 
        }

        const rev = MusicFXModule.getEffect("jcReverb");
        if(rev) { 
          setParam(rev, "roomSize", 0.7); 
          setParam(rev, "wet", 0.05, 1); // 极低混合度
        }

        // 延迟 (新主角): 4分音符的慢速回声
        const delay = MusicFXModule.getEffect("feedbackDelay");
        if(delay) {
          setParam(delay, "delayTime", "2n"); // 慢速 (从容感)
          setParam(delay, "feedback", 0.45);   // 只有 2-3 次回声
          setParam(delay, "wet", 0.2, 1);    // 适量混合，营造远距离反射
        }

        // // 宽度: 稍微收一点，防止相位混乱导致的"晕"
        const wide = MusicFXModule.getEffect("stereoWidener");
        if(wide) { setParam(wide, "width", 0.8); setParam(wide, "wet", 1, 1); }
        
      },
      off: () => resetAllEffects()
    },
    test2: {
      on: () => {
        console.log("[Scene] 切换到: 悬崖峭壁");
        // 空场景，用于自定义测试
// 第一阶段：10s-15s (冷风吹脸)
    // 只有高频噪音（风声）和刺骨感
    const highpass = MusicFXModule.getEffect("highpass");
    if (highpass) {
      setParam(highpass, "frequency", 1000, 2); // 进一步收窄，声音变得很细很尖
      setParam(highpass, "Q", 4, 2); // 加共振，模拟风哨声
    }
    
    

    // 恢复 EQ，让声音更真实一点
    const eq = MusicFXModule.getEffect("eq3");
    if (eq) {
        setParam(eq, "high", 8, 1); // 刺耳的高频
        setParam(eq, "mid", 0, 1);
        setParam(eq, "low", -10, 1);
    }
    const trem = MusicFXModule.getEffect("tremolo");
    if (trem) {
      // 6Hz 大约是每秒6次，相当于心率 360bpm (极度惊恐)
      // 这个频率非常具有生理压迫感
      setParam(trem, "frequency", 6, 1); 
      setParam(trem, "depth", 0.7, 1);   // 深度大一点，让断续感明显
      setParam(trem, "wet", 0.3, 1);     // 混入比重
    }
// 3. 模拟“恐高眩晕”
    const vib = MusicFXModule.getEffect("vibrato");
    if (vib) {
      setParam(vib, "frequency", 0.5, 1); // 很慢的晃动
      setParam(vib, "depth", 0.15, 1);    // 音高轻微偏移，让人站不稳
      setParam(vib, "wet", 0.05, 1);
    }

    // 4. 声场失控
    const autoPan = MusicFXModule.getEffect("autoPanner");
    if (autoPan) {
       setParam(autoPan, "frequency", 0.2); // 声音缓慢在左右耳飘忽
       setParam(autoPan, "wet", 0.05, 1);
    }
      },
      off: () => resetAllEffects()
    },
    test3: {
      on: () => {
        console.log("[Scene] 切换到: 失足坠落 ");

    // 1. 时间膨胀/子弹时间 (核心)
    // 瞬间把播放速度和音高降下来，制造“脑子一片空白”的效果
    setRate(1, 0.5); // 0.5秒内降到半速，那种被拉长的声音非常带感

    // 2. 制造“风压”和“闷罐感”
    // 使用你独立定义的 lowpass
    const lp = MusicFXModule.getEffect("lowpass");
    if (lp) {
      // 快速压到 300Hz，模拟耳朵被风压堵住的感觉
      setParam(lp, "frequency", 400, 0.2); 
      setParam(lp, "Q", 1, 2); // 这里不需要太多共振，要实打实的闷
    }

    // 3. 增加空气摩擦的“撕裂感”
    const dist = MusicFXModule.getEffect("distortion");
    if (dist) {
      setParam(dist, "distortion", 0.8); // 高失真，模拟极限状态
      setParam(dist, "wet", 0.1, 0.2);   // 混入30%的撕裂声
    }

    // 4. 立体声极度拉宽
    // 坠落时，人失去了方向感，声音应该从四面八方包裹过来
    const widener = MusicFXModule.getEffect("stereoWidener");
    if (widener) {
      setParam(widener, "width", 1, 0.2); // 拉满
    }
      },
      off: () => resetAllEffects()
    },
    test4: {
      on: () => {
        console.log("[Scene] 切换到: 测试场景4 (Test Scenario 4)");
        // 空场景，用于自定义测试
        console.log("[Scene] 切换到: 深入敌后 ");

    // 1. 制造“死寂感” (核心)
    // 雪地是天然的吸音材料。我们需要切掉高频的“空气感”，让声音变得很“干”。
    // 使用 LowPass (低通)，但不要像水下那么闷，要保留分辨脚步声的中频。
    const lp = MusicFXModule.getEffect("lowpass");
    if (lp) {
      setParam(lp, "frequency", 700, 2); // 700Hz 是一个临界点，能听到动静但听不清细节
      setParam(lp, "Q", 0.5, 2); // Q值设低！这里不要共振，要那种平滑、自然的衰减
    }
    
    

    // 2. 收缩声场 (Tunnel Vision)
    // 紧张潜行时，人的注意力会聚焦在正前方，无视周边的环境音。
    const widener = MusicFXModule.getEffect("stereoWidener");
    if (widener) {
      setParam(widener, "width", 0.2, 2); // 极度收窄，接近单声道，声音聚在眉心
    }

    // 3. 彻底干掉混响 (Anechoic)
    // 在雪地或室内近距离接触，没有空间反射。
  
    
    // 4. 动态控制
    // 稍微压一下，让细微的声音也能听见，保持一种紧绷的平稳
    const comp = MusicFXModule.getEffect("compressor");
    if (comp) {
        setParam(comp, "threshold", -25, 1);
        setParam(comp, "ratio", 3, 1);
    }
      },
      off: () => resetAllEffects()
    },
    test5: {
      on: () => {
        console.log("[Scene] 切换到: 测试场景5 (Test Scenario 5)");
        // 空场景，用于自定义测试
        console.log("[Scene] 切换到: 危机四伏");

    // 1. 模拟生理性恐惧 (Tremolo - 核心)
    // 呼应心跳检测器的节奏，以及人在极度紧张时的耳鸣/脉搏声。
    const trem = MusicFXModule.getEffect("tremolo");
    if (trem) {
      setParam(trem, "frequency", 4, 0.5); // 4Hz = 240bpm，非常急促的脉搏
      setParam(trem, "depth", 0.45, 0.5);  // 切得很深，制造很强的“阻断感”
      setParam(trem, "wet", 0.3, 1);
    }

    // 2. 模拟电子干扰/神经错乱 (BitCrusher)
    // 对应显示屏上的雪花点和红点，以及脑子里的杂音。
    // const dist = MusicFXModule.getEffect("distortion");
    //     if (dist) {
    //       // 2. 修正失真：点到为止
    //       setParam(dist, "distortion", 0.5); // 原0.8 -> 0.5 (降低硬度)
    //       setParam(dist, "wet", 0.1, 0.2);   // 原0.4 -> 0.2 (融入背景)
    //     }

        // const tremolo = MusicFXModule.getEffect("tremolo");
        // if (tremolo) {
        //   setParam(tremolo, "frequency", 10, 0.5);
        //   setParam(tremolo, "depth", 0.8, 0.5);
        //   setParam(tremolo, "wet", 0.3, 0.5);
        // }

        const delay = MusicFXModule.getEffect("feedbackDelay");
        if (delay) {
          setParam(delay, "delayTime", "8n");
          setParam(delay, "feedback", 0.15, 0.5); // 原0.6 -> 0.15 (只重复一下，像心慌)
          setParam(delay, "wet", 0.2, 0.5);       // 原0.4 -> 0.2 (微量)
        }

    // 3. 频段挤压 (EQ) - 制造“胸闷”
    // 我们要提升那些让人不舒服的频段 (低频和中低频)。
    const eq = MusicFXModule.getEffect("eq3");
    if (eq) {
      setParam(eq, "low", 0, 1);    // 最多加 2dB，或者干脆给 0
      setParam(eq, "mid", -2, 1);   // 衰减一点中频
      setParam(eq, "high", -15, 1); // 大幅衰减高频！这能消除沙沙声，并带来极致的压抑感
    }

    // 4. 滤波器状态调整
    // 这里的 Filter 既不能全开(太亮)，也不能太闷(太安逸)。
    // 我们用 LowPass 稍微放开一点，让 BitCrusher 的高频噪音透出来一点点，像漏气一样。
    const lp = MusicFXModule.getEffect("lowpass");
    if (lp) {
       setParam(lp, "frequency", 2000, 1); // 比刚才的潜行要亮一点，为了听到危险
       setParam(lp, "Q", 2, 1); // 加一点点峰值，增加不安定的感觉
    }
    
    // 5. 恢复一点声场
    // 敌人从四面八方来，声场需要稍微打开一点，不能像刚才那么窄
    const widener = MusicFXModule.getEffect("stereoWidener");
    if (widener) {
        setParam(widener, "width", 0.4, 1);
    }
      },
      off: () => resetAllEffects()
    },
    test6: {
      on: () => {
        console.log("[Scene] 切换到: 测试场景6 (杀出重围!)");
        // 空场景，用于自定义测试
        setRate(1.0, 1);
        const comp = MusicFXModule.getEffect("compressor");
        if (comp) {
          setParam(comp, "threshold", -20, 1); // 压得更深
          setParam(comp, "ratio", 10, 1);       // 稍微用力
          setParam(comp, "attack", 0.1, 1);    // 【关键】慢启动，保留冲击力
          setParam(comp, "release", 0.1, 1);   // 快释放
        }
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
    test7: {
      on: () => {
        console.log("[Scene] 切换到: 测试场景7 (Test Scenario 7)");
        // 空场景，用于自定义测试
        console.log("[Scene] 切换到: 中弹/仓皇逃离 (耳鸣/解离)");

    // 1. 模拟重伤踉跄 (变调变速)
    // 身体变沉重，时间流逝感变慢。
    setRate(1, 2); 

    // 2. 模拟“耳鸣”与“听力丧失” (LowPass + High Q) - 核心魔法
    // 我们关掉高频，模拟耳朵被打蒙了。
    // 【关键】把 Q 值拉得非常高！这会在截止频率处产生强烈的自激啸叫，
    // 这就是最逼真的“耳鸣声”，而不需要额外的音源。
    const lowpass = MusicFXModule.getEffect("lowpass");
    if (lowpass) {
      setParam(lowpass, "frequency", 600, 2); // 瞬间蒙住耳朵
      setParam(lowpass, "Q", 8, 2); // Q值设为15！会在 600Hz 处产生持续的“嗡——”声
    }

    // 3. 模拟“意识模糊/离体感” (Delay)
    // 声音此时不应该干脆，而应该有拖影，像喝醉了一样。
    const delay = MusicFXModule.getEffect("feedbackDelay");
    if (delay) {
      setParam(delay, "delayTime", 0.25, 1); // 明显的延迟
      setParam(delay, "feedback", 0.6, 1);   // 长尾巴
      setParam(delay, "wet", 0.2, 1);        // 湿声很大，现实感抽离
    }

    // 4. 模拟“疼痛的撕裂感” (Distortion)
    // 这种失真不是为了酷，是为了让每一声响动都带着刺痛。
    const dist = MusicFXModule.getEffect("distortion");
    if (dist) {
      setParam(dist, "distortion", 0.6); // 比较脏的失真
      setParam(dist, "wet", 0.1, 1);
    }

    // 5. 模拟“站立不稳/眩晕” (Vibrato)
    const vib = MusicFXModule.getEffect("vibrato");
    if (vib) {
      setParam(vib, "frequency", 2, 1);  // 较快的晃动
      setParam(vib, "depth", 0.2, 1);    // 音高飘忽不定
      setParam(vib, "wet", 0.1, 1);
    }
    
    // 6. 甚至可以让声场彻底乱掉 (AutoPanner)
    const panner = MusicFXModule.getEffect("autoPanner");
    if (panner) {
        setParam(panner, "frequency", 1); // 声音在脑袋里转圈
        setParam(panner, "depth", 1);
        setParam(panner, "wet", 0.1, 1);
    }
    
    // 7. 必须关掉压缩器的“爽感”
    // 受伤时听觉是脆弱的，不需要Punchy的感觉
    const comp = MusicFXModule.getEffect("compressor");
    if (comp) {
        setParam(comp, "ratio", 1, 1); // 关掉压缩
        setParam(comp, "threshold", 0, 1);
    }
      },
      off: () => resetAllEffects()
    },
    test8: {
      on: () => {
        console.log("[Scene] 切换到: 测试场景8 (Test Scenario 8)");
        // 空场景，用于自定义测试
        console.log("[Scene] 切换到: 雪地摩托激战 (极速/噪点)");

    // 1. 速度感依然重要
    setRate(1.0, 1); 

    // 2. 高通滤波器 (HighPass) - 去除引擎轰鸣的淤泥感
    // 摩托车引擎有很重的低频，为了不和音乐的贝斯打架，我们要切掉一点点超低频
    const hp = MusicFXModule.getEffect("highpass");
    if (hp) {
      setParam(hp, "frequency", 150, 1); // 切掉 150Hz 以下，让低频更干净有力
      setParam(hp, "Q", 1, 1);
    }
    
   
    

    // 4. 比特破碎 (BitCrusher) - 关键的“机械质感”
    // 这里加一点点破碎，会让声音听起来像是从对讲机或者被引擎震动干扰的耳朵里听到的
    // 这会增加一种“粗粝”的战斗感
    const crusher = MusicFXModule.getEffect("bitCrusher");
    if (crusher) {
      setParam(crusher, "bits", 8, 1); // 8bit 轻微破碎
      setParam(crusher, "wet", 0.15, 1); 
    }

    // 5. 立体声加宽 - 模拟两侧飞退的景物
    const widener = MusicFXModule.getEffect("stereoWidener");
    if (widener) {
      setParam(widener, "width", 0.9, 1); // 很宽，风从两边过
    }

    // 6. EQ 提亮 - 强调金铁交鸣声
    const eq = MusicFXModule.getEffect("eq3");
    if (eq) {
      setParam(eq, "low", 0, 1);
      setParam(eq, "mid", 3, 1); // 提升中频，让枪声和撞击声更突出
      setParam(eq, "high", 4, 1); // 提升高频，强化速度感
    }
      },
      off: () => resetAllEffects()
    },
    test9: {
      on: () => {
        console.log("[Scene] 切换到: 测试场景9 (Test Scenario 9)");
        // 空场景，用于自定义测试

    

        console.log("[Scene] 切换到: 飞越山崖 (音墙/力量)");

        // 1. 速度慢下来，但不要太慢，保留一点动能
        setRate(1, 2); 
    
        // 2. 【核心】EQ 不再微笑，而是像一堵墙 (Brick Wall)
        const eq = MusicFXModule.getEffect("eq3");
        if (eq) {
          setParam(eq, "low", 2, 1);    // 巨大的低频冲击
          setParam(eq, "mid", 3, 1);    // 【关键】提升中频！这是铜管乐器的力量所在
          setParam(eq, "high", 2, 1);   // 高频稍微给一点，保持清晰，但不要太多以免刺耳
        }
    
        // 3. 【核心】饱和度染色 (Saturation)
        // 我们需要 Distortion 回归，但只要一点点，作为“增厚剂”
        const dist = MusicFXModule.getEffect("distortion");
        if (dist) {
          setParam(dist, "distortion", 0.2); // 20% 的失真，增加谐波厚度
          setParam(dist, "wet", 0.05, 1);     // 稍微混一点进去，让声音变“宽”变“厚”
        }
    
        // 4. 压缩器 - 甚至可以用作“增益器”
        // 我们要制造那种“声音大到快要溢出来”的感觉
        const comp = MusicFXModule.getEffect("compressor");
        if (comp) {
           setParam(comp, "threshold", -15, 1); // 压得很深
           setParam(comp, "ratio", 8, 1);       // 强力压缩
           setParam(comp, "attack", 0.01, 1);   // 快启动，要把声音拍扁
           setParam(comp, "release", 0.2, 1);   // 让声音像墙一样推过来
           // 注意：如果 Tone.js 自动补增益，这会非常响。这正是我们要的。
        }
    
        // 5. 混响 - 只要“大”不要“远”
        // 之前的 wet 太大(0.4)会导致声音变远。我们要声音贴脸，但有尾音。
        // const rev = MusicFXModule.getEffect("jcReverb");
        // if (rev) {
        //   setParam(rev, "roomSize", 0.8, 2);
        //   setParam(rev, "wet", 0.1, 2); // 降低湿声比例，保证声音的“实体感”
        // }
        const chorus = MusicFXModule.getEffect("chorus");
        if (chorus) {
          // 3. 修正合唱：让它作为"宽底座"而不是特效
          setParam(chorus, "frequency", 0.5);
          setParam(chorus, "depth", 0.8); // 稍微减小深度，防止高音发飘
          setParam(chorus, "wet", 0.2, 1); // 稍微减小音量，不抢戏
        }
       
        // 7. 立体声稍微收一点，聚焦力量
        // 太宽(0.9)会散，0.5-0.6 能让力量集中在眉心
        const widener = MusicFXModule.getEffect("stereoWidener");
        if (widener) {
          setParam(widener, "width", 0.3, 1); 
        }
      },
      off: () => resetAllEffects()
    },
    test10: {
      on: () => {
        console.log("[Scene] 切换到: 测试场景10 (Test Scenario 10)");
        // 空场景，用于自定义测试
        console.log("[Scene] 切换到: 雪地漫步 (寒冷/吸音/孤寂)");

    setRate(1.0, 1); 

    // 1. 【核心】滤波器：切掉“温度”
    // 温暖感来自 200Hz 以下的低频。
    // 我们用 HighPass Filter 把这部分切掉，声音瞬间就变“冷”变“瘦”了。
    const hp = MusicFXModule.getEffect("highpass");
    if (hp) {
      setParam(hp, "frequency", 600, 2); // 切掉 350Hz 以下，只留中高频
      setParam(hp, "Q", 1, 1);
    }
    
   
    

    // 2. EQ：制造“冷脆感”
    // 你的 High +2 是对的，但 Low 要切得更狠。
    const eq = MusicFXModule.getEffect("eq3");
    if (eq) {
      setParam(eq, "low", -20, 1);  // 彻底不要低频，消除任何暖意
      setParam(eq, "mid", -5, 1);   // 稍微挖一点中频，增加空旷感
      setParam(eq, "high", 3, 1);   // 【关键】提升高频，模拟冷空气的清晰度
    }
    const rev = MusicFXModule.getEffect("jcReverb");
    if (rev) {
      setParam(rev, "roomSize", 0.1, 1); // 极小的空间（像冰层表面）
      setParam(rev, "wet", 0.1, 1);     // 给一点点光泽感
    }

    // 4. BitCrusher：模拟“冰晶/脚踏声”
    // 这里我们用一点点失真来模拟踩在雪上的那种“咯吱咯吱”的颗粒感
    const bit = MusicFXModule.getEffect("bitCrusher");
    if (bit) {
      setParam(bit, "bits", 12);  // 12-14bit 产生轻微的霜冻感
      setParam(bit, "wet", 0.08, 1); // 不需要太多，一点点“毛刺”即可
    }

    // 5. 立体声：稍微加宽
    // 表现雪原的无边无际
    const widener = MusicFXModule.getEffect("stereoWidener");
    if (widener) {
      setParam(widener, "width", 1, 1); 
    }
      },
      off: () => resetAllEffects()
    },
    test11: {
      on: () => {
        console.log("[Scene] 切换到: 测试场景11 (Test Scenario 11)");
        // 空场景，留作后续自定义
        console.log("[Scene] 切换到: 炙热沙海 (热浪/扭曲/焦躁)");

    setRate(1.0, 1); 

    // 1. 【核心魔法】模拟“热浪扭曲” (Mirage Effect)
    // 你看到过夏天柏油路上空气那种扭曲的感觉吗？
    // 用 Vibrato (音高颤动) 来模拟这种光线的折射。
    // 这种微妙的走调会让管弦乐听起来像是被晒化了一样。
    const vib = MusicFXModule.getEffect("vibrato");
    if (vib) {
      setParam(vib, "frequency", 2, 1);   // 较慢的频率，像热空气缓缓上升
      setParam(vib, "depth", 0.15, 1);    // 深度不要太大，只要一点点“晕”的感觉
      setParam(vib, "wet", 0.2, 1);       // 混入这种不稳定的感觉
    }

    // 2. EQ：制造“刺眼感” (The Glare)
    // 寒冷是切低频提两头(V-shape)，而炎热是“中频突出”。
    // 2kHz - 5kHz 是人耳觉得最“吵”、最“硬”的频段。
    // 提升这里，声音会变得很有侵略性，像烈日当头照下来的压迫感。
    const eq = MusicFXModule.getEffect("eq3");
    if (eq) {
      setParam(eq, "low", -5, 1);   // 沙子是软的，不反射低频
      setParam(eq, "mid", 5, 1);    // 【关键】大幅提升中频！制造焦躁感
      setParam(eq, "high", -5, 1);  // 切掉高频的“空气感”，空气是浑浊且停滞的
    }

    // 3. 饱和度：模拟“被烤焦”的质感
    // 用一点点 Distortion 让声音变“脏”，模拟老式收音机在高温下工作的过载感。
    const dist = MusicFXModule.getEffect("distortion");
    if (dist) {
      setParam(dist, "distortion", 0.2); 
      setParam(dist, "wet", 0.15, 1); 
    }

    

    // 5. 滤波器：聚焦中段
    // 配合 EQ，我们把频段限制在中间，去掉两头的清爽感
    const hp = MusicFXModule.getEffect("highpass");
    if (hp) setParam(hp, "frequency", 200, 1);

    const lp = MusicFXModule.getEffect("lowpass");
    if (lp) setParam(lp, "frequency", 8000, 1); // 切掉极高频，让声音不那么通透
    
    // 6. 立体声：广阔的地平线
    const widener = MusicFXModule.getEffect("stereoWidener");
    if (widener) {
        setParam(widener, "width", 0.8, 1); // 保持宽广
    }
    
    
  
      },
      off: () => resetAllEffects()
    },
    test12: {
      on: () => {
        console.log("[Scene] 切换到: 测试场景12 (Test Scenario 12)");
        // 空场景，留作后续自定义
        console.log("[Scene] 切换到: 幽邃矿洞 (狭窄/回声/压抑)");

    setRate(1.0, 1); 

    // 1. 【核心】立体声极度收窄 (The Squeeze)
    // 既然是“狭窄”的山洞，声音就不能从很宽的地方传过来。
    // 把声场收缩到 0.3 - 0.4，你会立刻感觉到两侧墙壁逼近了你的耳朵。
    // 这是制造“幽闭恐惧症”最直接的手段。
    const widener = MusicFXModule.getEffect("stereoWidener");
    if (widener) {
      setParam(widener, "width", 0.3, 2); 
    }

    // 2. 滤波器：只切高频，不切低频
    // 你的原版 high: -40 太极端了，会听不清旋律。
    // 我们用 LowPass 切到 1000Hz，保留山洞的浑浊感，但不要完全闷死。
    const lp = MusicFXModule.getEffect("lowpass");
    if (lp) {
      setParam(lp, "frequency", 1000, 2); 
      setParam(lp, "Q", 1, 1);
    }
    

    // 3. EQ：制造“箱体共鸣” (Boxiness)
    // 狭窄空间的特征是中低频突出（轰隆隆的感觉）。
    // 之前的 low: -5 是错的，那会让山洞变得像纸盒子一样薄。
    // 我们要提升 Low，切掉 High。
    const eq = MusicFXModule.getEffect("eq3");
    if (eq) {
      setParam(eq, "low", 2, 1);    // 提升低频，制造压抑的轰鸣
      setParam(eq, "mid", 1, 1);    // 提升中频，制造浑浊感
      setParam(eq, "high", -10, 1); // 再次确认压暗高频
    }

    // 4. 【秘密武器】短延迟 (Slapback Delay)
    // 这是区分“被窝”和“岩洞”的关键。
    // 岩石是硬反射面。声音打在近处的墙上弹回来，会形成极短的金属质感回声。
    const delay = MusicFXModule.getEffect("feedbackDelay");
    if (delay) {
      setParam(delay, "delayTime", 0.1, 1); // 0.1秒的短延迟
      setParam(delay, "feedback", 0.3, 1);  // 稍微有一点拖尾
      setParam(delay, "wet", 0.2, 1);       // 明显的反射声
    }

    // 5. 混响：从小房间变成长隧道
    // roomSize 不要太小。虽然横向窄，但山洞通常很深。
    // 稍微大一点的 roomSize 配合短 Delay，能营造出“深邃但狭窄”的感觉。
    const rev = MusicFXModule.getEffect("jcReverb");
    if (rev) {
      setParam(rev, "roomSize", 0.5, 1); // 中等大小
      setParam(rev, "wet", 0.2, 1);      // 保持湿润感
    }
      },
      off: () => resetAllEffects()
    },
    test13: {
      on: () => {
        console.log("[Scene] 切换到: 测试场景13 (Test Scenario 13)");
        // 空场景，留作后续自定义
        console.log("[Scene] 切换到: 万圣节地牢 (诡异/幽灵/旧物)");

    // 1. 速度：稍微拖沓一点点
    // 0.95 的速度会让音乐有一种“赖着不走”的僵尸感，但又不至于太慢。
    setRate(0.975, 5); 

    // 2. 【核心魔法】幽灵般的走调 (Vibrato)
    // 这是万圣节风格的精髓！
    // 想象一下那种泰勒明琴（Theremin）或者鬼叫的声音，都是飘忽不定的。
    const vib = MusicFXModule.getEffect("vibrato");
    if (vib) {
      setParam(vib, "frequency", 3, 1);   // 3Hz，不快不慢，像幽灵的呜咽
      setParam(vib, "depth", 0.15, 1);    // 深度适中，让音高明显偏离，产生不协和感
      setParam(vib, "wet", 0.3, 1);       // 混入 30%，给整个BGM蒙上一层“鬼气”
    }

    // 3. 颤抖的灯光 (Tremolo)
    // 保留你之前喜欢的 Tremolo，这模拟了地牢里忽明忽暗的火把，或者因为寒冷而发抖。
    const trem = MusicFXModule.getEffect("tremolo");
    if (trem) {
      setParam(trem, "frequency", 2, 1);  // 保持你喜欢的 2Hz
      setParam(trem, "depth", 0.6, 1);    // 稍微调浅一点点，让它作为背景
      setParam(trem, "wet", 0.2, 1);      // 作为点缀
    }

    // 4. 陈旧的质感 (BitCrusher)
    // 这里的 BitCrusher 不是为了破碎，而是为了模拟“灰尘感”和“蜘蛛网”。
    // 就像老电影胶片的底噪。
    const bit = MusicFXModule.getEffect("bitCrusher");
    if (bit) {
      setParam(bit, "bits", 10, 1);  // 10bit 比较柔和，有一点点Lo-Fi的感觉
      setParam(bit, "wet", 0.1, 1);  // 只有一点点灰尘味
    }

    // 5. 地牢空间 (Reverb)
    // 万圣节地牢通常是空旷的石室。
    const rev = MusicFXModule.getEffect("jcReverb");
    if (rev) {
      setParam(rev, "roomSize", 0.7, 1); // 较大的空间
      setParam(rev, "wet", 0.2, 1);     // 有明显的回声，制造阴森感
    }

    // 6. EQ：诡异的中高频
    // 这里的 EQ 既不冷（高频多）也不热（中频多）。
    // 我们要切掉低频（让怪物没脚步声，像幽灵一样飘），
    // 并稍微保留一点中高频的“塑料感/玩具感”。
    const eq = MusicFXModule.getEffect("eq3");
    if (eq) {
      setParam(eq, "low", -10, 1);  // 切掉低频，声音变轻、变飘
      setParam(eq, "mid", 2, 1);    // 稍微提一点中频，像旧广播
      setParam(eq, "high", -5, 1);  // 稍微压暗，制造陈旧感
    }
      },
      off: () => resetAllEffects()
    },
    test14: {
      on: () => {
        console.log("[Scene] 切换到: 测试场景14 (Test Scenario 14)");
        // 空场景，留作后续自定义
      },
      off: () => resetAllEffects()
    },
    test15: {
      on: () => {
        console.log("[Scene] 切换到: 测试场景15 (Test Scenario 15)");
        // 空场景，留作后续自定义
      },
      off: () => resetAllEffects()
    },
    test16: {
      on: () => {
        console.log("[Scene] 切换到: 测试场景16 (Test Scenario 16)");
        // 空场景，留作后续自定义
      },
      off: () => resetAllEffects()
    },
    test17: {
      on: () => {
        console.log("[Scene] 切换到: 测试场景17 (Test Scenario 17)");
        // 空场景，留作后续自定义
      },
      off: () => resetAllEffects()
    },
    test18: {
      on: () => {
        console.log("[Scene] 切换到: 测试场景18 (Test Scenario 18)");
        // 空场景，留作后续自定义
      },
      off: () => resetAllEffects()
    },
    test19: {
      on: () => {
        console.log("[Scene] 切换到: 测试场景19 (Test Scenario 19)");
        // 空场景，留作后续自定义
      },
      off: () => resetAllEffects()
    },
    test20: {
      on: () => {
        console.log("[Scene] 切换到: 测试场景20 (Test Scenario 20)");
        // 空场景，留作后续自定义
      },
      off: () => resetAllEffects()
    },
    test: {
      on: () => {
        console.log("[Scene] 切换到: 测试场景 (Test Scenario)");

        // 该场景专用于单独调试任意效果参数
        // 默认示例：调节 JCReverb 作为占位，请根据需要修改
        setRate(1, 5); // 慢动作的宏大感

        const highpass = MusicFXModule.getEffect("highpass");
        if (highpass) {
          setParam(highpass, "frequency", 500, 2); // 切掉 500Hz 以下的低频
          setParam(highpass, "Q", 2, 2);
        }
        // EQ: 切掉低频(鼓点)，挖空中频(弦乐律动)，大幅提亮高频(主旋律)
        const eq = MusicFXModule.getEffect("eq3");
        if(eq) { 
          setParam(eq, "low", -30, 1); 
          setParam(eq, "mid", 2, 1); 
          setParam(eq, "high", 3, 1); 
        }

        const rev = MusicFXModule.getEffect("jcReverb");
        if(rev) { 
          setParam(rev, "roomSize", 0.7); 
          setParam(rev, "wet", 0.05, 1); // 极低混合度
        }

        // 延迟 (新主角): 4分音符的慢速回声
        const delay = MusicFXModule.getEffect("feedbackDelay");
        if(delay) {
          setParam(delay, "delayTime", "2n"); // 慢速 (从容感)
          setParam(delay, "feedback", 0.45);   // 只有 2-3 次回声
          setParam(delay, "wet", 0.2, 1);    // 适量混合，营造远距离反射
        }

        // // 宽度: 稍微收一点，防止相位混乱导致的"晕"
        const wide = MusicFXModule.getEffect("stereoWidener");
        if(wide) { setParam(wide, "width", 0.8); setParam(wide, "wet", 1, 1); }
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


