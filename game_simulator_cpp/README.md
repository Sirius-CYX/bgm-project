# C++ 游戏状态模拟器 (WebSocket Server)

这是一个独立的 C++ 控制台程序，用于模拟游戏状态变化，并通过 WebSocket 协议向前端音频引擎广播指令。

## 功能特性

- 在端口 9002 启动 WebSocket 服务器
- 使用加权随机算法生成游戏状态（Reset 概率最高）
- 每 5-15 秒随机切换一次状态
- 自动广播状态给所有连接的客户端

## 环境要求

### 必需库

1. **websocketpp** (Header-only 库)
   - 下载地址：https://github.com/zaphoyd/websocketpp
   - 版本要求：0.8.2 或更高

2. **asio** (Standalone 版本，无需 Boost)
   - 下载地址：https://github.com/chriskohlhoff/asio
   - 版本要求：1.18.0 或更高

### 编译器要求

- **Windows**: Visual Studio 2015 或更高版本（支持 C++11）
- **Linux**: GCC 4.8+ 或 Clang 3.3+
- **macOS**: Xcode 8.0+ 或 Clang

## 项目结构

```
game_simulator_cpp/
├── main.cpp              # 主程序文件
├── CMakeLists.txt        # CMake 构建文件
├── README.md             # 本文件
└── third_party/          # 第三方库目录（需要手动创建）
    ├── websocketpp/       # websocketpp 库
    └── asio/              # asio 库
        └── asio/
            └── include/   # asio 头文件
```

## 安装步骤

### 1. 下载依赖库

#### 方法 A: 使用 Git（推荐）

```bash
# 在 game_simulator_cpp 目录下创建 third_party 文件夹
mkdir -p third_party
cd third_party

# 克隆 websocketpp
git clone https://github.com/zaphoyd/websocketpp.git

# 克隆 asio
git clone https://github.com/chriskohlhoff/asio.git
```

#### 方法 B: 手动下载

1. 访问 https://github.com/zaphoyd/websocketpp/releases 下载最新版本
2. 访问 https://github.com/chriskohlhoff/asio/releases 下载最新版本
3. 解压到 `third_party` 目录，确保目录结构如下：
   ```
   third_party/
   ├── websocketpp/          # websocketpp 的根目录
   └── asio/
       └── asio/
           └── include/      # asio 头文件
   ```

### 2. 编译项目

#### Windows (使用 Visual Studio)

```bash
# 创建构建目录
mkdir build
cd build

# 生成 Visual Studio 解决方案
cmake .. -G "Visual Studio 16 2019" -A x64

# 编译（或使用 Visual Studio 打开生成的 .sln 文件）
cmake --build . --config Release
```

#### Linux/macOS

```bash
# 创建构建目录
mkdir build
cd build

# 生成 Makefile
cmake ..

# 编译
make

# 运行
./game_simulator
```

## 使用方法

### 启动服务器

```bash
# Windows
.\build\Release\game_simulator.exe

# Linux/macOS
./build/game_simulator
```

服务器启动后会：
- 监听端口 9002
- 等待 WebSocket 客户端连接
- 每 5-15 秒随机生成并广播游戏状态

### 控制台输出示例

```
[Server] WebSocket 服务器已启动，监听端口 9002
[Server] 等待客户端连接...
[Game Sim] 游戏模拟循环已启动
[Game Sim] 等待 8.234 秒...
[WebSocket] 新客户端连接，当前连接数: 1
[Game Sim] 状态变更: reset
[WebSocket] 已广播状态 'reset' 给 1 个客户端
[Game Sim] 等待 12.567 秒...
[Game Sim] 状态变更: epic
[WebSocket] 已广播状态 'epic' 给 1 个客户端
```

## 前端集成

前端代码已自动集成 WebSocket 客户端。`game_simulator.js` 会自动连接到 `ws://localhost:9002`。

### 手动连接示例

如果需要手动连接，可以使用以下代码：

```javascript
const ws = new WebSocket('ws://localhost:9002');

ws.onopen = () => {
    console.log('已连接到游戏模拟器服务器');
};

ws.onmessage = (event) => {
    const state = event.data; // 'reset', 'epic', 'anxiety' 等
    if (window.GameAudioInterface) {
        window.GameAudioInterface.sendSignal(state);
    }
};

ws.onerror = (error) => {
    console.error('WebSocket 错误:', error);
};

ws.onclose = () => {
    console.log('连接已关闭');
};
```

## 状态定义

| 状态键 | 权重 | 说明 |
|--------|------|------|
| reset | 50 | 正常探索状态（概率最高） |
| epic | 15 | 激烈战斗 |
| anxiety | 15 | 生命垂危 |
| lofi | 10 | 回忆杀 |
| claustro | 10 | 钻入地道 |

## 故障排除

### 编译错误：找不到头文件

- 检查 `third_party` 目录结构是否正确
- 确认 `CMakeLists.txt` 中的 `include_directories` 路径是否正确

### 链接错误：找不到 ws2_32 (Windows)

- 确保 `CMakeLists.txt` 中已添加 `target_link_libraries(game_simulator ws2_32)`

### 运行时错误：端口被占用

- 检查端口 9002 是否被其他程序占用
- 可以修改 `main.cpp` 中的端口号（第 145 行）

## 许可证

本项目代码可自由使用。websocketpp 和 asio 库遵循各自的许可证。

