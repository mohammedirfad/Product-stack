export const categories = ['Electronics', 'Home', 'Fashion'];

export function buildProductQuery(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  return params.toString();
}

export function validateProductForm(values) {
  const errors = {};
  const normalized = normalizeProductForm(values);

  if (normalized.name.length < 2) errors.name = 'Product name must be at least 2 characters.';
  if (normalized.name.length > 120) errors.name = 'Product name must be 120 characters or fewer.';
  if (!/^[A-Z0-9][A-Z0-9-_.]*$/i.test(normalized.sku)) errors.sku = 'SKU must start with a letter or number and may include -, _, or .';
  if (normalized.sku.length < 2) errors.sku = 'SKU must be at least 2 characters.';
  if (!categories.includes(normalized.category)) errors.category = 'Select one of the available categories.';
  if (!Number.isFinite(normalized.price) || normalized.price < 0) errors.price = 'Price must be a valid number greater than or equal to 0.';
  if (!Number.isInteger(normalized.stock) || normalized.stock < 0) errors.stock = 'Stock must be a whole number greater than or equal to 0.';
  if (normalized.description.length > 500) errors.description = 'Description must be 500 characters or fewer.';

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: normalized
  };
}

export function normalizeProductForm(values) {
  return {
    name: String(values.name || '').trim(),
    sku: String(values.sku || '').trim().toUpperCase(),
    category: String(values.category || '').trim(),
    description: String(values.description || '').trim(),
    price: Number(values.price),
    stock: Number(values.stock),
    imageUrl: String(values.imageUrl || '').trim()
  };
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}
