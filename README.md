# 🚀 Clash Node IP CHECKER - Node.js 版本

这是 [Clash IP Checker](https://github.com/tombcato/clash-ip-checker/) 的 Node.js 实现版本，功能与 Python 版本完全一致。

Clash IP Checker 地址 : https://github.com/tombcato/clash-ip-checker/

## 📦 安装说明

1. **确保已安装 Node.js 16+**

2. **安装依赖**
   ```bash
   cd nodejs
   npm install
   ```

3. **安装 Playwright 浏览器**
   
   **使用国内镜像源加速下载（推荐）：**
   
   **Windows (PowerShell):**
   ```powershell
   $env:PLAYWRIGHT_DOWNLOAD_HOST = "https://npmmirror.com/mirrors/playwright"
   $env:NPM_CONFIG_REGISTRY="https://registry.npmjs.org/"
   npx playwright install chromium
   ```
   
   **Windows (CMD):**
   ```cmd
   set PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright
   set NPM_CONFIG_REGISTRY=https://registry.npmjs.org/
   npx playwright install chromium
   ```
   
   **Linux/Mac:**
   ```bash
   export PLAYWRIGHT_DOWNLOAD_HOST="https://npmmirror.com/mirrors/playwright"
   export NPM_CONFIG_REGISTRY="https://registry.npmjs.org/"
   npx playwright install chromium
   ```
   
   > 注意：这些环境变量只在当前终端会话有效。如果需要永久设置，可以添加到系统环境变量或 shell 配置文件中。

4. **配置文件**
   - 复制 `config.yaml.example` 为 `config.yaml`
   - 编辑 `config.yaml` 填入你的信息：
     - `yaml_path`: 你的 Clash 配置文件的绝对路径
     - `clash_api_url`: Clash External Controller URL（默认 `http://127.0.0.1:9097`）
     - `clash_api_secret`: API 密钥（如果有的话）

## 🚀 使用方法

1. 打开你的 Clash 客户端（例如 Clash Verge），确保 External Controller 已开启
2. 运行脚本：
   ```bash
   npm start
   # 或
   node clash_automator.js
   ```
3. 脚本将会自动测试所有代理节点并生成 `_checked.yaml` 文件

## 📝 功能特点

- ✅ 与 Python 版本逻辑完全一致
- ✅ 自动遍历并切换 Clash 代理节点
- ✅ 通过 ippure.com 检测 IP 纯净度、Bot 比例、IP 属性等信息
- ✅ 智能缓存机制，相同 IP 不重复检测
- ✅ 自动跳过无效节点（如"到期"、"流量重置"等）
- ✅ 生成带标注的新配置文件

## 🔍 结果格式

格式：`【🟢🟡 属性|来源】`

- **第 1 个 Emoji**: IP 纯净度（值越低越好）
- **第 2 个 Emoji**: Bot 比例（值越低越好）
- **属性**: 机房、住宅
- **来源**: 原生、广播

### 评分对照表

| 范围 | Emoji | 含义 |
| :--- | :---: | :--- |
| **0 - 10%** | ⚪ | **极佳** |
| **11 - 30%** | 🟢 | **优秀** |
| **31 - 50%** | 🟡 | **良好** |
| **51 - 70%** | 🟠 | **中等** |
| **71 - 90%** | 🔴 | **差** |
| **> 90%** | ⚫ | **极差** |

## 📂 项目结构

```
nodejs/
├── core/
│   ├── ip_checker.js      # IP检测核心模块
│   └── clash_api.js       # Clash API控制器
├── utils/
│   └── config_loader.js   # 配置文件加载器
├── clash_automator.js     # 主程序入口
├── ipcheck.js             # 独立的IP检测脚本（测试用）
├── config.yaml.example    # 配置文件模板
├── package.json           # 项目依赖
└── README.md             # 本文件
```

## ⚠️ 注意事项

- 需要确保 Clash 客户端已启动并开启了 External Controller
- 首次运行需要安装 Playwright 浏览器（`npx playwright install chromium`）
  - 如果下载速度慢，可以使用国内镜像源加速（参考上面的设置方法）
- 配置文件路径需要使用绝对路径
- Windows 系统下路径可以使用单引号避免转义问题

## 🔧 依赖项

- `playwright`: 浏览器自动化
- `axios`: HTTP 客户端
- `js-yaml`: YAML 配置文件解析

## 📄 许可证

MIT License

