import { useEffect, useState } from 'react';
import { api, money } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { deliveryCharge, distanceForCity } from '../../../shared/commerce.js';
import { EmptyState, Field, Notice, buttonClass, ghostClass } from '../../components/ui';

export default function CartPage({ setPage }) {
  const { user } = useAuth();
  const cart = useCart();
  const [meta, setMeta] = useState(null);
  const [city, setCity] = useState('Islamabad');
  const [distance, setDistance] = useState(8);
  const [address, setAddress] = useState({ name: user?.name || '', phone: '', line1: '', city: 'Islamabad', instructions: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { api('/api/marketplace/meta').then(setMeta).catch((requestError) => setError(requestError.message)); }, []);
  useEffect(() => { setAddress((current) => ({ ...current, name: current.name || user?.name || '' })); }, [user]);

  const settings = meta?.settings || { deliveryBasePkr: 800, deliveryPerKmPkr: 25, freeDeliveryOver: 75000, taxPercent: 18, taxLabel: 'Tax', cityDistancesKm: {} };
  const delivery = deliveryCharge(cart.subtotal, distance, settings);
  const tax = Math.round(cart.subtotal * ((settings.taxPercent || 0) / 100));
  const total = cart.subtotal + delivery + tax;
  const itemCount = cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const checkout = async (event) => {
    event.preventDefault();
    setError('');
    if (!user) {
      setPage('login');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api('/api/marketplace/checkout', { method: 'POST', body: { distanceKm: distance, address } });
      await cart.refresh();
      setPage('order', result.order._id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const changeQty = (productId, quantity) => {
    cart.update(productId, quantity).catch((requestError) => setError(requestError.message));
  };

  if (!cart.items.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <EmptyState
          title="Your cart is empty"
          text="Add materials from the marketplace or a repair estimate."
          action={<button type="button" className={buttonClass} onClick={() => setPage('marketplace')}>Browse materials</button>}
        />
      </div>
    );
  }

  return (
    <div className="pb-28 lg:pb-10">
      <div className="border-b border-slate-200/80 bg-gradient-to-br from-white via-orange-50/40 to-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7518]">Shopping cart</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[#101828] sm:text-4xl">Review and order</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
              {cart.items.length} product{cart.items.length === 1 ? '' : 's'} · {itemCount} item{itemCount === 1 ? '' : 's'}.
              Delivery and tax use saved commerce settings; catalog prices lock in at checkout.
            </p>
          </div>
          <button type="button" className={`${ghostClass} w-full sm:w-auto`} onClick={() => setPage('marketplace')}>Continue shopping</button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
        {meta?.priceNotice && <div className="mb-4"><Notice>{meta.priceNotice}</Notice></div>}
        {!user && (
          <div className="mb-4">
            <Notice>
              Sign in to checkout. Guest carts merge into your account after you sign in.
              {' '}
              <button type="button" className="font-semibold text-[#FF7518] underline" onClick={() => setPage('login')}>Sign in</button>
              {' · '}
              <button type="button" className="font-semibold text-[#FF7518] underline" onClick={() => setPage('register')}>Create account</button>
            </Notice>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-start">
          <section className="space-y-3" aria-label="Cart items">
            {cart.items.map((item) => {
              const product = item.product || {};
              const productId = item.productId || product._id;
              const image = product.images?.[0] || '/logoB.png';
              const maxStock = Math.max(1, Number(product.stock) || 9999);
              return (
                <article key={productId} className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_12px_40px_-24px_rgba(15,23,42,0.35)]">
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:gap-5 sm:p-5">
                    <button
                      type="button"
                      className="mx-auto h-36 w-full shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:mx-0 sm:h-28 sm:w-28"
                      onClick={() => product.slug && setPage('product', product.slug)}
                      aria-label={`View ${product.name || 'product'}`}
                    >
                      <img src={image} alt="" className="h-full w-full object-cover" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <button type="button" className="text-left" onClick={() => product.slug && setPage('product', product.slug)}>
                            <h2 className="text-lg font-bold leading-snug text-slate-900">{product.name || 'Product'}</h2>
                          </button>
                          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {product.brand || 'Unbranded'}
                            {product.categorySlug ? ` · ${product.categorySlug}` : ''}
                          </p>
                          <p className="mt-2 text-sm text-slate-600">
                            {money(product.pricePkr)}
                            <span className="text-slate-400"> / {product.unit || 'unit'}</span>
                            {product.supplierName ? <span className="text-slate-400"> · {product.supplierName}</span> : null}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {product.inStock === false || product.stock === 0
                              ? 'Out of stock'
                              : product.stock != null ? `${product.stock} ${product.unit || 'units'} in stock` : 'Catalog price'}
                            {product.priceUpdatedAt ? ` · Updated ${new Date(product.priceUpdatedAt).toLocaleDateString()}` : ''}
                          </p>
                        </div>
                        <p className="text-xl font-black text-[#101828] sm:text-right">{money(item.lineTotal)}</p>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                        <div className="inline-flex items-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                          <button
                            type="button"
                            className="px-3.5 py-2 text-sm font-bold text-slate-700 transition hover:bg-white disabled:opacity-40"
                            disabled={item.quantity <= 1}
                            onClick={() => changeQty(productId, item.quantity - 1)}
                            aria-label={`Decrease ${product.name}`}
                          >
                            −
                          </button>
                          <input
                            className="w-12 border-x border-slate-200 bg-white py-2 text-center text-sm font-semibold outline-none"
                            type="number"
                            min="1"
                            max={maxStock}
                            value={item.quantity}
                            onChange={(event) => changeQty(productId, Number(event.target.value))}
                            aria-label={`Quantity for ${product.name}`}
                          />
                          <button
                            type="button"
                            className="px-3.5 py-2 text-sm font-bold text-slate-700 transition hover:bg-white disabled:opacity-40"
                            disabled={item.quantity >= maxStock}
                            onClick={() => changeQty(productId, item.quantity + 1)}
                            aria-label={`Increase ${product.name}`}
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          className="ml-auto text-sm font-semibold text-red-600 transition hover:text-red-700"
                          onClick={() => changeQty(productId, 0)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <aside className="lg:sticky lg:top-24">
            <form id="cart-checkout" onSubmit={checkout} className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_12px_40px_-24px_rgba(15,23,42,0.35)]">
              <div className="border-b border-slate-100 bg-[#101828] px-5 py-4 text-white">
                <h2 className="text-lg font-bold">Order summary</h2>
                <p className="mt-1 text-xs text-slate-300">{itemCount} item{itemCount === 1 ? '' : 's'} ready for delivery</p>
              </div>

              <div className="space-y-5 p-5">
                <ul className="max-h-36 space-y-2 overflow-y-auto text-sm text-slate-600">
                  {cart.items.map((item) => (
                    <li key={`sum-${item.productId || item.product?._id}`} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">{item.product?.name} × {item.quantity}</span>
                      <span className="shrink-0 font-semibold text-slate-900">{money(item.lineTotal)}</span>
                    </li>
                  ))}
                </ul>

                <dl className="space-y-2.5 border-t border-slate-100 pt-4 text-sm">
                  <div className="flex justify-between text-slate-600"><dt>Subtotal</dt><dd className="font-semibold text-slate-900">{money(cart.subtotal)}</dd></div>
                  <div className="flex justify-between text-slate-600"><dt>Delivery</dt><dd className="font-semibold text-slate-900">{money(delivery)}</dd></div>
                  <div className="flex justify-between text-slate-600"><dt>{settings.taxLabel || 'GST'}</dt><dd className="font-semibold text-slate-900">{money(tax)}</dd></div>
                  <div className="flex items-end justify-between border-t border-slate-100 pt-3">
                    <dt className="text-sm font-bold text-slate-900">Estimated total</dt>
                    <dd className="text-2xl font-black text-[#101828]">{money(total)}</dd>
                  </div>
                </dl>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">Delivery details</h3>
                  {!user && <p className="mt-1 text-xs leading-5 text-slate-500">Unlocks after you sign in.</p>}
                  <fieldset disabled={!user} className="mt-3 grid gap-3 disabled:opacity-55">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="City">
                        <select
                          className="input"
                          value={city}
                          onChange={(event) => {
                            const next = event.target.value;
                            setCity(next);
                            setDistance(distanceForCity(next, settings));
                            setAddress({ ...address, city: next });
                          }}
                        >
                          {Object.keys(settings.cityDistancesKm || { Islamabad: 8 }).map((name) => <option key={name}>{name}</option>)}
                        </select>
                      </Field>
                      <Field label="Distance (km)">
                        <input className="input" type="number" min="0" value={distance} onChange={(event) => setDistance(Number(event.target.value))} />
                      </Field>
                    </div>
                    <Field label="Contact name">
                      <input className="input" value={address.name} onChange={(event) => setAddress({ ...address, name: event.target.value })} required={Boolean(user)} />
                    </Field>
                    <Field label="Phone">
                      <input className="input" value={address.phone} onChange={(event) => setAddress({ ...address, phone: event.target.value })} required={Boolean(user)} />
                    </Field>
                    <Field label="Address">
                      <input className="input" value={address.line1} onChange={(event) => setAddress({ ...address, line1: event.target.value })} required={Boolean(user)} />
                    </Field>
                    <Field label="Delivery instructions">
                      <textarea className="input min-h-20" value={address.instructions} onChange={(event) => setAddress({ ...address, instructions: event.target.value })} />
                    </Field>
                  </fieldset>
                </div>

                {meta?.cancellationRules && <p className="text-xs leading-5 text-slate-500">{meta.cancellationRules}</p>}

                <div className="hidden lg:block">
                  {user ? (
                    <button className={`${buttonClass} w-full !rounded-2xl !py-3.5`} type="submit" disabled={submitting}>
                      {submitting ? 'Placing order…' : `Place order · ${money(total)}`}
                    </button>
                  ) : (
                    <button className={`${buttonClass} w-full !rounded-2xl !py-3.5`} type="button" onClick={() => setPage('login')}>
                      Sign in to checkout
                    </button>
                  )}
                </div>
              </div>
            </form>
          </aside>
        </div>
      </div>

      {/* Mobile sticky checkout bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Estimated total</p>
            <p className="truncate text-lg font-black text-[#101828]">{money(total)}</p>
          </div>
          {user ? (
            <button className={`${buttonClass} shrink-0 !rounded-2xl`} type="submit" form="cart-checkout" disabled={submitting}>
              {submitting ? 'Placing…' : 'Place order'}
            </button>
          ) : (
            <button className={`${buttonClass} shrink-0 !rounded-2xl`} type="button" onClick={() => setPage('login')}>
              Sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
