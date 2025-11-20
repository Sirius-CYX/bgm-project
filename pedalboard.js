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
    distortion: null,
    chorus: null,
    feedbackDelay: null,
    jcReverb: null
  };
  
  // Step 1: 效果链顺序
  let _effectOrder = [
    "compressor",    // 1. 动态控制
    "eq3",           // 2. 音色雕刻
    "distortion",    // 3. 失真
    "chorus",        // 4. 调制
    "feedbackDelay", // 5. 延迟
    "jcReverb"       // 6. 空间
  ];
  
  let _player = null;
  let _masterGain = null;
  let _limiter = null;
  
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
    
    // 3. Distortion (失真)
    _allEffects.distortion = new Tone.Distortion({ 
      distortion: 0.4, 
      wet: 0  // 默认关闭
    });
    
    // 4. Chorus (合唱)
    _allEffects.chorus = new Tone.Chorus({ 
      frequency: 10,//摇摆频率
      delayTime: 0.1,
      depth: 0.9,
      spread: 180,//立体声扩散 
      wet: 0  // 默认关闭
    });
    
    // 5. FeedbackDelay (延迟)
    _allEffects.feedbackDelay = new Tone.FeedbackDelay({
      delayTime: "8n",  // 延迟时间（8分音符）
      feedback: 0.2,    // 反馈量
      wet: 0  // 默认关闭
    });
    
    // 6. JCReverb (混响)
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

