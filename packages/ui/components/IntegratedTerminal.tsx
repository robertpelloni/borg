"use client";

import { useEffect, useRef, useState } from "react";
import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import type { Socket } from "socket.io-client";
import "@xterm/xterm/css/xterm.css";

interface IntegratedTerminalProps {
  sessionId?: string;
  workingDir?: string;
  className?: string;
}

export function IntegratedTerminal({
  sessionId = "default",
  workingDir = "",
  className = "",
}: IntegratedTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const errorShownRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!terminalRef.current || !isMounted) return;

    let terminal: Terminal;
    let fitAddon: FitAddon;
    let socket: Socket;
    let resizeObserver: ResizeObserver;
    let handleWindowResize: (() => void) | null = null;
    let isCancelled = false;

    const initTerminal = async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      const { io } = await import("socket.io-client");

      if (isCancelled) return;

      terminal = new Terminal({
        cursorBlink: true,
        fontSize: 12,
        fontFamily: '"Ubuntu Mono", "Courier New", Courier, monospace',
        lineHeight: 1.2,
        theme: {
          background: "#0a0a0f",
          foreground: "#e5e5e5",
          cursor: "#ffffff",
          cursorAccent: "#0a0a0f",
          selectionBackground: "rgba(255, 255, 255, 0.2)",
          black: "#2e3436",
          red: "#cc0000",
          green: "#4e9a06",
          yellow: "#c4a000",
          blue: "#3465a4",
          magenta: "#75507b",
          cyan: "#06989a",
          white: "#d3d7cf",
          brightBlack: "#555753",
          brightRed: "#ef2929",
          brightGreen: "#8ae234",
          brightYellow: "#fce94f",
          brightBlue: "#729fcf",
          brightMagenta: "#ad7fa8",
          brightCyan: "#34e2e2",
          brightWhite: "#eeeeec",
        },
        scrollback: 1000,
        allowProposedApi: true,
        cursorStyle: "block",
        cursorInactiveStyle: "outline",
      });

      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      
      if (terminalRef.current) {
        terminal.open(terminalRef.current);
        fitAddon.fit();
      }

      xtermRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // Connect to terminal server
      // If running via custom server (node server.js), socket.io is on the same port.
      // If running via standard next dev, we might need a separate URL.
      // We default to undefined (same origin) which works with our custom server setup.
      const wsUrl = process.env.NEXT_PUBLIC_TERMINAL_WS_URL;

      console.log("Connecting to terminal server:", wsUrl || "same origin");

      socket = io(wsUrl, {
        query: { sessionId, workingDir },
        transports: ["websocket"],
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        reconnection: true,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("Connected to terminal server");
        if (!isCancelled) {
          setIsConnected(true);
          errorShownRef.current = false;
        }
        terminal.write("\r\n\x1b[32m*** Connected to terminal ***\x1b[0m\r\n\r\n");
      });

      socket.on("connect_error", (error) => {
        console.log("Failed to connect to terminal server:", error.message);
        if (!isCancelled) {
          setIsConnected(false);
        }

        if (!errorShownRef.current) {
          errorShownRef.current = true;
          terminal.write("\r\n\x1b[33m*** Terminal Server Not Available ***\x1b[0m\r\n");
        }
      });

      socket.on("disconnect", () => {
        console.log("Disconnected from terminal server");
        if (!isCancelled) {
          setIsConnected(false);
        }
        terminal.write("\r\n\x1b[31m*** Disconnected from terminal ***\x1b[0m\r\n");
      });

      socket.on("terminal.output", (data: string) => {
        terminal.write(data);
      });

      socket.on("terminal.exit", ({ exitCode }: { exitCode: number }) => {
        terminal.write(`\r\n\x1b[33m*** Process exited with code ${exitCode} ***\x1b[0m\r\n`);
      });

      terminal.onData((data) => {
        socket.emit("terminal.input", data);
      });

      handleWindowResize = () => {
        fitAddon.fit();
        socket.emit("terminal.resize", {
          cols: terminal.cols,
          rows: terminal.rows,
        });
      };

      window.addEventListener("resize", handleWindowResize);

      resizeObserver = new ResizeObserver(() => {
        setTimeout(() => {
          if (!isCancelled && fitAddon) {
            fitAddon.fit();
            if (terminal) {
               socket.emit("terminal.resize", {
                cols: terminal.cols,
                rows: terminal.rows,
              });
            }
          }
        }, 0);
      });

      if (terminalRef.current) {
        resizeObserver.observe(terminalRef.current);
      }
    };

    initTerminal();

    return () => {
      isCancelled = true;
      const currentSocket = socketRef.current;
      const currentXterm = xtermRef.current;
      
      if (handleWindowResize) {
        window.removeEventListener("resize", handleWindowResize);
      }

      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (currentSocket) {
        currentSocket.disconnect();
      }
      if (currentXterm) {
        currentXterm.dispose();
      }
    };
  }, [sessionId, workingDir, isMounted]);

  if (!isMounted) {
    return (
      <div className={`relative ${className} flex items-center justify-center bg-[#0a0a0f]`}>
        <div className="text-white/40 text-xs font-mono">Loading terminal...</div>
      </div>
    );
  }

  return (
    <div className={`relative ${className} bg-[#0a0a0f] rounded-lg overflow-hidden border border-gray-800`}>
      <div className="absolute top-2 right-2 z-10">
        <div
          className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
          title={isConnected ? "Connected" : "Disconnected"}
        />
      </div>
      <div ref={terminalRef} className="h-full w-full p-2" />
    </div>
  );
}
