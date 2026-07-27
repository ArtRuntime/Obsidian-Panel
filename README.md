# Obsidian Panel

**Obsidian Panel** is a modern, high-performance Minecraft Server Management Panel built with **Node.js** and **React**. Designed to manage a single server with maximum efficiency and elegance, it provides a powerful web interface to control your Minecraft server, manage files, schedule backups, edit server properties, and monitor performance in real-time.

![Obsidian Panel Interface](images/dashboard.png)

## Installation

### Prerequisites
- **Docker** or **Podman** (installed and running)
- **MongoDB** (running locally or remote connection URL)
- **RAM**: Minimum 2GB (4GB+ recommended)
- **OS**: Linux (Ubuntu/Debian/Alpine recommended)
- **Disk**: 5GB+ for server files and backups

### Method 1: Automated Install Script (Recommended)

The easiest way to install Obsidian Panel with a single command:

```bash
bash <(curl -s https://raw.githubusercontent.com/ArtRuntime/Obsidian-Panel/master/install.sh)
```

**What it does:**
- Checks Docker or Podman installation and starts the service if needed
- Prompts for MongoDB URI (required)
- Prompts for Web UI Port (default: 5000)
- Builds/Pulls container image with Java 8, 17, 21, and 25 pre-installed
- Exposes Web UI port, Minecraft Java (25565), Bedrock (19132), and Voice Chat (24454) with option for extra ports
- Creates and starts the container with proper volume mappings (`obsidian-data`)

**Access the panel:**
- Open http://localhost:5000 or http://YOUR_SERVER_IP:5000 (or your custom Web UI port)
- First registered user becomes **Admin**

---

### Method 2: Docker Compose

For manual control or custom configurations:

**1. Clone the repository**
```bash
git clone https://github.com/ArtRuntime/Obsidian-Panel.git
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

# Optional: Custom Java paths
# JAVA_8_HOME=/usr/lib/jvm/java-1.8-openjdk
# JAVA_17_HOME=/usr/lib/jvm/java-17-openjdk
# JAVA_21_HOME=/usr/lib/jvm/java-21-openjdk
# JAVA_25_HOME=/usr/lib/jvm/java-25-openjdk
```

> **Note**: If using external MongoDB, replace `MONGO_URI` with your connection string (e.g., `mongodb://username:password@host:27017`)

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

### Updating the Panel

To update to the latest version, run the installation script again:

```bash
bash <(curl -s https://raw.githubusercontent.com/ArtRuntime/Obsidian-Panel/master/install.sh)
```

The script will:
1. Detect your existing installation
2. Download the latest `alexbhai/obsidian-panel` image
3. Recreate the container while keeping your server data safe in persistent volumes

**For Docker Compose users:**
```bash
docker-compose pull
docker-compose up -d
```

### Development Setup

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

## Features

### Server Management
- **Live Console**: Real-time log streaming via Socket.IO with 5000-line history buffer
    <br>
    ![Server Console](images/console.png)
- **Multi-Version Support**: Native support for Paper, Purpur, and Vanilla Minecraft servers
    <br>
    ![Multi-Version Support](images/multi-version.png)
- **Smart Java Detection**: Automatic discovery of Java 8, 17, 21, and 25 installations with version verification
- **Power Controls**: Start, Stop, Restart, and Force Kill with status tracking

### Game Settings Editor
- **Visual properties editor**: Dynamic tabs for Core, Network, World, Performance, Players & Security, Resource Pack, and Advanced rules
- **Server Icon Manager**: Upload any image to automatically convert and apply a 64x64 PNG `server-icon.png`
    <br>
    ![Game Settings](images/game-settings.png)

### Configuration
- **Server Settings**: Manage server RAM allocation, Java version selection, and storage providers
    <br>
    ![Server Settings](images/server-settings.png)
- **Environment Configuration**: Support for custom Java paths via `JAVA_X_HOME` environment variables
- **Hot Reload**: Configuration updates apply without requiring container rebuilds

### Server Templates
- **Template System**: Deploy pre-configured Minecraft server templates and world setups
    <br>
    ![Server Templates](images/server-templates.png)

### File Manager
- **Full-featured File Browser**: Upload, download, edit, and delete files with drag-and-drop support
- **Built-in Code Editor**: Monaco editor for direct file editing
- **Archive Extraction & Password Support**: Support for ZIP, TAR, 7Z, and RAR with password decryption
- **Remote cURL Downloader**: Download direct files into server directory with custom headers, automatic filename detection, and file collision auto-incrementing
    <br>
    ![File Manager](images/file-manager.png)
    <br>
    ![Drag and Drop](images/drag-and-drop.png)
    <br>
    ![Editor UI](images/editor.png)
    <br>
    ![Remote File Downloader](images/remote-file-download.png)
- **Chunked Uploads**: Support for large file uploads

### Backup System
- **Cloud Storage Integration**: Built-in support for **Buzzheavier** and **GoFile** providers
- **Automated Scheduling**: Cron-based backup scheduler (minutely, hourly, daily, custom expressions)
- **One-Click Restore**: Restore from any backup with safeguards
- **Encrypted Archives**: Password-protected backup compression
    <br>
    ![Backup System](images/backup-system.png)
    <br>
    ![Backup Note Feature](images/backup-note-feature.png)

### Task Scheduler
- **Automated Tasks**: Schedule commands, server restarts, and automatic backups with cron syntax or preset intervals
    <br>
    ![Task Scheduler](images/schedue-task.png)

