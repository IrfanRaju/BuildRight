import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api, money } from '../../lib/api';
import { useCart } from '../../context/CartContext';
import { EmptyState, Notice, PageHeader, buttonClass } from '../../components/ui';

export default function MarketplacePage({ setPage }) {
  const { add } = useCart();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [brand, setBrand] = useState('');
  const [sort, setSort] = useState('name');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [compare, setCompare] = useState([]);

  useEffect(() => {
    api('/api/marketplace/categories')
      .then((result) => setCategories(result.categories || []))
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ limit: '12', sort, page: String(pageNumber) });
      if (query.trim()) params.set('q', query.trim());
      if (category !== 'All') params.set('category', category);
      if (brand) params.set('brand', brand);
      if (minPrice !== '') params.set('minPrice', minPrice);
      if (maxPrice !== '') params.set('maxPrice', maxPrice);
      api(`/api/marketplace/products?${params}`)
        .then((catalog) => {
          setProducts(catalog.products || []);
          setBrands(catalog.brands || []);
          setNotice(catalog.priceNotice || '');
          setPages(catalog.pages || 1);
          setTotal(catalog.total || 0);
          setError('');
        })
        .catch((requestError) => setError(requestError.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, category, brand, sort, minPrice, maxPrice, pageNumber]);

  const toggleCompare = (product) => {
    setCompare((current) => {
      if (current.some((item) => item._id === product._id)) return current.filter((item) => item._id !== product._id);
      if (current.length >= 3) return current;
      return [...current, product];
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Marketplace" title="Construction materials" description="Browse administrator-managed and supplier-verified prices, then calculate quantities and order. Prices show their last update and are not a live market feed." actions={<button type="button" className={buttonClass} onClick={() => setPage('calculator')}>Quantity calculator</button>} />
      {notice && <div className="mb-4"><Notice>{notice}</Notice></div>}
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row">
          <input className="input lg:max-w-sm" value={query} onChange={(event) => { setQuery(event.target.value); setPageNumber(1); }} placeholder="Search name, brand, category, or keyword" aria-label="Search products" />
          <input className="input w-32" type="number" min="0" value={minPrice} onChange={(event) => { setMinPrice(event.target.value); setPageNumber(1); }} placeholder="Min PKR" aria-label="Minimum price" />
          <input className="input w-32" type="number" min="0" value={maxPrice} onChange={(event) => { setMaxPrice(event.target.value); setPageNumber(1); }} placeholder="Max PKR" aria-label="Maximum price" />
          <select className="input lg:ml-auto lg:w-48" value={brand} onChange={(event) => { setBrand(event.target.value); setPageNumber(1); }} aria-label="Filter by brand"><option value="">All brands</option>{brands.map((item) => <option key={item}>{item}</option>)}</select>
          <select className="input lg:w-52" value={sort} onChange={(event) => { setSort(event.target.value); setPageNumber(1); }} aria-label="Sort products"><option value="name">Name</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="updated">Recently updated</option></select>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <FilterChip active={category === 'All'} onClick={() => { setCategory('All'); setPageNumber(1); }}>All</FilterChip>
          {categories.map((item) => <FilterChip key={item.slug} active={category === item.slug} onClick={() => { setCategory(item.slug); setPageNumber(1); }}>{item.name}</FilterChip>)}
        </div>
        <p className="mt-4 text-xs text-slate-500">{loading ? 'Searching the catalog…' : `${total} matching product${total === 1 ? '' : 's'} from the database`}</p>
        {!loading && !error && products.length === 0 && <div className="mt-6"><EmptyState title="No products found" text="Nothing in the catalog matches that search. Try another keyword, or run npm run seed if the catalog is empty." /></div>}
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <motion.article key={product._id} whileHover={{ y: -3 }} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
              <button type="button" className="block w-full text-left" onClick={() => setPage('product', product.slug)}>
                <img src={product.images?.[0] || '/logoB.png'} alt="" className="h-40 w-full object-cover" />
                <div className="p-5">
                  <p className="text-xs uppercase tracking-wider text-slate-500">{product.brand || 'Unbranded'} · {product.categorySlug}</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">{product.name}</h2>
                  <p className="mt-3 text-2xl font-black">{money(product.pricePkr)} <span className="text-sm font-medium text-slate-500">/ {product.unit}</span></p>
                  <p className="mt-1 text-xs text-slate-500">{product.availability} · {product.deliveryDays} day delivery estimate · {product.supplierName}</p>
                  <p className="mt-2 text-xs text-slate-400">Updated {new Date(product.priceUpdatedAt || product.updatedAt).toLocaleDateString()} · {product.priceSource === 'supplier' ? 'Supplier-verified' : 'Administrator-managed'}{product.illustrative ? ' · sample price' : ''}</p>
                </div>
              </button>
              <div className="flex items-center justify-between px-5 pb-5">
                <button type="button" className={buttonClass} onClick={() => add(product, 1).catch((requestError) => setError(requestError.message))}>Add to cart</button>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={compare.some((item) => item._id === product._id)} onChange={() => toggleCompare(product)} />Compare</label>
              </div>
            </motion.article>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <button type="button" className={buttonClass} disabled={pageNumber <= 1} onClick={() => setPageNumber((current) => Math.max(1, current - 1))}>Previous</button>
          <span>Page {pageNumber} of {pages}</span>
          <button type="button" className={buttonClass} disabled={pageNumber >= pages} onClick={() => setPageNumber((current) => current + 1)}>Next</button>
        </div>
      </div>
      {compare.length > 0 && (
        <section className="mt-6 overflow-x-auto rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Compare up to 3 products</h2>
          <table className="mt-4 min-w-full text-left text-sm">
            <thead><tr>{compare.map((product) => <th key={product._id} className="px-3 pb-3">{product.name}</th>)}</tr></thead>
            <tbody>
              {[['Brand', 'brand'], ['Price', 'pricePkr'], ['Unit', 'unit'], ['Stock', 'stock'], ['Supplier', 'supplierName'], ['Delivery days', 'deliveryDays']].map(([label, key]) => (
                <tr key={key} className="border-t border-slate-100"><td className="py-2 pr-4 text-slate-500" colSpan={compare.length}>{label}: {compare.map((product) => key === 'pricePkr' ? money(product[key]) : product[key]).join('  ·  ')}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return <button type="button" onClick={onClick} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active ? 'bg-[#FF7518] text-white' : 'bg-slate-100 text-slate-600'}`}>{children}</button>;
}
