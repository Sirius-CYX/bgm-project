// 确保在点击页面后启动 Tone.js
document.documentElement.addEventListener("click", () => {
  if (Tone.context.state === "suspended") {
    Tone.context.resume();
  }
});

// ===================================
//  PART 1: 播放器和主增益 (全局)
// ===================================
let player = null;
let masterGain = null;

// DOM 元素
const audioUpload = document.getElementById("audioUpload");
const playButton = document.getElementById("play");
const stopButton = document.getElementById("stop");
const statusText = document.getElementById("status");

// ===================================
//  PART 2: 音乐效果器模块 (MusicFXModule)
// ===================================
const MusicFXModule = (function() {
  
  // --- 内部私有变量 ---
  let _allEffects = {
    distortion: null,
    chorus: null,
    delay: null,
    reverb: null
  };
  
  // (新) 效果器激活状态追踪
  let _activeEffectsState = {
    distortion: false,
    chorus: false,
    delay: false,
    reverb: false
  };
  
  // 效果链顺序
  let _effectOrder = [
    "distortion", // 1. 失真
    "chorus",     // 2. 调制
    "delay",      // 3. 延迟
    "reverb"      // 4. 空间
  ];
  
  let _player = null;
  let _masterGain = null;
  
  // --- 内部私有函数 ---
  
  /**
   * (修改) 创建节点，设置合理的默认参数
   * wet 值现在是预设值，只有当效果器被激活时才生效
   */
  function _initializeNodes() {
    console.log("MusicFXModule: 正在初始化 4 个节点...");
    
    // 1. Distortion (失真)
    _allEffects.distortion = new Tone.Distortion({ 
      distortion: 0.4, 
      wet: 0.25  // 预设值，激活时使用
    });
    
    // 2. Chorus (合唱)
    _allEffects.chorus = new Tone.Chorus({ 
      frequency: 10,  // 摇摆频率
      delayTime: 0.1,
      depth: 0.9,
      spread: 180,    // 立体声扩散
      wet: 0.3       // 预设值，激活时使用
    });
    
    // 3. Delay (延迟)
    _allEffects.delay = new Tone.FeedbackDelay({
      delayTime: "8n",  // 延迟时间（8分音符）
      feedback: 0.2,    // 反馈量
      wet: 0.3          // 预设值，激活时使用
    });
    
    // 4. JCReverb (混响)
    _allEffects.reverb = new Tone.JCReverb({ 
      roomSize: 0.3,  // 房间大小
      wet: 0.3        // 预设值，激活时使用
    });
    
    console.log("MusicFXModule: 节点初始化完毕。");
  }
  
  /**
   * (新) 核心函数：动态重建音频链
   * 根据 _activeEffectsState 动态连接/断开效果器
   */
  function _rebuildAudioChain() {
    console.log("MusicFXModule: 正在重建音频链...");
    
    // 1. 过滤出所有"激活"的效果器
    const activeEffectNames = _effectOrder.filter(name => {
      return _activeEffectsState[name] === true;
    });
    
    // 2. 映射到真正的 Tone.js 节点实例
    const nodesToChain = activeEffectNames
        .map(name => _allEffects[name])
        .filter(node => node !== null);
    
    // 3. 断开 MasterGain 的所有下游连接，准备重组
    _masterGain.disconnect();
    
    // 4. 建立新的链
    if (nodesToChain.length > 0) {
      // 动态链：MasterGain -> [Effect 1] -> [Effect 2] -> ... -> Destination
      console.log("激活的路径:", `MasterGain -> ${activeEffectNames.join(" -> ")} -> Destination`);
      _masterGain.chain(...nodesToChain, Tone.Destination);
    } else {
      // 纯净路径：MasterGain -> Destination
      console.log("激活的路径: MasterGain -> Destination (纯净路径)");
      _masterGain.toDestination();
    }
  }
  
  // --- 模块公开接口 (API) ---
  return {
    
    /**
     * API 1: 初始化模块 (已修改)
     * 只创建节点，不连接效果器，使用纯净路径
     */
    init: function(playerNode, gainNode) {
      _player = playerNode;
      _masterGain = gainNode;
      
      _initializeNodes(); // 创建所有"积木"
      
      _player.connect(_masterGain); // 播放器 -> 主增益 (永久)
      
      // (修改) 初始化时，设置"纯净路径"
      _rebuildAudioChain();
      
      console.log("MusicFXModule: 动态链已初始化 (纯净路径)。");
    },
    
    /**
     * (新) API 2: 切换效果器开关
     */
    toggleEffect: function(effectName, state) {
      if (_activeEffectsState[effectName] === state) {
        return; // 状态未改变，无需操作
      }
      
      if (_activeEffectsState[effectName] !== undefined) {
        _activeEffectsState[effectName] = state;
        console.log(`MusicFXModule: ${effectName} 设置为 ${state ? 'ON' : 'OFF'}`);
        _rebuildAudioChain(); // 触发重建！
      } else {
        console.warn(`未找到名为 ${effectName} 的效果器状态`);
      }
    },
    
    /**
     * API 3: 【核心】获取效果器节点
     * (功能不变，用于参数调节)
     */
    getEffect: function(effectName) {
      if (!_allEffects[effectName]) {
        console.warn(`未找到名为 ${effectName} 的效果器`);
        return null;
      }
      return _allEffects[effectName];
    },
    
    /**
     * API 4: 【测试】打印当前状态 (已修改)
     * 基于激活状态而不是 wet 值
     */
    logCurrentState: function() {
      console.log("--- 音乐效果器当前状态 (动态链) ---");
      let hasActiveEffect = false;
      
      for (const name of _effectOrder) {
        const effect = _allEffects[name];
        if (!effect) continue;
        
        // 检查激活状态（而不是 wet 值）
        if (_activeEffectsState[name]) {
          hasActiveEffect = true;
          let params = [];
          
          // 获取 wet 值
          if (effect.wet) {
            const wetValue = typeof effect.wet === 'object' && effect.wet.value !== undefined 
              ? effect.wet.value 
              : effect.wet;
            params.push(`wet: ${wetValue.toFixed(2)}`);
          }
          
          // 添加效果器特定的参数
          if (name === "distortion" && effect.distortion) {
            params.push(`distortion: ${effect.distortion.toFixed(2)}`);
          }
          if (name === "reverb" && effect.roomSize) {
            const roomSizeValue = typeof effect.roomSize === 'object' && effect.roomSize.value !== undefined 
              ? effect.roomSize.value 
              : effect.roomSize;
            params.push(`roomSize: ${roomSizeValue.toFixed(2)}`);
          }
          if (name === "chorus") {
            if (effect.depth) {
              const depthValue = typeof effect.depth === 'object' && effect.depth.value !== undefined 
                ? effect.depth.value 
                : effect.depth;
              params.push(`depth: ${depthValue.toFixed(2)}`);
            }
            if (effect.frequency) {
              const freqValue = typeof effect.frequency === 'object' && effect.frequency.value !== undefined 
                ? effect.frequency.value 
                : effect.frequency;
              params.push(`frequency: ${freqValue.toFixed(2)}Hz`);
            }
            if (effect.delayTime) {
              const delayTimeValue = typeof effect.delayTime === 'object' && effect.delayTime.value !== undefined 
                ? effect.delayTime.value 
                : effect.delayTime;
              params.push(`delayTime: ${delayTimeValue.toFixed(3)}`);
            }
            if (effect.spread) {
              const spreadValue = typeof effect.spread === 'object' && effect.spread.value !== undefined 
                ? effect.spread.value 
                : effect.spread;
              params.push(`spread: ${spreadValue.toFixed(2)}`);
            }
          }
          if (name === "delay") {
            if (effect.delayTime) {
              const delayTime = typeof effect.delayTime === 'string' 
                ? effect.delayTime 
                : (typeof effect.delayTime === 'object' && effect.delayTime.value !== undefined
                  ? (typeof effect.delayTime.value === 'string' ? effect.delayTime.value : effect.delayTime.value.toFixed(3) + 's')
                  : effect.delayTime.toFixed(3) + 's');
              params.push(`delayTime: ${delayTime}`);
            }
            if (effect.feedback) {
              const feedbackValue = typeof effect.feedback === 'object' && effect.feedback.value !== undefined 
                ? effect.feedback.value 
                : effect.feedback;
              params.push(`feedback: ${feedbackValue.toFixed(2)}`);
            }
          }
          
          console.log(`[ON] ${name.toUpperCase()}: ${params.join(', ')}`);
        }
      }
      
      if (!hasActiveEffect) {
        console.log("所有效果器均已旁路 (纯净路径)");
      }
      console.log("---------------------------");
    }
  };
})(); // IIFE 立即执行，创建模块

