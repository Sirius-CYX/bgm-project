// DSP DEMO (3D Axes) - standalone, no dependency on pedalboard/rules_engine2
(() => {
  "use strict";

  const fileInput = document.getElementById("file-input");
  const playBtn = document.getElementById("play-btn");
  const stopBtn = document.getElementById("stop-btn");
  const statusText = document.getElementById("status-text");

  const sliderX = document.getElementById("slider-x");
  const sliderY = document.getElementById("slider-y");
  const sliderZ = document.getElementById("slider-z");
  const valX = document.getElementById("val-x");
  const valY = document.getElementById("val-y");
  const valZ = document.getElementById("val-z");
  const barX = document.getElementById("bar-x");
  const barY = document.getElementById("bar-y");
  const barZ = document.getElementById("bar-z");

  let player = null;
  let widener = null;
  let eq3 = null;
  let reverb = null;
  let limiter = null;
  let masterGain = null;

  // 让 Tone 在首次点击后恢复音频上下文
  document.documentElement.addEventListener("click", () => {
    if (Tone.context.state === "suspended") {
      Tone.context.resume();
    }
  });

  function updateViz(val, spanEl, barEl) {
    spanEl.textContent = val.toFixed(2);
    // X轴范围是0-2，Y和Z轴范围是0-1
    barEl.style.width = `${Math.min(1, Math.max(0, val / (barEl === barX ? 2 : 1))) * 100}%`;
  }

  async function loadFile(file) {
    statusText.textContent = "Loading audio...";
    try {
      // 确保 Tone.js Context 已激活
      if (Tone.context.state === "suspended") {
        await Tone.context.resume();
      }

      // 清理旧播放器
      if (player) {
        player.stop();
        player.dispose();
      }
      // 解码
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await Tone.context.decodeAudioData(arrayBuffer);

      player = new Tone.Player(audioBuffer);
      masterGain = new Tone.Gain(0.85);

      // 节点：宽度 -> EQ3 -> Reverb -> Limiter
      widener = new Tone.StereoWidener({ width: 1, wet: 1 });
      eq3 = new Tone.EQ3({ low: 0, mid: 0, high: 0 });
      reverb = new Tone.JCReverb({ roomSize: 0.1, wet: 0 });
      limiter = new Tone.Limiter(-0.1);

      player.connect(masterGain);
      masterGain.chain(eq3, widener, reverb, limiter, Tone.Destination);

      // 同步初始化：立即应用当前滑块的值到新节点
      const currentX = parseFloat(sliderX.value);
      const currentY = parseFloat(sliderY.value);
      const currentZ = parseFloat(sliderZ.value);
      
      applyWidth(currentX);
      applyHeight(currentY);
      applyDepth(currentZ);
      
      // 更新视觉反馈
      updateViz(currentX, valX, barX);
      updateViz(currentY, valY, barY);
      updateViz(currentZ, valZ, barZ);

      statusText.textContent = `Loaded: ${file.name}`;
      playBtn.textContent = "Play";
    } catch (err) {
      console.error(err);
      statusText.textContent = "Load failed.";
    }
  }

  // 线性插值函数
  function lerp(start, end, t) {
    return start + (end - start) * t;
  }

  // 智能参数设置函数（类似 rules_engine2.js 中的 setParam）
  function setParam(node, param, value) {
    if (!node || typeof node[param] === "undefined") return;
    const target = node[param];
    // 情况 A: Tone.Signal 或带 rampTo 的参数
    if (target && typeof target.rampTo === "function") {
      target.value = value;
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

  // X: Width (0-2) - 立体声效果
  // 0 = 单声道，1 = 原始立体声 (Neutral)，2 = 超宽立体声
  function applyWidth(x) {
    if (!widener) return;
    // 确保 x 在有效范围内 [0, 2]
    const clampedX = Math.max(0, Math.min(2, x));
    // 直接使用线性映射：0-2 对应 width 0-2
    setParam(widener, "width", clampedX);
    // 确保wet始终为1（在[0,1]范围内），让立体声效果完全应用
    setParam(widener, "wet", 1);
  }

  // Y: Height/Spectrum (0-1) - 频率频谱控制
  // 重新设计映射，让 y = 0.5 时为"原始声音" (Flat EQ)
  // y < 0.5: 衰减两端 (电话音效)
  // y = 0.5: 0dB (无效果，原始声音)
  // y > 0.5: 增强两端 (微笑曲线)
  function applyHeight(y) {
    if (!eq3) return;
    const clampedY = Math.max(0, Math.min(1, y));

    let low, mid, high;

    if (clampedY < 0.5) {
      // 范围 0.0 -> 0.5 : 从"电话音效"过渡到"原始声音"
      // normalize t: 0 -> 1
      const t = clampedY * 2; 
      low = lerp(-40, 0, t);  // -40dB -> 0dB
      high = lerp(-40, 0, t); // -40dB -> 0dB
      mid = lerp(0, 0, t);    // 保持 0dB
    } else {
      // 范围 0.5 -> 1.0 : 从"原始声音"过渡到"微笑曲线"
      // normalize t: 0 -> 1
      const t = (clampedY - 0.5) * 2;
      low = lerp(0, 12, t);   // 0dB -> +12dB
      high = lerp(0, 12, t);  // 0dB -> +12dB
      mid = lerp(0, -6, t);   // 0dB -> -6dB
    }

    setParam(eq3, "low", low);
    setParam(eq3, "mid", mid);
    setParam(eq3, "high", high);
  }

  // Z: Depth/Distance (0-1) - 增强混响效果
  // wet: 0 -> 1, roomSize: 0.1 -> 0.98 (更大的房间尺寸)
  function applyDepth(z) {
    if (!reverb) return;
    // 确保 z 在 [0, 1] 范围内
    const clampedZ = Math.max(0, Math.min(1, z));
    // wet 参数必须在 [0, 1] 范围内
    const wet = lerp(0, 1, clampedZ);
    // roomSize 使用平方曲线，让变化更明显，范围 [0.1, 0.98]
    const roomSize = lerp(0.1, 0.98, clampedZ * clampedZ);
    setParam(reverb, "wet", wet);
    setParam(reverb, "roomSize", roomSize);
  }

  function attachEvents() {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) loadFile(file);
    });

    playBtn.addEventListener("click", () => {
      if (!player) {
        statusText.textContent = "Please upload an audio file.";
        return;
      }
      if (Tone.Transport.state === "started") {
        Tone.Transport.pause();
        playBtn.textContent = "Play";
        statusText.textContent = "Paused";
      } else {
        player.sync().start(0);
        Tone.Transport.start();
        playBtn.textContent = "Pause";
        statusText.textContent = "Playing...";
      }
    });

    stopBtn.addEventListener("click", () => {
      if (!player) return;
      Tone.Transport.stop();
      statusText.textContent = "Stopped";
      playBtn.textContent = "Play";
    });

    sliderX.addEventListener("input", (e) => {
      const x = parseFloat(e.target.value);
      updateViz(x, valX, barX);
      applyWidth(x);
    });

    sliderY.addEventListener("input", (e) => {
      const y = parseFloat(e.target.value);
      updateViz(y, valY, barY);
      applyHeight(y);
    });

    sliderZ.addEventListener("input", (e) => {
      const z = parseFloat(e.target.value);
      updateViz(z, valZ, barZ);
      applyDepth(z);
    });
  }

  // 初始化显示
  updateViz(parseFloat(sliderX.value), valX, barX);
  updateViz(parseFloat(sliderY.value), valY, barY);
  updateViz(parseFloat(sliderZ.value), valZ, barZ);

  attachEvents();
})();

