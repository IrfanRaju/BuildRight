import { useEffect, useState } from 'react';
import { Check, Copy, Link2, MapPin, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { api, money } from '../../lib/api';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { EmptyState, Notice, PageHeader, SearchableSelect, buttonClass, ghostClass } from '../../components/ui';

const CITY_KEY = 'buildright-marketplace-city';
const COMPARE_KEY = 'buildright-marketplace-compare';
const QUALITY_OPTIONS = [
  { value: '', label: 'Any grade' },
  { value: 'economy', label: 'Economy' },
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
  { value: 'luxury', label: 'Luxury' },
];

const COMPARE_ROWS = [
  { label: 'Brand', key: 'brand', format: (product) => product.brand || 'Unbranded' },
  { label: 'Grade', key: 'quality', format: (product) => formatQuality(product.quality) },
  { label: 'Price', key: 'pricePkr', format: (product) => money(product.pricePkr), highlightBest: 'min' },
  { label: 'Unit', key: 'unit', format: (product) => product.unit },
  { label: 'Stock', key: 'stock', format: (product) => product.availability || product.stock },
  { label: 'Supplier', key: 'supplierName', format: (product) => product.supplierName || 'Catalog' },
  { label: 'Delivery', key: 'deliveryDays', format: (product) => `${product.deliveryDays} day${product.deliveryDays === 1 ? '' : 's'}`, highlightBest: 'min' },
  { label: 'Source', key: 'priceSource', format: (product) => (product.priceSource === 'supplier' ? 'Supplier-verified' : 'Admin-managed') },
];

function formatQuality(value) {
  if (!value) return 'Standard';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function readStoredCity() {
  try { return sessionStorage.getItem(CITY_KEY) || 'Islamabad'; } catch { return 'Islamabad'; }
}

function storeCity(city) {
  try { sessionStorage.setItem(CITY_KEY, city || ''); } catch { /* ignore */ }
}

function readCompareIds() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('compare');
    if (fromUrl) {
      return [...new Set(fromUrl.split(',').map((id) => id.trim()).filter(Boolean))].slice(0, 3);
    }
    const stored = sessionStorage.getItem(COMPARE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, 3) : [];
  } catch {
    return [];
  }
}

function syncCompareIds(ids) {
  const clean = [...new Set(ids.map(String).filter(Boolean))].slice(0, 3);
  try { sessionStorage.setItem(COMPARE_KEY, JSON.stringify(clean)); } catch { /* ignore */ }
  try {
    const url = new URL(window.location.href);
    if (clean.length) url.searchParams.set('compare', clean.join(','));
    else url.searchParams.delete('compare');
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
      window.history.replaceState(window.history.state, '', next);
    }
  } catch { /* ignore */ }
  return clean;
}

function bestValue(products, key, mode) {
  const values = products.map((product) => Number(product[key])).filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return mode === 'min' ? Math.min(...values) : Math.max(...values);
}

