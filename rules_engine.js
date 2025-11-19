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
  }
});

document.getElementById("test-dist-off").addEventListener("click", () => {
  const dist = MusicFXModule.getEffect("distortion");
  if (dist) {
    dist.wet.rampTo(0, 0.1);
  }
});

// Chorus 控制
document.getElementById("test-chorus-on").addEventListener("click", () => {
  const chorus = MusicFXModule.getEffect("chorus");
  if (chorus) {
    chorus.wet.rampTo(0.3, 0.1);
  }
});

document.getElementById("test-chorus-off").addEventListener("click", () => {
  const chorus = MusicFXModule.getEffect("chorus");
  if (chorus) {
    chorus.wet.rampTo(0, 0.1);
  }
});

// Delay 控制
document.getElementById("test-delay-on").addEventListener("click", () => {
  const delay = MusicFXModule.getEffect("feedbackDelay");
  if (delay) {
    delay.wet.rampTo(0.3, 0.1);
  }
});

document.getElementById("test-delay-off").addEventListener("click", () => {
  const delay = MusicFXModule.getEffect("feedbackDelay");
  if (delay) {
    delay.wet.rampTo(0, 0.1);
  }
});

// Reverb (JCReverb) 控制
document.getElementById("test-reverb-on").addEventListener("click", () => {
  const reverb = MusicFXModule.getEffect("jcReverb");
  if (reverb) {
    reverb.wet.rampTo(0.3, 0.1);
  }
});

document.getElementById("test-reverb-off").addEventListener("click", () => {
  const reverb = MusicFXModule.getEffect("jcReverb");
  if (reverb) {
    reverb.wet.rampTo(0, 0.1);
  }
});

// 关闭所有效果
document.getElementById("test-all-off").addEventListener("click", () => {
  const dist = MusicFXModule.getEffect("distortion");
  const chorus = MusicFXModule.getEffect("chorus");
  const delay = MusicFXModule.getEffect("feedbackDelay");
  const reverb = MusicFXModule.getEffect("jcReverb");
  
  if (dist) dist.wet.rampTo(0, 0.1);
  if (chorus) chorus.wet.rampTo(0, 0.1);
  if (delay) delay.wet.rampTo(0, 0.1);
  if (reverb) reverb.wet.rampTo(0, 0.1);
});

// 打印当前状态
document.getElementById("test-log-state").addEventListener("click", () => {
  // 日志功能已移除，如需恢复请参阅 log/log.js 中的备份代码
});

