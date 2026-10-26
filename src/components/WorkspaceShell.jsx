import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Boxes,
  Calculator,
  ChevronDown,
  ClipboardList,
  ExternalLink,
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
  UserRound,
  Wand2,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Planning',
    items: [
      { id: 'estimator', label: 'Estimator', icon: Calculator },
      { id: 'calculator', label: 'Quantity calc', icon: PaintBucket },
      { id: 'designer', label: 'Design studio', icon: Wand2 },
      { id: 'projects', label: 'Projects', icon: FolderKanban },
      { id: 'repairs', label: 'Repairs', icon: Wrench },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { id: 'marketplace', label: 'Marketplace', icon: Store },
      { id: 'cart', label: 'Cart', icon: ShoppingCart },
      { id: 'orders', label: 'Orders', icon: ClipboardList },
    ],
  },
];

const ROLE_GROUPS = {
  admin: {
    label: 'Administration',
    items: [
      { id: 'admin', label: 'Admin panel', icon: Settings2 },
      { id: 'materials', label: 'Rate catalog', icon: Boxes },
    ],
  },
  supplier: {
    label: 'Supplier',
    items: [{ id: 'supplier', label: 'Supplier desk', icon: Package2 }],
  },
  provider: {
    label: 'Provider',
    items: [{ id: 'provider', label: 'Repair requests', icon: Truck }],
  },
};

const PAGE_META = {
  dashboard: { title: 'Dashboard', subtitle: 'Account overview and recent activity' },
  estimator: { title: 'Cost estimator', subtitle: 'Plan construction costs from project inputs' },
  calculator: { title: 'Quantity calculator', subtitle: 'Estimate material quantities before ordering' },
  designer: { title: 'Design studio', subtitle: '2D plans and 3D visualization' },
  floorplanner: { title: 'Floor planner', subtitle: 'Conceptual layout workspace' },
  projects: { title: 'Projects', subtitle: 'Saved and sample project gallery' },
  marketplace: { title: 'Marketplace', subtitle: 'Browse construction materials' },
  product: { title: 'Product detail', subtitle: 'Material specifications and ordering' },
  cart: { title: 'Cart', subtitle: 'Review items before checkout' },
  orders: { title: 'Orders', subtitle: 'Track material orders' },
  order: { title: 'Order detail', subtitle: 'Status and line items' },
  repairs: { title: 'Repair planner', subtitle: 'Paint, repair, and renovation planning' },
  'repair-project': { title: 'Repair project', subtitle: 'Project estimate and materials' },
  materials: { title: 'Rate catalog', subtitle: 'Administrator-managed construction rates' },
  admin: { title: 'Admin panel', subtitle: 'Control center for catalog, users, and settings' },
  supplier: { title: 'Supplier desk', subtitle: 'Update your product prices and stock' },
  provider: { title: 'Repair requests', subtitle: 'Assigned service requests' },
  prediction: { title: 'Cost forecast', subtitle: 'Illustrative forecast charts' },
};

function isNavActive(page, itemId) {
  if (page === itemId) return true;
  if (itemId === 'orders' && page === 'order') return true;
  if (itemId === 'repairs' && page === 'repair-project') return true;
  if (itemId === 'marketplace' && page === 'product') return true;
  if (itemId === 'designer' && page === 'floorplanner') return true;
  return false;
}

