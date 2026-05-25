import { LogOut, PackageCheck, Server, WalletCards } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest, API_URL } from './api/client.js';
import { Login } from './components/Login.jsx';
import { ConfirmDeleteModal, Modal } from './components/Modal.jsx';
import { ProductForm } from './components/ProductForm.jsx';
import { ProductList } from './components/ProductList.jsx';
import { ToastStack } from './components/Toast.jsx';
import { buildProductQuery, formatCurrency, normalizeProductForm } from './utils/products.js';

const initialFilters = {
  search: '',
  category: '',
  inStock: '',
  page: 1,
  pageSize: 10,
  sortBy: 'createdAt',
  sortOrder: 'desc'
};

export default function App() {
  const [session, setSession] = useState(() => JSON.parse(sessionStorage.getItem('catalog_session') || 'null'));
  const [filters, setFilterState] = useState(initialFilters);
  const [debouncedFilters, setDebouncedFilters] = useState(initialFilters);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [view, setView] = useState('cards');
  const [toasts, setToasts] = useState([]);

  const token = session?.token;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilters(filters), 300);
    return () => clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    if (!token) return;
    loadProducts();
  }, [token, debouncedFilters]);

  function setFilters(patch) {
    setFilterState((current) => ({ ...current, ...patch }));
  }

  function safeUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'f-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
  }

  function notify(message, type = 'success') {
    const id = safeUUID();
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4000);
  }

  async function handleLogin(credentials) {
    setLoginBusy(true);
    try {
      const data = await apiRequest('/api/auth/login', { method: 'POST', body: credentials });
      setSession(data);
      sessionStorage.setItem('catalog_session', JSON.stringify(data));
      notify('Signed in successfully.');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoginBusy(false);
    }
  }

  async function loadProducts() {
    setLoading(true);
    try {
      const query = buildProductQuery(debouncedFilters);
      const data = await apiRequest(`/api/products?${query}`, { token });
      setResult(data);
    } catch (error) {
      notify(error.message, 'error');
      if (error.status === 401) logout();
    } finally {
      setLoading(false);
    }
  }

  async function saveProduct(values) {
    setSaving(true);
    try {
      const payload = normalizeProductForm(values);
      await apiRequest(editing ? `/api/products/${editing.id}` : '/api/products', {
        token,
        method: editing ? 'PUT' : 'POST',
        body: payload
      });
      notify(editing ? 'Product updated.' : 'Product created.');
      setEditing(null);
      setFormOpen(false);
      await loadProducts();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct() {
    if (!deleteCandidate) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/products/${deleteCandidate.id}`, { token, method: 'DELETE' });
      notify('Product deleted.');
      setDeleteCandidate(null);
      await loadProducts();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setDeleting(false);
    }
  }

  function logout() {
    setSession(null);
    setResult(null);
    setEditing(null);
    sessionStorage.removeItem('catalog_session');
  }

  const metrics = useMemo(() => ({
    total: result?.total || 0,
    stock: result?.facets?.visibleStock || 0,
    value: result?.facets?.visibleValue || 0
  }), [result]);

  if (!session) {
    return (
      <>
        <Login onLogin={handleLogin} busy={loginBusy} />
        <ToastStack toasts={toasts} onClose={(id) => setToasts((items) => items.filter((toast) => toast.id !== id))} />
      </>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Product catalog admin</p>
          <h1>Products</h1>
          <span className="api-pill"><Server size={14} /> API {API_URL}</span>
        </div>
        <div className="account">
          <span>{session.user.name}</span>
          <button className="secondary" type="button" onClick={logout}><LogOut size={17} /> Sign out</button>
        </div>
      </header>

      <section className="metrics">
        <article><PackageCheck size={20} /><span>Total SKUs</span><strong>{metrics.total}</strong></article>
        <article><PackageCheck size={20} /><span>Visible units</span><strong>{metrics.stock}</strong></article>
        <article><WalletCards size={20} /><span>Visible value</span><strong>{formatCurrency(metrics.value)}</strong></article>
      </section>

      <section className="workspace single-column">
        <ProductList
          result={result}
          loading={loading}
          filters={filters}
          setFilters={setFilters}
          view={view}
          setView={setView}
          onCreate={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          onEdit={(product) => {
            setEditing(product);
            setFormOpen(true);
          }}
          onDelete={setDeleteCandidate}
          onPage={(page) => setFilters({ page })}
        />
      </section>

      {formOpen && (
        <Modal
          title={editing ? 'Edit product' : 'Add product'}
          subtitle={editing ? editing.sku : 'Catalog management'}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        >
          <ProductForm
            editing={editing}
            onSubmit={saveProduct}
            onCancel={() => {
              setFormOpen(false);
              setEditing(null);
            }}
            busy={saving}
          />
        </Modal>
      )}

      {deleteCandidate && (
        <ConfirmDeleteModal
          product={deleteCandidate}
          busy={deleting}
          onCancel={() => setDeleteCandidate(null)}
          onConfirm={deleteProduct}
        />
      )}

      <ToastStack toasts={toasts} onClose={(id) => setToasts((items) => items.filter((toast) => toast.id !== id))} />
    </main>
  );
}
