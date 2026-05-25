import { Edit3, LayoutGrid, List, Package, Plus, Search, Trash2 } from 'lucide-react';
import { API_URL } from '../api/client.js';
import { categories, formatCurrency } from '../utils/products.js';

// Uploaded images are stored on the API server. Prefix relative /uploads/ paths
// with the API base URL so the browser fetches from port 4000, not 3001.
function resolveImage(imageUrl) {
  if (!imageUrl) return '/products/wearable-kit.svg';
  if (imageUrl.startsWith('/uploads/')) return `${API_URL}${imageUrl}`;
  return imageUrl;
}

export function ProductList({
  result,
  loading,
  filters,
  setFilters,
  view,
  setView,
  onCreate,
  onEdit,
  onDelete,
  onPage
}) {
  const products = result?.items || [];
  const categories = result?.facets?.categories || [];

  return (
    <section className="catalog-panel">
      <div className="toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            type="search"
            placeholder="Search name, SKU, category"
            value={filters.search}
            onChange={(event) => setFilters({ search: event.target.value, page: 1 })}
          />
        </label>
        <select value={filters.category} onChange={(event) => setFilters({ category: event.target.value, page: 1 })}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <select value={filters.inStock} onChange={(event) => setFilters({ inStock: event.target.value, page: 1 })}>
          <option value="">All stock</option>
          <option value="true">In stock</option>
          <option value="false">Out of stock</option>
        </select>
        <select
          value={`${filters.sortBy}:${filters.sortOrder}`}
          onChange={(event) => {
            const [sortBy, sortOrder] = event.target.value.split(':');
            setFilters({ sortBy, sortOrder, page: 1 });
          }}
        >
          <option value="createdAt:desc">Newest</option>
          <option value="updatedAt:desc">Recently updated</option>
          <option value="name:asc">Name A-Z</option>
          <option value="price:asc">Lowest price</option>
          <option value="price:desc">Highest price</option>
          <option value="stock:asc">Lowest stock</option>
        </select>
        <div className="view-toggle" aria-label="View mode">
          <button className={view === 'cards' ? 'active icon-button bordered' : 'icon-button bordered'} type="button" onClick={() => setView('cards')} aria-label="Card view">
            <LayoutGrid size={18} />
          </button>
          <button className={view === 'table' ? 'active icon-button bordered' : 'icon-button bordered'} type="button" onClick={() => setView('table')} aria-label="Table view">
            <List size={18} />
          </button>
        </div>
        <button type="button" onClick={onCreate}><Plus size={18} /> Add</button>
      </div>

      {loading ? <Skeleton view={view} /> : products.length === 0 ? (
        <div className="empty-state">
          <Package size={36} />
          <strong>No products found</strong>
          <span>Try a different search or create a new product.</span>
        </div>
      ) : view === 'cards' ? (
        <div className="product-grid">
          {products.map((product) => (
            <article className="product-card" key={product.id}>
              <img className="product-image" src={resolveImage(product.imageUrl)} alt={product.name} loading="lazy" />
              <div className="product-card-head">
                <span>{product.category}</span>
                <strong>{formatCurrency(product.price)}</strong>
              </div>
              <h3>{product.name}</h3>
              <p>{product.description || 'No description provided.'}</p>
              <div className="product-meta">
                <span>{product.sku}</span>
                <span>{product.stock} units</span>
              </div>
              <div className="card-actions">
                <button className="secondary" type="button" onClick={() => onEdit(product)}><Edit3 size={16} /> Edit</button>
                <button className="danger" type="button" onClick={() => onDelete(product)}><Trash2 size={16} /> Delete</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td><strong>{product.name}</strong></td>
                  <td>
                    <div className="table-product">
                      <img src={resolveImage(product.imageUrl)} alt={product.name} loading="lazy" />
                      <span>{product.sku}</span>
                    </div>
                  </td>
                  <td>{product.category}</td>
                  <td>{formatCurrency(product.price)}</td>
                  <td>{product.stock}</td>
                  <td className="row-actions">
                    <button className="secondary compact" type="button" onClick={() => onEdit(product)}>Edit</button>
                    <button className="danger compact" type="button" onClick={() => onDelete(product)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <footer className="pagination">
        <span>{result ? `${result.total} products - page ${result.page} of ${result.totalPages}` : 'Loading products...'}</span>
        <div>
          <button className="secondary" type="button" disabled={!result || result.page <= 1} onClick={() => onPage(result.page - 1)}>Previous</button>
          <button className="secondary" type="button" disabled={!result || result.page >= result.totalPages} onClick={() => onPage(result.page + 1)}>Next</button>
        </div>
      </footer>
    </section>
  );
}

function Skeleton({ view }) {
  if (view === 'table') {
    return <div className="table-skeleton">{Array.from({ length: 10 }).map((_, index) => <span key={index} />)}</div>;
  }
  return <div className="product-grid">{Array.from({ length: 10 }).map((_, index) => <article className="product-card skeleton-card" key={index} />)}</div>;
}
