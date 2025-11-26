## 项目概览

本项目是一个基于 Web Audio API 与 Tone.js 的「音乐氛围 / 游戏 BGM 中间件」实验工程，用于：

- **离线调音**：通过网页 UI 组合多种音频效果器，快速预设和试听不同「情景模式」（史诗、恐怖、怀旧等）。
- **在线驱动**：通过 C++ WebSocket 游戏模拟器，实时推送「游戏状态标签」，前端规则引擎被动响应并切换音效场景。
- **架构验证**：模拟真实游戏 + 音频中间件的解耦结构，为后续集成到实际游戏引擎打基础。

核心入口页面是 `pedalboard.html`，其 JS 逻辑分别由 `pedalboard.js`、`rules_engine.js`、`rules_engine2.js`、`game_simulator.js` 共同组成。

---

## 目录结构与子项目说明

### `basic/` — Web Audio API 最小可行性原型

- **定位**：最原始的实验场，用「纯 Web Audio API」验证以下能力：
  - 音量（Gain）控制
  - 音高（Playback Rate / Detune）调整
  - 播放速度（Time Stretch / Rate）变化
- **作用**：给后续基于 Tone.js 的实现提供心理模型和参考，实现「从零开始理解数字音频处理」。

### `effect/` — Tone.js 单效果器实验室

- **定位**：围绕 `Tone.js` 的「效果器 Demo 场」。
- **功能**：
  - 在独立页面中测试 Reverb / Delay / Chorus / Distortion / Phaser / AutoWah / AutoPanner / BitCrusher 等单个效果。
  - 每个效果都有简化 UI 按钮，方便快速试听开关、wet 值变化。
- **作用**：为后续在 `pedalboard.js` 中搭建完整效果链提供「单元级」感知和参数参考。

### `Gain/` — 增益与削波相关算法实验

- **定位**：与「声音响度 / 削波」相关的算法和验证工程。
- **内容**：
  - 关于增益（Gain）、削波（Clipping）、安全头间距等概念的对比测试。
  - 可视化或听觉上的 AB 对比，用于校准主增益与限制器（Limiter）的参数。
- **作用**：帮助在 `pedalboard.js` 中合理设定主增益和限制器，避免场景叠加时出现严重失真。

### `log/` — 调试与日志辅助（可选启用）

- **定位**：早期用于调试效果链状态的日志模块。
- **说明**：
  - 当前主线版本中，规则引擎的「打印当前状态」按钮已被注释为「参考实现」。
  - 当需要深入调试效果器参数（如 EQ 曲线、各节点 wet 值）时，可以恢复该日志模块的调用。

---

## 核心前端：混音台与规则引擎

### `pedalboard.html` — 项目 UI 入口

- **功能**：
  - 音频文件上传与基础播放控制（播放 / 暂停 / 停止）。
  - 播放速度高精度微调（默认 ±2%，步长 0.001，对应 3 位小数展示），适合「气氛微调」。
  - 场景切换按钮区：包含大量命名良好的「场景模式」，如史诗、怀旧、恐慌、梦幻、复古等。
  - 顶部「🎮 游戏状态模拟器 (AI Director)」控制面板，用于连接 C++ 后端。
- **设计目标**：作为「调音工作台 + Demo UI」，让音频设计师 / 程序可以直观操控 BGM 行为。

### `pedalboard.js` — 静态效果链与基础混音台

- **作用**：负责创建和连接真实的 Tone.js 节点，是「底层音频布线」的地方。
- **主要内容**：
  - 使用 `Tone.Player` 播放上传的音频，并通过 `Tone.Transport` 精确控制播放状态。
  - 搭建一条固定顺序的效果链：
    - Compressor → EQ3 → BitCrusher → Distortion → Tremolo → Vibrato → Chorus → FeedbackDelay → AutoPanner → StereoWidener → JCReverb → Limiter → Audio Destination
  - 使用 `MusicFXModule` 封装：
    - 统一初始化所有效果器（含 `.start()` 的 Tremolo / AutoPanner）。
    - 提供 `getEffect(name)` 与 `setPlaybackRate(value, rampTime)` 等 API。
  - 播放速度滑块逻辑：支持对 `Tone.Player.playbackRate` 做高精度、平滑控制。
- **特点**：
  - 所有效果默认 `wet = 0`，由规则引擎或测试逻辑按场景渐进启用。
  - Shuffle / reset 时会通过模块 API 平滑归零，防止参数残留。

### `rules_engine.js` — 早期测试版规则引擎（保留备份）

