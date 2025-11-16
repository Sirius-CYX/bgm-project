// ===================================
//  PART 4: 规则引擎 - 测试按钮逻辑
// ===================================
// 这个文件是"大脑"或"指挥官"，负责监听事件并调用 MusicFXModule 的 API
// 它不关心如何实现效果器，只关心"当事件发生时，执行什么操作"

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

