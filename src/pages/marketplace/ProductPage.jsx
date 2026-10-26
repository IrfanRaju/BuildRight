import { useEffect, useState } from 'react';
import { api, money } from '../../lib/api';
import { useCart } from '../../context/CartContext';
import { EmptyState, Notice, PageHeader, buttonClass, ghostClass } from '../../components/ui';

const CITY_KEY = 'buildright-marketplace-city';

function readStoredCity() {
  try { return sessionStorage.getItem(CITY_KEY) || ''; } catch { return ''; }
}

export default function ProductPage({ slug, setPage }) {
  const { add } = useCart();
  const [data, setData] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [added, setAdded] = useState('');
  const city = readStoredCity();

  useEffect(() => {
    const params = city ? `?city=${encodeURIComponent(city)}` : '';
    api(`/api/marketplace/products/${slug}${params}`).then(setData).catch((requestError) => setError(requestError.message));
  }, [slug, city]);

  if (error) return <div className="mx-auto max-w-3xl px-4 py-8"><Notice tone="error">{error}</Notice></div>;
  if (!data?.product) return <div className="mx-auto max-w-3xl px-4 py-8"><p className="text-sm text-slate-500">Loading product…</p></div>;
  const product = data.product;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader eyebrow={product.categorySlug} title={product.name} description={product.description} actions={<button type="button" className={ghostClass} onClick={() => setPage('marketplace')}>Back to marketplace</button>} />
      <div className="mb-4"><Notice>{product.priceNotice}</Notice></div>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <img src={product.images?.[0] || '/logoB.png'} alt={product.name} className="h-80 w-full rounded-3xl object-cover" />
        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-3xl font-black">{money(product.pricePkr)} <span className="text-base font-medium text-slate-500">per {product.unit}</span></p>
          {product.pricingCity ? (
            <p className="mt-1 text-sm font-semibold text-[#FF7518]">
              {product.pricingCity} price
              {product.basePricePkr != null && product.basePricePkr !== product.pricePkr ? (
                <span className="font-medium text-slate-500"> · catalog base {money(product.basePricePkr)}</span>
              ) : null}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-slate-600">{product.availability}</p>
          <dl className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="flex justify-between"><dt>Brand</dt><dd className="font-semibold text-slate-900">{product.brand || 'Unbranded'}</dd></div>
            <div className="flex justify-between"><dt>Grade</dt><dd className="font-semibold capitalize text-slate-900">{product.quality || 'standard'}</dd></div>
            <div className="flex justify-between"><dt>Supplier</dt><dd className="font-semibold text-slate-900">{product.supplierName || 'BuildRight catalog'}</dd></div>
            <div className="flex justify-between"><dt>Estimated delivery</dt><dd className="font-semibold text-slate-900">{product.deliveryDays} days</dd></div>
            <div className="flex justify-between"><dt>Price source</dt><dd className="font-semibold text-slate-900">{product.priceSource === 'supplier' ? 'Supplier-verified' : 'Administrator-managed'}</dd></div>
            <div className="flex justify-between"><dt>Last updated</dt><dd className="font-semibold text-slate-900">{new Date(product.priceUpdatedAt || product.updatedAt).toLocaleDateString()}</dd></div>
          </dl>
          {product.illustrative && <p className="mt-3 text-xs text-amber-700">This seeded price is a sample for planning. It is not a live quotation.</p>}
          <div className="mt-5 flex gap-3">
            <input className="input w-24" type="number" min="1" max={product.stock || 1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} aria-label="Quantity" />
            <button type="button" className={buttonClass} disabled={!product.inStock} onClick={() => add(product, quantity).then(() => setAdded('Added to cart.')).catch((requestError) => setError(requestError.message))}>Add to cart</button>
          </div>
          {added && <p className="mt-3 text-sm text-emerald-700">{added}</p>}
        </section>
      </div>
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="font-bold">Specifications</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{(product.specifications || []).map((spec) => <p key={spec.label} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm"><span className="text-slate-500">{spec.label}: </span>{spec.value}</p>)}</div>
        {(product.specifications || []).length === 0 && <p className="mt-2 text-sm text-slate-500">No extra specifications are listed.</p>}
      </section>
      <section className="mt-6">
        <h2 className="font-bold">Related products</h2>
        {(data.related || []).length === 0 && <div className="mt-3"><EmptyState title="No related products" text="Other products in this category will appear here." /></div>}
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          {(data.related || []).map((item) => (
            <button key={item._id} type="button" onClick={() => setPage('product', item.slug)} className="rounded-3xl border border-slate-200 bg-white p-4 text-left">
              <p className="font-semibold">{item.name}</p>
              <p className="mt-1 text-sm text-slate-500">{money(item.pricePkr)} / {item.unit}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
