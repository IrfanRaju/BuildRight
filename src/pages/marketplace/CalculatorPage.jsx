import { useEffect, useState } from 'react';
import { api, money } from '../../lib/api';
import { useCart } from '../../context/CartContext';
import { QUANTITY_CALCULATORS } from '../../../shared/quantityEngine.js';
import { Notice, PageHeader, SearchableSelect, buttonClass } from '../../components/ui';

export default function CalculatorPage() {
  const { add } = useCart();
  const [meta, setMeta] = useState(null);
  const [calculator, setCalculator] = useState('plaster');
  const [input, setInput] = useState({ quality: 'standard', condition: 'moderate', coats: 2, thicknessMm: 12 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api('/api/marketplace/meta').then(setMeta).catch((requestError) => setError(requestError.message)); }, []);
  const calculators = meta?.calculators?.length ? meta.calculators : QUANTITY_CALCULATORS;
  const selected = calculators.find((item) => item.id === calculator);

  const calculate = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const response = await api('/api/marketplace/calculate', { method: 'POST', body: { calculator, input } });
      setResult({ ...response, lines: response.lines.map((line) => ({ ...line, key: `${line.role}|${line.name}|${line.unit}` })) });
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const editLine = (key, patch) => {
    setResult((current) => ({
      ...current,
      lines: current.lines.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };
        next.lineTotal = Math.round((Number(next.quantity) || 0) * (Number(next.unitPrice) || 0));
        return next;
      }),
    }));
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader eyebrow="Quantity calculator" title="Estimate the materials" description="Every result is an estimate. Edit the quantities before you add them to the cart. Prices come from the catalog and are not a live market feed." />
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      <div className="mb-4 flex flex-wrap gap-2">
        {calculators.map((item) => <button key={item.id} type="button" onClick={() => { setCalculator(item.id); setResult(null); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${calculator === item.id ? 'bg-[#101828] text-white' : 'bg-white'}`}>{item.title}</button>)}
      </div>
      <form onSubmit={calculate} className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 md:grid-cols-2">
        <p className="md:col-span-2 text-sm text-slate-600">{selected?.text}</p>
        {(selected?.fields || []).map((field) => (
          <label key={field.key} className="block text-sm font-semibold text-slate-700">{field.label}{field.unit ? ` (${field.unit})` : ''}
            <input className="input mt-2" type="number" min="0" step="0.1" value={input[field.key] ?? field.defaultValue ?? ''} onChange={(event) => setInput({ ...input, [field.key]: event.target.value === '' ? '' : Number(event.target.value) })} />
          </label>
        ))}
        {calculator === 'paint' && (
          <>
            <label className="text-sm font-semibold">Surface
              <SearchableSelect
                className="mt-2"
                value={input.surface || 'interior'}
                onChange={(next) => setInput({ ...input, surface: next })}
                options={[
                  { value: 'interior', label: 'Interior' },
                  { value: 'exterior', label: 'Exterior' },
                  { value: 'both', label: 'Both' },
                ]}
              />
            </label>
            <label className="text-sm font-semibold">Condition
              <SearchableSelect
                className="mt-2"
                value={input.condition}
                onChange={(next) => setInput({ ...input, condition: next })}
                options={[
                  { value: 'minor', label: 'Minor' },
                  { value: 'moderate', label: 'Moderate' },
                  { value: 'major', label: 'Major' },
                ]}
              />
            </label>
          </>
        )}
        <label className="text-sm font-semibold">Material quality
          <SearchableSelect
            className="mt-2"
            value={input.quality}
            onChange={(next) => setInput({ ...input, quality: next })}
            options={[
              { value: 'economy', label: 'Economy' },
              { value: 'standard', label: 'Standard' },
              { value: 'premium', label: 'Premium' },
              { value: 'luxury', label: 'Luxury' },
            ]}
          />
        </label>
        <div className="md:col-span-2"><button className={buttonClass} type="submit">Calculate estimate</button></div>
      </form>
      {result && (
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
          <Notice>{result.disclaimer}</Notice>
          <p className="mt-4 text-sm text-slate-500">{result.priceNotice}</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead><tr className="text-slate-500"><th className="pb-2">Material</th><th>Net</th><th>Wastage</th><th>Order qty</th><th>Brand</th><th>Unit price</th><th>Line total</th><th></th></tr></thead>
              <tbody>
                {result.lines.map((line) => (
                  <tr key={line.key} className="border-t border-slate-100">
                    <td className="py-3 font-semibold">{line.name}</td>
                    <td>{line.netQuantity} {line.unit}</td>
                    <td>{line.wastageQuantity} {line.unit}</td>
                    <td><input className="input w-24" type="number" min="0" step="0.01" value={line.quantity} onChange={(event) => editLine(line.key, { quantity: Number(event.target.value) })} /></td>
                    <td>{line.unmatched ? 'No catalog match' : (
                      <SearchableSelect
                        className="min-w-[12rem]"
                        value={String(line.productId || '')}
                        onChange={(next) => {
                          const option = line.options.find((item) => String(item._id) === String(next));
                          if (!option) return;
                          editLine(line.key, { productId: option._id, productName: option.name, brand: option.brand, unitPrice: option.pricePkr, unmatched: false });
                        }}
                        options={line.options.map((option) => ({ value: String(option._id), label: `${option.brand} · ${money(option.pricePkr)}` }))}
                      />
                    )}</td>
                    <td>{line.unmatched ? '—' : money(line.unitPrice)}<div className="text-[11px] text-slate-400">{line.priceUpdatedAt ? `Updated ${new Date(line.priceUpdatedAt).toLocaleDateString()}` : ''}</div></td>
                    <td>{money(line.lineTotal)}</td>
                    <td>{!line.unmatched && <button type="button" className="text-sm font-semibold text-[#FF7518]" onClick={() => add({ _id: line.productId, pricePkr: line.unitPrice, name: line.productName, unit: line.unit, brand: line.brand, priceUpdatedAt: line.priceUpdatedAt }, Math.max(1, Math.ceil(line.quantity))).catch((requestError) => setError(requestError.message))}>Add</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-lg font-black">Estimated material cost {money(result.lines.reduce((sum, line) => sum + line.lineTotal, 0))}</p>
        </section>
      )}
    </div>
  );
}
