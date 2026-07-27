# 🌑 Obsidian Panel

**Obsidian Panel** is a modern, high-performance Minecraft Server Management Panel built with **Node.js** and **React**. Designed to manage a single server with maximum efficiency and elegance, it provides a powerful web interface to control your Minecraft server, manage files, schedule backups, and monitor performance in real-time.

![Obsidian Panel Interface](images/dashboard.png)

## 🚀 Installation

### Prerequisites
- **Docker** (must be installed and running)
- **MongoDB** (running locally or remote connection URL)
- **RAM**: Minimum 2GB (4GB+ recommended)
- **OS**: Linux (Ubuntu/Debian/Alpine recommended)
- **Disk**: 5GB+ for server files and backups

### Method 1: Automated Install Script (Recommended) ⚡

The easiest way to install Obsidian Panel with a single command:

```bash
bash <(curl -s https://raw.githubusercontent.com/honeypie112/Obsidian-Panel/master/install.sh)
```

**What it does:**
- ✅ Checks Docker installation and starts the service
- ✅ Clones/updates the repository automatically
- ✅ Prompts for MongoDB URI (required)
- ✅ Builds Docker image with Java 8, 17, 21, and 25 pre-installed
- ✅ Creates and starts the container with proper port mappings
- ✅ Uses persistent Docker volume `obsidian-data` for server data
- ✅ Optional cleanup of source files after installation

**Access the panel:**
- Open http://localhost:5000 or http://YOUR_SERVER_IP:5000
- First registered user becomes **Admin**

---

### Method 2: Docker Compose

For manual control or custom configurations:

**1. Clone the repository**
```bash
git clone https://github.com/honeypie112/Obsidian-Panel.git
cd Obsidian-Panel
```

**2. Create `.env` file**

Create a `.env` file in the project root with your configuration:

```bash
nano .env
```

**Required variables:**
```env
# Database (Required)
MONGO_URI=mongodb://mongo:27017
MONGO_DB_NAME=obsidian_panel

# Server Configuration
PORT=5000
MC_SERVER_BASE_PATH=/minecraft_server
TEMP_BACKUP_PATH=/tmp/obsidian_backups
SESSION_SECRET=change_this_to_a_secure_random_string

# Optional: Custom Java paths (if needed)
# JAVA_8_HOME=/usr/lib/jvm/java-1.8-openjdk
# JAVA_17_HOME=/usr/lib/jvm/java-17-openjdk
# JAVA_21_HOME=/usr/lib/jvm/java-21-openjdk
```

> **Note**: If you're using an external MongoDB, replace `MONGO_URI` with your connection string (e.g., `mongodb://username:password@host:27017`)

**3. Start with Docker Compose**
```bash
docker-compose up -d
```

**4. Access the panel**
- Open http://localhost:5000
- First registered user becomes **Admin**

**To stop:**
```bash
docker-compose down
```

**To view logs:**
```bash
docker-compose logs -f obsidian-panel
```

### 🔄 Updating the Panel

To update to the latest version, simply run the installation script again:

```bash
bash <(curl -s https://raw.githubusercontent.com/honeypie112/Obsidian-Panel/master/install.sh)
```

The script will:
1. Detect your existing installation
2. Download the latest `alexbhai/obsidian-panel` image
3. Recreate the container while **keeping your server data safe** (volumes are preserved)

**For Docker Compose users:**
```bash
docker-compose pull
docker-compose up -d
```

### 🛠️ Development Setup

**Backend (Node.js)**
```bash
cd backend
npm install
npm run dev
```

**Frontend (React)**
```bash
cd frontend
npm install
npm run dev
```

Frontend dev server runs on http://localhost:5173
Backend dev server runs on http://localhost:5000

## ✨ Features

### 🎮 Server Management
- **Live Console**: Real-time log streaming via Socket.IO with 5000-line history buffer
    <br>
    ![Server Console](images/console.png)
- **Multi-Version Support**: Native support for **Paper**, **Purpur**, and **Vanilla** Minecraft servers
    <br>
    ![Multi-Version Support](images/multi-version.png)
- **Smart Java Detection**: Automatic discovery of Java 8, 17, 21, and 25 installations with version verification
- **Power Controls**: Start, Stop, Restart, and Force Kill with proper error handling

