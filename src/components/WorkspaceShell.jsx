import { useState } from 'react';
import {
  Boxes,
  Calculator,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Package2,
  PaintBucket,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  ShoppingCart,
  Store,
  Truck,
  Wand2,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'estimator', label: 'Estimator', icon: Calculator },
  { id: 'calculator', label: 'Quantity calc', icon: PaintBucket },
  { id: 'designer', label: 'Design studio', icon: Wand2 },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'marketplace', label: 'Marketplace', icon: Store },
  { id: 'cart', label: 'Cart', icon: ShoppingCart },
  { id: 'orders', label: 'Orders', icon: ClipboardList },
  { id: 'repairs', label: 'Repairs', icon: Wrench },
];

const ROLE_NAV = {
  admin: [
    { id: 'admin', label: 'Admin panel', icon: Settings2 },
    { id: 'materials', label: 'Rate catalog', icon: Boxes },
  ],
  supplier: [{ id: 'supplier', label: 'Supplier desk', icon: Package2 }],
  provider: [{ id: 'provider', label: 'Repair requests', icon: Truck }],
};

export default function WorkspaceShell({ page, setPage, children }) {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = [
    ...NAV,
    ...(ROLE_NAV[user?.role] || []),
  ];

  const go = (id) => {
    setPage(id);
    setMobileOpen(false);
  };

  const NavButtons = ({ dense = false }) => (
    <nav className={`flex flex-col gap-1 ${dense ? 'p-2' : 'p-3'}`}>
      {items.map((item) => {
        const Icon = item.icon;
        const active = page === item.id || (item.id === 'orders' && page === 'order') || (item.id === 'repairs' && page === 'repair-project') || (item.id === 'marketplace' && page === 'product');
        const badge = item.id === 'cart' && count ? count : null;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => go(item.id)}
            title={item.label}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
              active ? 'bg-[#FF7518] text-white shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            } ${collapsed && !dense ? 'justify-center px-2' : ''}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {(!collapsed || dense) && <span className="flex-1 truncate">{item.label}</span>}
            {badge && (!collapsed || dense) ? <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? 'bg-white/20' : 'bg-[#FF7518] text-white'}`}>{badge}</span> : null}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#EEF2F7] text-[#1F2937] lg:flex">
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-800/40 bg-[#0F172A] text-white transition-[width] lg:flex ${collapsed ? 'w-[4.5rem]' : 'w-64'}`}>
        <div className={`flex items-center gap-3 border-b border-white/10 ${collapsed ? 'justify-center px-2 py-4' : 'px-4 py-5'}`}>
          <img src="/logoB.png" alt="" className="h-9 w-9 rounded-lg object-cover object-top" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-tight">BuildRight</p>
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Workspace</p>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavButtons />
        </div>
        <div className={`border-t border-white/10 ${collapsed ? 'p-2' : 'p-3'}`}>
          {!collapsed && (
            <div className="mb-2 rounded-xl bg-white/5 px-3 py-2">
              <p className="truncate text-sm font-semibold">{user?.name}</p>
              <p className="truncate text-xs capitalize text-slate-400">{user?.role || 'user'}</p>
            </div>
          )}
          <button type="button" onClick={() => setCollapsed((value) => !value)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white ${collapsed ? 'justify-center px-2' : ''}`}>
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
          <button
            type="button"
            onClick={() => { logout(); setPage('home'); }}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white ${collapsed ? 'justify-center px-2' : ''}`}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center gap-3 px-4">
            <button type="button" aria-label="Open menu" className="rounded-xl border border-slate-200 p-2" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">BuildRight</p>
              <p className="truncate text-[11px] text-slate-500">{user?.name}</p>
            </div>
            <button type="button" onClick={() => go('cart')} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold">
              Cart{count ? ` (${count})` : ''}
            </button>
          </div>
        </header>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-slate-950/50" onClick={() => setMobileOpen(false)} />
            <aside className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col bg-[#0F172A] text-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                <div>
                  <p className="text-sm font-black">BuildRight</p>
                  <p className="text-xs text-slate-400">Workspace</p>
                </div>
                <button type="button" aria-label="Close" className="rounded-lg p-2 hover:bg-white/10" onClick={() => setMobileOpen(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <NavButtons dense />
              </div>
              <div className="border-t border-white/10 p-3">
                <button type="button" onClick={() => { logout(); setPage('home'); setMobileOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10">
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            </aside>
          </div>
        )}

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
