'use client';

import { useState, useEffect, useCallback } from 'react';
import { PERSONAL_SUGGESTED_CATEGORIES } from '@/lib/defaultCategories';
import ConfirmModal from '@/app/components/ConfirmModal';

type Category = { id: string; name: string; type: string };

const SUGGESTED: { name: string; type: string }[] = PERSONAL_SUGGESTED_CATEGORIES;

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  expense: { label: 'Expense', color: 'bg-red-100 text-red-700' },
  income:  { label: 'Income',  color: 'bg-green-100 text-green-700' },
  saving:  { label: 'Saving / Investment', color: 'bg-blue-100 text-blue-700' },
};

export default function CategoriesPage() {
  type ConfirmState =
    | { kind: 'delete'; id: string }
    | { kind: 'addAll'; count: number }
    | null;

  const [cats, setCats] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState('expense');
  const [loading, setLoading] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/categories');
    setCats(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type }),
    });
    setName('');
    await load();
    setLoading(false);
  }

  async function handleDelete(id: string) {
    await fetch('/api/categories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setConfirmState(null);
    await load();
  }

  async function handleAddSuggested(item: { name: string; type: string }) {
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    await load();
  }

  async function handleAddAllSuggested(remaining: { name: string; type: string }[]) {
    setLoading(true);
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(remaining),
    });
    await load();
    setLoading(false);
    setConfirmState(null);
  }

  const existingNames = new Set(cats.map(c => c.name.toLowerCase()));
  const remaining = SUGGESTED.filter(s => !existingNames.has(s.name.toLowerCase()));

  const grouped = ['expense', 'income', 'saving'].map(t => ({
    type: t,
    items: cats.filter(c => c.type === t),
  })).filter(g => g.items.length > 0);

  const suggestedGrouped = ['expense', 'income', 'saving'].map(t => ({
    type: t,
    items: remaining.filter(s => s.type === t),
  })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <span className="text-sm text-gray-400">{cats.length} categories</span>
      </div>

      {/* Add new */}
      <form onSubmit={handleAdd} className="bg-white rounded-xl border p-5 shadow-sm">
        <h2 className="font-semibold text-sm mb-3">Add Custom Category</h2>
        <div className="flex gap-3 flex-wrap">
          <input
            className="flex-1 min-w-48 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Category name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={type}
            onChange={e => setType(e.target.value)}
          >
            <option value="expense">💸 Expense</option>
            <option value="income">💰 Income</option>
            <option value="saving">🏦 Saving / Investment</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add
          </button>
        </div>
      </form>

      {/* My categories */}
      {cats.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="font-semibold text-sm text-gray-700">Your Categories</h2>
          </div>
          {grouped.map(g => (
            <div key={g.type}>
              <div className="px-4 py-2 bg-gray-50 border-b border-t first:border-t-0">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_LABELS[g.type].color}`}>
                  {g.type === 'expense' ? '💸' : g.type === 'income' ? '💰' : '🏦'} {TYPE_LABELS[g.type].label}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-0 divide-x divide-y">
                {g.items.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                    <span className="text-sm">{c.name}</span>
                    <button
                      onClick={() => setConfirmState({ kind: 'delete', id: c.id })}
                      className="px-2 py-1 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 text-xs ml-2 font-bold transition active:scale-[0.98]"
                      title="Remove"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Suggested */}
      {remaining.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-sm text-gray-700">Suggested Categories</h2>
              <p className="text-xs text-gray-400 mt-0.5">Click to add individual ones, or add all at once</p>
            </div>
            <button
              onClick={() => setConfirmState({ kind: 'addAll', count: remaining.length })}
              disabled={loading}
              className="text-sm text-indigo-600 font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Add all {remaining.length}
            </button>
          </div>
          {suggestedGrouped.map(g => (
            <div key={g.type}>
              <div className="px-4 py-2 bg-gray-50 border-b border-t first:border-t-0">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_LABELS[g.type].color}`}>
                  {g.type === 'expense' ? '💸' : g.type === 'income' ? '💰' : '🏦'} {TYPE_LABELS[g.type].label}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 p-4">
                {g.items.map(s => (
                  <button
                    key={s.name}
                    onClick={() => handleAddSuggested(s)}
                    className="text-sm border rounded-full px-3 py-1 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 transition active:scale-[0.99]"
                  >
                    + {s.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {cats.length === 0 && remaining.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-8">No categories yet. Add one above or use suggested ones.</p>
      )}

      <ConfirmModal
        isOpen={!!confirmState}
        title={confirmState?.kind === 'addAll' ? 'Add all suggested categories?' : 'Remove category?'}
        message={
          confirmState?.kind === 'addAll'
            ? `This will add ${confirmState.count} suggested categories.`
            : 'This will remove the category from your list.'
        }
        confirmLabel={confirmState?.kind === 'addAll' ? 'Add All' : 'Remove'}
        tone={confirmState?.kind === 'addAll' ? 'primary' : 'danger'}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          if (!confirmState) return;
          if (confirmState.kind === 'delete') {
            void handleDelete(confirmState.id);
            return;
          }
          void handleAddAllSuggested(remaining);
        }}
      />
    </div>
  );
}
