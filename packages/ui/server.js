const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const pty = require('node-pty');
const os = require('os');
const net = require('net');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(err);
      }
    });
    server.listen(startPort, () => {
      server.close(() => {
        resolve(startPort);
      });
    });
  });
}

findAvailablePort(3001).then((port) => {
  // when using middleware `hostname` and `port` must be provided below
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  app.prepare().then(() => {
    const server = createServer(async (req, res) => {
      try {
        // Be sure to pass `true` as the second argument to `url.parse`.
        // This tells it to parse the query portion of the URL.
        const parsedUrl = parse(req.url, true);
        const { pathname, query } = parsedUrl;

        if (pathname === '/a') {
          await app.render(req, res, '/a', query);
        } else if (pathname === '/b') {
          await app.render(req, res, '/b', query);
        } else {
          await handle(req, res, parsedUrl);
        }
      } catch (err) {
        console.error('Error occurred handling', req.url, err);
        res.statusCode = 500;
        res.end('internal server error');
      }
    });

    const io = new Server(server);

    // Track active terminal sessions
    const sessions = new Map();

    io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);

      const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
      
      // Use the project root as the default working directory
      const cwd = process.cwd();

      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: cwd,
        env: process.env
      });

      sessions.set(socket.id, {
        ptyProcess,
        createdAt: Date.now(),
      });

      ptyProcess.onData((data) => {
        socket.emit('terminal.output', data);
      });

      socket.on('terminal.input', (data) => {
        ptyProcess.write(data);
      });

      socket.on('terminal.resize', ({ cols, rows }) => {
          try {
              ptyProcess.resize(cols, rows);
          } catch (err) {
              console.error("Resize error:", err);
          }
      });

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        const session = sessions.get(socket.id);
        if (session) {
          session.ptyProcess.kill();
          sessions.delete(socket.id);
        }
      });
    });

    server.listen(port, (err) => {
      if (err) throw err;
      console.log(`> Ready on http://${hostname}:${port}`);
    });
  });
}).catch(err => {
  console.error("Failed to find an available port:", err);
  process.exit(1);
});
