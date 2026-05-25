import { describe, expect, test } from '@jest/globals';
import { categories, validateProductForm } from '../../frontend/src/utils/products.js';

describe('React product form validation', () => {
  test('accepts the three supported categories', () => {
    expect(categories).toEqual(['Electronics', 'Home', 'Fashion']);
  });

  test('returns field-level messages for invalid input', () => {
    const result = validateProductForm({
      name: 'A',
      sku: '?',
      category: 'Outdoor',
      price: '-1',
      stock: '1.5',
      description: ''
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toMatchObject({
      name: expect.any(String),
      sku: expect.any(String),
      category: expect.any(String),
      price: expect.any(String),
      stock: expect.any(String)
    });
  });
});
