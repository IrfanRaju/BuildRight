import { useEffect, useState } from 'react';
import { api, money } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { EmptyState, Notice, PageHeader, buttonClass } from '../../components/ui';

const STEPS = ['Pending', 'Confirmed', 'Processing', 'Dispatched', 'Out for Delivery', 'Delivered'];

export default function OrdersPage({ orderId, setPage }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [order, setOrder] = useState(null);
  const [rules, setRules] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    if (!user) return;
    api('/api/marketplace/orders').then((result) => { setOrders(result.orders || []); setRules(result.cancellationRules || ''); }).catch((requestError) => setError(requestError.message));
    if (orderId) api(`/api/marketplace/orders/${orderId}`).then((result) => setOrder(result.order)).catch((requestError) => setError(requestError.message));
  };
  useEffect(() => { load(); }, [user, orderId]);

  const download = async (id, number) => {
    const blob = await api(`/api/marketplace/orders/${id}/invoice`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `buildright-invoice-${number}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!user) return <div className="mx-auto max-w-3xl px-4 py-8"><EmptyState title="Sign in to see orders" text="Order history is saved to your account." action={<button className={buttonClass} type="button" onClick={() => setPage('login')}>Sign in</button>} /></div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader eyebrow="Orders" title={order ? order.orderNumber : 'Your material orders'} description="Track status from placement through delivery. Cancellation is available while an order is pending or confirmed." />
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      {rules && <div className="mb-4"><Notice>{rules}</Notice></div>}
      {order && (
        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black">{money(order.total)}</h2>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-[#FF7518]">{order.status}</span>
          </div>
          <ol className="mt-4 flex flex-wrap gap-2">{STEPS.map((step) => <li key={step} className={`rounded-full px-3 py-1 text-xs font-semibold ${order.status === step ? 'bg-[#101828] text-white' : 'bg-slate-100 text-slate-500'}`}>{step}</li>)}</ol>
          <div className="mt-4 space-y-2 text-sm">{(order.statusHistory || []).map((entry, index) => <p key={`${entry.status}-${index}`}>{new Date(entry.at).toLocaleString()} · {entry.status}{entry.note ? ` · ${entry.note}` : ''}</p>)}</div>
          <div className="mt-4 space-y-1 text-sm">{order.items.map((item) => <p key={`${item.productId}-${item.name}`}>{item.name} · {item.quantity} {item.unit} · {money(item.lineTotal)}</p>)}</div>
          <p className="mt-3 text-sm text-slate-600">{order.address?.line1}, {order.address?.city} · {order.address?.phone}</p>
          {order.address?.instructions && <p className="text-sm text-slate-500">Instructions: {order.address.instructions}</p>}
          <p className="mt-3 text-xs text-slate-500">{order.priceNotice}</p>
          <div className="mt-4 flex gap-3">
            <button type="button" className={buttonClass} onClick={() => download(order._id, order.orderNumber).catch((requestError) => setError(requestError.message))}>Download invoice</button>
            {['Pending', 'Confirmed'].includes(order.status) && user.role !== 'supplier' && <button type="button" className="text-sm font-semibold text-red-600" onClick={() => api(`/api/marketplace/orders/${order._id}/cancel`, { method: 'POST', body: { reason: 'Cancelled by customer' } }).then(load).catch((requestError) => setError(requestError.message))}>Cancel order</button>}
          </div>
        </section>
      )}
      <div className="space-y-2">
        {orders.length === 0 && <EmptyState title="No orders yet" text="Materials you buy will appear here with their delivery status." />}
        {orders.map((item) => (
          <button key={item._id} type="button" onClick={() => setPage('order', item._id)} className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left text-sm">
            <span>{item.orderNumber} · {new Date(item.createdAt).toLocaleDateString()}</span>
            <span>{item.status} · {money(item.total)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
