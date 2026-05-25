import { allowedCategories, imageFor, normalizeCategory } from '../repositories/productRepository.js';

export function parseProductFilters(query) {
  return {
    search: clean(query.search, 120),
    category: query.category ? normalizeCategory(clean(query.category, 80)) : '',
    minPrice: optionalNumber(query.minPrice),
    maxPrice: optionalNumber(query.maxPrice),
    inStock: optionalBoolean(query.inStock),
    page: clampInt(query.page, 1, 10_000, 1),
    pageSize: clampInt(query.pageSize, 1, 50, 12),
    sortBy: query.sortBy || 'createdAt',
    sortOrder: query.sortOrder === 'asc' ? 'asc' : 'desc'
  };
}

export function validateProductInput(input, { partial = false } = {}) {
  const errors = {};
  const output = {};

  text(input, output, errors, 'name', { required: !partial, min: 2, max: 120 });
  text(input, output, errors, 'sku', {
    required: !partial,
    min: 2,
    max: 64,
    pattern: /^[A-Z0-9][A-Z0-9-_.]*$/i,
    transform: (value) => value.toUpperCase()
  });
  text(input, output, errors, 'category', { required: !partial, min: 2, max: 80 });
  text(input, output, errors, 'description', { required: false, min: 0, max: 500 });
  text(input, output, errors, 'imageUrl', { required: false, min: 0, max: 300 });

  if (output.category) {
    output.category = normalizeCategory(output.category);
    if (!allowedCategories.includes(output.category)) {
      errors.category = `Category must be one of: ${allowedCategories.join(', ')}.`;
    }
  }

  if (Object.hasOwn(input, 'price') || !partial) {
    const price = Number(input.price);
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000) {
      errors.price = 'Price must be between 0 and 1,000,000.';
    } else {
      output.price = Math.round(price * 100) / 100;
    }
  }

  if (Object.hasOwn(input, 'stock') || !partial) {
    const stock = Number(input.stock);
    if (!Number.isInteger(stock) || stock < 0 || stock > 10_000_000) {
      errors.stock = 'Stock must be an integer between 0 and 10,000,000.';
    } else {
      output.stock = stock;
    }
  }

  if (!output.imageUrl && output.category) output.imageUrl = imageFor(output.category, output.name);

  return { ok: Object.keys(errors).length === 0, value: output, errors };
}

function text(input, output, errors, key, { required, min, max, pattern, transform = (value) => value }) {
  if (!Object.hasOwn(input, key)) {
    if (required) errors[key] = `${key} is required.`;
    return;
  }

  const value = String(input[key] ?? '').trim();
  if (required && !value) {
    errors[key] = `${key} is required.`;
    return;
  }
  if (value.length < min || value.length > max) {
    errors[key] = `${key} must be between ${min} and ${max} characters.`;
    return;
  }
  if (pattern && !pattern.test(value)) {
    errors[key] = `${key} contains unsupported characters.`;
    return;
  }
  output[key] = transform(value);
}

function clean(value, max) {
  return String(value || '').trim().slice(0, max);
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function optionalBoolean(value) {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return null;
}

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}