// ===================================
//  PART 3: 播放器逻辑 (正确的 Transport 版本)
// ===================================
audioUpload.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  statusText.textContent = "正在加载音乐...";
  
  try {
    // 清理旧播放器
    if (player) {
      player.unsync();
      player.dispose();
    }
    Tone.Transport.stop();
    
    // 读取并解码音频文件
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await Tone.context.decodeAudioData(arrayBuffer);
    
    // 创建新播放器
    player = new Tone.Player(audioBuffer);
    
    // 创建主增益，用于防止数字削波
    masterGain = new Tone.Gain(0.85);
    
    // 将播放器同步到 Transport
    player.sync().start(0);
    
    // *** 核心步骤 ***
    // 初始化效果器模块，并把 player 和 masterGain 传给它
    MusicFXModule.init(player, masterGain);
    
    statusText.textContent = `加载成功: ${file.name} (动态链已激活)`;
    playButton.textContent = "播放";
    
  } catch (error) {
    console.error("加载失败:", error);
    statusText.textContent = "音频加载失败，请检查文件格式";
  }
});

playButton.addEventListener("click", () => {
  if (!player) {
    statusText.textContent = "请先上传音乐";
    return;
  }
  
  if (Tone.Transport.state === "started") {
    Tone.Transport.pause();
    statusText.textContent = "已暂停";
    playButton.textContent = "播放";
  } else {
    Tone.Transport.start();
    statusText.textContent = "正在播放...";
    playButton.textContent = "暂停";
  }
});