export default function WorkspaceShell({ page, setPage, children }) {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const groups = useMemo(() => {
    const roleGroup = ROLE_GROUPS[user?.role];
    return roleGroup ? [...NAV_GROUPS, roleGroup] : NAV_GROUPS;
  }, [user?.role]);

  const meta = PAGE_META[page] || { title: 'Workspace', subtitle: 'BuildRight portal' };

  useEffect(() => {
    const onClick = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const go = (id) => {
    setPage(id);
    setMobileOpen(false);
    setProfileOpen(false);
  };

  const NavList = ({ dense = false }) => (
    <div className={`flex flex-col ${dense ? 'gap-4 p-3' : 'gap-5 p-3'}`}>
      {groups.map((group) => (
        <div key={group.label}>
          {(!collapsed || dense) && (
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {group.label}
            </p>
          )}
          <nav className="flex flex-col gap-0.5" aria-label={group.label}>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(page, item.id);
              const badge = item.id === 'cart' && count ? count : null;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.id)}
                  title={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                    active
                      ? 'bg-[#FF7518] text-white shadow-sm'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  } ${collapsed && !dense ? 'justify-center px-2' : ''}`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                  {(!collapsed || dense) && <span className="flex-1 truncate">{item.label}</span>}
                  {badge && (!collapsed || dense) ? (
                    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${active ? 'bg-white/20' : 'bg-[#FF7518] text-white'}`}>
                      {badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );

  const SidebarChrome = ({ showClose = false }) => (
    <>
      <div className={`flex items-center border-b border-white/10 ${collapsed && !showClose ? 'justify-center px-2 py-4' : 'gap-3 px-4 py-4'}`}>
        <img src="/logoB.png" alt="" className="h-9 w-9 rounded-lg object-cover object-top" />
        {(!collapsed || showClose) && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold tracking-tight">BuildRight</p>
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Portal</p>
          </div>
        )}
        {showClose && (
          <button type="button" aria-label="Close menu" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <NavList dense={showClose} />
      </div>
      <div className={`border-t border-white/10 ${collapsed && !showClose ? 'p-2' : 'p-3'}`}>
        {(!collapsed || showClose) && (
          <div className="mb-2 rounded-lg bg-white/5 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
            <p className="truncate text-xs capitalize text-slate-400">{user?.role || 'user'}</p>
          </div>
        )}
        {!showClose && (
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white ${collapsed ? 'justify-center px-2' : ''}`}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        )}
        <button
          type="button"
          onClick={() => { logout(); setPage('home'); }}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white ${collapsed && !showClose ? 'justify-center px-2' : ''}`}
        >
          <LogOut className="h-4 w-4" />
          {(!collapsed || showClose) && <span>Log out</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="portal-shell min-h-screen bg-[#F1F5F9] text-[#0F172A] lg:flex">
      <aside
        className={`sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-slate-800/50 bg-[#0B1220] text-white transition-[width] duration-200 lg:flex ${collapsed ? 'w-[4.25rem]' : 'w-60'}`}
        aria-label="Portal navigation"
      >
        <SidebarChrome />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-5 lg:h-[3.75rem] lg:px-6">
            <button
              type="button"
              aria-label="Open menu"
              className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">{meta.title}</h1>
              <p className="hidden truncate text-xs text-slate-500 sm:block">{meta.subtitle}</p>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => go('cart')}
                className="relative hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-orange-200 hover:bg-orange-50/50 sm:inline-flex"
              >
                <ShoppingCart className="h-4 w-4" />
                Cart
                {count ? (
                  <span className="rounded-md bg-[#FF7518] px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">{count}</span>
                ) : null}
              </button>

              <button
                type="button"
                className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                aria-label="Notifications"
                title="No new notifications"
              >
                <Bell className="h-4 w-4" />
              </button>

              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 py-1.5 pl-1.5 pr-2 hover:bg-slate-50 sm:pr-3"
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0B1220] text-xs font-bold uppercase text-white">
                    {(user?.name || 'U').slice(0, 1)}
                  </span>
                  <span className="hidden min-w-0 text-left sm:block">
                    <span className="block max-w-[8rem] truncate text-xs font-semibold text-slate-800">{user?.name}</span>
                    <span className="block text-[10px] capitalize text-slate-500">{user?.role || 'user'}</span>
                  </span>
                  <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
                </button>

                {profileOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    <div className="border-b border-slate-100 px-3 py-2.5">
                      <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
                      <p className="truncate text-xs text-slate-500">{user?.email}</p>
                    </div>
                    <button type="button" role="menuitem" className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => go('dashboard')}>
                      <UserRound className="h-4 w-4 text-slate-400" />
                      Account dashboard
                    </button>
                    <button type="button" role="menuitem" className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => { setProfileOpen(false); setPage('home'); }}>
                      <ExternalLink className="h-4 w-4 text-slate-400" />
                      Public website
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                      onClick={() => { logout(); setPage('home'); }}
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-slate-950/50" onClick={() => setMobileOpen(false)} />
            <aside className="absolute inset-y-0 left-0 flex w-[min(19rem,88vw)] flex-col bg-[#0B1220] text-white shadow-2xl">
              <SidebarChrome showClose />
            </aside>
          </div>
        )}

        <main className="portal-main flex-1 pb-8">{children}</main>
      </div>
    </div>
  );
}
