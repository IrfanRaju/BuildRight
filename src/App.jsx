import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Building2,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Download,
  Factory,
  FileText,
  FolderKanban,
  Layers3,
  Menu,
  X,
  MessageSquareQuote,
  MoreHorizontal,
  Package2,
  Plus,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
  Building,
  Home,
  Blocks,
  SlidersHorizontal,
  Wand2,
  PanelLeftClose,
  PanelLeftOpen,
  DoorOpen,
  Undo2,
  Redo2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Pencil,
  Save,
  ImageUp,
  Cpu,
  ShieldCheck,
  Bell,
  Gauge,
  Grid2x2,
  Box,
  Warehouse,
  LocateFixed,
  Map,
  Route,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import { useAuth } from './context/AuthContext';
import { useCart } from './context/CartContext';
import { api } from './lib/api';
import { pageFromPath, pathFor } from './lib/routes';
import WorkspaceShell from './components/WorkspaceShell';
import RatesTicker from './components/RatesTicker';
import { SearchableSelect } from './components/ui';

const DesignStudio = lazy(() => import('./DesignStudio'));
const EstimatorWorkspace = lazy(() => import('./pages/EstimatorPage'));
const MaterialsCatalog = lazy(() => import('./pages/MaterialsPage'));
const MarketplacePage = lazy(() => import('./pages/marketplace/MarketplacePage'));
const ProductPage = lazy(() => import('./pages/marketplace/ProductPage'));
const CalculatorPage = lazy(() => import('./pages/marketplace/CalculatorPage'));
const CartPage = lazy(() => import('./pages/marketplace/CartPage'));
const OrdersPage = lazy(() => import('./pages/marketplace/OrdersPage'));
const RepairPlannerPage = lazy(() => import('./pages/repairs/RepairPlannerPage'));
const RepairProjectPage = lazy(() => import('./pages/repairs/RepairProjectPage'));
const AccountDashboard = lazy(() => import('./pages/AccountDashboard'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
import { AboutPage, ArticlePage, BlogPage, ContactPage, ContractorsPage, ProjectsPage, ServicesPage } from './pages/ContentPages';
import { ForgotPage, LoginPage, RegisterPage, ResetPage } from './pages/AuthPages';
import { ProviderWorkspace, SupplierWorkspace } from './pages/commerce/Workspaces';

const primaryNavItems = [
  { label: 'Home', id: 'home' },
  { label: 'Services', id: 'services' },
  { label: 'Estimator', id: 'estimator' },
  { label: 'Design', id: 'design', title: '2D/3D Design' },
  { label: 'Projects', id: 'projects' },
  { label: 'Marketplace', id: 'marketplace' },
  { label: 'Repairs', id: 'repairs' },
];

const moreNavItems = [
  { label: 'About', id: 'about' },
  { label: 'Contact', id: 'contact' },
];

const navItems = [...primaryNavItems, ...moreNavItems];

function isNavActive(page, itemId) {
  return page === (itemId === 'design' ? 'designer' : itemId);
}

const featureCards = [
  {
    title: 'Construction Cost Estimation',
    description: 'Estimate project costs from your inputs; treat results as planning guidance and verify local rates.',
    icon: Calculator,
    page: 'estimator',
  },
  {
    title: 'Prompt-Based 2D Floor Plans',
    description: 'Generate and refine a conceptual labeled plan from a project description, then export it.',
    icon: Grid2x2,
    page: 'designer',
  },
  {
    title: 'Interactive 3D Visualization',
    description: 'Orbit, zoom, and inspect a procedural building model; it is not engineered documentation.',
    icon: Building2,
    page: 'designer',
  },
  {
    title: 'Material Marketplace',
    description: 'Browse catalog prices, calculate quantities, and order materials for construction and repairs.',
    icon: Sparkles,
    page: 'marketplace',
  },
  {
    title: 'Home Repair Planner',
    description: 'Estimate painting, repairs, and renovation costs, then order the materials from the same account.',
    icon: Home,
    page: 'repairs',
  },
  {
    title: 'Design Exports',
    description: 'Download conceptual floor plans as PNG or PDF and 3D models in GLB format.',
    icon: Package2,
    page: 'designer',
  },
  {
    title: 'Saved Design Projects',
    description: 'Keep designs in this browser and reopen them from the Design Studio history.',
    icon: FolderKanban,
    page: 'designer',
  },
];

const steps = [
  'Define the project scope',
  'Model room and structural inputs',
  'Review cost breakdown and quality mix',
];

const featuredProjectsFallback = [
  {
    title: 'Lakeside Villa',
    type: 'Residential',
    area: '3,400 sq ft',
    price: 'PKR 18.6M',
    image:
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: 'Civic Plaza',
    type: 'Commercial',
    area: '11,500 sq ft',
    price: 'PKR 47.2M',
    image:
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: 'Green Horizon Office',
    type: 'Corporate',
    area: '9,200 sq ft',
    price: 'PKR 31.8M',
    image:
      'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80',
  },
];

function presentFeaturedProject(project) {
  const category = String(project.category || project.projectType || 'Project');
  const budget = Number(project.estimatedBudget) || 0;
  const price = budget >= 1_000_000
    ? `PKR ${(budget / 1_000_000).toFixed(1)}M`
    : budget > 0
      ? `PKR ${Math.round(budget).toLocaleString('en-PK')}`
      : 'Illustrative';
  return {
    title: project.title,
    type: category.charAt(0).toUpperCase() + category.slice(1),
    area: `${Number(project.area || 0).toLocaleString('en-US')} ${project.areaUnit || 'sq ft'}`,
    price,
    image: project.imageUrl || '/logoB.png',
  };
}

const monthlyForecast = [
  { month: 'Jan', planned: 6.6, actual: 6.2 },
  { month: 'Feb', planned: 6.8, actual: 6.5 },
  { month: 'Mar', planned: 7.1, actual: 7.0 },
  { month: 'Apr', planned: 7.6, actual: 7.4 },
  { month: 'May', planned: 7.9, actual: 7.8 },
  { month: 'Jun', planned: 8.2, actual: 8.0 },
  { month: 'Jul', planned: 8.8, actual: 8.4 },
];

const materialPriceTrends = [
  { name: 'Cement', price: 1040 },
  { name: 'Steel', price: 2220 },
  { name: 'Blocks', price: 950 },
  { name: 'Paint', price: 680 },
  { name: 'Tiles', price: 910 },
  { name: 'Sand', price: 760 },
];

const recentProjects = [
  { name: 'Harbor View Residence', type: 'House', area: '2,850 sq ft', location: 'Islamabad', cost: 'PKR 19.4M', date: '25 Sep 2026', status: 'In Review' },
  { name: 'Aurora Tower', type: 'Commercial', area: '12,400 sq ft', location: 'Lahore', cost: 'PKR 52.1M', date: '14 Sep 2026', status: 'Approved' },
  { name: 'North Ridge Plaza', type: 'Plaza', area: '8,950 sq ft', location: 'Peshawar', cost: 'PKR 36.8M', date: '02 Sep 2026', status: 'Draft' },
  { name: 'Civic Learning Hub', type: 'University', area: '16,200 sq ft', location: 'Karachi', cost: 'PKR 67.7M', date: '28 Aug 2026', status: 'On Hold' },
];

const qualityOptions = ['Standard', 'Premium', 'Luxury'];

const materialCatalog = [
  { name: 'Cement', category: 'Binders', unit: '50kg Bag', quality: 'Premium', price: 1250, availability: 'In stock' },
  { name: 'Steel Rebar', category: 'Structural', unit: 'Ton', quality: 'Luxury', price: 285000, availability: 'Fast moving' },
  { name: 'Bricks', category: 'Masonry', unit: '1000 Units', quality: 'Standard', price: 39000, availability: 'Regional supply' },
  { name: 'Concrete Blocks', category: 'Masonry', unit: 'Piece', quality: 'Premium', price: 85, availability: 'In stock' },
  { name: 'River Sand', category: 'Aggregates', unit: 'Cubic Yard', quality: 'Standard', price: 16500, availability: 'Limited' },
  { name: 'Crushed Stone', category: 'Aggregates', unit: 'Ton', quality: 'Premium', price: 22000, availability: 'In stock' },
  { name: 'Ceramic Tiles', category: 'Finishing', unit: 'Box', quality: 'Luxury', price: 9800, availability: 'In stock' },
  { name: 'Exterior Paint', category: 'Finishing', unit: 'Gallons', quality: 'Premium', price: 6200, availability: 'Seasonal' },
  { name: 'PVC Pipes', category: 'Plumbing', unit: 'Bundle', quality: 'Standard', price: 14500, availability: 'Fast moving' },
  { name: 'Electrical Wiring', category: 'Electrical', unit: 'Roll', quality: 'Premium', price: 4200, availability: 'Available' },
];

const buildingTypes = ['House', 'Plaza', 'Commercial Building', 'University', 'Shop', 'Office'];
const cities = ['Gilgit-Baltistan', 'Islamabad', 'Rawalpindi', 'Lahore', 'Karachi', 'Peshawar', 'Multan', 'Faisalabad'];
const roomKinds = ['Bedroom', 'Bathroom', 'Kitchen', 'Living Room', 'Dining Room', 'Lounge', 'Office', 'Shop', 'Corridor', 'Staircase', 'Storage'];

const floorPlannerInitialRooms = [
  { id: 1, type: 'Living Room', x: 18, y: 18, width: 26, height: 20, label: 'Living Room' },
  { id: 2, type: 'Kitchen', x: 18, y: 40, width: 18, height: 15, label: 'Kitchen' },
  { id: 3, type: 'Bedroom', x: 47, y: 18, width: 22, height: 18, label: 'Bedroom 1' },
  { id: 4, type: 'Bathroom', x: 47, y: 40, width: 14, height: 12, label: 'Bath' },
];

function formatCurrency(value) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(value);
}

const AUTH_PAGES = new Set(['login', 'register', 'forgot', 'reset']);
const PORTAL_PAGES = new Set([
  'dashboard',
  'admin',
  'estimator',
  'floorplanner',
  'designer',
  'prediction',
  'materials',
  'marketplace',
  'product',
  'calculator',
  'cart',
  'orders',
  'order',
  'repairs',
  'repair-project',
  'supplier',
  'provider',
  'projects',
]);

function App() {
  const { user, ready } = useAuth();
  const initial = pageFromPath(window.location.pathname);
  const [page, setPageState] = useState(initial.page);
  const [routeSlug, setRouteSlug] = useState(initial.slug);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const inAuth = AUTH_PAGES.has(page);
  const inWorkspace = Boolean(user) && PORTAL_PAGES.has(page);

  const setPage = (next, slug = '') => {
    const path = pathFor(next, slug);
    if (window.location.pathname !== path) window.history.pushState({ page: next, slug }, '', path);
    setPageState(next);
    setRouteSlug(slug);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const onPop = () => {
      const next = pageFromPath(window.location.pathname);
      setPageState(next.page);
      setRouteSlug(next.slug);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!ready || !user) return undefined;
    if (page === 'login' || page === 'register') setPage('dashboard');
    return undefined;
  }, [ready, user, page]);

  const renderPage = () => {
    switch (page) {
      case 'about':
        return <AboutPage setPage={setPage} />;
      case 'services':
      case 'service':
        return <ServicesPage setPage={setPage} slug={page === 'service' ? routeSlug : ''} />;
      case 'dashboard':
        return <AccountDashboard setPage={setPage} />;
      case 'admin':
        return <AdminPage setPage={setPage} />;
      case 'estimator':
        return <EstimatorWorkspace setPage={setPage} />;
      case 'floorplanner':
        return <FloorPlannerPage setPage={setPage} />;
      case 'designer':
        return <DesignStudio />;
      case 'prediction':
        return <PredictionPage setPage={setPage} />;
      case 'materials':
        return <MaterialsCatalog />;
      case 'marketplace':
        return <MarketplacePage setPage={setPage} />;
      case 'product':
        return <ProductPage slug={routeSlug} setPage={setPage} />;
      case 'calculator':
        return <CalculatorPage />;
      case 'cart':
        return <CartPage setPage={setPage} />;
      case 'orders':
      case 'order':
        return <OrdersPage orderId={page === 'order' ? routeSlug : ''} setPage={setPage} />;
      case 'repairs':
        return <RepairPlannerPage setPage={setPage} />;
      case 'repair-project':
        return <RepairProjectPage projectId={routeSlug} setPage={setPage} />;
      case 'supplier':
        return <SupplierWorkspace />;
      case 'provider':
        return <ProviderWorkspace />;
      case 'projects':
        return <ProjectsPage setPage={setPage} />;
      case 'contractors':
        return <ContractorsPage setPage={setPage} />;
      case 'blog':
        return <BlogPage setPage={setPage} />;
      case 'article':
        return <ArticlePage slug={routeSlug} setPage={setPage} />;
      case 'contact':
        return <ContactPage />;
      case 'login':
        return <LoginPage setPage={setPage} />;
      case 'register':
        return <RegisterPage setPage={setPage} />;
      case 'forgot':
        return <ForgotPage setPage={setPage} />;
      case 'reset':
        return <ResetPage setPage={setPage} />;
      default:
        return <LandingPage setPage={setPage} />;
    }
  };

  const content = (
    <Suspense fallback={<p className="px-6 py-10 text-sm text-slate-500">Loading page…</p>}>
      {renderPage()}
    </Suspense>
  );

  if (inAuth) {
    return content;
  }

  if (inWorkspace) {
    return <WorkspaceShell page={page} setPage={setPage}>{content}</WorkspaceShell>;
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#1F2937]">
      <Header page={page} setPage={setPage} mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} />
      {content}
    </div>
  );
}

