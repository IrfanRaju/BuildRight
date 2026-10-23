import { useEffect, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, money } from '../../lib/api';
import { Notice, buttonClass } from '../../components/ui';

export default function CommerceAdmin({ tab }) {
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [rules, setRules] = useState([]);
  const [services, setServices] = useState([]);
  const [providers, setProviders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [category, setCategory] = useState({ name: '', description: '' });
  const [provider, setProvider] = useState({ name: '', trades: 'Painter', email: '', phone: '', cities: 'Islamabad' });
  const [product, setProduct] = useState({ sku: '', name: '', categorySlug: 'cement-building', brand: '', unit: 'piece', pricePkr: 0, stock: 0, supplierName: '', description: '', illustrative: true });

  const load = () => {
    const jobs = [];
    if (tab === 'catalog') jobs.push(api('/api/marketplace/categories').then((result) => setCategories(result.categories || [])), api('/api/marketplace/supplier/products').then((result) => setProducts(result.products || [])));
    if (tab === 'orders') jobs.push(api('/api/marketplace/orders').then((result) => setOrders(result.orders || [])));
    if (tab === 'repairs') jobs.push(api('/api/repairs/services?all=1&limit=48').then((result) => setServices(result.services || [])), api('/api/repairs/pricing').then((result) => setRules(result.rules || [])));
    if (tab === 'providers') jobs.push(api('/api/repairs/providers').then((result) => setProviders(result.providers || [])), api('/api/repairs/requests').then((result) => setRequests(result.requests || [])));
    Promise.all(jobs).catch((requestError) => setError(requestError.message));
  };
  useEffect(() => { load(); }, [tab]);

  return (
    <div className="space-y-4">
      {error && <Notice tone="error">{error}</Notice>}
      {tab === 'orders' && (
        <>
          <div className="h-48 rounded-3xl bg-white p-3">{orders.length > 0 && <ResponsiveContainer width="100%" height="100%"><BarChart data={countStatuses(orders)}><XAxis dataKey="status" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#FF7518" /></BarChart></ResponsiveContainer>}</div>
          {orders.map((order) => (
            <div key={order._id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 text-sm">
              <span>{order.orderNumber} · {money(order.total)} · {order.address?.city}</span>
              <span className="flex gap-2">
                <button type="button" onClick={() => api(`/api/marketplace/orders/${order._id}/status`, { method: 'PATCH', body: { status: nextStatus(order.status) } }).then(load).catch((requestError) => setError(requestError.message))}>{order.status} →</button>
                {order.status !== 'Cancelled' && order.status !== 'Delivered' && <button type="button" onClick={() => api(`/api/marketplace/orders/${order._id}/status`, { method: 'PATCH', body: { status: 'Cancelled', note: 'Cancelled by administrator' } }).then(load)}>Cancel</button>}
              </span>
            </div>
          ))}
        </>
      )}
      {tab === 'catalog' && (
        <>
          <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); api('/api/marketplace/categories', { method: 'POST', body: category }).then(() => { setCategory({ name: '', description: '' }); load(); }).catch((requestError) => setError(requestError.message)); }}>
            <input className="input max-w-xs" placeholder="New category" value={category.name} onChange={(event) => setCategory({ ...category, name: event.target.value })} required />
            <input className="input max-w-sm" placeholder="Description" value={category.description} onChange={(event) => setCategory({ ...category, description: event.target.value })} />
            <button className={buttonClass} type="submit">Add category</button>
          </form>
          <div className="flex flex-wrap gap-2">{categories.map((item) => <span key={item._id} className="rounded-full bg-white px-3 py-1 text-xs">{item.name} <button type="button" className="text-red-600" onClick={() => api(`/api/marketplace/categories/${item._id}`, { method: 'DELETE' }).then(load).catch((requestError) => setError(requestError.message))}>Remove</button></span>)}</div>
          <form className="grid gap-2 rounded-3xl bg-white p-4 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); api('/api/marketplace/products', { method: 'POST', body: product }).then(() => { setProduct({ ...product, sku: '', name: '' }); load(); }).catch((requestError) => setError(requestError.message)); }}>
            <input className="input" placeholder="SKU" value={product.sku} onChange={(event) => setProduct({ ...product, sku: event.target.value })} required />
            <input className="input" placeholder="Product name" value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value })} required />
            <select className="input" value={product.categorySlug} onChange={(event) => setProduct({ ...product, categorySlug: event.target.value })}>{categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select>
            <input className="input" placeholder="Brand" value={product.brand} onChange={(event) => setProduct({ ...product, brand: event.target.value })} />
            <select className="input" value={product.unit} onChange={(event) => setProduct({ ...product, unit: event.target.value })}>{['bag', 'piece', 'kg', 'ton', 'liter', 'meter', 'sq ft', 'cft'].map((unit) => <option key={unit}>{unit}</option>)}</select>
            <input className="input" type="number" min="0" placeholder="Price PKR" value={product.pricePkr} onChange={(event) => setProduct({ ...product, pricePkr: Number(event.target.value) })} />
            <input className="input" type="number" min="0" placeholder="Stock" value={product.stock} onChange={(event) => setProduct({ ...product, stock: Number(event.target.value) })} />
            <input className="input" placeholder="Supplier" value={product.supplierName} onChange={(event) => setProduct({ ...product, supplierName: event.target.value })} />
            <input className="input md:col-span-2" placeholder="Description" value={product.description} onChange={(event) => setProduct({ ...product, description: event.target.value })} />
            <button className={buttonClass} type="submit">Add product</button>
          </form>
          {products.map((product) => (
            <form key={product._id} className="grid gap-2 rounded-2xl bg-white p-3 md:grid-cols-[1fr_120px_100px_auto]" onSubmit={(event) => { event.preventDefault(); api(`/api/marketplace/products/${product._id}`, { method: 'PUT', body: product }).then(load).catch((requestError) => setError(requestError.message)); }}>
              <span className="text-sm font-semibold">{product.name}<span className="block text-xs font-normal text-slate-500">{product.categorySlug} · {product.priceSource}</span></span>
              <input className="input" type="number" value={product.pricePkr} onChange={(event) => setProducts(products.map((item) => item._id === product._id ? { ...item, pricePkr: Number(event.target.value) } : item))} />
              <input className="input" type="number" value={product.stock} onChange={(event) => setProducts(products.map((item) => item._id === product._id ? { ...item, stock: Number(event.target.value) } : item))} />
              <span className="flex gap-2"><button className={buttonClass} type="submit">Save</button><button type="button" className="text-xs text-red-600" onClick={() => api(`/api/marketplace/products/${product._id}`, { method: 'DELETE' }).then(load).catch((requestError) => setError(requestError.message))}>Remove</button></span>
            </form>
          ))}
        </>
      )}
      {tab === 'repairs' && (
        <>
          <p className="text-sm text-slate-600">Labor and equipment rates are planning figures in PKR. They are illustrative until you replace them with verified local rates.</p>
          {rules.map((rule) => (
            <form key={rule.serviceSlug} className="rounded-2xl bg-white p-4 text-sm" onSubmit={(event) => { event.preventDefault(); api(`/api/repairs/pricing/${rule.serviceSlug}`, { method: 'PUT', body: rule }).then(load).catch((requestError) => setError(requestError.message)); }}>
              <p className="font-bold">{rule.serviceSlug} · per {rule.laborUnit}</p>
              <div className="mt-2 grid gap-2 md:grid-cols-4">{['economy', 'standard', 'premium', 'luxury'].map((quality) => <label key={quality}>{quality}<input className="input" type="number" value={rule.labor?.[quality] ?? 0} onChange={(event) => updateRule(setRules, rule.serviceSlug, 'labor', quality, Number(event.target.value))} /></label>)}</div>
              <button className={`${buttonClass} mt-3`} type="submit">Save labor rates</button>
            </form>
          ))}
          {services.map((service) => (
            <form key={service._id || service.slug} className="grid gap-2 rounded-2xl bg-white p-4 md:grid-cols-[1fr_2fr_auto]" onSubmit={(event) => { event.preventDefault(); api(`/api/repairs/services/${service._id}`, { method: 'PUT', body: { title: service.title, summary: service.summary, keywords: String(service.keywords || '').split(',').map((item) => item.trim()).filter(Boolean), active: service.active !== false } }).then(load).catch((requestError) => setError(requestError.message)); }}>
              <input className="input" value={service.title || ''} onChange={(event) => setServices(services.map((item) => item._id === service._id ? { ...item, title: event.target.value } : item))} aria-label={`${service.slug} title`} />
              <input className="input" value={service.summary || ''} onChange={(event) => setServices(services.map((item) => item._id === service._id ? { ...item, summary: event.target.value } : item))} aria-label={`${service.slug} summary`} />
              <span className="flex gap-2"><button className={buttonClass} type="submit">Save</button><button type="button" className="text-xs text-red-600" onClick={() => api(`/api/repairs/services/${service._id}`, { method: 'PUT', body: { active: service.active === false } }).then(load)}>{service.active === false ? 'Show' : 'Hide'}</button></span>
            </form>
          ))}
        </>
      )}
      {tab === 'providers' && (
        <>
          <form className="grid gap-2 rounded-3xl bg-white p-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); api('/api/repairs/providers', { method: 'POST', body: { ...provider, trades: provider.trades.split(',').map((item) => item.trim()), cities: provider.cities.split(',').map((item) => item.trim()) } }).then(load).catch((requestError) => setError(requestError.message)); }}>
            <input className="input" placeholder="Name" value={provider.name} onChange={(event) => setProvider({ ...provider, name: event.target.value })} required />
            <input className="input" placeholder="Email of their user account" value={provider.email} onChange={(event) => setProvider({ ...provider, email: event.target.value })} />
            <input className="input" placeholder="Trades, comma separated" value={provider.trades} onChange={(event) => setProvider({ ...provider, trades: event.target.value })} />
            <input className="input" placeholder="Cities" value={provider.cities} onChange={(event) => setProvider({ ...provider, cities: event.target.value })} />
            <button className={buttonClass} type="submit">Add provider</button>
          </form>
          {requests.map((request) => (
            <div key={request._id} className="rounded-2xl bg-white p-4 text-sm">
              <p className="font-semibold">{request.trade} · {request.status} · {request.location}</p>
              <p>{request.booked ? 'Booking confirmed.' : 'Not booked.'}</p>
              <div className="mt-2 flex flex-wrap gap-2">{providers.map((item) => <button key={item._id} type="button" className="rounded-full bg-slate-100 px-3 py-1 text-xs" onClick={() => api(`/api/repairs/requests/${request._id}/assign`, { method: 'POST', body: { providerId: item._id } }).then(load).catch((requestError) => setError(requestError.message))}>Assign {item.name}</button>)}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function nextStatus(status) {
  const flow = ['Pending', 'Confirmed', 'Processing', 'Dispatched', 'Out for Delivery', 'Delivered'];
  return flow[flow.indexOf(status) + 1] || status;
}

function countStatuses(orders) {
  const map = new Map();
  for (const order of orders) map.set(order.status, (map.get(order.status) || 0) + 1);
  return [...map.entries()].map(([status, count]) => ({ status, count }));
}

function updateRule(setRules, slug, group, quality, value) {
  setRules((current) => current.map((rule) => rule.serviceSlug === slug ? { ...rule, [group]: { ...rule[group], [quality]: value } } : rule));
}