### ⚙️ Configuration
- **Server Settings**: Manage server properties, RAM allocation, and Java version through intuitive UI
    <br>
    ![Server Settings](images/server-settings.png)
- **Environment Configuration**: Support for custom Java paths via `JAVA_X_HOME` environment variables
- **Hot Reload**: Configuration changes apply immediately without container restarts

### 📁 File Manager
- **Full-featured File Browser**: Upload, download, edit, delete with drag-and-drop support
- **Built-in Code Editor**: Monaco editor for direct file editing
- **Archive Handling**: Extract ZIP/TAR archives and create compressed backups
    <br>
    ![File Manager](images/file-manager.png)
    <br>
    ![Drag and Drop](images/drag-and-drop.png)
  <br>
    ![editor ui](images/editor.png)
- **Chunked Uploads**: Large file support with resumable uploads

### 💾 Backup System
- **Unlimited Cloud Storage**: Seamless integration with **GoFile** for infinite backups
- **Automated Scheduling**: Cron-based backup scheduler (minutely, hourly, daily, custom expressions)
- **One-Click Restore**: Restore from any backup with safety safeguards
- **Encrypted Archives**: Password-protected backup files
    <br>
    ![Backup System](images/backup-system.png)
  <br>
    ![backup-note-feature](images/backup-note-feature.png)
### 🔌 Plugin Management  
- **Unified Plugin Store**: Search and install from **Modrinth**, **Hangar** (Paper), and **Spiget** (Spigot)
- **One-Click Installation**: Automatic plugin download and installation
    <br>
    ![Plugin Store](images/plugin-store.png)
    <br>
    ![Plugin Store Installation](images/plugin-store-2.png)

- **Updater UI**: easy and simple panel update reminder
    <br>
    ![Updater UI](images/update.png)

### 👥 User Management
- **Role-Based Access Control (RBAC)**: Create sub-admin accounts with granular permissions
- **Permissions**:
  - **Files**: View, Edit, Upload/Create, Delete
  - **Backups**: Create, Restore, Delete, Settings
  - **Power**: Start/Stop/Restart
  - **Console**: Command Execution
    <br>
    ![User Management](images/user-management.png)

### 🎨 User Experience
- **Responsive Design**: Fully optimized for desktop and mobile with collapsible sidebar
- **Toast Notifications**: Real-time error and success messages
- **Obsidian Dark Theme**: Glassmorphism effects with smooth animations
- **Real-time Updates**: WebSocket-powered live status and statistics
    <br>
    ![Profile Settings](images/profile.png)

### 🔒 Security
- **Enterprise-Grade Security**:
  - **Rate Limiting**: Global DDoS protection with per-IP limits
  - **Authentication**: Bcrypt password hashing with secure sessions
  - **CORS Protection**: Configurable cross-origin policies
  - **Path Validation**: Directory traversal prevention
  - **Session Management**: MongoDB-backed sessions with secure cookies

## 🛠️ Tech Stack

### Backend (Node.js)
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Real-time**: Socket.IO
- **Sessions**: express-session with connect-mongo
- **Security**: Helmet, Rate Limit, Bcrypt, CORS
- **System**: Child Process for Java management

### Frontend (React)
- **Build Tool**: Vite
- **Framework**: React 18+
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Editor**: Monaco Editor (VS Code editor)
- **Routing**: React Router 6
- **Toast**: React Hot Toast
- **Real-time**: Socket.IO Client

### Infrastructure
- **Containerization**: Docker multi-stage builds (Node.js Alpine)
- **Java**: OpenJDK 8, 17, and 21 support
- **Database**: MongoDB
- **Reverse Proxy Compatible**: Nginx, Caddy, Traefik

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Backend server port |
| `MONGO_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGO_DB_NAME` | `obsidian_panel` | Database name |
| `SESSION_SECRET` | `secret` | Secret key for session signing |
| `MC_SERVER_BASE_PATH` | `/minecraft_server` | Minecraft server files location |
| `TEMP_BACKUP_PATH` | `/tmp/obsidian_backups` | Temporary backup storage |
| `JAVA_8_HOME` | Auto-detected | Override Java 8 location |
| `JAVA_17_HOME` | Auto-detected | Override Java 17 location |
| `JAVA_21_HOME` | Auto-detected | Override Java 21 location |

