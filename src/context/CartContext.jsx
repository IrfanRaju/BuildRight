import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

const KEY = 'buildright-cart';
const CartContext = createContext(null);
let accountCartRequest = null;

function loadAccountCart(localItems) {
  if (!accountCartRequest) {
    const request = localItems.length
      ? api('/api/marketplace/cart/merge', { method: 'POST', body: { items: localItems.map(({ productId, quantity }) => ({ productId, quantity })) } })
      : api('/api/marketplace/cart');
    accountCartRequest = request.finally(() => { accountCartRequest = null; });
  }
  return accountCartRequest;
}

function readLocal() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    if (!user) {
      setItems(readLocal());
      return;
    }
    const cart = await api('/api/marketplace/cart');
    setItems(cart.items || []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!user) {
          if (!cancelled) setItems(readLocal());
          return;
        }
        const local = readLocal();
        if (local.length) localStorage.removeItem(KEY);
        const result = await loadAccountCart(local);
        if (!cancelled) setItems(result.items || []);
      } catch (error) {
        if (!cancelled) setNotice(error.message);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const value = useMemo(() => {
    const saveLocal = (next) => {
      setItems(next);
      localStorage.setItem(KEY, JSON.stringify(next));
    };
    return {
      items,
      notice,
      count: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      subtotal: items.reduce((sum, item) => sum + Number(item.lineTotal || Math.round((item.product?.pricePkr || 0) * item.quantity)), 0),
      refresh,
      async add(product, quantity = 1) {
        if (user) {
          const result = await api('/api/marketplace/cart/items', { method: 'POST', body: { productId: product._id, quantity } });
          setItems(result.items || []);
          return;
        }
        const next = items.map((item) => ({ ...item }));
        const found = next.find((item) => item.productId === product._id);
        if (found) {
          found.quantity += quantity;
          found.lineTotal = Math.round((found.product?.pricePkr || 0) * found.quantity);
        } else {
          next.push({ productId: product._id, quantity, product, lineTotal: Math.round(product.pricePkr * quantity) });
        }
        saveLocal(next);
      },
      async update(productId, quantity) {
        if (user) {
          const result = await api(`/api/marketplace/cart/items/${productId}`, { method: 'PATCH', body: { quantity } });
          setItems(result.items || []);
          return;
        }
        const next = quantity <= 0
          ? items.filter((item) => item.productId !== productId)
          : items.map((item) => (item.productId === productId ? { ...item, quantity, lineTotal: Math.round((item.product?.pricePkr || 0) * quantity) } : item));
        saveLocal(next);
      },
    };
  }, [items, notice, user]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
