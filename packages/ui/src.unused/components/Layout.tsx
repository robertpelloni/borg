import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Key, Server, Bot, Plug, Activity, Settings, MessageSquare, FileText, ShoppingBag } from 'lucide-react';

export const Layout = () => {
  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            aios
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavLink to="/" className={({ isActive }) => `flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/marketplace" className={({ isActive }) => `flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
            <ShoppingBag size={20} />
            <span>Marketplace</span>
          </NavLink>

          <NavLink to="/secrets" className={({ isActive }) => `flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
            <Key size={20} />
            <span>API Keys</span>
          </NavLink>

          <NavLink to="/mcp" className={({ isActive }) => `flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
            <Server size={20} />
            <span>MCP Servers</span>
          </NavLink>

          <NavLink to="/agents" className={({ isActive }) => `flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
            <Bot size={20} />
            <span>Agents & Skills</span>
          </NavLink>

          <NavLink to="/prompts" className={({ isActive }) => `flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
            <MessageSquare size={20} />
            <span>Prompts</span>
          </NavLink>

          <NavLink to="/context" className={({ isActive }) => `flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
            <FileText size={20} />
            <span>Context</span>
          </NavLink>

          <NavLink to="/hooks" className={({ isActive }) => `flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
            <Plug size={20} />
            <span>Hooks</span>
          </NavLink>

          <NavLink to="/inspector" className={({ isActive }) => `flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
            <Activity size={20} />
            <span>Traffic</span>
          </NavLink>
        </nav>

        <div className="p-4 border-t border-gray-700">
          <div className="text-xs text-gray-500">v0.7.0-rc</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-900 p-8">
        <Outlet />
      </main>
    </div>
  );
};