### Java Detection

The backend automatically detects Java installations in `/usr/lib/jvm/`. You can override with environment variables:

```bash
JAVA_17_HOME=/opt/java/jdk-17 npm start
```

Detection order:
1. `JAVA_X_HOME` environment variable
2. Directory scan in `/usr/lib/jvm/`
3. Fallback to hardcoded paths

All candidates are verified with `java -version` to ensure correct version.

## 📖 Usage Guide

### Initial Setup
1. **Register Admin Account**: First user becomes administrator
2. **Install Server**: Go to Server Settings → Select Version → Install
3. **Configure RAM**: Set memory allocation in Server Settings
4. **Select Java Version**: Choose Java 8/17/21 based on Minecraft version
5. **Start Server**: Click Start button on Overview page

### Backup Configuration
1. **Get GoFile Token**: Register at gofile.io and get API token
2. **Configure**: Backups → Settings → Enter token
3. **Schedule**: Set cron expression (e.g., `0 */6 * * *` for every 6 hours)
4. **Manual Backup**: Click "Create Backup" button

### User Management
1. **Create User**: Users → Add User
2. **Set Role**: Choose Admin or custom role
3. **Grant Permissions**: Select specific permissions
4. **Save**: User can login with credentials

## 🔍 Troubleshooting

### Server Won't Start
- **Check Java**: Ensure correct Java version installed
- **Verify Logs**: Check console for error messages
- **Toast Notifications**: Error details shown in UI
- **Backend Logs**: `docker logs obsidian-panel`

### Memory Issues
- **Insufficient RAM**: Increase Docker memory limit
- **Large Logs**: Log buffer limited to 5000 lines
- **Backup Space**: Monitor `/tmp/obsidian_backups` usage

### Connection Issues
- **Port Conflicts**: Ensure port 5000 is available
- **MongoDB**: Verify database connection
- **CORS**: Check frontend URL in environment

## 🐳 Docker Deployment

**Run manually:**
```bash
docker run -d \
  -p 5000:5000 \
  -p 25565:25565 \
  -e MONGO_URI=mongodb://host:27017 \
  -e SESSION_SECRET=mysecuresecret \
  -v minecraft_data:/minecraft_server \
  --name obsidian-panel \
  alexbhai/obsidian-panel:latest
```

**Docker Compose (not recommended but optional if you know what you're doing):**
```yaml
version: '3.8'
services:
  obsidian-panel:
    image: alexbhai/obsidian-panel:latest
    container_name: obsidian-panel
    ports:
      - "5000:5000"
      - "25565:25565"
      - "19132:19132/udp"  
    environment:
      - MONGO_URI=mongodb://admin:secretpassword@mongo:27017/obsidian_panel?authSource=admin
      - MONGO_DB_NAME=obsidian_panel
      - SESSION_SECRET=mysecuresecret
    volumes:
      - minecraft_data:/minecraft_server
    depends_on:
      - mongo

  mongo:
    image: mongo:latest
    container_name: mongo
    restart: always
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=secretpassword
    volumes:
      - mongo_data:/data/db

volumes:
  minecraft_data:
  mongo_data:
```

## 📝 API Documentation

The backend provides RESTful API endpoints:

- **Authentication**: `/api/auth` (login, register, logout)
- **Server Control**: `/api/control` (start, stop, restart, kill)
- **File Management**: `/files/*` (list, read, write, upload)
- **Backups**: `/api/backups` (create, restore, delete, configure)
- **Plugins**: `/api/plugins` (search, install)
- **Users**: `/api/users` (CRUD operations)

WebSocket events:
- `status` - Server status updates
- `console_log` - Live log streaming
- `log_history` - Historical logs on connect
- `stats` - System statistics (CPU, RAM, disk, network)

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - feel free to use for personal or commercial projects.

## 🙏 Acknowledgments

- Built with ❤️ using Node.js and React
- Inspired by modern server management panels
- Community feedback and contributions

---

**Need help?** Open an issue or join our Discord community.
