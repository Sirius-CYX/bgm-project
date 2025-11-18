/**
 * 备份：日志相关代码（仅供参考，不参与运行）
 * 如果需要恢复日志，请从下方片段复制回对应文件。
 */

/* ---------- pedalboard.js: 初始化日志 ----------
function _initializeNodes() {
  console.log("MusicFXModule: 正在初始化 4 个原型节点...");
  // ...创建节点...
  console.log("MusicFXModule: 节点 (带 Limiter) 初始化完毕。");
}
*/

/* ---------- pedalboard.js: 链接日志 ----------
_limiter.toDestination();
_player.connect(_masterGain);
_masterGain.chain(...nodesInChain, _limiter);
console.log("MusicFXModule: 效果链已成功连接！ (已安装 Limiter)");
console.log("效果链顺序:", _effectOrder.join(" -> ") + " -> Limiter");
*/

/* ---------- pedalboard.js: getEffect 警告 ----------
getEffect: function(effectName) {
  if (!_allEffects[effectName]) {
    console.warn(`未找到名为 ${effectName} 的效果器`);
    return null;
  }
  return _allEffects[effectName];
},
*/

/* ---------- pedalboard.js: logCurrentState 备份 ----------
logCurrentState: function() {
  console.log("--- 音乐效果器当前状态 ---");
  let hasActiveEffect = false;
  
  for (const name of _effectOrder) {
    const effect = _allEffects[name];
    if (!effect) continue;
    
    if (effect.wet && effect.wet.value > 0) {
      hasActiveEffect = true;
      let params = [`wet: ${effect.wet.value.toFixed(2)}`];
      
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
*/

/* ---------- pedalboard.js: 加载失败日志 ----------
} catch (error) {
  console.error("加载失败:", error);
  statusText.textContent = "音频加载失败，请检查文件格式";
}
*/

/* ---------- rules_engine.js: 事件日志 ----------
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
// ...其余按钮逻辑与之类似...

document.getElementById("test-log-state").addEventListener("click", () => {
  MusicFXModule.logCurrentState();
});
*/