stopButton.addEventListener("click", () => {
  if (player) {
    Tone.Transport.stop();
    statusText.textContent = "已停止";
    playButton.textContent = "播放";
  }
});

// ===================================
//  PART 4: 测试按钮逻辑 (已重构)
// ===================================

// -- Distortion --
document.getElementById("test-dist-on").addEventListener("click", () => {
  MusicFXModule.toggleEffect("distortion", true);
  // (可选) 在"打开"时设置特定的 wet 值
  const dist = MusicFXModule.getEffect("distortion");
  if (dist) {
    dist.wet.rampTo(0.25, 0.1);
  }
  MusicFXModule.logCurrentState();
});

document.getElementById("test-dist-off").addEventListener("click", () => {
  MusicFXModule.toggleEffect("distortion", false);
  MusicFXModule.logCurrentState();
});

// -- Chorus --
document.getElementById("test-chorus-on").addEventListener("click", () => {
  MusicFXModule.toggleEffect("chorus", true);
  const chorus = MusicFXModule.getEffect("chorus");
  if (chorus) {
    chorus.wet.rampTo(0.3, 0.1);
  }
  MusicFXModule.logCurrentState();
});

document.getElementById("test-chorus-off").addEventListener("click", () => {
  MusicFXModule.toggleEffect("chorus", false);
  MusicFXModule.logCurrentState();
});

// -- Delay --
document.getElementById("test-delay-on").addEventListener("click", () => {
  MusicFXModule.toggleEffect("delay", true);
  const delay = MusicFXModule.getEffect("delay");
  if (delay) {
    delay.wet.rampTo(0.3, 0.1);
  }
  MusicFXModule.logCurrentState();
});

document.getElementById("test-delay-off").addEventListener("click", () => {
  MusicFXModule.toggleEffect("delay", false);
  MusicFXModule.logCurrentState();
});

// -- Reverb --
document.getElementById("test-reverb-on").addEventListener("click", () => {
  MusicFXModule.toggleEffect("reverb", true);
  const reverb = MusicFXModule.getEffect("reverb");
  if (reverb) {
    reverb.wet.rampTo(0.3, 0.1);
  }
  MusicFXModule.logCurrentState();
});

document.getElementById("test-reverb-off").addEventListener("click", () => {
  MusicFXModule.toggleEffect("reverb", false);
  MusicFXModule.logCurrentState();
});

// -- 全局 --
document.getElementById("test-all-off").addEventListener("click", () => {
  MusicFXModule.toggleEffect("distortion", false);
  MusicFXModule.toggleEffect("chorus", false);
  MusicFXModule.toggleEffect("delay", false);
  MusicFXModule.toggleEffect("reverb", false);
  // (注意：因为 toggleEffect 会触发 4 次 rebuild，效率不高，但功能正确)
  MusicFXModule.logCurrentState();
});

document.getElementById("test-log-state").addEventListener("click", () => {
  MusicFXModule.logCurrentState();
});

