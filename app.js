// 获取DOM元素
const audioUpload = document.getElementById("audioUpload");
const playButton = document.getElementById("play");
const stopButton = document.getElementById("stop");
const statusText = document.getElementById("status");
const reverbButton = document.getElementById("reverb");
const delayButton = document.getElementById("delay");
const chorusButton = document.getElementById("chorus");
const distortionButton = document.getElementById("distortion");
const clearButton = document.getElementById("clear");

if (Tone.context.state !== "running") {
  Tone.context.resume();
}
// 全局变量
let audioBuffer = null;        // 上传的音频缓冲区
let player = null;             // Tone.Player实例
let isPlaying = false;         // 播放状态

// 效果链系统
let effectChain = null;        // 效果链路由节点（Gain节点，用于音量控制和路由管理）
let currentEffect = null;      // 当前激活的效果节点
let effectNodes = {            // 所有效果节点
  reverb: null,
  delay: null,
  chorus: null,
  distortion: null
};

document.addEventListener("click", () => {
  if (Tone.context.state === "suspended") {
    Tone.context.resume();
  }
});

// 文件上传处理
audioUpload.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    statusText.textContent = "正在加载音乐文件...";
    
    // *** 清理旧播放器和 Transport ***
    if (player) {
      player.unsync(); // 解除同步
      player.dispose(); // 销毁旧实例
    }
    // 确保 Transport 停止并重置，为新歌做准备
    Tone.Transport.stop();
    
    // 读取文件为ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // 解码音频数据
    audioBuffer = await Tone.context.decodeAudioData(arrayBuffer);
    
    // 创建播放器
    player = new Tone.Player(audioBuffer);
    
    // *** 同步 Transport 并准备播放 ***
    // 告诉 player 在 Transport 的 0 秒钟位置准备好
    player.sync().start(0);
    
    // 初始化效果链系统（会在内部连接 player 到 effectChain）
    initializeEffectChain();
    
    statusText.textContent = `音乐加载成功！文件：${file.name}`;
    console.log("音乐文件加载完成，可以播放和添加效果了");
    
    // *** 重置播放按钮状态 ***
    isPlaying = false;
    playButton.textContent = "播放";
    
  } catch (error) {
    console.error("音频加载失败:", error);
    statusText.textContent = "音频加载失败，请检查文件格式";
  }
});

// 播放控制 (已修复为"暂停/继续")
playButton.addEventListener("click", () => {
  if (!player) {
    statusText.textContent = "请先上传音乐文件";
    return;
  }
  
  // 检查"主时钟"的状态
  if (Tone.Transport.state === "started") {
    // 如果正在播放，就"暂停"
    Tone.Transport.pause();
    
    statusText.textContent = "已暂停";
    playButton.textContent = "播放";
    isPlaying = false;
  } else {
    // 如果是"已停止"或"已暂停"，就"开始/继续"
    Tone.Transport.start();
    
    statusText.textContent = "正在播放...";
    playButton.textContent = "暂停";
    isPlaying = true;
  }
});

// 停止播放 (重置)
stopButton.addEventListener("click", () => {
  if (player) {
    // .stop() 会停止播放并重置 Transport 的时间到 0
    Tone.Transport.stop();
    
    statusText.textContent = "已停止";
    playButton.textContent = "播放"; // 重置播放按钮的状态
    isPlaying = false;
  }
});

// 初始化效果链系统
function initializeEffectChain() {
  // 如果之前已经初始化过，先清理旧的连接和效果节点
  if (effectChain) {
    effectChain.disconnect();
  }
  if (currentEffect) {
    currentEffect.disconnect();
    currentEffect = null;
  }
  
  // 创建所有效果节点
  effectNodes.reverb = new Tone.JCReverb({
    roomSize: 0.3,//空间大小
    wet: 0.2,
  });
  
  effectNodes.delay = new Tone.FeedbackDelay({
    delayTime: "8n",//延迟时间（8音符的话回声和原声对齐）
    feedback: 0.2,//回声重复多少次
    wet: 0.3,
  });
  
  effectNodes.chorus = new Tone.Chorus({
    frequency: 10,//摇摆频率
    delayTime: 0.1,
    depth: 0.9,
    spread: 180,//立体声扩散
  });
  
  effectNodes.distortion = new Tone.Distortion({
    distortion: 0.4,//失真量
    //saturate: 0.5,
    wet: 0.25,
  });
  
  // 创建效果链路由节点：播放器 → effectChain(Gain) → 输出（初始为 dry 路径）
  // Gain 值设为 0.85 以防止数字削波失真（避免音频信号超过 0dB 导致削波）
  effectChain = new Tone.Gain(0.85);
  player.connect(effectChain);
  effectChain.toDestination();
  
  console.log("效果链系统初始化完成");
}

// 实时切换音频效果
function switchEffect(effectType) {
  if (!player || !effectChain) {
    statusText.textContent = "请先上传音乐文件";
    return;
  }
  
  // 获取目标效果节点
  const targetEffect = effectNodes[effectType];
  if (!targetEffect) {
    console.error("未找到效果类型:", effectType);
    return;
  }
  
  // 断开 effectChain 的所有输出连接，避免多条路径并存导致相位抵消和失真
  effectChain.disconnect();
  
  // 如果当前已经有效果，也断开其连接（确保清理）
  if (currentEffect) {
    currentEffect.disconnect();
  }
  
  // 连接新效果：effectChain(Gain) -> 效果 -> Destination（单一路径，避免相位抵消）
  effectChain.connect(targetEffect);
  targetEffect.toDestination();
  currentEffect = targetEffect;
  
  // 更新状态显示
  statusText.textContent = `已切换到${effectType.toUpperCase()}效果`;
  console.log(`实时切换到${effectType}效果`);
}

// 效果按钮事件监听器 - 实时切换
reverbButton.addEventListener("click", () => {
  switchEffect("reverb");
});

chorusButton.addEventListener("click", () => {
  switchEffect("chorus");
});

distortionButton.addEventListener("click", () => {
  switchEffect("distortion");
});

delayButton.addEventListener("click", () => {
  switchEffect("delay");
});

// 清除效果按钮
clearButton.addEventListener("click", () => {
  if (!player || !effectChain) {
    statusText.textContent = "请先上传音乐文件";
    return;
  }
  
  // 断开 effectChain 的所有输出连接，确保清理所有路径
  effectChain.disconnect();
  
  // 断开当前效果的连接（确保清理）
  if (currentEffect) {
    currentEffect.disconnect();
    currentEffect = null;
  }
  
  // 重新连接到输出（dry 路径，无效果，音量由 effectChain 的 Gain 值 0.85 控制）
  effectChain.toDestination();
  
  statusText.textContent = "已清除所有效果，播放原始音频";
  console.log("清除所有效果");
});

