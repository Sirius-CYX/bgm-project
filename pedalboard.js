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
  
  // Step 1: 效果链顺序
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
   * (Step 1) 创建 4 个原型效果器
   * 全部默认 wet: 0 (关闭)
   */
  function _initializeNodes() {
    console.log("MusicFXModule: 正在初始化 4 个原型节点...");
    
    // 1. Distortion (失真)
    _allEffects.distortion = new Tone.Distortion({ 
      distortion: 0.4, 
      wet: 0  // 默认关闭
    });
    
    // 2. Chorus (合唱)
    _allEffects.chorus = new Tone.Chorus({ 
      frequency: 10,//摇摆频率
      delayTime: 0.1,
      depth: 0.9,
      spread: 180,//立体声扩散 
      wet: 0  // 默认关闭
    });
    
    // 3. Delay (延迟)
    _allEffects.delay = new Tone.FeedbackDelay({
      delayTime: "8n",  // 延迟时间（8分音符）
      feedback: 0.2,    // 反馈量
      wet: 0  // 默认关闭
    });
    
    // 4. JCReverb (混响) - 使用 JCReverb 替代 Reverb
    _allEffects.reverb = new Tone.JCReverb({ 
      roomSize: 0.3,  // 房间大小
      wet: 0  // 默认关闭
    });
    // JCReverb 是同步的，不需要等待异步生成
    
    console.log("MusicFXModule: 节点初始化完毕。");
  }
  
  // --- 模块公开接口 (API) ---
  return {
    
    /**
     * API 1: 初始化模块
     * 负责创建所有节点并连接效果链
     */
    init: function(playerNode, gainNode) {
      _player = playerNode;
      _masterGain = gainNode;
      
      _initializeNodes();
      
      // 获取已初始化的节点，按顺序排列
      const nodesInChain = _effectOrder
          .map(name => _allEffects[name])
          .filter(node => node !== null); // 过滤掉 null (如果有)
          
      // 断开 masterGain 的旧连接（如果有）
      _masterGain.disconnect();
      
      // 链接！ Player -> MasterGain -> [效果链] -> Destination
      _player.connect(_masterGain);
      _masterGain.chain(...nodesInChain, Tone.Destination);
      
      console.log("MusicFXModule: 效果链已成功连接！");
      console.log("效果链顺序:", _effectOrder.join(" -> "));
    },
    
    /**
     * API 2: 【核心】获取效果器节点
     * 供规则引擎或测试按钮调用
     */
    getEffect: function(effectName) {
      if (!_allEffects[effectName]) {
        console.warn(`未找到名为 ${effectName} 的效果器`);
        return null;
      }
      return _allEffects[effectName];
    },
    
    /**
     * API 3: 【测试】打印当前状态
     * 供你调试使用
     */
    logCurrentState: function() {
      console.log("--- 音乐效果器当前状态 ---");
      let hasActiveEffect = false;
      
      for (const name of _effectOrder) {
        const effect = _allEffects[name];
        if (!effect) continue;
        
        // 检查效果器的 wet 值
        if (effect.wet && effect.wet.value > 0) {
          hasActiveEffect = true;
          let params = [`wet: ${effect.wet.value.toFixed(2)}`];
          
          // 添加效果器特定的参数
          if (name === "distortion" && effect.distortion) {
            params.push(`distortion: ${effect.distortion.toFixed(2)}`);
          }
          if (name === "reverb" && effect.roomSize) {
            params.push(`roomSize: ${effect.roomSize.value.toFixed(2)}`);
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
              const delayTime = typeof effect.delayTime.value === 'string' 
                ? effect.delayTime.value 
                : effect.delayTime.value.toFixed(3) + 's';
              params.push(`delayTime: ${delayTime}`);
            }
            if (effect.feedback) params.push(`feedback: ${effect.feedback.value.toFixed(2)}`);
          }
          
          console.log(`[ON] ${name.toUpperCase()}: ${params.join(', ')}`);
        }
      }
      
      if (!hasActiveEffect) {
        console.log("所有效果器均已旁路 (Bypassed / wet:0)");
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
    
    statusText.textContent = `加载成功: ${file.name} (效果链已激活)`;
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
//  PART 4: 测试按钮逻辑
// ===================================

// Distortion 控制
document.getElementById("test-dist-on").addEventListener("click", () => {
  const dist = MusicFXModule.getEffect("distortion");
  if (dist) {
    dist.wet.rampTo(0.25, 0.1);
    console.log("测试：Distortion -> ON (wet: 0.25)");
    MusicFXModule.logCurrentState();
  } else {
    console.error("无法获取 Distortion 效果器");
  }
});

document.getElementById("test-dist-off").addEventListener("click", () => {
  const dist = MusicFXModule.getEffect("distortion");
  if (dist) {
    dist.wet.rampTo(0, 0.1);
    console.log("测试：Distortion -> OFF (wet: 0)");
    MusicFXModule.logCurrentState();
  } else {
    console.error("无法获取 Distortion 效果器");
  }
});

// Chorus 控制
document.getElementById("test-chorus-on").addEventListener("click", () => {
  const chorus = MusicFXModule.getEffect("chorus");
  if (chorus) {
    chorus.wet.rampTo(0.3, 0.1);
    console.log("测试：Chorus -> ON (wet: 0.3)");
    MusicFXModule.logCurrentState();
  } else {
    console.error("无法获取 Chorus 效果器");
  }
});

document.getElementById("test-chorus-off").addEventListener("click", () => {
  const chorus = MusicFXModule.getEffect("chorus");
  if (chorus) {
    chorus.wet.rampTo(0, 0.1);
    console.log("测试：Chorus -> OFF (wet: 0)");
    MusicFXModule.logCurrentState();
  } else {
    console.error("无法获取 Chorus 效果器");
  }
});

// Delay 控制
document.getElementById("test-delay-on").addEventListener("click", () => {
  const delay = MusicFXModule.getEffect("delay");
  if (delay) {
    delay.wet.rampTo(0.3, 0.1);
    console.log("测试：Delay -> ON (wet: 0.3)");
    MusicFXModule.logCurrentState();
  } else {
    console.error("无法获取 Delay 效果器");
  }
});

document.getElementById("test-delay-off").addEventListener("click", () => {
  const delay = MusicFXModule.getEffect("delay");
  if (delay) {
    delay.wet.rampTo(0, 0.1);
    console.log("测试：Delay -> OFF (wet: 0)");
    MusicFXModule.logCurrentState();
  } else {
    console.error("无法获取 Delay 效果器");
  }
});

// Reverb (JCReverb) 控制
document.getElementById("test-reverb-on").addEventListener("click", () => {
  const reverb = MusicFXModule.getEffect("reverb");
  if (reverb) {
    reverb.wet.rampTo(0.3, 0.1);
    console.log("测试：Reverb -> ON (wet: 0.3)");
    MusicFXModule.logCurrentState();
  } else {
    console.error("无法获取 Reverb 效果器");
  }
});

document.getElementById("test-reverb-off").addEventListener("click", () => {
  const reverb = MusicFXModule.getEffect("reverb");
  if (reverb) {
    reverb.wet.rampTo(0, 0.1);
    console.log("测试：Reverb -> OFF (wet: 0)");
    MusicFXModule.logCurrentState();
  } else {
    console.error("无法获取 Reverb 效果器");
  }
});

// 关闭所有效果
document.getElementById("test-all-off").addEventListener("click", () => {
  const dist = MusicFXModule.getEffect("distortion");
  const chorus = MusicFXModule.getEffect("chorus");
  const delay = MusicFXModule.getEffect("delay");
  const reverb = MusicFXModule.getEffect("reverb");
  
  if (dist) dist.wet.rampTo(0, 0.1);
  if (chorus) chorus.wet.rampTo(0, 0.1);
  if (delay) delay.wet.rampTo(0, 0.1);
  if (reverb) reverb.wet.rampTo(0, 0.1);
  
  console.log("测试：All FX -> OFF (wet: 0)");
  MusicFXModule.logCurrentState();
});

// 打印当前状态
document.getElementById("test-log-state").addEventListener("click", () => {
  MusicFXModule.logCurrentState();
});

