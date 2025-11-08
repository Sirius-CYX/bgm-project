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
let effectChain = null;        // 效果链节点
let currentEffect = null;      // 当前激活的效果
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
    
    // 读取文件为ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // 解码音频数据
    audioBuffer = await Tone.context.decodeAudioData(arrayBuffer);
    
    // 创建播放器
    player = new Tone.Player(audioBuffer);
    
    // 初始化效果链系统
    initializeEffectChain();
    
    statusText.textContent = `音乐加载成功！文件：${file.name}`;
    console.log("音乐文件加载完成，可以播放和添加效果了");
    
  } catch (error) {
    console.error("音频加载失败:", error);
    statusText.textContent = "音频加载失败，请检查文件格式";
  }
});

// 播放控制
playButton.addEventListener("click", () => {
  if (!player) {
    statusText.textContent = "请先上传音乐文件";
    return;
  }
  
  if (!isPlaying) {
    player.start();
    isPlaying = true;
    statusText.textContent = "正在播放...";
    playButton.textContent = "暂停";
  } else {
    player.stop();
    isPlaying = false;
    statusText.textContent = "已暂停";
    playButton.textContent = "播放";
  }
});

// 停止播放
stopButton.addEventListener("click", () => {
  if (player && isPlaying) {
    player.stop();
    isPlaying = false;
    statusText.textContent = "已停止";
    playButton.textContent = "播放";
  }
});

// 初始化效果链系统
function initializeEffectChain() {
  // 创建所有效果节点
  effectNodes.reverb = new Tone.JCReverb({
    roomSize: 0.8,
    wet: 0.5,
  });
  
  effectNodes.delay = new Tone.FeedbackDelay({
    delayTime: "8n",
    feedback: 0.6,
    wet: 0.5,
  });
  
  effectNodes.chorus = new Tone.Chorus({
    frequency: 10,
    delayTime: 0.1,
    depth: 0.9,
    spread: 180,
  });
  
  effectNodes.distortion = new Tone.Distortion({
    distortion: 0.8,
    saturate: 0.5,
  });
  
  // 创建效果链：播放器 → 效果链 → 输出
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
  
  // 如果当前已经有效果，先断开
  if (currentEffect) {
    currentEffect.disconnect();
  }
  
  // 连接新效果到效果链
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
  
  // 断开当前效果
  if (currentEffect) {
    currentEffect.disconnect();
    currentEffect = null;
  }
  
  // 直接连接到输出
  effectChain.toDestination();
  
  statusText.textContent = "已清除所有效果，播放原始音频";
  console.log("清除所有效果");
});

