export const paths = {
  home: '/',
  about: '/about',
  services: '/services',
  estimator: '/estimator',
  designer: '/design',
  floorplanner: '/floor-planner',
  projects: '/projects',
  materials: '/materials',
  marketplace: '/marketplace',
  calculator: '/quantity-calculator',
  cart: '/cart',
  orders: '/orders',
  repairs: '/repairs',
  supplier: '/supplier',
  provider: '/provider',
  contractors: '/contractors',
  blog: '/blog',
  contact: '/contact',
  login: '/login',
  register: '/register',
  forgot: '/forgot-password',
  reset: '/reset-password',
  dashboard: '/dashboard',
  admin: '/admin',
  prediction: '/forecast',
};

export function pathFor(page, slug = '') {
  if (page === 'article' && slug) return `/blog/${slug}`;
  if (page === 'service' && slug) return `/services/${slug}`;
  if (page === 'product' && slug) return `/marketplace/${slug}`;
  if (page === 'order' && slug) return `/orders/${slug}`;
  if (page === 'repair-project' && slug) return `/repairs/${slug}`;
  return paths[page] || '/';
}

export function pageFromPath(pathname) {
  if (pathname.startsWith('/blog/') && pathname.length > 6) return { page: 'article', slug: decodeURIComponent(pathname.slice(6)) };
  if (pathname.startsWith('/services/') && pathname.length > 10) return { page: 'service', slug: decodeURIComponent(pathname.slice(10)) };
  if (pathname.startsWith('/marketplace/') && pathname.length > '/marketplace/'.length) return { page: 'product', slug: decodeURIComponent(pathname.slice('/marketplace/'.length)) };
  if (pathname.startsWith('/orders/') && pathname.length > '/orders/'.length) return { page: 'order', slug: decodeURIComponent(pathname.slice('/orders/'.length)) };
  if (pathname.startsWith('/repairs/') && pathname.length > '/repairs/'.length) return { page: 'repair-project', slug: decodeURIComponent(pathname.slice('/repairs/'.length)) };
  const match = Object.entries(paths).find(([, path]) => path === pathname);
  return { page: match?.[0] || 'home', slug: '' };
}
