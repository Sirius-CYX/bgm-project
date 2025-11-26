cmake_minimum_required(VERSION 3.10)
project(GameSimulator)

# 设置 C++ 标准
set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 包含目录：假设 websocketpp 和 asio 在项目根目录的 third_party 文件夹中
# 用户需要根据实际路径调整
include_directories(
    ${CMAKE_SOURCE_DIR}/third_party/websocketpp
    ${CMAKE_SOURCE_DIR}/third_party/asio/asio/include
)

# 添加可执行文件
add_executable(game_simulator main.cpp)

# 链接系统库（Windows 需要 ws2_32，Linux 需要 pthread）
if(WIN32)
    target_link_libraries(game_simulator ws2_32)
else()
    target_link_libraries(game_simulator pthread)
endif()

# 编译选项
if(MSVC)
    # Windows MSVC 编译器选项
    target_compile_options(game_simulator PRIVATE /W4)
else()
    # GCC/Clang 编译器选项
    target_compile_options(game_simulator PRIVATE -Wall -Wextra)
endif()