export default function MarketplacePage({ setPage }) {
  const { user } = useAuth();
  const { add } = useCart();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [cities, setCities] = useState(['Islamabad', 'Rawalpindi', 'Lahore', 'Karachi', 'Peshawar', 'Multan', 'Faisalabad', 'Gilgit-Baltistan']);
  const [city, setCity] = useState(readStoredCity);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [brand, setBrand] = useState('');
  const [quality, setQuality] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState('name');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [compare, setCompare] = useState([]);
  const [compareReady, setCompareReady] = useState(false);
  const [multiplier, setMultiplier] = useState(1);
  const [shareState, setShareState] = useState('');

  useEffect(() => {
    api('/api/marketplace/categories')
      .then((result) => setCategories(result.categories || []))
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ids = readCompareIds();
    if (!ids.length) {
      setCompare([]);
      setCompareReady(true);
      return undefined;
    }
    const params = new URLSearchParams({ ids: ids.join(','), limit: '3' });
    if (city) params.set('city', city);
    api(`/api/marketplace/products?${params}`)
      .then((result) => {
        if (cancelled) return;
        const byId = new Map((result.products || []).map((product) => [String(product._id), product]));
        const ordered = ids.map((id) => byId.get(String(id))).filter(Boolean);
        setCompare(ordered);
        syncCompareIds(ordered.map((product) => product._id));
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message);
      })
      .finally(() => {
        if (!cancelled) setCompareReady(true);
      });
    return () => { cancelled = true; };
  }, [city]);

  useEffect(() => {
    storeCity(city);
    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ limit: '12', sort, page: String(pageNumber) });
      if (city) params.set('city', city);
      if (query.trim()) params.set('q', query.trim());
      if (category !== 'All') params.set('category', category);
      if (brand) params.set('brand', brand);
      if (quality) params.set('quality', quality);
      if (inStockOnly) params.set('inStock', '1');
      if (minPrice !== '') params.set('minPrice', minPrice);
      if (maxPrice !== '') params.set('maxPrice', maxPrice);
      api(`/api/marketplace/products?${params}`)
        .then((catalog) => {
          setProducts(catalog.products || []);
          setBrands(catalog.brands || []);
          if (catalog.cities?.length) setCities(catalog.cities);
          setMultiplier(catalog.cityMultiplier || 1);
          setNotice(catalog.priceNotice || '');
          setPages(catalog.pages || 1);
          setTotal(catalog.total || 0);
          setError('');
        })
        .catch((requestError) => setError(requestError.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, category, brand, quality, inStockOnly, sort, minPrice, maxPrice, pageNumber, city]);

  const toggleCompare = (product) => {
    setCompare((current) => {
      const exists = current.some((item) => item._id === product._id);
      const next = exists
        ? current.filter((item) => item._id !== product._id)
        : current.length >= 3
          ? current
          : [...current, product];
      syncCompareIds(next.map((item) => item._id));
      return next;
    });
    setShareState('');
  };

  const clearCompare = () => {
    setCompare([]);
    syncCompareIds([]);
    setShareState('');
  };

  const copyCompareLink = async () => {
    if (!compare.length) return;
    const ids = syncCompareIds(compare.map((item) => item._id));
    const url = new URL(window.location.href);
    url.searchParams.set('compare', ids.join(','));
    try {
      await navigator.clipboard.writeText(url.toString());
      setShareState('copied');
      setTimeout(() => setShareState(''), 2000);
    } catch {
      setShareState('failed');
      setTimeout(() => setShareState(''), 2500);
    }
  };

  const lowestPrice = bestValue(compare, 'pricePkr', 'min');
  const fastestDelivery = bestValue(compare, 'deliveryDays', 'min');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        variant={user ? 'portal' : 'marketing'}
        eyebrow="Marketplace"
        title="Construction materials"
        description="Browse administrator-managed and supplier-verified prices by city, then compare grades side by side, calculate quantities, and order. City prices use regional multipliers; cart checkout uses catalog base prices."
        actions={<button type="button" className={buttonClass} onClick={() => setPage('calculator')}>Quantity calculator</button>}
      />
      {notice && <div className="mb-4"><Notice>{notice}</Notice></div>}
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      {!user && (
        <div className="mb-4 rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50 to-white px-4 py-3 text-sm text-slate-700">
          Visitors can compare up to 3 materials, filter by grade and stock, and share a shortlist link — no account needed until checkout.
        </div>
      )}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap">
          <label className="flex min-w-[12rem] flex-1 items-center gap-2 lg:max-w-xs">
            <span className="sr-only">Pricing city</span>
            <span className="hidden items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:inline-flex">
              <MapPin className="h-3.5 w-3.5 text-[#FF7518]" />
              City
            </span>
            <SearchableSelect
              value={city}
              onChange={(next) => { setCity(next); setPageNumber(1); }}
              options={cities}
              clearable
              emptyLabel="Catalog base"
              aria-label="Filter prices by city"
            />
          </label>
          <input className="input lg:max-w-sm" value={query} onChange={(event) => { setQuery(event.target.value); setPageNumber(1); }} placeholder="Search name, brand, category, or keyword" aria-label="Search products" />
          <input className="input w-32" type="number" min="0" value={minPrice} onChange={(event) => { setMinPrice(event.target.value); setPageNumber(1); }} placeholder="Min PKR" aria-label="Minimum price" />
          <input className="input w-32" type="number" min="0" value={maxPrice} onChange={(event) => { setMaxPrice(event.target.value); setPageNumber(1); }} placeholder="Max PKR" aria-label="Maximum price" />
          <SearchableSelect className="lg:w-48" value={brand} onChange={(next) => { setBrand(next); setPageNumber(1); }} options={brands} clearable emptyLabel="All brands" aria-label="Filter by brand" />
          <SearchableSelect
            className="lg:w-44"
            value={quality}
            onChange={(next) => { setQuality(next); setPageNumber(1); }}
            options={QUALITY_OPTIONS.filter((option) => option.value !== '')}
            clearable
            emptyLabel="Any grade"
            aria-label="Filter by quality grade"
          />
          <SearchableSelect
            className="lg:w-52"
            value={sort}
            onChange={(next) => { setSort(next); setPageNumber(1); }}
            options={[
              { value: 'name', label: 'Name' },
              { value: 'price-asc', label: 'Price: low to high' },
              { value: 'price-desc', label: 'Price: high to low' },
              { value: 'updated', label: 'Recently updated' },
            ]}
            aria-label="Sort products"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-[#FF7518] focus:ring-[#FF7518]"
              checked={inStockOnly}
              onChange={(event) => { setInStockOnly(event.target.checked); setPageNumber(1); }}
            />
            In stock only
          </label>
          {quality && (
            <button type="button" className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-[#c45a0f]" onClick={() => { setQuality(''); setPageNumber(1); }}>
              Grade: {formatQuality(quality)}
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {city && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-semibold text-[#c45a0f]">
            <MapPin className="h-3.5 w-3.5" />
            Showing {city} prices · regional factor ×{Number(multiplier).toFixed(2)}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <FilterChip active={category === 'All'} onClick={() => { setCategory('All'); setPageNumber(1); }}>All</FilterChip>
          {categories.map((item) => <FilterChip key={item.slug} active={category === item.slug} onClick={() => { setCategory(item.slug); setPageNumber(1); }}>{item.name}</FilterChip>)}
        </div>
        <p className="mt-4 text-xs text-slate-500">{loading ? 'Searching the catalog…' : `${total} matching product${total === 1 ? '' : 's'} from the database`}</p>
        {!loading && !error && products.length === 0 && <div className="mt-6"><EmptyState title="No products found" text="Nothing in the catalog matches that search. Try another keyword, or run npm run seed if the catalog is empty." /></div>}
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => {
            const selected = compare.some((item) => item._id === product._id);
            const compareFull = !selected && compare.length >= 3;
            return (
              <motion.article key={product._id} whileHover={{ y: -3 }} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                <button type="button" className="block w-full text-left" onClick={() => setPage('product', product.slug)}>
                  <img src={product.images?.[0] || '/logoB.png'} alt="" className="h-40 w-full object-cover" />
                  <div className="p-5">
                    <p className="text-xs uppercase tracking-wider text-slate-500">{product.brand || 'Unbranded'} · {product.categorySlug}</p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">{product.name}</h2>
                    <p className="mt-2 inline-flex rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">{formatQuality(product.quality)}</p>
                    <p className="mt-3 text-2xl font-black">{money(product.pricePkr)} <span className="text-sm font-medium text-slate-500">/ {product.unit}</span></p>
                    {product.pricingCity ? (
                      <p className="mt-1 text-xs font-semibold text-[#FF7518]">
                        {product.pricingCity} price
                        {product.basePricePkr != null && product.basePricePkr !== product.pricePkr ? (
                          <span className="font-medium text-slate-400"> · base {money(product.basePricePkr)}</span>
                        ) : null}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-500">{product.availability} · {product.deliveryDays} day delivery estimate · {product.supplierName}</p>
                    <p className="mt-2 text-xs text-slate-400">Updated {new Date(product.priceUpdatedAt || product.updatedAt).toLocaleDateString()} · {product.priceSource === 'supplier' ? 'Supplier-verified' : 'Administrator-managed'}{product.illustrative ? ' · sample price' : ''}</p>
                  </div>
                </button>
                <div className="flex items-center justify-between gap-3 px-5 pb-5">
                  <button type="button" className={buttonClass} onClick={() => add(product, 1).catch((requestError) => setError(requestError.message))}>Add to cart</button>
                  <label className={`flex items-center gap-2 text-xs font-semibold ${compareFull ? 'cursor-not-allowed text-slate-400' : 'text-slate-600'}`}>
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={compareFull}
                      onChange={() => toggleCompare(product)}
                      title={compareFull ? 'Compare list is full (max 3)' : 'Add to compare'}
                    />
                    Compare
                  </label>
                </div>
              </motion.article>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <button type="button" className={buttonClass} disabled={pageNumber <= 1} onClick={() => setPageNumber((current) => Math.max(1, current - 1))}>Previous</button>
          <span>Page {pageNumber} of {pages}</span>
          <button type="button" className={buttonClass} disabled={pageNumber >= pages} onClick={() => setPageNumber((current) => current + 1)}>Next</button>
        </div>
      </div>

      {compareReady && compare.length > 0 && (
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Compare shortlist · {compare.length}/3{city ? ` · ${city}` : ''}</h2>
              <p className="mt-1 text-sm text-slate-600">Each product gets its own column — copy the link to share this shortlist without signing in.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={ghostClass} onClick={copyCompareLink}>
                {shareState === 'copied' ? <Check className="mr-1.5 inline h-4 w-4" /> : shareState === 'failed' ? <Link2 className="mr-1.5 inline h-4 w-4" /> : <Copy className="mr-1.5 inline h-4 w-4" />}
                {shareState === 'copied' ? 'Link copied' : shareState === 'failed' ? 'Copy failed' : 'Copy share link'}
              </button>
              <button type="button" className={ghostClass} onClick={clearCompare}>Clear</button>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <div
              className="min-w-[36rem] divide-y divide-slate-100"
              style={{ display: 'grid', gridTemplateColumns: `8.5rem repeat(${compare.length}, minmax(11rem, 1fr))` }}
              role="table"
              aria-label="Product comparison"
            >
              <div className="sticky left-0 z-10 bg-slate-50 px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400" role="columnheader">Spec</div>
              {compare.map((product) => (
                <div key={`head-${product._id}`} className="border-l border-slate-100 bg-slate-50 px-3 py-3" role="columnheader">
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" className="text-left text-sm font-bold leading-snug text-slate-900 hover:text-[#FF7518]" onClick={() => setPage('product', product.slug)}>
                      {product.name}
                    </button>
                    <button type="button" className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-white hover:text-slate-700" aria-label={`Remove ${product.name} from compare`} onClick={() => toggleCompare(product)}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{product.brand || 'Unbranded'}</p>
                </div>
              ))}

              {COMPARE_ROWS.map((row) => (
                <div key={row.key} className="contents" role="row">
                  <div className="sticky left-0 z-10 bg-white px-3 py-2.5 text-sm text-slate-500" role="rowheader">{row.label}</div>
                  {compare.map((product) => {
                    const value = Number(product[row.key]);
                    const isBest = row.highlightBest === 'min'
                      && Number.isFinite(value)
                      && value === (row.key === 'pricePkr' ? lowestPrice : fastestDelivery)
                      && compare.length > 1;
                    return (
                      <div key={`${product._id}-${row.key}`} className={`border-l border-slate-100 px-3 py-2.5 text-sm font-semibold ${isBest ? 'bg-emerald-50/60 text-emerald-700' : 'bg-white text-slate-900'}`} role="cell">
                        {row.format(product)}
                        {isBest ? <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">best</span> : null}
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="contents" role="row">
                <div className="sticky left-0 z-10 bg-white px-3 py-3 text-sm text-slate-500" role="rowheader">Actions</div>
                {compare.map((product) => (
                  <div key={`${product._id}-actions`} className="border-l border-slate-100 bg-white px-3 py-3" role="cell">
                    <button
                      type="button"
                      className={buttonClass}
                      disabled={!product.inStock}
                      onClick={() => add(product, 1).catch((requestError) => setError(requestError.message))}
                    >
                      Add to cart
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return <button type="button" onClick={onClick} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active ? 'bg-[#FF7518] text-white' : 'bg-slate-100 text-slate-600'}`}>{children}</button>;
}
