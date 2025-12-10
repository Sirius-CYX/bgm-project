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
    compressor: null,
    eq3: null,
    bitCrusher: null,
    distortion: null,
    highpass: null,
    lowpass: null,
    tremolo: null,
    vibrato: null,
    chorus: null,
    feedbackDelay: null,
    autoPanner: null,
    stereoWidener: null,
    jcReverb: null
  };
  
  // Step 1: 效果链顺序
  let _effectOrder = [
    "compressor",     // 1. 动态控制
    "eq3",            // 2. 音色雕刻
    "bitCrusher",     // 3. 数字破碎
    "distortion",     // 4. 失真
    "highpass",       // 5. 高通滤波器
    "lowpass",        // 6. 低通滤波器
    "tremolo",        // 7. 音量切片
    "vibrato",        // 8. 音高颤动
    "chorus",         // 9. 调制叠加
    "feedbackDelay",  // 10. 回声
    "autoPanner",     // 11. 左右移动
    "stereoWidener",  // 12. 立体声加宽
    "jcReverb"        // 13. 混响空间
  ];
  
  let _player = null;
  let _masterGain = null;
  let _limiter = null;
  let _rateInterval = null; // 用于存储播放速度渐变定时器 ID
  
  // --- 内部私有函数 ---
  
  /**
   * (Step 1) 创建 4 个原型效果器
   * 全部默认 wet: 0 (关闭)
   */
  function _initializeNodes() {
    
    // 1. Compressor (压缩器) - 默认温和设置
    _allEffects.compressor = new Tone.Compressor({
      threshold: -24,
      ratio: 3,
      attack: 0.05,
      release: 0.2
    });
    
    // 2. EQ3 (三段均衡) - 默认中性
    _allEffects.eq3 = new Tone.EQ3({
      low: 0,
      mid: 0,
      high: 0,
      lowFrequency: 400,
      highFrequency: 2500
    });
    
    // 3. BitCrusher (数字破碎)
    _allEffects.bitCrusher = new Tone.BitCrusher({
      bits: 8,
      wet: 0
    });
    
    // 4. Distortion (失真)
    _allEffects.distortion = new Tone.Distortion({ 
      distortion: 0.4, 
      wet: 0  // 默认关闭
    });
    
    // 5. Highpass (高通滤波器)
    // 默认 10Hz = 全开，不阻挡任何声音
    _allEffects.highpass = new Tone.Filter({
      type: "highpass",
      frequency: 10,
      rolloff: -12,
      Q: 1
    });
    
    // 6. Lowpass (低通滤波器)
    // 默认 20000Hz = 全开，不阻挡任何声音
    _allEffects.lowpass = new Tone.Filter({
      type: "lowpass",
      frequency: 20000,
      rolloff: -12,
      Q: 1
    });
    
    // 7. Tremolo (音量切片) - 需要启动
    _allEffects.tremolo = new Tone.Tremolo({
      frequency: 10,
      depth: 0.5,
      wet: 0
    }).start();
    
    // 8. Vibrato (音高颤动)
    _allEffects.vibrato = new Tone.Vibrato({
      frequency: 5,
      depth: 0.1,
      wet: 0
    });
    
    // 9. Chorus (合唱)
    _allEffects.chorus = new Tone.Chorus({ 
      frequency: 10,//摇摆频率
      delayTime: 0.1,
      depth: 0.9,
      spread: 180,//立体声扩散 
      wet: 0  // 默认关闭
    });
    
    // 10. FeedbackDelay (延迟)
    _allEffects.feedbackDelay = new Tone.FeedbackDelay({
      delayTime: "8n",  // 延迟时间（8分音符）
      feedback: 0.2,    // 反馈量
      wet: 0  // 默认关闭
    });
    
    // 11. AutoPanner (左右声相) - 需要启动
    _allEffects.autoPanner = new Tone.AutoPanner({
      frequency: 1,
      depth: 1,
      wet: 0
    }).start();
    
    // 12. StereoWidener (立体声宽度)
    _allEffects.stereoWidener = new Tone.StereoWidener({
      width: 0.5,
      wet: 0
    });
    
    // 13. JCReverb (混响)
    _allEffects.jcReverb = new Tone.JCReverb({ 
      roomSize: 0.3,  // 房间大小
      wet: 0  // 默认关闭
    });
    // JCReverb 是同步的，不需要等待异步生成
    
    // 5. Limiter (限制器) - 防止效果链叠加后音量暴增的"安全网"
    _limiter = new Tone.Limiter(-0.1);  // 阈值设为 -0.1dB 作为安全余量
    
  }
  
  // --- 模块公开接口 (API) ---
  return {
    
    /**
     * API 1: 初始化模块
     * 负责创建所有节点并连接效果链
     */
    init: function(playerNode, gainNode) {
      // 清理可能存在的旧定时器（防止重新初始化时冲突）
      if (_rateInterval) {
        clearInterval(_rateInterval);
        _rateInterval = null;
      }
      
      _player = playerNode;
      _masterGain = gainNode;
      
      _initializeNodes();
      
      // 获取已初始化的节点，按顺序排列
      const nodesInChain = _effectOrder
          .map(name => _allEffects[name])
          .filter(node => node !== null); // 过滤掉 null (如果有)
          
      // 断开 masterGain 的旧连接（如果有）
      _masterGain.disconnect();
      
      // 链接！ Player -> MasterGain -> [效果链] -> Limiter -> Destination
      _limiter.toDestination();
      _player.connect(_masterGain);
      _masterGain.chain(...nodesInChain, _limiter);
    },
    
    /**
     * API 2: 【核心】获取效果器节点
     * 供规则引擎或测试按钮调用
     */
    getEffect: function(effectName) {
      if (!_allEffects[effectName]) {
        return null;
      }
      return _allEffects[effectName];
    },
    
    /**
     * API 3: 设置播放速度 (手动平滑版 - 强制生效)
     * @param {number} value - 目标速度
     * @param {number} [rampTime] - 过渡时间 (秒)
     */
    setPlaybackRate: function(value, rampTime) {
      if (!_player) return;

      // 如果没有时间，直接设置
      if (!rampTime || rampTime <= 0) {
        if (_player.playbackRate && _player.playbackRate.value !== undefined) {
          _player.playbackRate.value = value;
        } else {
          _player.playbackRate = value;
        }
        return;
      }

      // *** 核心修复：手动计算渐变 ***
      // 既然 rampTo 不听话，我们自己动手
      const startRate = (_player.playbackRate && _player.playbackRate.value !== undefined) 
        ? _player.playbackRate.value 
        : _player.playbackRate;
      const targetRate = value;
      const durationMs = rampTime * 1000;
      const stepTimeMs = 20; // 每 20ms 更新一次 (50fps)
      const steps = Math.ceil(durationMs / stepTimeMs);
      const rateStep = (targetRate - startRate) / steps;

      let currentStep = 0;

      // 清除可能存在的旧定时器 (防止冲突)
      if (_rateInterval) {
        clearInterval(_rateInterval);
        _rateInterval = null;
      }

      _rateInterval = setInterval(() => {
        currentStep++;

        const newRate = startRate + (rateStep * currentStep);

        // 设置新值
        if (_player.playbackRate && _player.playbackRate.value !== undefined) {
          _player.playbackRate.value = newRate;
        } else {
          _player.playbackRate = newRate;
        }

        // 结束条件
        if (currentStep >= steps) {
          clearInterval(_rateInterval);
          _rateInterval = null;

          // 确保最后精准落在目标值上
          if (_player.playbackRate && _player.playbackRate.value !== undefined) {
            _player.playbackRate.value = targetRate;
          } else {
            _player.playbackRate = targetRate;
          }
        }
      }, stepTimeMs);
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

// 播放速度微调控制，确保 ±5% 微变化可被精确展示并作用于 Player
const rateSlider = document.getElementById("playback-rate");
const rateVal = document.getElementById("rate-val");

if (rateSlider && rateVal) {
  rateSlider.addEventListener("input", (event) => {
    const sliderValue = parseFloat(event.target.value);
    if (Number.isNaN(sliderValue)) {
      return;
    }

    // 将显示值固定为 3 位小数，方便观察极小的速率变化
    rateVal.textContent = sliderValue.toFixed(3);

    if (player) {
      const playbackParam = player.playbackRate;
      if (playbackParam && typeof playbackParam.value === "number") {
        playbackParam.value = sliderValue;
      } else {
        player.playbackRate = sliderValue;
      }
    }
  });
}

