import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, CreditCard, Wrench, Cloud, Terminal } from 'lucide-react';

export function Layout() {
    const location = useLocation();

    const navItems = [
        { path: '/', label: 'Console', icon: <Terminal size={20} /> },
        { path: '/tools', label: 'Tools & Ecosystem', icon: <Wrench size={20} /> },
        { path: '/billing', label: 'Billing & Subscriptions', icon: <CreditCard size={20} /> },
        { path: '/cloud', label: 'Cloud Environments', icon: <Cloud size={20} /> },
        { path: '/jules', label: 'Jules App', icon: <LayoutDashboard size={20} /> },
    ];

    return (
        <div className="min-h-screen bg-gray-900 text-white flex">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
                <div className="p-6">
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
                        Super AI Hub
                    </h1>
                    <div className="text-xs text-gray-500 mt-1">v0.1.0</div>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    {navItems.map(item => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                                location.pathname === item.path
                                    ? 'bg-blue-900/50 text-blue-400 border border-blue-800'
                                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                            }`}
                        >
                            {item.icon}
                            <span className="font-medium">{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
                    <div>Status: Connected</div>
                    <div className="mt-1">Backend: Fastify v5</div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-gray-900">
                <Outlet />
            </main>
        </div>
    );
}
