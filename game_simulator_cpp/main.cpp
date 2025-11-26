// 1. 定义独立运行宏 (必须在最前面)
#define ASIO_STANDALONE 
#define _WEBSOCKETPP_CPP11_STL_

// 2. 包含头文件
#include <websocketpp/config/asio_no_tls.hpp>
#include <websocketpp/server.hpp>

#include <iostream>
#include <thread>
#include <chrono>
#include <vector>
#include <random>
#include <string>
#include <set>
#include <mutex>

// 定义服务器类型
typedef websocketpp::server<websocketpp::config::asio> server;

// 使用 websocketpp 的命名空间
using websocketpp::lib::placeholders::_1;
using websocketpp::lib::placeholders::_2;
using websocketpp::lib::bind;

// 游戏状态定义
struct GameState {
    std::string key;      // 状态标识 ('reset', 'epic', 'anxiety' 等)
    int weight;           // 权重值
    std::string label;    // 显示标签
};

// 全局状态池
// 权重越大，被抽中的概率越高
const std::vector<GameState> GAME_STATES = {
    { "reset",       25, "Normal Exploration (Reset)" },
    { "epic",        10, "Epic Battle" },
    { "lofi",         8, "Lo-Fi / Flashback" },
    { "claustro",     7, "Claustrophobic" },
    { "anxiety",      8, "Anxiety" },
    { "heroic",       7, "Heroic Moment" },
    { "warmth",       7, "Warmth" },
    { "intimacy",     6, "Intimacy" },
    { "cold",         6, "Cold / Digital" },
    { "panic",        5, "Panic" },
    { "suspense",     5, "Suspense" },
    { "horror",       4, "Horror" },
    { "empty",        5, "Empty / Distant" },
    { "underwater",   4, "Underwater" },
    { "dreamy",       5, "Dreamy" },
    { "ethereal",     5, "Ethereal" },
    { "retro",        6, "Retro 80s" },
    { "dirty",        4, "Dirty / Industrial" },
    { "robotic",      4, "Robotic" },
    { "glitch",       3, "Glitch" },
    { "psychedelic",  4, "Psychedelic" },
    { "memory",       4, "Inner Monologue" }
    
};

// 加权随机选择器
std::string pickRandomState(std::mt19937& rng) {
    // 计算总权重
    int totalWeight = 0;
    for (const auto& state : GAME_STATES) {
        totalWeight += state.weight;
    }
    
    // 生成随机数
    std::uniform_int_distribution<int> dist(0, totalWeight - 1);
    int random = dist(rng);
    
    // 根据权重选择状态
    int currentWeight = 0;
    for (const auto& state : GAME_STATES) {
        currentWeight += state.weight;
        if (random < currentWeight) {
            return state.key;
        }
    }
    
    // 兜底返回第一个状态
    return GAME_STATES[0].key;
}

// 消息处理器类
class GameSimulator {
public:
    GameSimulator() {
        // 初始化服务器
        m_server.init_asio();
        
        // 设置消息处理器
        m_server.set_open_handler(bind(&GameSimulator::on_open, this, ::_1));
        m_server.set_close_handler(bind(&GameSimulator::on_close, this, ::_1));
        m_server.set_message_handler(bind(&GameSimulator::on_message, this, ::_1, ::_2));
    }
    
    void on_open(websocketpp::connection_hdl hdl) {
        std::lock_guard<std::mutex> lock(m_connection_mutex);
        m_connections.insert(hdl);
        std::cout << "[WebSocket] Client connected. Active connections: " << m_connections.size() << std::endl;
    }
    
    void on_close(websocketpp::connection_hdl hdl) {
        std::lock_guard<std::mutex> lock(m_connection_mutex);
        m_connections.erase(hdl);
        std::cout << "[WebSocket] Client disconnected. Active connections: " << m_connections.size() << std::endl;
    }
    
    void on_message(websocketpp::connection_hdl hdl, server::message_ptr msg) {
        // 接收客户端消息（可选，用于心跳或控制）
        std::cout << "[WebSocket] Received message: " << msg->get_payload() << std::endl;
    }
    
    // 广播状态给所有连接的客户端
    void broadcastState(const std::string& state) {
        std::lock_guard<std::mutex> lock(m_connection_mutex);
        
        if (m_connections.empty()) {
            std::cout << "[WebSocket] No clients connected. Skipping broadcast." << std::endl;
            return;
        }
        
        // 遍历所有连接并发送
        for (auto it = m_connections.begin(); it != m_connections.end();) {
            try {
                m_server.send(*it, state, websocketpp::frame::opcode::text);
                ++it;
            } catch (const websocketpp::exception& e) {
                std::cerr << "[WebSocket] 发送失败: " << e.what() << std::endl;
                it = m_connections.erase(it);
            }
        }
        
        std::cout << "[WebSocket] Broadcast state '" << state << "' to " << m_connections.size() << " clients." << std::endl;
    }
    
    void run() {
        // 监听端口 9002
        m_server.listen(9002);
        m_server.start_accept();
        
        std::cout << "[Server] WebSocket server started on port 9002." << std::endl;
        std::cout << "[Server] Waiting for clients..." << std::endl;
        
        // 在独立线程中运行服务器
        std::thread server_thread([this]() {
            try {
                m_server.run();
            } catch (const std::exception& e) {
                std::cerr << "[Server] Server runtime error: " << e.what() << std::endl;
            }
        });
        
        // 主线程运行游戏模拟循环
        gameLoop();
        
        // 等待服务器线程结束（通常不会到达这里）
        server_thread.join();
    }
    
private:
    server m_server;
    // 使用自定义比较器以兼容 C++11
    struct ConnectionCompare {
        bool operator()(const websocketpp::connection_hdl& a, const websocketpp::connection_hdl& b) const {
            return a.owner_before(b);
        }
    };
    std::set<websocketpp::connection_hdl, ConnectionCompare> m_connections;
    std::mutex m_connection_mutex;
    
    // 游戏循环
    void gameLoop() {
        // 初始化随机数生成器
        std::random_device rd;
        std::mt19937 rng(rd());
        std::uniform_int_distribution<int> delayDist(5000, 15000); // 5-15秒，单位毫秒
        
        std::cout << "[Game Sim] Simulation loop started." << std::endl;
        
        while (true) {
            // 1. 随机等待 5-15 秒
            int delayMs = delayDist(rng);
            std::cout << "[Game Sim] Waiting " << (delayMs / 1000.0) << " seconds..." << std::endl;
            std::this_thread::sleep_for(std::chrono::milliseconds(delayMs));
            
            // 2. 生成加权随机状态
            std::string nextState = pickRandomState(rng);
            
            // 3. 打印日志
            std::cout << "[Game Sim] Change state -> " << nextState << std::endl;
            
            // 4. 广播状态给所有连接的客户端
            broadcastState(nextState);
        }
    }
};

int main() {
    try {
        GameSimulator simulator;
        simulator.run();
    } catch (const std::exception& e) {
        std::cerr << "[Error] Fatal exception: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}

