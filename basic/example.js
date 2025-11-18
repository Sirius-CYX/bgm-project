
import { PitchShifter } from './lib.js';

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const gainNode = audioCtx.createGain();
let shifter;
let is_playing = false;

// 添加回声相关变量
const echoSlider = document.getElementById('echoSlider');
const echoValue = document.getElementById('echoValue');
let delayNode = audioCtx.createDelay();
let feedbackNode = audioCtx.createGain();
let wetNode = audioCtx.createGain();

// 添加混响相关变量
const reverbSlider = document.getElementById('reverbSlider');
const reverbValue = document.getElementById('reverbValue');
let convolverNode = audioCtx.createConvolver();
let wetGain = audioCtx.createGain();
let dryGain = audioCtx.createGain();

// 添加空间环绕相关变量
const panSlider = document.getElementById('panSlider');
const panValue = document.getElementById('panValue');
let pannerNode = audioCtx.createStereoPanner();

const playBtn = document.getElementById('play');
const tempoSlider = document.getElementById('tempoSlider');
const tempoOutput = document.getElementById('tempo');
tempoOutput.innerHTML = tempoSlider.value;
const pitchSlider = document.getElementById('pitchSlider');
const pitchOutput = document.getElementById('pitch');
pitchOutput.innerHTML = pitchSlider.value;
const keySlider = document.getElementById('keySlider');
const keyOutput = document.getElementById('key');
keyOutput.innerHTML = keySlider.value;
const volumeSlider = document.getElementById('volumeSlider');
const volumeOutput = document.getElementById('volume');
volumeOutput.innerHTML = volumeSlider.value;
const currTime = document.getElementById('currentTime');
const duration = document.getElementById('duration');
const progressMeter = document.getElementById('progressMeter');
const fileInput = document.getElementById('fileInput');

// 添加参数显示元素
const tempoDisplay = document.getElementById('tempo');
const pitchDisplay = document.getElementById('pitch');
const keyDisplay = document.getElementById('key');
const volumeDisplay = document.getElementById('volume');

// 初始化显示
tempoDisplay.textContent = tempoSlider.value;
pitchDisplay.textContent = pitchSlider.value;
keyDisplay.textContent = keySlider.value;
volumeDisplay.textContent = volumeSlider.value;
echoValue.textContent = echoSlider.value;
panValue.textContent = panSlider.value;

// 初始化回声节点
function setupEcho() {
    delayNode.delayTime.value = 0.3; // 基础延迟时间
    feedbackNode.gain.value = 0.5;  // 反馈量
    wetNode.gain.value = 0;         // 初始回声量为0
    
    // 连接回声效果链
    delayNode.connect(feedbackNode);
    feedbackNode.connect(delayNode);
    delayNode.connect(wetNode);
}

// 初始化混响节点
function setupReverb() {
    // 创建一个简单的脉冲响应
    const length = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(2, length, audioCtx.sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    
    for (let i = 0; i < length; i++) {
        left[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 1);
        right[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 1);
    }
    
    convolverNode.buffer = buffer;
    wetGain.gain.value = 0;
    dryGain.gain.value = 1;
}

const loadSource = function (url) {
    playBtn.setAttribute('disabled', 'disabled');
    if (shifter) {
        shifter.off();
    }
    fetch(url)
        .then((response) => response.arrayBuffer())
        .then((buffer) => {
            console.log('have array buffer');
            audioCtx.decodeAudioData(buffer, (audioBuffer) => {
                console.log('decoded the buffer');
                shifter = new PitchShifter(audioCtx, audioBuffer, 16384);
                shifter.tempo = tempoSlider.value;
                shifter.pitch = pitchSlider.value;
                shifter.on('play', (detail) => {
                    console.log(`timeplayed: ${detail.timePlayed}`);
                    currTime.innerHTML = detail.formattedTimePlayed;
                    progressMeter.value = detail.percentagePlayed;
                });
                duration.innerHTML = shifter.formattedDuration;
                playBtn.removeAttribute('disabled');

                // 初始化回声和混响效果
                setupEcho();
                setupReverb();
            });
        });
};

fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        loadSource(url);
    }
});

// 修改播放控制逻辑
let isPaused = false;

const play = function () {
    if (!shifter) {
        alert('请先选择音频文件');
        return;
    }
    
    if (is_playing) {
        // Pause
        shifter.disconnect();
        audioCtx.suspend();
        is_playing = false;
        playBtn.textContent = '播放';
    } else {
        // Play or Resume
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().then(() => {
                // 连接效果链
                shifter.connect(dryGain);
                shifter.connect(delayNode);  // 回声
                shifter.connect(convolverNode);  // 混响
                
                dryGain.connect(pannerNode);
                wetGain.connect(pannerNode);
                delayNode.connect(wetNode);
                wetNode.connect(pannerNode);
                convolverNode.connect(wetGain);
                
                pannerNode.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                is_playing = true;
                playBtn.textContent = '暂停';
            });
        } else {
            // 连接效果链
            shifter.connect(dryGain);
            shifter.connect(delayNode);  // 回声
            shifter.connect(convolverNode);  // 混响
            
            dryGain.connect(pannerNode);
            wetGain.connect(pannerNode);
            delayNode.connect(wetNode);
            wetNode.connect(pannerNode);
            convolverNode.connect(wetGain);
            
            pannerNode.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            is_playing = true;
            playBtn.textContent = '暂停';
        }
    }
};

playBtn.addEventListener('click', play);

// 更新滑块事件监听
tempoSlider.addEventListener('input', function () {
    if (shifter) {
        shifter.tempo = this.value;
    }
    tempoDisplay.textContent = this.value;
});

pitchSlider.addEventListener('input', function () {
    if (shifter) {
        shifter.pitch = this.value;
    }
    pitchDisplay.textContent = this.value;
});

keySlider.addEventListener('input', function () {
    if (shifter) {
        shifter.pitch = Math.pow(2, this.value / 12);
    }
    keyDisplay.textContent = this.value;
});

volumeSlider.addEventListener('input', function () {
    gainNode.gain.value = this.value;
    volumeDisplay.textContent = this.value;
});

progressMeter.addEventListener('click', function (event) {
  const pos = event.target.getBoundingClientRect();
  const relX = event.pageX - pos.x;
  const perc = relX / event.target.offsetWidth;
  pause(is_playing);
  shifter.percentagePlayed = perc;
  progressMeter.value = 100 * perc;
  currTime.innerHTML = shifter.timePlayed;
  if (is_playing) {
    play();
  }
});

// 修改后的回声滑块事件监听
echoSlider.addEventListener('input', function () {
    wetNode.gain.value = this.value;
    echoValue.textContent = this.value;
});

// 添加混响滑块事件监听
reverbSlider.addEventListener('input', function () {
    wetGain.gain.value = this.value;
    dryGain.gain.value = 1 - this.value;
    reverbValue.textContent = this.value;
});

// 添加空间环绕滑块事件监听
panSlider.addEventListener('input', function () {
    pannerNode.pan.value = this.value;
    panValue.textContent = this.value;
});
