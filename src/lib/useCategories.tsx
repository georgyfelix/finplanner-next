import { useState, useEffect } from 'react';

export type Category = { id: string; name: string; type: string };

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(setCategories);
  }, []);

  return categories;
}

/** Renders an optgroup-based grouped select of user categories */
export function CategorySelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const categories = useCategories();

  const groups = [
    { type: 'expense', label: '💸 Expenses', items: categories.filter(c => c.type === 'expense') },
    { type: 'income',  label: '💰 Income',   items: categories.filter(c => c.type === 'income') },
    { type: 'saving',  label: '🏦 Savings',  items: categories.filter(c => c.type === 'saving') },
  ].filter(g => g.items.length > 0);

  // Set default to first category when loaded
  useEffect(() => {
    if (!value && categories.length > 0) {
      onChange(categories[0].name);
    }
  }, [categories, value, onChange]);

  if (categories.length === 0) {
    return (
      <select className={className} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">No categories — add some in Categories</option>
      </select>
    );
  }

  return (
    <select className={className} value={value} onChange={e => onChange(e.target.value)}>
      {groups.map(g => (
        <optgroup key={g.type} label={g.label}>
          {g.items.map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