- **定位**：前期用于测试 `MusicFXModule.getEffect()` API 是否工作正常。
- **功能**：
  - 通过一组显式按钮控制单个效果器（如 Distortion / Chorus / Delay / Reverb）的开关与 wet 值。
  - 主要偏向「工程验证」而非正式场景逻辑。
- **当前状态**：
  - 对应的 HTML 按钮区已在 `pedalboard.html` 中被整体注释。
  - 如需调试，可：
    - 重新解除 HTML 按钮注释；
    - 与 `rules_engine.js` 联动，手动控制单个效果器。

### `rules_engine2.js` — 场景化、声明式的规则引擎（主线）

- **定位**：真正用于「场景驱动」的规则引擎，是本项目的核心逻辑。
- **主要特性**：
  - **声明式场景配置**：使用一个大型的 `SCENARIOS` 对象，以「场景名」为键，定义每个场景的：
    - 播放速率变化（`setRate(value, rampTime)`）
    - 各个效果器参数（EQ 曲线、失真深度、混响房间大小、wet 量、BitCrusher bits、Tremolo/Vibrato 频率和深度、AutoPanner 等）
  - **统一默认值管理**：`FX_DEFAULTS` 集中定义所有效果器的「安全默认值」，包括：
    - `eq3`、`distortion`、`bitCrusher`、`tremolo`、`vibrato`、`chorus`、`feedbackDelay`、`autoPanner`、`stereoWidener`、`jcReverb` 等。
  - **完整的重置逻辑**：`resetAllEffects()` 会：
    - 将播放速率平滑恢复到 `1.0`；
    - 对所有已注册效果器调用对应 `resetXxx()` 函数（本质上是若干次 `setParam(..., FX_DEFAULTS, RESET_RAMP_TIME)`）。
  - **场景切换节流与防抖**：
    - 使用 `pendingScenarioTimeoutId` 实现「打断并覆盖」的交互：在缓冲期内点击新场景会取消旧延时任务。
    - 结构是「重置 → 延迟 → 应用新场景」，保证场景之间不会混合残留。
  - **辅助函数**：
    - `setParam(node, param, value, rampTime)`：智能识别 Tone.Signal / AudioParam / 普通属性，在有能力时使用 `rampTo` 平滑过渡，否则直接赋值。
    - `setRate(value, rampTime)`：通过 `MusicFXModule.setPlaybackRate` 统一管理 `Tone.Player` 的播放速率。

- **场景集合（示例）**：
  - 情绪/叙事向：`epic`, `heroic`, `warmth`, `intimacy`, `memory` 等。
  - 氛围/空间向：`empty`, `underwater`, `dreamy`, `ethereal`。
  - 压迫/恐惧向：`anxiety`, `panic`, `suspense`, `horror`。
  - 音色/风格向：`lofi`, `cold`, `retro`, `dirty`, `robotic`, `glitch`, `psychedelic`。
  - 工具向：`test` 场景用于单独调整某一个效果器参数，方便调参。

- **对外接口**：
  - 通过挂载在 `window.GameAudioInterface` 上的：
    - `sendSignal(sceneKey: string)`：被动接收「游戏状态」或「模拟器事件」，内部自动调用 `applyScenario` 或 `resetAllEffects`。

---

## 后端与跨进程集成

### `game_simulator_cpp/` — C++ 游戏状态模拟器（WebSocket Server）

- **main.cpp**：
  - 使用 **WebSocket++ (header-only)** + **ASIO standalone** 搭建 WebSocket 服务器（端口 `9002`）。
  - 维护一个 `GAME_STATES` 向量，每个元素包含：
    - `key`: 与前端 `SCENARIOS` 对应的场景名（如 `epic`, `panic`, `dreamy`, `memory`, `test` 等）。
    - `weight`: 加权随机的权重值，决定出现概率（`reset` 比例较大，但不会压制其他模式）。
    - `label`: 在控制台中用于可读日志的英文说明。
  - 主逻辑：
    - 使用 `std::mt19937` + `std::uniform_int_distribution` 实现加权随机状态选择。
    - 每 5–15 秒随机等待一次，然后：
      - 生成新状态；
      - 打印 `[Game Sim] Change state -> <state>`；
      - 通过 `broadcastState()` 向所有 WebSocket 客户端广播该状态字符串。
  - 并发与连接管理：
    - 使用 `std::set<connection_hdl, ConnectionCompare>` 存储当前连接。
    - 使用 `std::mutex` 保护广播与连接增删。