function MoreNavMenu({ page, onNavigate }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const closeTimer = useRef(null);
  const hoverOpened = useRef(false);
  const moreActive = moreNavItems.some((item) => isNavActive(page, item.id));

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const openMenu = () => {
    clearCloseTimer();
    setOpen(true);
  };

  const closeMenu = () => {
    clearCloseTimer();
    hoverOpened.current = false;
    setOpen(false);
  };

  const scheduleClose = () => {
    clearCloseTimer();
    hoverOpened.current = false;
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };

  useEffect(() => () => clearCloseTimer(), []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) closeMenu();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeMenu();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => {
        hoverOpened.current = true;
        openMenu();
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          clearCloseTimer();
          if (hoverOpened.current) {
            setOpen(true);
            return;
          }
          setOpen((wasOpen) => !wasOpen);
        }}
        className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange xl:px-3 ${moreActive || open ? 'bg-orange-50 font-semibold text-brand-orange' : 'hover:bg-slate-50 hover:text-brand-orange'}`}
      >
        More
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-1/2 top-full z-50 pt-1 min-w-[11rem] -translate-x-1/2"
        >
          <div className="rounded-xl border border-slate-200/90 bg-white py-1.5 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.55)]">
            {moreNavItems.map((item) => {
              const active = isNavActive(page, item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    closeMenu();
                    onNavigate(item.id);
                  }}
                  className={`flex w-full items-center px-3.5 py-2.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-orange ${active ? 'bg-orange-50 font-semibold text-brand-orange' : 'text-slate-700 hover:bg-slate-50 hover:text-brand-orange'}`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Header({ page, setPage, mobileNavOpen, setMobileNavOpen }) {
  const { user } = useAuth();
  const { count } = useCart();
  const navigate = (id) => {
    const routes = {
      home: 'home',
      about: 'about',
      services: 'services',
      features: 'services',
      estimator: 'estimator',
      materials: 'marketplace',
      marketplace: 'marketplace',
      repairs: 'repairs',
      design: 'designer',
      projects: 'projects',
      contractors: 'contractors',
      contact: 'contact',
    };
    setPage(routes[id] || 'home');
  };

  const go = (id) => {
    navigate(id);
    setMobileNavOpen(false);
  };

  const navLinkClass = (active) =>
    `shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange xl:px-3 ${active ? 'bg-orange-50 font-semibold text-brand-orange' : 'hover:bg-slate-50 hover:text-brand-orange'}`;

  return (
    <div className="sticky top-0 z-50">
      <RatesTicker onOpenCatalog={() => { setPage('materials'); setMobileNavOpen(false); }} />
      <header className="border-b border-slate-200/70 bg-white/90 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.35)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:h-[4.25rem] sm:px-6 lg:gap-5 lg:px-8">
          <button onClick={() => { setPage('home'); setMobileNavOpen(false); }} aria-label="BuildRight home" className="flex shrink-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200/80">
              <img src="/logoB.png" alt="" width="500" height="500" className="h-10 w-10 object-cover object-top" />
            </span>
            <span className="flex min-w-0 items-baseline gap-2 text-left">
              <span className="text-lg font-black tracking-tight text-[#101828]">BuildRight</span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 2xl:inline">Smart planning</span>
            </span>
          </button>

          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 text-[12.5px] font-medium text-slate-600 lg:flex xl:gap-1 xl:text-[13px]" aria-label="Primary">
            {primaryNavItems.map((item) => {
              const active = isNavActive(page, item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.title || item.label}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => go(item.id)}
                  className={navLinkClass(active)}
                >
                  {item.label}
                </button>
              );
            })}
            <MoreNavMenu page={page} onNavigate={go} />
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">
              {user ? <button type="button" onClick={() => { setPage('dashboard'); setMobileNavOpen(false); }} className="max-w-[7.5rem] truncate whitespace-nowrap rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-orange-200">{user.name.split(' ')[0]}</button> : <button type="button" onClick={() => { setPage('login'); setMobileNavOpen(false); }} className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-orange-200">Sign In</button>}
              {user?.role === 'admin' && <button type="button" onClick={() => { setPage('admin'); setMobileNavOpen(false); }} className="whitespace-nowrap rounded-full border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm">Admin</button>}
              {user?.role === 'supplier' && <button type="button" onClick={() => { setPage('supplier'); setMobileNavOpen(false); }} className="whitespace-nowrap rounded-full border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm">Supplier</button>}
              {user?.role === 'provider' && <button type="button" onClick={() => { setPage('provider'); setMobileNavOpen(false); }} className="whitespace-nowrap rounded-full border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm">Requests</button>}
              <button type="button" onClick={() => { setPage('cart'); setMobileNavOpen(false); }} className="whitespace-nowrap rounded-full border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-orange-200">Cart{count ? ` (${count})` : ''}</button>
              <button type="button" onClick={() => { setPage(user ? 'dashboard' : 'estimator'); setMobileNavOpen(false); }} className="hidden whitespace-nowrap rounded-full bg-brand-orange px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(255,117,24,0.9)] transition hover:-translate-y-0.5 hover:bg-orange-600 active:scale-[0.98] xl:inline-flex">{user ? 'Open portal' : 'Get Started'}</button>
            </div>
            <button type="button" onClick={() => { setPage('cart'); setMobileNavOpen(false); }} className="whitespace-nowrap rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 md:hidden">Cart{count ? ` (${count})` : ''}</button>
            <button type="button" aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileNavOpen} className="rounded-xl border border-slate-200 p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange lg:hidden" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="max-h-[min(70vh,32rem)] overflow-y-auto border-t border-slate-200 bg-white/98 px-4 py-4 shadow-lg lg:hidden">
            <div className="mx-auto grid max-w-7xl gap-1 text-sm text-slate-700 sm:grid-cols-2">
              {primaryNavItems.map((item) => {
                const active = isNavActive(page, item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.title || item.label}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => go(item.id)}
                    className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-left font-medium transition hover:bg-orange-50 hover:text-brand-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange ${active ? 'bg-orange-50 text-brand-orange' : ''}`}
                  >
                    {item.title || item.label}
                  </button>
                );
              })}
            </div>
            <div className="mx-auto mt-3 max-w-7xl border-t border-slate-100 pt-3">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">More</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {moreNavItems.map((item) => {
                  const active = isNavActive(page, item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      onClick={() => go(item.id)}
                      className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm font-medium transition hover:bg-orange-50 hover:text-brand-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange ${active ? 'bg-orange-50 text-brand-orange' : 'text-slate-700'}`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mx-auto mt-4 flex max-w-7xl flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => { setPage(user ? 'dashboard' : 'login'); setMobileNavOpen(false); }} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold">{user ? 'Dashboard' : 'Sign In'}</button>
              <button type="button" onClick={() => go('estimator')} className="flex-1 rounded-2xl bg-brand-orange px-4 py-3 text-sm font-semibold text-white">Get Started</button>
            </div>
          </div>
        )}
      </header>
    </div>
  );
}

function LandingPage({ setPage }) {
  const prefersReducedMotion = useReducedMotion();
  const [featuredProjects, setFeaturedProjects] = useState(featuredProjectsFallback);
  useEffect(() => {
    let cancelled = false;
    api('/api/projects?limit=6')
      .then((result) => {
        const projects = (result.projects || []).map(presentFeaturedProject);
        if (!cancelled && projects.length) setFeaturedProjects(projects);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const heroSlides = [
    {
      eyebrow: 'Construction planning, reimagined',
      title: 'Design Your Building. Estimate Your Cost. Build with Confidence.',
      description: 'Bring your next building project to life with practical planning, cost estimates, and design tools in one place.',
      image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=2000&q=85',
    },
    {
      eyebrow: 'A better way to build',
      title: 'Design Your Building. Estimate Your Cost. Build with Confidence.',
      description: 'Compare materials, explore layouts, and understand the costs before work begins on site.',
      image: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=2000&q=85',
    },
    {
      eyebrow: 'From first sketch to final structure',
      title: 'Design Your Building. Estimate Your Cost. Build with Confidence.',
      description: 'Create a clear project plan and make informed decisions at every stage of construction.',
      image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=2000&q=85',
    },
  ];
  const [activeSlide, setActiveSlide] = useState(0);
  const [projectStart, setProjectStart] = useState(0);
  const activeHero = heroSlides[activeSlide];
  const projectCount = featuredProjects.length || 1;
  const visibleProjects = featuredProjects.length <= 3
    ? featuredProjects
    : [0, 1, 2].map((offset) => featuredProjects[(projectStart + offset) % projectCount]);
  useEffect(() => {
    if (prefersReducedMotion) return undefined;
    const slideTimer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 5000);

    return () => window.clearInterval(slideTimer);
  }, [heroSlides.length, prefersReducedMotion]);
  const services = [
    { title: 'Architectural Design', text: 'Create and refine a conceptual 2D plan alongside its interactive 3D preview.', icon: Building2, page: 'designer' },
    { title: 'Construction Planning', text: 'Bring building scope, layout concepts, and early-stage cost planning together.', icon: Blocks, page: 'dashboard' },
    { title: 'Renovation Planning', text: 'Use the cost estimator to explore indicative renovation budgets and inputs.', icon: Wand2, page: 'estimator' },
    { title: 'Material Marketplace', text: 'Compare catalog prices, calculate quantities, and order materials.', icon: Package2, page: 'marketplace' },
    { title: 'Roof and Building Repair', text: 'Plan painting, roof, plumbing, and other repairs, then order the materials.', icon: Home, page: 'repairs' },
    { title: 'Smart Construction Tools', text: 'Open the available planning, design, and estimation workflows.', icon: Zap, page: 'dashboard' },
  ];
  const team = [
    { name: 'Ayesha Khan', role: 'Architect · Islamabad', image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=700&q=80' },
    { name: 'Ahmed Raza', role: 'Civil Engineer · Lahore', image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=700&q=80' },
    { name: 'Sana Ahmed', role: 'Project Manager · Karachi', image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=700&q=80' },
    { name: 'Bilal Hussain', role: 'Site Engineer · Gilgit', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=700&q=80' },
  ];
  const articles = [
    { title: 'A practical guide to planning your first build', image: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=900&q=80', category: 'Project Planning' },
    { title: 'Choosing materials with confidence', image: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=80', category: 'Materials' },
    { title: 'What to include in a construction estimate', image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80', category: 'Cost Guide' },
  ];

  return (
    <main className="bg-white">
      <section className="relative isolate min-h-[610px] overflow-hidden bg-slate-950 text-white sm:min-h-[680px]">
        <motion.div key={activeHero.image} initial={prefersReducedMotion ? false : { scale: 1.03, opacity: 0.7 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: prefersReducedMotion ? 0 : 0.7 }} className="absolute inset-0 -z-20">
          <img src={activeHero.image} alt="Architectural construction project" className="h-full w-full object-cover" />
        </motion.div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#101828]/85 via-[#101828]/70 to-[#101828]/50" />
        <div className="mx-auto flex min-h-[610px] max-w-7xl items-center justify-center px-6 py-20 text-center sm:min-h-[680px]">
          <motion.div key={activeSlide} initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.35 }} className="max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-200 sm:text-base">{activeHero.eyebrow}</p>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-[3.75rem]">{activeHero.title}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-100 sm:text-lg">{activeHero.description}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button onClick={() => setPage('projects')} className="rounded-xl border border-white/80 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white hover:text-slate-900 active:scale-[0.98]">Explore Projects</button>
              <button onClick={() => setPage('estimator')} className="rounded-xl bg-brand-orange px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:bg-orange-600 active:scale-[0.98]">Start Estimating</button>
              <button onClick={() => setPage('designer')} className="rounded-xl border border-white/80 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white hover:text-slate-900 active:scale-[0.98]">Create 2D/3D Design</button>
            </div>
            <div className="mt-10 flex justify-center gap-2">
              {heroSlides.map((slide, index) => (
                <button key={index} onClick={() => setActiveSlide(index)} aria-label={`Show slide ${index + 1}`} className={`h-1.5 rounded-full transition-all ${index === activeSlide ? 'w-9 bg-brand-orange' : 'w-4 bg-white/60'}`} />
              ))}
            </div>
          </motion.div>
        </div>
        <button aria-label="Previous slide" onClick={() => setActiveSlide((activeSlide + heroSlides.length - 1) % heroSlides.length)} className="absolute left-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-brand-orange lg:flex lg:left-8"><ChevronRight className="h-5 w-5 rotate-180" /></button>
        <button aria-label="Next slide" onClick={() => setActiveSlide((activeSlide + 1) % heroSlides.length)} className="absolute right-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-brand-orange lg:flex lg:right-8"><ChevronRight className="h-5 w-5" /></button>
      </section>

      <section className="relative z-10 mx-auto -mt-9 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid overflow-hidden rounded-2xl bg-white shadow-soft md:grid-cols-3">
          {[
            { title: 'Who We Are', icon: Users, text: 'A planning platform bringing owners, builders, and designers together.' },
            { title: 'What We Do', icon: Calculator, text: 'Estimate construction costs and map projects with practical digital tools.' },
            { title: 'Why Choose Us?', icon: ShieldCheck, text: 'Clearer decisions, organized project information, and fewer surprises.' },
          ].map(({ title, icon: Icon, text }) => (
            <div key={title} className="border-b border-slate-100 px-6 py-7 text-center last:border-none md:border-b-0 md:border-r">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-orange text-white"><Icon className="h-5 w-5" /></span>
              <h2 className="mt-4 font-bold text-slate-900">{title}</h2>
              <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-slate-500">{text}</p>
              <button onClick={() => setPage('services')} className="mt-3 text-xs font-semibold text-brand-orange">More Services <ArrowRight className="ml-1 inline h-3 w-3" /></button>
            </div>
          ))}
        </div>
      </section>

      <section id="about" className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div>
          <p className="font-serif text-sm italic text-brand-orange">About BuildRight</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">We Build for Your Comfort</h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-slate-600">A successful build starts with a thoughtful plan. BuildRight helps you understand costs, compare material choices, and shape your design before construction begins. Keep your project details together and make each decision with more confidence.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button onClick={() => setPage('about')} className="bg-slate-900 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-brand-orange">More About Us</button>
            <button onClick={() => setPage('estimator')} className="inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-700">Start an estimate <ArrowRight className="h-4 w-4 text-brand-orange" /></button>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-lg">
          <div className="absolute -right-4 -top-4 h-full w-2/3 border-2 border-orange-200" />
          <img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1100&q=85" alt="Modern home design" className="relative h-[360px] w-full object-cover shadow-soft sm:h-[420px]" />
          <button onClick={() => setPage('designer')} aria-label="Open the 3D designer" className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-brand-orange text-white shadow-xl transition hover:scale-105"><ArrowRight className="h-6 w-6" /></button>
          <div className="absolute -bottom-5 -left-5 bg-white px-5 py-3 shadow-soft"><strong className="block text-2xl text-slate-900">01</strong><span className="text-xs text-slate-500">One smarter workflow</span></div>
        </div>
      </section>

      <section id="features" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Plan with BuildRight" title="Tools for a clearer build" description="Explore the working design and estimation workflows, with planning outputs clearly identified as conceptual." />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featureCards.map(({ title, description, icon: Icon, page }) => (
              <button key={title} onClick={() => setPage(page)} className="group min-h-44 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-brand-orange transition group-hover:bg-brand-orange group-hover:text-white"><Icon className="h-5 w-5" /></span>
                <h3 className="mt-4 font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="How we can help" title="Construction services" description="Practical starting points for design, renovation, materials, and early-stage planning." />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map(({ title, text, icon: Icon, page }) => (
              <button key={title} onClick={() => setPage(page)} className="group min-h-40 rounded-2xl border border-slate-200 bg-white p-6 text-left transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-brand-orange transition group-hover:bg-brand-orange group-hover:text-white"><Icon className="h-5 w-5" /></span>
                <h3 className="mt-4 font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#172B4D] px-4 py-14 text-center text-white">
        <h2 className="text-2xl font-bold sm:text-3xl">Build your next project with confidence</h2>
        <p className="mt-3 text-sm text-slate-200">Plan smarter, compare options, and keep your project moving forward.</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <button onClick={() => setPage('designer')} className="rounded-xl bg-brand-orange px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600">Start Your Design</button>
          <button onClick={() => setPage('estimator')} className="rounded-xl border border-white/70 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-slate-900">Open Cost Estimator</button>
        </div>
      </section>

      <section id="projects" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-5">
          <SectionHeading eyebrow="Illustrative examples" title="Project concepts" description="Sample project cards and cost figures are for demonstration only, not verified or completed client projects." />
          {featuredProjects.length > 3 && (
            <div className="hidden shrink-0 gap-2 sm:flex">
              <button onClick={() => setProjectStart((projectStart + projectCount - 1) % projectCount)} aria-label="Previous projects" className="rounded-full border border-slate-200 p-3 text-slate-700 hover:bg-brand-orange hover:text-white"><ChevronRight className="h-4 w-4 rotate-180" /></button>
              <button onClick={() => setProjectStart((projectStart + 1) % projectCount)} aria-label="Next projects" className="rounded-full border border-slate-200 p-3 text-slate-700 hover:bg-brand-orange hover:text-white"><ChevronRight className="h-4 w-4" /></button>
            </div>
          )}
        </div>
        <div className="mt-9 grid gap-5 md:grid-cols-3">
          {visibleProjects.map((project) => (
            <motion.article key={project.title} whileHover={{ y: -4 }} className="overflow-hidden border border-slate-100 bg-white shadow-sm">
              <img src={project.image} alt={project.title} className="h-56 w-full object-cover" />
              <div className="p-5">
                <div className="flex items-center justify-between"><span className="font-semibold text-brand-orange">{project.type}</span><span className="text-xs text-slate-500">{project.area}</span></div>
                <h3 className="mt-2 text-lg font-bold text-slate-900">{project.title}</h3>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-600"><span>Illustrative estimate</span><strong className="text-slate-900">{project.price}</strong></div>
              </div>
            </motion.article>
          ))}
        </div>
        {featuredProjects.length > 3 && (
          <div className="mt-5 flex justify-center gap-2 sm:hidden">
            <button onClick={() => setProjectStart((projectStart + projectCount - 1) % projectCount)} aria-label="Previous projects" className="rounded-full border p-3"><ChevronRight className="h-4 w-4 rotate-180" /></button>
            <button onClick={() => setProjectStart((projectStart + 1) % projectCount)} aria-label="Next projects" className="rounded-full border p-3"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </section>

      <section className="bg-[#101828] py-12 text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 text-center sm:px-6 md:grid-cols-4 lg:px-8">
          {[
            ['2D', 'Conceptual floor plans'],
            ['3D', 'Interactive model preview'],
            ['PKR', 'Construction cost estimates'],
            ['Export', 'PNG, PDF and GLB formats'],
          ].map(([value, label]) => (
            <div key={label}><div className="text-2xl font-black text-orange-400 sm:text-3xl">{value}</div><div className="mt-2 text-xs font-medium text-slate-200 sm:text-sm">{label}</div></div>
          ))}
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Our Pakistan Team" title="People Behind the Plan" description="Meet our sample team of Pakistani architects, engineers, and project leaders working across the country." />
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((person) => (
              <article key={person.name} className="overflow-hidden border border-slate-100 bg-white shadow-sm">
                <img src={person.image} alt={person.name} className="h-64 w-full object-cover" />
                <div className="relative -mt-8 mx-4 bg-white px-4 py-4 text-center shadow-soft">
                  <h3 className="font-bold text-slate-900">{person.name}</h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-brand-orange">{person.role}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-5 text-center text-xs text-slate-400">Sample profiles and portraits for this frontend demo.</p>
        </div>
      </section>

      <section id="articles" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Demo content" title="Planning guides" description="Sample guide cards link to the relevant BuildRight tools; they are not published articles." />
        <div className="mt-9 grid gap-5 md:grid-cols-3">
          {articles.map((article, index) => (
            <article key={article.title} className="overflow-hidden border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-soft">
              <img src={article.image} alt="" className="h-52 w-full object-cover" />
              <div className="p-5">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-orange">{article.category}</span>
                <h3 className="mt-2 min-h-12 font-bold leading-6 text-slate-900">{article.title}</h3>
                <p className="mt-3 text-xs leading-5 text-slate-500">Simple ways to make your next construction decision clearer and more informed.</p>
                <button onClick={() => setPage('blog')} className="mt-4 rounded-lg bg-brand-orange px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-orange-600">Read guides</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Sample feedback" title="What a planning workflow should feel like" description="These quotes are sample interface content, not verified customer reviews." />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ['The plan and the model stayed in sync after I changed the room count.', 'Homeowner, sample'],
              ['I could see which part of the total was contingency and which part was materials.', 'Contractor, sample'],
              ['Saving the estimate kept the same rates when I came back the next day.', 'Student reviewer, sample'],
            ].map(([quote, person]) => (
              <figure key={person} className="rounded-3xl border border-slate-200 p-5"><blockquote className="text-sm leading-6 text-slate-700">“{quote}”</blockquote><figcaption className="mt-4 text-xs font-semibold uppercase tracking-wider text-[#FF7518]">{person}</figcaption></figure>
            ))}
          </div>
        </div>
      </section>

      <footer id="contact" className="bg-[#101828] text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-3 lg:px-8">
          <div>
            <div className="flex items-center gap-3"><span className="h-9 w-12 overflow-hidden rounded-lg bg-white"><img src="/logoB.png" alt="" width="500" height="500" className="h-12 w-12 object-cover object-top" /></span><span className="text-lg font-bold text-white">BuildRight</span></div>
            <p className="mt-4 max-w-sm text-xs leading-6 text-slate-400">Construction planning and cost estimation for Pakistan. Sample rates and designs are planning guidance, not a contractor tender.</p>
          </div>
          <div><h3 className="text-sm font-bold text-white">Quick Links</h3><div className="mt-4 grid gap-2 text-xs">{[['About Us', 'about'], ['Our Services', 'services'], ['Cost Estimator', 'estimator'], ['Contact Us', 'contact'], ['Guides', 'blog'], ['Professionals', 'contractors']].map(([label, id]) => <button key={label} onClick={() => setPage(id)} className="text-left hover:text-brand-orange">{label}</button>)}</div></div>
          <div><h3 className="text-sm font-bold text-white">Explore BuildRight</h3><div className="mt-4 grid gap-2 text-xs">{[['Floor Planner', 'floorplanner'], ['Marketplace', 'marketplace'], ['Repairs', 'repairs'], ['Cart', 'cart'], ['Dashboard', 'dashboard']].map(([label, id]) => <button key={label} onClick={() => setPage(id)} className="text-left hover:text-brand-orange">{label}</button>)}</div></div>
          <div><h3 className="text-sm font-bold text-white">Plan your next step</h3><p className="mt-3 text-xs leading-5 text-slate-400">Start with a conceptual design or explore a construction cost estimate.</p><div className="mt-4 flex flex-wrap gap-3"><button onClick={() => setPage('designer')} className="rounded-lg bg-brand-orange px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-orange-600">Open Designer</button><button onClick={() => setPage('estimator')} className="rounded-lg border border-slate-500 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white hover:text-slate-900">Estimate Cost</button></div></div>
        </div>
        <div className="border-t border-white/10 px-4 py-4 text-center text-[11px] text-slate-500">© 2026 BuildRight. Final Year Project. All project and pricing figures shown are illustrative.</div>
      </footer>
    </main>
  );
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="font-serif text-sm italic text-brand-orange">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function DashboardPage({ setPage }) {
  const summaryCards = [
    { label: 'Total Projects', value: '128', change: '+18.2%', icon: FolderKanban },
    { label: 'Estimated Construction Cost', value: 'PKR 46.8M', change: '+12.6%', icon: CircleDollarSign },
    { label: 'Saved Projects', value: '34', change: '+7.4%', icon: Save },
    { label: 'Avg Cost / Sq Ft', value: 'PKR 2,480', change: '+4.9%', icon: TrendingUp },
  ];

  const costBreakdown = [
    { name: 'Materials', value: 42 },
    { name: 'Labor', value: 28 },
    { name: 'Equipment', value: 17 },
    { name: 'Planning', value: 13 },
  ];

  const pieColors = ['#f97316', '#fdba74', '#0f172a', '#94a3b8'];
  const dashboardNav = [
    { label: 'Overview', page: 'dashboard' },
    { label: 'New Estimation', page: 'estimator' },
    { label: 'My Projects', page: 'designer' },
    { label: '2D Floor Planner', page: 'floorplanner' },
    { label: '3D Building Designer', page: 'designer' },
    { label: 'Material Marketplace', page: 'materials' },
    { label: 'Cost Forecast', page: 'prediction' },
    { label: 'Contractors', disabled: true },
    { label: 'Reports', disabled: true },
    { label: 'Settings', disabled: true },
  ];

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[260px_1fr] lg:px-8">
      <aside className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft lg:h-[calc(100vh-6rem)]">
        <div className="mb-8 flex items-center gap-3">
          <span className="h-9 w-12 overflow-hidden rounded-lg bg-white"><img src="/logoB.png" alt="" width="500" height="500" className="h-12 w-12 object-cover object-top" /></span>
          <div>
            <div className="font-bold text-slate-900">BuildRight</div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Control center</div>
          </div>
        </div>

        <nav className="space-y-2">
          {dashboardNav.map(({ label, page: targetPage, disabled }, idx) => (
            <button key={label} type="button" onClick={() => targetPage && setPage(targetPage)} disabled={disabled} title={disabled ? `${label} is not available in this demo` : undefined} className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange ${disabled ? 'cursor-not-allowed text-slate-400' : idx === 0 ? 'bg-orange-50 text-brand-orange' : 'text-slate-600 hover:bg-slate-50'}`}>
              <span>{label}</span>
              {idx === 0 && <ChevronRight className="h-4 w-4" />}
            </button>
          ))}
        </nav>
      </aside>

      <main className="space-y-6">
        <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-orange">Illustrative demo dashboard</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Project Overview</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Figures, charts, and project rows below are sample content; this dashboard is not connected to a live account or market feed.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setPage('estimator')} className="rounded-full bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white">New Estimate</button>
            <button type="button" disabled title="Report export is not configured for the demo dashboard" className="cursor-not-allowed rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-400">Download Report</button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map(({ label, value, change, icon: Icon }) => (
            <div key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">{label}</span>
                <div className="rounded-xl bg-orange-50 p-2 text-brand-orange"><Icon className="h-4 w-4" /></div>
              </div>
              <div className="mt-5 text-3xl font-black text-slate-900">{value}</div>
              <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{change}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Monthly Project Estimates</h3>
              <span className="text-sm text-slate-500">FY 2026</span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyForecast}>
                  <defs>
                    <linearGradient id="plannedColor" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Area type="monotone" dataKey="planned" stroke="#f97316" fill="url(#plannedColor)" strokeWidth={3} />
                  <Area type="monotone" dataKey="actual" stroke="#0f172a" fill="transparent" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Construction Spend</h3>
              <span className="text-sm text-slate-500">Overview</span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={costBreakdown} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={4}>
                    {costBreakdown.map((entry, index) => (
                      <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-2">
              {costBreakdown.map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pieColors[idx] }} />
                    {item.name}
                  </div>
                  <span className="font-semibold text-slate-800">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Recent Projects</h3>
              <span className="text-xs font-medium text-slate-500">Example rows</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="pb-3 font-medium">Project</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Area</th>
                    <th className="pb-3 font-medium">Location</th>
                    <th className="pb-3 font-medium">Cost</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentProjects.map((project) => (
                    <tr key={project.name} className="border-b border-slate-100 last:border-none">
                      <td className="py-3 font-semibold text-slate-800">{project.name}</td>
                      <td className="py-3 text-slate-600">{project.type}</td>
                      <td className="py-3 text-slate-600">{project.area}</td>
                      <td className="py-3 text-slate-600">{project.location}</td>
                      <td className="py-3 font-semibold text-slate-800">{project.cost}</td>
                      <td className="py-3 text-slate-600">{project.date}</td>
                      <td className="py-3">
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{project.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Quick Actions</h3>
                <MoreHorizontal className="h-5 w-5 text-slate-400" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <button onClick={() => setPage('estimator')} className="flex items-center justify-between rounded-2xl bg-orange-50 px-4 py-3 text-left text-sm font-semibold text-brand-orange"><span>New Estimate</span><ArrowRight className="h-4 w-4" /></button>
                <button onClick={() => setPage('floorplanner')} className="flex items-center justify-between rounded-2xl bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700"><span>Create Floor Plan</span><Grid2x2 className="h-4 w-4" /></button>
                <button onClick={() => setPage('designer')} className="flex items-center justify-between rounded-2xl bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700"><span>Open 3D Designer</span><Box className="h-4 w-4" /></button>
                <button onClick={() => setPage('designer')} className="flex items-center justify-between rounded-2xl bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700"><span>Open Design Studio</span><Wand2 className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Notifications</h3>
                <span className="rounded-full bg-orange-50 px-2 py-1 text-xs font-semibold text-brand-orange">3 new</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                  <div className="font-semibold text-slate-800">Material Pricing Update</div>
                  <div>Steel prices rose 4.7% across Lahore.</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                  <div className="font-semibold text-slate-800">Saved Project Changed</div>
                  <div>North Ridge Plaza was updated by the design team.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function EstimatorPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    projectName: 'North Ridge Residence',
    location: 'Islamabad',
    buildingType: 'House',
    constructionType: 'Grey Structure',
    plotArea: 1200,
    unit: 'sq ft',
    floors: 2,
    coveredArea: 2200,
    length: 45,
    width: 30,
    structureType: 'Framed RCC',
    quality: 'Premium',
    laborCost: 720000,
    contractorMargin: 12,
    transport: 160000,
    regionalMultiplier: 1.08,
    inflation: 5,
    contingency: 8,
  });

  const currentStep = step;

  const estimate = useMemo(() => {
    const baseRate = {
      Standard: 1850,
      Premium: 2400,
      Luxury: 3200,
    }[form.quality] ?? 2400;

    const areaFactor = form.coveredArea || form.plotArea;
    const materialCost = areaFactor * baseRate;
    const laborCost = form.laborCost || 650000;
    const contractorMargin = materialCost * (form.contractorMargin / 100);
    const transportation = form.transport || 200000;
    const inflationAdjustment = (materialCost + laborCost + transportation) * (form.inflation / 100);
    const contingency = (materialCost + laborCost + transportation + inflationAdjustment) * (form.contingency / 100);
    const total = (materialCost + laborCost + contractorMargin + transportation + inflationAdjustment + contingency) * form.regionalMultiplier;

    return {
      materialCost,
      laborCost,
      contractorMargin,
      transportation,
      inflationAdjustment,
      contingency,
      total,
      costPerSqFt: total / Math.max(areaFactor, 1),
      cementBags: Math.round(areaFactor / 9.5),
      steelTons: (areaFactor / 180).toFixed(2),
      bricks: Math.round(areaFactor * 7.5),
      sand: (areaFactor * 0.18).toFixed(2),
      crush: (areaFactor * 0.22).toFixed(2),
      timeline: '7-9 months',
    };
  }, [form]);

  const pieData = [
    { name: 'Materials', value: estimate.materialCost },
    { name: 'Labor', value: estimate.laborCost },
    { name: 'Margin', value: estimate.contractorMargin },
    { name: 'Transport', value: estimate.transportation },
    { name: 'Contingency', value: estimate.contingency },
  ];

  const steps = [
    { id: 1, title: 'Project Details' },
    { id: 2, title: 'Area & Structure' },
    { id: 3, title: 'Materials & Quality' },
    { id: 4, title: 'Additional Costs' },
    { id: 5, title: 'Results' },
  ];

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const nextStep = () => setStep((s) => Math.min(s + 1, 5));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Estimator</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Smart Construction Cost Estimator</h1>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">Illustrative estimates only</div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {steps.map((item) => (
              <div key={item.id} className={`rounded-full px-3 py-2 text-xs font-semibold ${currentStep === item.id ? 'bg-brand-orange text-white' : 'bg-slate-100 text-slate-600'}`}>
                {item.title}
              </div>
            ))}
          </div>
          <div className="text-sm text-slate-500">Step {currentStep} of {steps.length}</div>
        </div>

        {currentStep === 1 && (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Project Name"><input value={form.projectName} onChange={(e) => setField('projectName', e.target.value)} className="input" /></Field>
            <Field label="Location"><SearchableSelect value={form.location} onChange={(next) => setField('location', next)} options={cities} /></Field>
            <Field label="Building Type"><SearchableSelect value={form.buildingType} onChange={(next) => setField('buildingType', next)} options={buildingTypes} /></Field>
            <Field label="Construction Type"><SearchableSelect value={form.constructionType} onChange={(next) => setField('constructionType', next)} options={['Grey Structure', 'Complete Construction', 'Renovation', 'Custom Project']} /></Field>
          </div>
        )}

        {currentStep === 2 && (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Plot Area"><div className="flex items-center gap-2"><input type="number" value={form.plotArea} onChange={(e) => setField('plotArea', Number(e.target.value))} className="input" /><SearchableSelect className="w-28" value={form.unit} onChange={(next) => setField('unit', next)} options={['sq ft', 'Marla', 'Kanal']} /></div></Field>
            <Field label="Number of Floors"><input type="number" value={form.floors} onChange={(e) => setField('floors', Number(e.target.value))} className="input" /></Field>
            <Field label="Covered Area per Floor"><input type="number" value={form.coveredArea} onChange={(e) => setField('coveredArea', Number(e.target.value))} className="input" /></Field>
            <Field label="Plot Dimensions (L x W)"><div className="flex items-center gap-2"><input type="number" value={form.length} onChange={(e) => setField('length', Number(e.target.value))} className="input" /><input type="number" value={form.width} onChange={(e) => setField('width', Number(e.target.value))} className="input" /></div></Field>
            <Field label="Structure Type"><input value={form.structureType} onChange={(e) => setField('structureType', e.target.value)} className="input" /></Field>
            <Field label="Room Requirements"><input value="3 Bedrooms, 2 Baths, Lounge" className="input" readOnly /></Field>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <label className="mb-3 block text-sm font-semibold text-slate-700">Construction Quality</label>
              <div className="flex flex-wrap gap-3">
                {qualityOptions.map((quality) => (
                  <button key={quality} onClick={() => setField('quality', quality)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${form.quality === quality ? 'border-brand-orange bg-orange-50 text-brand-orange' : 'border-slate-200 bg-white text-slate-700'}`}>
                    {quality}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {['Cement', 'Steel', 'Bricks', 'Blocks', 'Sand', 'Crush', 'Tiles', 'Paint', 'Electrical', 'Plumbing', 'Finishing'].map((item) => (
                <label key={item} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  <span>{item}</span>
                  <input type="checkbox" defaultChecked className="h-4 w-4 accent-brand-orange" />
                </label>
              ))}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Labor Costs"><input type="number" value={form.laborCost} onChange={(e) => setField('laborCost', Number(e.target.value))} className="input" /></Field>
            <Field label="Contractor Margin (%)"><input type="number" value={form.contractorMargin} onChange={(e) => setField('contractorMargin', Number(e.target.value))} className="input" /></Field>
            <Field label="Transportation Costs"><input type="number" value={form.transport} onChange={(e) => setField('transport', Number(e.target.value))} className="input" /></Field>
            <Field label="Regional Pricing Multiplier"><input type="number" step="0.01" value={form.regionalMultiplier} onChange={(e) => setField('regionalMultiplier', Number(e.target.value))} className="input" /></Field>
            <Field label="Inflation Adjustment (%)"><input type="number" value={form.inflation} onChange={(e) => setField('inflation', Number(e.target.value))} className="input" /></Field>
            <Field label="Contingency (%)"><input type="number" value={form.contingency} onChange={(e) => setField('contingency', Number(e.target.value))} className="input" /></Field>
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-3xl bg-slate-900 p-6 text-white">
                <div className="text-sm uppercase tracking-[0.2em] text-slate-400">Total Estimated Cost</div>
                <div className="mt-4 text-4xl font-black">{formatCurrency(estimate.total)}</div>
                <div className="mt-2 text-sm text-slate-300">Cost per sq ft: {formatCurrency(estimate.costPerSqFt)}</div>
                <div className="mt-6 flex items-center justify-between text-sm text-slate-300">
                  <span>Estimated timeline</span>
                  <span className="font-semibold text-white">{estimate.timeline}</span>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <div className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Breakdown</div>
                <div className="space-y-3 text-sm text-slate-600">
                  <div className="flex justify-between"><span>Material Cost</span><span className="font-semibold text-slate-800">{formatCurrency(estimate.materialCost)}</span></div>
                  <div className="flex justify-between"><span>Labor Cost</span><span className="font-semibold text-slate-800">{formatCurrency(estimate.laborCost)}</span></div>
                  <div className="flex justify-between"><span>Contractor Margin</span><span className="font-semibold text-slate-800">{formatCurrency(estimate.contractorMargin)}</span></div>
                  <div className="flex justify-between"><span>Transportation</span><span className="font-semibold text-slate-800">{formatCurrency(estimate.transportation)}</span></div>
                  <div className="flex justify-between"><span>Contingency</span><span className="font-semibold text-slate-800">{formatCurrency(estimate.contingency)}</span></div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="mb-4 text-lg font-bold text-slate-900">Material Quantity & Price Table</div>
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="pb-3 font-medium">Material</th>
                      <th className="pb-3 font-medium">Qty</th>
                      <th className="pb-3 font-medium">Unit</th>
                      <th className="pb-3 font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100"><td className="py-2">Cement</td><td className="py-2">{estimate.cementBags}</td><td className="py-2">Bags</td><td className="py-2">{formatCurrency(estimate.cementBags * 1250)}</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-2">Steel</td><td className="py-2">{estimate.steelTons}</td><td className="py-2">Tons</td><td className="py-2">{formatCurrency(estimate.steelTons * 285000)}</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-2">Bricks</td><td className="py-2">{estimate.bricks}</td><td className="py-2">Nos</td><td className="py-2">{formatCurrency(estimate.bricks * 18)}</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-2">Sand</td><td className="py-2">{estimate.sand}</td><td className="py-2">Cubic Yd</td><td className="py-2">{formatCurrency(Number(estimate.sand) * 16500)}</td></tr>
                    <tr><td className="py-2">Crush</td><td className="py-2">{estimate.crush}</td><td className="py-2">Tons</td><td className="py-2">{formatCurrency(Number(estimate.crush) * 22000)}</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="mb-4 text-lg font-bold text-slate-900">Cost Distribution</div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" innerRadius={45} outerRadius={80} paddingAngle={3}>
                        {pieData.map((entry, index) => (
                          <Cell key={entry.name} fill={['#f97316', '#fdba74', '#0f172a', '#94a3b8', '#dbeafe'][index]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
          <button onClick={prevStep} disabled={currentStep === 1} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Back</button>
          <div className="flex gap-3">
            <button className="rounded-full border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-medium text-slate-700">Save Project</button>
            <button onClick={nextStep} className="rounded-full bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white">{currentStep === 5 ? 'Review Complete' : 'Next'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function FloorPlannerPage() {
  const [rooms, setRooms] = useState(floorPlannerInitialRooms);
  const [selectedRoomId, setSelectedRoomId] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState([floorPlannerInitialRooms]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [buildingType, setBuildingType] = useState('House');

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) || rooms[0];

  const updateRoom = (updates) => {
    const nextRooms = rooms.map((room) => (room.id === selectedRoomId ? { ...room, ...updates } : room));
    setRooms(nextRooms);
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), nextRooms]);
    setHistoryIndex((prev) => prev + 1);
  };

  const addRoom = (type) => {
    const newRoom = {
      id: Date.now(),
      type,
      x: 10 + rooms.length * 4,
      y: 10 + rooms.length * 4,
      width: 18,
      height: 14,
      label: `${type} ${rooms.length + 1}`,
    };
    const nextRooms = [...rooms, newRoom];
    setRooms(nextRooms);
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), nextRooms]);
    setHistoryIndex((prev) => prev + 1);
    setSelectedRoomId(newRoom.id);
  };

  const undo = () => {
    if (historyIndex === 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setRooms(history[nextIndex]);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    setRooms(history[nextIndex]);
  };

  const reset = () => {
    setRooms(floorPlannerInitialRooms);
    setHistory([floorPlannerInitialRooms]);
    setHistoryIndex(0);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">2D Floor Planner</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Interactive Room Layout Studio</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={undo} className="rounded-full border border-slate-200 bg-slate-50 p-2.5"><Undo2 className="h-4 w-4" /></button>
          <button onClick={redo} className="rounded-full border border-slate-200 bg-slate-50 p-2.5"><Redo2 className="h-4 w-4" /></button>
          <button onClick={reset} className="rounded-full border border-slate-200 bg-slate-50 p-2.5"><RotateCcw className="h-4 w-4" /></button>
          <button onClick={() => setZoom((value) => Math.min(value + 0.1, 1.8))} className="rounded-full border border-slate-200 bg-slate-50 p-2.5"><ZoomIn className="h-4 w-4" /></button>
          <button onClick={() => setZoom((value) => Math.max(value - 0.1, 0.8))} className="rounded-full border border-slate-200 bg-slate-50 p-2.5"><ZoomOut className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr_320px]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
          <div className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Project</div>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Building Type</span>
            <SearchableSelect value={buildingType} onChange={setBuildingType} options={['House', 'Plaza', 'Shop', 'University', 'Office', 'Commercial Building']} />
          </label>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-2 block text-sm text-slate-700">Plot width</span><input type="number" defaultValue={42} className="input" /></label>
            <label className="block"><span className="mb-2 block text-sm text-slate-700">Plot length</span><input type="number" defaultValue={52} className="input" /></label>
            <label className="block"><span className="mb-2 block text-sm text-slate-700">Floors</span><input type="number" defaultValue={2} className="input" /></label>
            <label className="block"><span className="mb-2 block text-sm text-slate-700">Scale</span><input type="number" defaultValue={1} className="input" /></label>
          </div>

          <div className="mt-6">
            <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Add Room</div>
            <div className="grid gap-2">
              {roomKinds.map((type) => (
                <button key={type} onClick={() => addRoom(type)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100">{type}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Plan Canvas</div>
            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-brand-orange">{zoom.toFixed(1)}x</span>
          </div>
          <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-100 p-4">
            <div className="grid h-[560px] place-items-center overflow-auto">
              <div className="relative h-[420px] w-[560px] rounded-3xl border-[4px] border-slate-300 bg-[repeating-linear-gradient(#fff,#fff_32px,#e2e8f0_32px,#e2e8f0_33px),repeating-linear-gradient(90deg,#fff,#fff_32px,#e2e8f0_32px,#e2e8f0_33px)]" style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
                <div className="absolute left-4 top-4 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">N</div>
                <div className="absolute left-4 top-8 h-3 w-3 rounded-full bg-slate-800" />
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`absolute flex cursor-pointer items-center justify-center border-2 ${selectedRoomId === room.id ? 'border-brand-orange bg-orange-100/80' : 'border-slate-400 bg-white/90'} text-center text-sm font-semibold text-slate-800 shadow-sm`}
                    style={{ left: `${room.x}%`, top: `${room.y}%`, width: `${room.width}%`, height: `${room.height}%` }}
                  >
                    <div className="flex flex-col items-center justify-center text-center">
                      <span>{room.label}</span>
                      <span className="text-[10px] font-medium text-slate-500">{room.width}x{room.height} ft</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
          <div className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Properties</div>
          {selectedRoom ? (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Room Type</span>
                <SearchableSelect value={selectedRoom.type} onChange={(next) => updateRoom({ type: next })} options={roomKinds} />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Name</span>
                <input value={selectedRoom.label} onChange={(e) => updateRoom({ label: e.target.value })} className="input" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="mb-2 block text-sm text-slate-700">Width</span><input type="number" value={selectedRoom.width} onChange={(e) => updateRoom({ width: Number(e.target.value) })} className="input" /></label>
                <label className="block"><span className="mb-2 block text-sm text-slate-700">Height</span><input type="number" value={selectedRoom.height} onChange={(e) => updateRoom({ height: Number(e.target.value) })} className="input" /></label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="mb-2 block text-sm text-slate-700">X Position</span><input type="number" value={selectedRoom.x} onChange={(e) => updateRoom({ x: Number(e.target.value) })} className="input" /></label>
                <label className="block"><span className="mb-2 block text-sm text-slate-700">Y Position</span><input type="number" value={selectedRoom.y} onChange={(e) => updateRoom({ y: Number(e.target.value) })} className="input" /></label>
              </div>

              <div className="grid gap-2">
                <button className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">Add door</button>
                <button className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">Add window</button>
                <button className="rounded-2xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">Delete room</button>
              </div>
            </div>
          ) : (
            <p className="text-slate-500">Select a room to edit properties.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DesignerPage() {
  const [settings, setSettings] = useState({
    buildingType: 'House',
    floors: 2,
    width: 18,
    depth: 12,
    wallColor: '#e2e8f0',
    roofStyle: 'Flat',
    windowStyle: 'Large',
    preset: 'Modern',
  });

  const presetColors = {
    Modern: '#f8fafc',
    Contemporary: '#e2e8f0',
    Traditional: '#f5f5f4',
    Minimalist: '#f1f5f9',
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">3D Building Designer</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">Architectural Preview</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Building Type</span>
              <SearchableSelect value={settings.buildingType} onChange={(next) => setSettings({ ...settings, buildingType: next })} options={['House', 'Plaza', 'Shop', 'University', 'Office', 'Commercial Building']} />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="mb-2 block text-sm text-slate-700">Width</span><input type="number" value={settings.width} onChange={(e) => setSettings({ ...settings, width: Number(e.target.value) })} className="input" /></label>
              <label className="block"><span className="mb-2 block text-sm text-slate-700">Depth</span><input type="number" value={settings.depth} onChange={(e) => setSettings({ ...settings, depth: Number(e.target.value) })} className="input" /></label>
              <label className="block"><span className="mb-2 block text-sm text-slate-700">Floors</span><input type="number" value={settings.floors} onChange={(e) => setSettings({ ...settings, floors: Number(e.target.value) })} className="input" /></label>
              <label className="block"><span className="mb-2 block text-sm text-slate-700">Preset</span><SearchableSelect value={settings.preset} onChange={(next) => setSettings({ ...settings, preset: next, wallColor: presetColors[next] || settings.wallColor })} options={['Modern', 'Contemporary', 'Traditional', 'Minimalist']} /></label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Wall Color</span>
              <input type="color" value={settings.wallColor} onChange={(e) => setSettings({ ...settings, wallColor: e.target.value })} className="h-12 w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-1" />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Roof Style</span>
              <SearchableSelect value={settings.roofStyle} onChange={(next) => setSettings({ ...settings, roofStyle: next })} options={['Flat', 'Hip', 'Gable']} />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Window Style</span>
              <SearchableSelect value={settings.windowStyle} onChange={(next) => setSettings({ ...settings, windowStyle: next })} options={['Large', 'Sliding', 'Minimal']} />
            </label>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-3 shadow-soft">
          <div className="mb-3 flex items-center justify-between px-2">
            <div className="text-sm font-medium text-slate-600">Viewport</div>
            <div className="flex gap-2">
              <button className="rounded-full border border-slate-200 bg-slate-50 p-2"><RotateCcw className="h-4 w-4" /></button>
              <button className="rounded-full border border-slate-200 bg-slate-50 p-2"><ZoomIn className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="h-[700px] overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-100">
            <Canvas camera={{ position: [8, 7, 11], fov: 42 }}>
              <ambientLight intensity={1.1} />
              <directionalLight position={[6, 10, 4]} intensity={1.5} />
              <group position={[0, -1.1, 0]}>
                <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                  <planeGeometry args={[30, 30]} />
                  <meshStandardMaterial color="#dbeafe" />
                </mesh>
                <mesh position={[0, 0.4, 0]} castShadow>
                  <boxGeometry args={[settings.width, 1.2, settings.depth]} />
                  <meshStandardMaterial color="#cbd5e1" />
                </mesh>
                <mesh position={[0, 2.5 + (settings.floors - 1) * 1.2, 0]} castShadow>
                  <boxGeometry args={[settings.width, settings.floors * 2.2, settings.depth]} />
                  <meshStandardMaterial color={settings.wallColor} />
                </mesh>
                <mesh position={[0, 4 + settings.floors * 1.2, 0]} castShadow>
                  <boxGeometry args={[settings.width + 0.5, 0.5, settings.depth + 0.5]} />
                  <meshStandardMaterial color="#e2e8f0" />
                </mesh>
                <mesh position={[0, 1.2, settings.depth / 2 + 0.15]} castShadow>
                  <boxGeometry args={[2.2, 2.2, 0.2]} />
                  <meshStandardMaterial color="#94a3b8" />
                </mesh>
                {[[-4.5, 1.1, 0], [4.5, 1.1, 0], [0, 1.1, -5.5], [0, 1.1, 5.5]].map((position, idx) => (
                  <mesh key={idx} position={position} castShadow>
                    <boxGeometry args={[0.4, 1.8, 0.2]} />
                    <meshStandardMaterial color="#f8fafc" />
                  </mesh>
                ))}
              </group>
              <ContactShadows position={[0, -0.8, 0]} opacity={0.45} blur={2.5} far={6} />
              <OrbitControls enablePan enableZoom enableRotate />
            </Canvas>
          </div>
        </div>
      </div>
    </div>
  );
}

function PredictionPage() {
  const [area, setArea] = useState(2500);
  const [location, setLocation] = useState('Islamabad');
  const [buildingType, setBuildingType] = useState('House');
  const [quality, setQuality] = useState('Premium');
  const [year, setYear] = useState(2026);

  const predictions = useMemo(() => {
    const rate = {
      Standard: 2000,
      Premium: 2600,
      Luxury: 3400,
    }[quality] || 2600;
    const base = area * rate * (location === 'Karachi' ? 1.08 : location === 'Gilgit-Baltistan' ? 1.12 : 1.0);
    const total = base * (1 + (year - 2025) * 0.06);

    return {
      current: total,
      month3: total * 1.06,
      month6: total * 1.12,
      month12: total * 1.2,
      trend: [
        { month: 'Jan', cost: total * 0.92 },
        { month: 'Mar', cost: total * 0.97 },
        { month: 'May', cost: total * 1.02 },
        { month: 'Jul', cost: total * 1.08 },
        { month: 'Sep', cost: total * 1.12 },
        { month: 'Dec', cost: total * 1.18 },
      ],
    };
  }, [area, location, quality, year]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Illustrative cost scenario</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">Cost Forecasting Dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">A rule-based illustration using sample rates and assumptions—not an AI model or live market feed. Verify estimates with local suppliers and qualified professionals.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
          <div className="space-y-5">
            <Field label="Project Area"><input type="number" value={area} onChange={(e) => setArea(Number(e.target.value))} className="input" /></Field>
            <Field label="Location"><SearchableSelect value={location} onChange={setLocation} options={cities} /></Field>
            <Field label="Building Type"><SearchableSelect value={buildingType} onChange={setBuildingType} options={buildingTypes} /></Field>
            <Field label="Material Quality"><SearchableSelect value={quality} onChange={setQuality} options={['Standard', 'Premium', 'Luxury']} /></Field>
            <Field label="Construction Year"><input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="input" /></Field>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-slate-400">Illustrative estimated cost</div>
                <div className="mt-2 text-4xl font-black text-slate-900">{formatCurrency(predictions.current)}</div>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">Formula-based scenario</div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { label: '3 Months', value: predictions.month3 },
                { label: '6 Months', value: predictions.month6 },
                { label: '12 Months', value: predictions.month12 },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">{item.label}</div>
                  <div className="mt-2 text-xl font-bold text-slate-900">{formatCurrency(item.value)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-4 text-lg font-bold text-slate-900">Cost Trend Projection</div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={predictions.trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Line type="monotone" dataKey="cost" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
              <div className="mb-4 text-lg font-bold text-slate-900">Material Comparison</div>
              <div className="space-y-3">
                {materialCatalog.slice(0, 5).map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <div>
                      <div className="font-semibold text-slate-800">{item.name}</div>
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{item.quality}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">{formatCurrency(item.price)}</div>
                      <div className="text-xs text-slate-500">{item.unit}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
              <div className="mb-4 text-lg font-bold text-slate-900">Prediction Factors</div>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> Material price volatility in {location}</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> Construction type and structural density</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> Seasonal labor and logistics conditions</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> Quality classification and inflation index</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MaterialMarketplacePage() {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('Recommended');

  const categories = ['All', 'Binders', 'Structural', 'Masonry', 'Aggregates', 'Finishing', 'Plumbing', 'Electrical'];

  const filteredMaterials = useMemo(() => {
    const lowerQuery = query.toLowerCase();
    return [...materialCatalog]
      .filter((material) => (selectedCategory === 'All' ? true : material.category === selectedCategory))
      .filter((material) => material.name.toLowerCase().includes(lowerQuery) || material.category.toLowerCase().includes(lowerQuery))
      .sort((a, b) => {
        if (sortBy === 'Price: Low to High') return a.price - b.price;
        if (sortBy === 'Price: High to Low') return b.price - a.price;
        if (sortBy === 'Quality') return (['Standard', 'Premium', 'Luxury'].indexOf(b.quality) - ['Standard', 'Premium', 'Luxury'].indexOf(a.quality));
        return 0;
      });
  }, [query, selectedCategory, sortBy]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Material Marketplace</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">Supplier Comparison & Planning</h1>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full rounded-full border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-700 outline-none focus:border-brand-orange" placeholder="Search materials" />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button key={category} onClick={() => setSelectedCategory(category)} className={`rounded-full px-4 py-2 text-sm font-semibold ${selectedCategory === category ? 'bg-brand-orange text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
                {category}
              </button>
            ))}
          </div>

          <SearchableSelect
            className="w-52"
            triggerClassName="!rounded-full !border-slate-200 !bg-white !px-4 !py-2.5 !text-sm !font-medium !text-slate-700"
            value={sortBy}
            onChange={setSortBy}
            options={['Recommended', 'Price: Low to High', 'Price: High to Low', 'Quality']}
          />
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredMaterials.map((material) => (
            <div key={material.name} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xl font-bold text-slate-900">{material.name}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">{material.category}</div>
                </div>
                <div className="rounded-xl bg-white p-2 text-brand-orange"><Package2 className="h-5 w-5" /></div>
              </div>

              <div className="mt-5 flex items-end justify-between">
                <div>
                  <div className="text-2xl font-black text-slate-900">{formatCurrency(material.price)}</div>
                  <div className="text-xs uppercase tracking-[0.12em] text-slate-500">{material.unit}</div>
                </div>
                <div className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{material.availability}</div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4">
                <span className="text-sm text-slate-500">Quality</span>
                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-brand-orange">{material.quality}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
