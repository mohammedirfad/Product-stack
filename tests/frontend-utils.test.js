import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildProductQuery, formatCurrency, normalizeProductForm, validateProductForm } from '../frontend/src/utils/products.js';

test('buildProductQuery skips empty filters', () => {
  assert.equal(
    buildProductQuery({ search: 'watch', category: '', page: 2, pageSize: 12, inStock: true }),
    'search=watch&page=2&pageSize=12&inStock=true'
  );
});

test('normalizeProductForm prepares validated payloads', () => {
  assert.deepEqual(
    normalizeProductForm({
      name: ' Desk Lamp ',
      sku: ' home-lamp-100 ',
      category: ' Home ',
      description: ' LED lamp ',
      price: '39.99',
      stock: '50',
      imageUrl: '  /uploads/test.png  '
    }),
    {
      name: 'Desk Lamp',
      sku: 'HOME-LAMP-100',
      category: 'Home',
      description: 'LED lamp',
      price: 39.99,
      stock: 50,
      imageUrl: '/uploads/test.png'
    }
  );
});

test('formatCurrency formats product prices', () => {
  assert.equal(formatCurrency(119), '$119.00');
});

test('validateProductForm returns inline validation details', () => {
  const result = validateProductForm({ name: 'A', sku: '?', category: 'Outdoor', price: '-1', stock: '1.5' });

  assert.equal(result.ok, false);
  assert.ok(result.errors.name);
  assert.ok(result.errors.sku);
  assert.ok(result.errors.category);
  assert.ok(result.errors.price);
  assert.ok(result.errors.stock);
});
