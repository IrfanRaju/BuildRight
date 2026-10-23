import { useEffect, useState } from 'react';
import { api, money } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { deliveryCharge, distanceForCity } from '../../../shared/commerce.js';
import { EmptyState, Field, Notice, PageHeader, buttonClass, ghostClass } from '../../components/ui';

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
      <div className="mx-auto max-w-3xl px-4 py-8">
        <EmptyState
          title="Your cart is empty"
          text="Add materials from the marketplace or a repair estimate."
          action={<button type="button" className={buttonClass} onClick={() => setPage('marketplace')}>Browse materials</button>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        eyebrow="Cart"
        title="Review and order"
        description={`${cart.items.length} product${cart.items.length === 1 ? '' : 's'} · ${itemCount} item${itemCount === 1 ? '' : 's'} total. Delivery and tax use the saved commerce settings; final prices are taken from the catalog at checkout.`}
        actions={<button type="button" className={ghostClass} onClick={() => setPage('marketplace')}>Continue shopping</button>}
      />
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      {meta?.priceNotice && <div className="mb-4"><Notice>{meta.priceNotice}</Notice></div>}
      {!user && (
        <div className="mb-4">
          <Notice>
            Sign in to checkout. You can keep browsing and editing quantities as a guest; your cart merges into your account after you sign in.
            {' '}
            <button type="button" className="font-semibold text-[#FF7518] underline" onClick={() => setPage('login')}>Sign in</button>
            {' · '}
            <button type="button" className="font-semibold text-[#FF7518] underline" onClick={() => setPage('register')}>Create account</button>
          </Notice>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1 text-sm text-slate-500">
            <span>Products in cart</span>
            <span>{cart.items.length} line{cart.items.length === 1 ? '' : 's'}</span>
          </div>
          {cart.items.map((item) => {
            const product = item.product || {};
            const productId = item.productId || product._id;
            const image = product.images?.[0] || '/logoB.png';
            const maxStock = Math.max(1, Number(product.stock) || 9999);
            return (
              <article key={productId} className="flex gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-soft">
                <button type="button" className="shrink-0 overflow-hidden rounded-2xl bg-slate-100" onClick={() => product.slug && setPage('product', product.slug)} aria-label={`View ${product.name || 'product'}`}>
                  <img src={image} alt="" className="h-24 w-24 object-cover sm:h-28 sm:w-28" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button type="button" className="text-left" onClick={() => product.slug && setPage('product', product.slug)}>
                        <h2 className="font-bold text-slate-900">{product.name || 'Product'}</h2>
                      </button>
                      <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">
                        {product.brand || 'Unbranded'}
                        {product.categorySlug ? ` · ${product.categorySlug}` : ''}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {money(product.pricePkr)} / {product.unit || 'unit'}
                        {product.supplierName ? ` · ${product.supplierName}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {product.inStock === false || product.stock === 0
                          ? 'Out of stock'
                          : product.availability || (product.stock != null ? `${product.stock} in stock` : 'Catalog price')}
                        {product.priceUpdatedAt ? ` · Updated ${new Date(product.priceUpdatedAt).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    <strong className="text-lg text-slate-900">{money(item.lineTotal)}</strong>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className="flex items-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                      <button
                        type="button"
                        className="px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-white disabled:opacity-40"
                        disabled={item.quantity <= 1}
                        onClick={() => changeQty(productId, item.quantity - 1)}
                        aria-label={`Decrease ${product.name}`}
                      >
                        −
                      </button>
                      <input
                        className="w-14 border-x border-slate-200 bg-white py-1.5 text-center text-sm font-semibold outline-none"
                        type="number"
                        min="1"
                        max={maxStock}
                        value={item.quantity}
                        onChange={(event) => changeQty(productId, Number(event.target.value))}
                        aria-label={`Quantity for ${product.name}`}
                      />
                      <button
                        type="button"
                        className="px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-white disabled:opacity-40"
                        disabled={item.quantity >= maxStock}
                        onClick={() => changeQty(productId, item.quantity + 1)}
                        aria-label={`Increase ${product.name}`}
                      >
                        +
                      </button>
                    </div>
                    <span className="text-xs text-slate-500">{product.unit || 'units'}</span>
                    <button type="button" className="ml-auto text-sm font-semibold text-red-600" onClick={() => changeQty(productId, 0)}>Remove</button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <form onSubmit={checkout} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
            <h2 className="font-bold">Order summary</h2>
            <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto text-sm text-slate-600">
              {cart.items.map((item) => (
                <li key={`sum-${item.productId || item.product?._id}`} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{item.product?.name} × {item.quantity}</span>
                  <span className="shrink-0 font-semibold text-slate-900">{money(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(cart.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Delivery</dt><dd>{money(delivery)}</dd></div>
              <div className="flex justify-between"><dt>{settings.taxLabel}</dt><dd>{money(tax)}</dd></div>
              <div className="flex justify-between text-lg font-black"><dt>Estimated total</dt><dd>{money(total)}</dd></div>
            </dl>

            <h3 className="mt-5 font-bold">Delivery</h3>
            {!user && <p className="mt-2 text-xs leading-5 text-slate-500">Delivery details unlock after you sign in.</p>}
            <fieldset disabled={!user} className="mt-3 grid gap-3 disabled:opacity-60">
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
              <Field label="Distance (km)"><input className="input" type="number" min="0" value={distance} onChange={(event) => setDistance(Number(event.target.value))} /></Field>
              <Field label="Contact name"><input className="input" value={address.name} onChange={(event) => setAddress({ ...address, name: event.target.value })} required={Boolean(user)} /></Field>
              <Field label="Phone"><input className="input" value={address.phone} onChange={(event) => setAddress({ ...address, phone: event.target.value })} required={Boolean(user)} /></Field>
              <Field label="Address"><input className="input" value={address.line1} onChange={(event) => setAddress({ ...address, line1: event.target.value })} required={Boolean(user)} /></Field>
              <Field label="Delivery instructions"><textarea className="input min-h-20" value={address.instructions} onChange={(event) => setAddress({ ...address, instructions: event.target.value })} /></Field>
            </fieldset>

            <p className="mt-3 text-xs leading-5 text-slate-500">{meta?.cancellationRules}</p>

            {user ? (
              <button className={`${buttonClass} mt-4 w-full`} type="submit" disabled={submitting}>
                {submitting ? 'Placing order…' : 'Place order'}
              </button>
            ) : (
              <button className={`${buttonClass} mt-4 w-full`} type="button" onClick={() => setPage('login')}>
                Sign in to checkout
              </button>
            )}
          </form>
        </aside>
      </div>
    </div>
  );
}
