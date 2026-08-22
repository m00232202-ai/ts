const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let server;
let PORT = 0;

const GAME_DIR = path.join(__dirname, 'game');

// Поднимаем локальный HTTP-сервер и раздаём файлы игры через http://127.0.0.1
// Это нужно потому, что игра использует ES-модули (import ...) и подключает
// three.js / Firebase / PeerJS по сети. Chromium (на котором построен Electron)
// блокирует ES-модули при открытии файла напрямую через file://, поэтому
// раздача через localhost — самый надёжный вариант.
function startServer() {
    return new Promise((resolve) => {
        server = http.createServer((req, res) => {
            const safeUrl = decodeURIComponent(req.url.split('?')[0]);
            let filePath = path.join(GAME_DIR, safeUrl === '/' ? 'index.html' : safeUrl);

            // защита от выхода за пределы папки game/
            if (!filePath.startsWith(GAME_DIR)) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }

            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404);
                    res.end('Not found');
                    return;
                }
                const ext = path.extname(filePath).toLowerCase();
                const types = {
                    '.html': 'text/html; charset=utf-8',
                    '.js': 'text/javascript; charset=utf-8',
                    '.mjs': 'text/javascript; charset=utf-8',
                    '.css': 'text/css',
                    '.json': 'application/json',
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.svg': 'image/svg+xml',
                    '.glb': 'model/gltf-binary',
                    '.gltf': 'model/gltf+json',
                    '.mp3': 'audio/mpeg',
                    '.wav': 'audio/wav',
                };
                res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
                res.end(data);
            });
        });

        server.listen(0, '127.0.0.1', () => {
            PORT = server.address().port;
            resolve();
        });
    });
}

function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    const iconPath = path.join(__dirname, 'build', 'icon.ico');
    const hasIcon = fs.existsSync(iconPath);

    const win = new BrowserWindow({
        width,
        height,
        autoHideMenuBar: true,
        backgroundColor: '#000000',
        ...(hasIcon ? { icon: iconPath } : {}),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
        },
    });

    win.loadURL(`http://127.0.0.1:${PORT}/index.html`);

    // Раскомментируй строку ниже, если нужно смотреть консоль/ошибки внутри exe:
    // win.webContents.openDevTools();
}

app.whenReady().then(async () => {
    await startServer();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (server) server.close();
    if (process.platform !== 'darwin') app.quit();
});