- **CMakeLists.txt**：
  - 配置 C++11，包含 `third_party/websocketpp` 与 `third_party/asio/asio/include`。
  - 根据平台自动链接 `ws2_32`（Windows）或 `pthread`（Linux/macOS）。

- **README.md**：
  - 描述依赖安装（websocketpp, asio）、目录结构、CMake 构建与运行方式。
  - 提供前端集成示例，以及常见问题（端口冲突、头文件路径错误等）的排查方案。

### `game_simulator.js` — WebSocket 客户端与状态桥接层

- **功能**：
  - 作为浏览器端 WebSocket 客户端，连接 `ws://localhost:9002`。
  - 收到服务端发送的状态字符串（如 `"epic"`, `"panic"`, `"memory"`）后：
    - 在控制台打印 `[WebSocket] 收到状态: <state>`；
    - 如果存在 `window.GameAudioInterface`，调用 `sendSignal(state)`，触发前端规则引擎。
    - 在顶部 UI 面板更新「当前状态」标签，并根据是否为 `reset` 切换颜色（绿色/红色）。
  - 提供「启动/断开模拟器」按钮，用于手动控制连接。

- **状态标签映射**：
  - `STATE_LABELS` 为每个状态提供带 emoji 的中文说明，提升可读性与调试体验。
  - 若 C++ 新增状态键，只要同时在 `rules_engine2.js` 与 `STATE_LABELS` 中注册，即可无缝联动。

---

## 架构小结

### 整体数据流

- **本地文件 → Player**：
  1. 用户在 `pedalboard.html` 上传音频文件。
  2. `pedalboard.js` 中用 `Tone.Player` 加载并解码，接入效果链。

- **效果链构建**：
  - `MusicFXModule.init(player, masterGain)` 负责：
    - 创建固定顺序的多效果器链；
    - 插入安全 `Limiter`；
    - 暴露 `getEffect`/`setPlaybackRate` 接口给规则引擎和调试工具。

- **场景控制**：
  - 前端按钮点击 → 调用 `applyScenario(sceneKey)`：
    - `resetAllEffects()` 平滑归零；
    - 延迟 `APPLY_DELAY_MS` 后执行对应 `SCENARIOS[sceneKey].on()`。
  - C++ 模拟器 → WebSocket 消息 → `game_simulator.js` → `GameAudioInterface.sendSignal(sceneKey)`：
    - 与前端按钮触发完全等价，只是驱动源从「用户点击」变成「游戏状态」。

### 模块职责划分

- `pedalboard.js`：**音频图与基础行为**（如何连线、如何播放）。
- `rules_engine2.js`：**业务规则与音色设计**（在什么状态下、以多长时间、怎么调参数）。
- `game_simulator_cpp/main.cpp`：**游戏世界的时间轴**（什么时候换状态、状态空间是什么）。
- `game_simulator.js`：**进程 / 语言边界桥接**（把 C++ 的字符串事件翻译成 JS 的场景切换）。

这种划分保证了：
- 想调「听感」时，只需要改 `rules_engine2.js` 里的声明式配置。
- 想模拟「剧情/游戏节奏」时，只需要改 C++ 的状态池或权重。
- 想迁移到真实游戏引擎，只需让游戏直接调用相同的 WebSocket 协议或 `sendSignal` 接口。

---

## 后续可以优化的方向（建议）

- **参数面板化**：为 `test` 场景增加一个简易侧边栏，允许直接在 UI 输入数值（如 EQ、wet、bits），然后一键应用到当前场景。
- **状态可视化**：在前端画出当前效果链各节点的 wet 值 / 部分关键参数曲线，方便音频设计师理解场景差异。
- **预设导入导出**：将 `SCENARIOS` 中的参数支持 JSON 导出/导入，便于团队协作与版本管理。
- **真实引擎接入**：用与当前 C++ 模拟器相同的协议，将 Unity / Unreal / 自研引擎中的「GameState」直接推送过来，替换模拟器成为真正的「Runtime BGM 中间件」。

---

## 总结

本项目已经具备一个中小型游戏 BGM 系统所需的大部分骨架：

- 有 **清晰的效果链与安全增益处理**（`pedalboard.js`）。
- 有 **声明式且可扩展的场景规则引擎**（`rules_engine2.js`）。
- 有 **跨进程、跨语言的状态驱动通道**（`game_simulator_cpp` + `game_simulator.js`）。

后续的工作将主要集中在「调参、打磨与集成」，而非底层架构的重写，这正是一个音频中间件项目到达「可用雏形」的标志。 

