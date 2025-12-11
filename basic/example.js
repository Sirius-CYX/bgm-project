import { PitchShifter } from './lib.js';

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const gainNode = audioCtx.createGain();
let shifter;
let is_playing = false;

const playBtn = document.getElementById('play');
const tempoSlider = document.getElementById('tempoSlider');
const tempoOutput = document.getElementById('tempo');
const pitchSlider = document.getElementById('pitchSlider');
const pitchOutput = document.getElementById('pitch');
const volumeSlider = document.getElementById('volumeSlider');
const volumeOutput = document.getElementById('volume');
const currTime = document.getElementById('currentTime');
const duration = document.getElementById('duration');
const progressMeter = document.getElementById('progressMeter');
const fileInput = document.getElementById('fileInput');
const statusText = document.getElementById('statusText');

// Initialize display values
function updateDisplayValue(element, value) {
    element.textContent = parseFloat(value).toFixed(3);
}

updateDisplayValue(tempoOutput, tempoSlider.value);
updateDisplayValue(pitchOutput, pitchSlider.value);
updateDisplayValue(volumeOutput, volumeSlider.value);

// Initialize gain node
gainNode.gain.value = volumeSlider.value;
gainNode.connect(audioCtx.destination);

const loadSource = function (url) {
    playBtn.setAttribute('disabled', 'disabled');
    statusText.textContent = 'Loading audio...';
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
                    currTime.textContent = detail.formattedTimePlayed;
                    progressMeter.value = detail.percentagePlayed;
                });
                duration.textContent = shifter.formattedDuration;
                playBtn.removeAttribute('disabled');
                statusText.textContent = 'Ready to play';
            });
        })
        .catch((error) => {
            console.error('Error loading audio:', error);
            statusText.textContent = 'Failed to load audio';
        });
};

fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        loadSource(url);
        statusText.textContent = `Loaded: ${file.name}`;
    }
});

const play = function () {
    if (!shifter) {
        statusText.textContent = 'Please upload an audio file first';
        return;
    }
    
    if (is_playing) {
        // Pause
        shifter.disconnect();
        audioCtx.suspend();
        is_playing = false;
        playBtn.textContent = 'Play';
        statusText.textContent = 'Paused';
    } else {
        // Play or Resume
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().then(() => {
                shifter.connect(gainNode);
                is_playing = true;
                playBtn.textContent = 'Pause';
                statusText.textContent = 'Playing...';
            });
        } else {
            shifter.connect(gainNode);
            is_playing = true;
            playBtn.textContent = 'Pause';
            statusText.textContent = 'Playing...';
        }
    }
};

playBtn.addEventListener('click', play);

// Update slider event listeners
tempoSlider.addEventListener('input', function () {
    if (shifter) {
        shifter.tempo = this.value;
    }
    updateDisplayValue(tempoOutput, this.value);
});

pitchSlider.addEventListener('input', function () {
    if (shifter) {
        shifter.pitch = this.value;
    }
    updateDisplayValue(pitchOutput, this.value);
});

volumeSlider.addEventListener('input', function () {
    gainNode.gain.value = this.value;
    updateDisplayValue(volumeOutput, this.value);
});

progressMeter.addEventListener('click', function (event) {
    if (!shifter) return;
    const pos = event.target.getBoundingClientRect();
    const relX = event.pageX - pos.x;
    const perc = relX / event.target.offsetWidth;
    const wasPlaying = is_playing;
    
    if (wasPlaying) {
        shifter.disconnect();
        audioCtx.suspend();
        is_playing = false;
    }
    
    shifter.percentagePlayed = perc;
    progressMeter.value = 100 * perc;
    currTime.textContent = shifter.formattedTimePlayed;
    
    if (wasPlaying) {
        audioCtx.resume().then(() => {
            shifter.connect(gainNode);
            is_playing = true;
        });
    }
});
