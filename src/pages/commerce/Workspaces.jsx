import { useEffect, useState } from 'react';
import { api, money } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { EmptyState, Notice, PageHeader, buttonClass } from '../../components/ui';

export function SupplierWorkspace() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([api('/api/marketplace/supplier/products'), api('/api/marketplace/orders')])
      .then(([catalog, orderResult]) => { setProducts(catalog.products || []); setOrders(orderResult.orders || []); })
      .catch((requestError) => setError(requestError.message));
  };
  useEffect(() => { if (user) load(); }, [user]);
  if (!user || !['supplier', 'admin'].includes(user.role)) return <div className="mx-auto max-w-3xl px-4 py-8"><EmptyState title="Supplier access required" text="An administrator can assign the supplier role." /></div>;

  const save = async (product) => {
    await api(`/api/marketplace/products/${product._id}`, { method: 'PUT', body: product });
    load();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader eyebrow="Supplier" title="Your materials" description="Update price and stock for products linked to your account. Prices stay marked with the date you change them and are not described as live." />
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      <div className="space-y-3">
        {products.map((product) => (
          <form key={product._id} className="grid gap-2 rounded-2xl bg-white p-4 md:grid-cols-[1.4fr_0.6fr_0.5fr_auto]" onSubmit={(event) => { event.preventDefault(); save(product).catch((requestError) => setError(requestError.message)); }}>
            <div><p className="font-semibold">{product.name}</p><p className="text-xs text-slate-500">{product.sku} · updated {new Date(product.priceUpdatedAt).toLocaleDateString()}</p></div>
            <input className="input" type="number" min="0" value={product.pricePkr} onChange={(event) => setProducts(products.map((item) => item._id === product._id ? { ...item, pricePkr: Number(event.target.value) } : item))} aria-label={`${product.name} price`} />
            <input className="input" type="number" min="0" value={product.stock} onChange={(event) => setProducts(products.map((item) => item._id === product._id ? { ...item, stock: Number(event.target.value) } : item))} aria-label={`${product.name} stock`} />
            <button className={buttonClass} type="submit">Save</button>
          </form>
        ))}
      </div>
      <h2 className="mb-3 mt-8 font-bold">Orders containing your products</h2>
      {orders.length === 0 && <EmptyState title="No supplier orders" text="Orders appear here when a customer buys one of your products." />}
      {orders.map((order) => <p key={order._id} className="mb-2 rounded-2xl bg-white px-4 py-3 text-sm">{order.orderNumber} · {order.status} · {order.items.map((item) => `${item.name} × ${item.quantity}`).join(', ')}</p>)}
    </div>
  );
}

export function ProviderWorkspace() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user) return;
    api('/api/repairs/requests').then((result) => { setRequests(result.requests || []); setNotice(result.notice || ''); }).catch((requestError) => setError(requestError.message));
  }, [user]);
  if (!user || !['provider', 'admin'].includes(user.role)) return <div className="mx-auto max-w-3xl px-4 py-8"><EmptyState title="Provider access required" text="An administrator assigns repair requests to provider accounts." /></div>;

  const act = (id, action) => api(`/api/repairs/requests/${id}/${action}`, { method: 'POST', body: {} }).then((result) => setRequests((current) => current.map((item) => item._id === id ? result.request : item))).catch((requestError) => setError(requestError.message));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader eyebrow="Service provider" title="Assigned repair requests" description="Accepting a request means you are available. It does not book the work until the customer confirms." />
      {notice && <div className="mb-4"><Notice>{notice}</Notice></div>}
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      {requests.length === 0 && <EmptyState title="No assigned requests" text="Requests appear after an administrator assigns them to you." />}
      <div className="space-y-3">{requests.map((request) => (
        <article key={request._id} className="rounded-3xl bg-white p-4">
          <p className="font-bold">{request.trade} · {request.location}</p>
          <p className="text-sm text-slate-600">{request.description}</p>
          <p className="mt-1 text-xs uppercase text-slate-500">{request.status}{request.booked ? ' · confirmed booking' : ' · not booked'}</p>
          {request.status === 'assigned' && <div className="mt-3 flex gap-3"><button type="button" className={buttonClass} onClick={() => act(request._id, 'accept')}>Accept</button><button type="button" className="text-sm text-red-600" onClick={() => act(request._id, 'decline')}>Decline</button></div>}
        </article>
      ))}</div>
    </div>
  );
}

export function moneyLabel(value) {
  return money(value);
}
