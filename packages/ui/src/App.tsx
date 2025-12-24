import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Secrets } from './pages/Secrets';
import { McpServers } from './pages/McpServers';
import { Agents } from './pages/Agents';
import { Hooks } from './pages/Hooks';
import { Inspector } from './pages/Inspector';
import { Prompts } from './pages/Prompts';
import { Context } from './pages/Context';
import { Marketplace } from './pages/Marketplace';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="secrets" element={<Secrets />} />
          <Route path="mcp" element={<McpServers />} />
          <Route path="agents" element={<Agents />} />
          <Route path="hooks" element={<Hooks />} />
          <Route path="inspector" element={<Inspector />} />
          <Route path="prompts" element={<Prompts />} />
          <Route path="context" element={<Context />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
