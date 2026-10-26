import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

/** Normalize string options or `{ value, label }` objects into a stable list. */
export function normalizeSelectOptions(options = []) {
  return (options || [])
    .map((option, index) => {
      if (option == null) return null;
      if (typeof option === 'string' || typeof option === 'number') {
        const value = String(option);
        return { value, label: value, key: value };
      }
      const value = String(option.value ?? '');
      const label = String(option.label ?? value);
      return {
        value,
        label,
        key: String(option.key ?? (value || `opt-${index}`)),
        disabled: Boolean(option.disabled),
        keywords: option.keywords != null ? String(option.keywords) : '',
      };
    })
    .filter(Boolean);
}

function optionMatches(option, query) {
  if (!query) return true;
  const haystack = `${option.label} ${option.value} ${option.keywords}`.toLowerCase();
  return haystack.includes(query);
}

/**
 * Searchable dropdown that matches the app `.input` look.
 * Drop-in for native `<select>`: pass `value`, `onChange(nextValue)`, and `options`.
 */
export default function SearchableSelect({
  value = '',
  onChange,
  options = [],
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  className = '',
  triggerClassName = '',
  disabled = false,
  clearable = false,
  emptyLabel = 'None',
  'aria-label': ariaLabel,
  id,
  name,
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState(null);
  const [fieldsetDisabled, setFieldsetDisabled] = useState(false);

  const items = useMemo(() => {
    const normalized = normalizeSelectOptions(options);
    if (!clearable) return normalized;
    return [{ value: '', label: emptyLabel, key: '__empty__', disabled: false, keywords: '' }, ...normalized];
  }, [options, clearable, emptyLabel]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((option) => optionMatches(option, needle));
  }, [items, query]);

  const selected = items.find((option) => option.value === String(value ?? '')) || null;
  const isDisabled = disabled || fieldsetDisabled;

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;
    const sync = () => setFieldsetDisabled(Boolean(node.closest('fieldset')?.disabled));
    sync();
    const observer = new MutationObserver(sync);
    const fieldset = node.closest('fieldset');
    if (fieldset) observer.observe(fieldset, { attributes: true, attributeFilter: ['disabled'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportPad = 8;
      const menuMax = 280;
      const spaceBelow = window.innerHeight - rect.bottom - viewportPad;
      const spaceAbove = rect.top - viewportPad;
      const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
      const maxHeight = Math.min(menuMax, Math.max(140, openUp ? spaceAbove : spaceBelow));
      setMenuStyle({
        position: 'fixed',
        left: Math.max(viewportPad, Math.min(rect.left, window.innerWidth - rect.width - viewportPad)),
        width: Math.max(rect.width, 160),
        maxHeight,
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
        zIndex: 80,
      });
    };

    updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', onScroll, true);
    const frame = requestAnimationFrame(() => searchRef.current?.focus());

    const onPointerDown = (event) => {
      const target = event.target;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = filtered.findIndex((option) => option.value === String(value ?? ''));
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, filtered, value]);

  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, filtered]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const commit = (nextValue) => {
    if (typeof onChange === 'function') onChange(nextValue);
    close();
    triggerRef.current?.focus();
  };

  const moveActive = (delta) => {
    if (!filtered.length) return;
    setActiveIndex((current) => {
      let next = current;
      for (let step = 0; step < filtered.length; step += 1) {
        next = (next + delta + filtered.length) % filtered.length;
        if (!filtered[next]?.disabled) return next;
      }
      return current;
    });
  };

  const onTriggerKeyDown = (event) => {
    if (isDisabled) return;
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onSearchKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      triggerRef.current?.focus();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option && !option.disabled) commit(option.value);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(Math.max(0, filtered.length - 1));
    }
  };

  const layoutClass = className.replace(/\binput\b/g, '').trim();
  const baseLayout = layoutClass.replace(/\b(sm|md|lg|xl|2xl):[^\s]+/g, '').trim();
  const hasBaseWidth = /(?:^|\s)!?((min|max)-)?w-|flex-1|shrink-0/.test(baseLayout);

  return (
    <div ref={rootRef} className={`relative min-w-0 ${hasBaseWidth ? '' : 'w-full'} ${layoutClass}`.trim()}>
      {name ? <input type="hidden" name={name} value={value ?? ''} readOnly /> : null}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={isDisabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={`input flex w-full items-center justify-between gap-2 text-left ${open ? 'border-orange-400 shadow-[0_0_0_3px_rgba(249,115,22,0.12)]' : ''} ${isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${triggerClassName}`.trim()}
        onClick={() => {
          if (isDisabled) return;
          setOpen((current) => !current);
          setQuery('');
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && menuStyle && createPortal(
        <div
          ref={listRef}
          style={menuStyle}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_-18px_rgba(15,23,42,0.35)]"
          role="presentation"
        >
          <div className="border-b border-slate-100 p-2">
            <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200 focus-within:ring-[#FF7518]">
              <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                aria-label={searchPlaceholder}
                autoComplete="off"
              />
            </label>
          </div>
          <ul
            id={listId}
            role="listbox"
            aria-label={ariaLabel || placeholder}
            className="max-h-[inherit] overflow-y-auto overscroll-contain py-1"
            style={{ maxHeight: Math.max(96, (menuStyle.maxHeight || 280) - 58) }}
          >
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-sm text-slate-500" role="presentation">No matches</li>
            )}
            {filtered.map((option, index) => {
              const isSelected = option.value === String(value ?? '');
              const isActive = index === activeIndex;
              return (
                <li key={option.key} role="option" aria-selected={isSelected} aria-disabled={option.disabled || undefined}>
                  <button
                    type="button"
                    data-active={isActive ? 'true' : 'false'}
                    disabled={option.disabled}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition ${
                      option.disabled
                        ? 'cursor-not-allowed text-slate-300'
                        : isActive
                          ? 'bg-orange-50 text-slate-900'
                          : 'text-slate-700 hover:bg-slate-50'
                    } ${isSelected ? 'font-semibold' : 'font-medium'}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      if (!option.disabled) commit(option.value);
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {isSelected ? <Check className="h-4 w-4 shrink-0 text-[#FF7518]" aria-hidden="true" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