### Plugin Management  
- **Unified Plugin Store**: Search and install from Modrinth, Hangar (Paper), and Spiget (Spigot)
- **One-Click Installation**: Automatic plugin download and placement
    <br>
    ![Plugin Store](images/plugin-store.png)
    <br>
    ![Plugin Store Installation](images/plugin-store-2.png)
- **Updater UI**: Dashboard notifications for panel updates
    <br>
    ![Updater UI](images/update.png)

### User Management
- **Role-Based Access Control (RBAC)**: Create sub-admin accounts with granular permissions
- **Permissions**:
  - **Files**: View, Edit, Upload/Create, Delete
  - **Backups**: Create, Restore, Delete, Settings
  - **Power**: Start/Stop/Restart
  - **Console**: Command Execution
    <br>
    ![User Management](images/user-management.png)

### User Experience
- **Responsive Design**: Mobile and desktop friendly layout with collapsible navigation
- **Obsidian Dark Theme**: Glassmorphism design with clean input controls
- **Real-time Statistics**: WebSocket-powered CPU, RAM, storage, and network bandwidth monitoring
    <br>
    ![Profile Settings](images/profile.png)

### Security
- **Rate Limiting**: Protection with configurable IP limits
- **Authentication**: Bcrypt password hashing with session tokens
- **Path Validation**: Strict directory traversal prevention
- **Session Management**: MongoDB-backed sessions with secure cookies

## Tech Stack

### Backend (Node.js)
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Real-time**: Socket.IO
- **Security**: Helmet, Rate Limit, Bcrypt, CORS
- **Process Tools**: Child Process, ImageMagick, p7zip/7zip, cURL

### Frontend (React)
- **Build Tool**: Vite
- **Framework**: React 18+
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Editor**: Monaco Editor
- **Routing**: React Router 6

### Infrastructure
- **Containerization**: Docker multi-stage builds (Node.js Alpine)
- **Java**: OpenJDK 8, 17, 21, and 25 support
- **Database**: MongoDB

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Web UI and backend server port |
| `MONGO_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGO_DB_NAME` | `obsidian_panel` | Database name |
| `SESSION_SECRET` | `secret` | Secret key for session signing |
| `MC_SERVER_BASE_PATH` | `/minecraft_server` | Minecraft server files location |
| `TEMP_BACKUP_PATH` | `/tmp/obsidian_backups` | Temporary backup storage |
| `JAVA_8_HOME` | Auto-detected | Override Java 8 location |
| `JAVA_17_HOME` | Auto-detected | Override Java 17 location |
| `JAVA_21_HOME` | Auto-detected | Override Java 21 location |
| `JAVA_25_HOME` | Auto-detected | Override Java 25 location |

## Troubleshooting

### Server Won't Start
- **Check Java**: Ensure correct Java version is selected for your server jar
- **Verify Logs**: Check live console for startup crash tracebacks
- **Backend Logs**: Run `docker logs obsidian-panel`

### Archive Extraction Issues
- **Password Error**: Ensure password is provided if archive is encrypted
- **Binary Check**: Container includes 7z/7za/unzip tools for ZIP, 7Z, RAR, and TAR archives

### Connection Issues
- **Port Conflicts**: Ensure your selected Web UI port is available
- **MongoDB**: Verify connection string and network accessibility

## Container Deployment

### Docker Run

```bash
docker run -d \
  --name obsidian-panel \
  --restart unless-stopped \
  -p 5000:5000/tcp \
  -p 25565:25565/tcp -p 25565:25565/udp \
  -p 19132:19132/tcp -p 19132:19132/udp \
  -p 24454:24454/tcp -p 24454:24454/udp \
  -e MONGO_URI="mongodb://your-mongo-host:27017" \
  -e MONGO_DB_NAME="obsidian-panel" \
  -e PORT="5000" \
  -e SESSION_SECRET="your_secure_random_secret_key" \
  -v obsidian-data:/minecraft_server:rw \
  docker.io/alexbhai/obsidian-panel:latest
```

### Podman Run

```bash
podman run -d \
  --name obsidian-panel \
  --restart unless-stopped \
  -p 5000:5000/tcp \
  -p 25565:25565/tcp -p 25565:25565/udp \
  -p 19132:19132/tcp -p 19132:19132/udp \
  -p 24454:24454/tcp -p 24454:24454/udp \
  -e MONGO_URI="mongodb://your-mongo-host:27017" \
  -e MONGO_DB_NAME="obsidian-panel" \
  -e PORT="5000" \
  -e SESSION_SECRET="your_secure_random_secret_key" \
  -v obsidian-data:/minecraft_server:rw \
  docker.io/alexbhai/obsidian-panel:latest
```

## API Documentation

The backend provides RESTful API endpoints:

- **Authentication**: `/api/auth` (login, register, logout)
- **Server Control**: `/api/control` (start, stop, restart, kill, public-ip)
- **File Management**: `/api/control/files/*` (list, read, write, upload, extract, remote-download, server-icon)
- **Backups**: `/api/backups` (create, restore, delete, configure)
- **Plugins**: `/api/plugins` (search, install)
- **Users**: `/api/users` (CRUD operations)

WebSocket events:
- `status` - Server status updates
- `console_log` - Live log streaming
- `stats` - Real-time CPU, RAM, disk, and network stats

## License

MIT License - feel free to use for personal or commercial projects.
