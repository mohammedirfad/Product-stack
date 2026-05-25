import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuid } from 'uuid';
import { normalizeText, tokenize } from '../utils/text.js';

export const allowedCategories = ['Electronics', 'Home', 'Fashion'];

const seedProducts = [
  {
    name: 'Auralux Pro ANC Earbuds',
    sku: 'ELEC-AURALUX-PRO',
    category: 'Electronics',
    price: 129,
    stock: 34,
    imageUrl: '/products/audio-kit.svg',
    description: 'Wireless earbuds with adaptive noise cancellation, low-latency gaming mode, and 32-hour battery case.'
  },
  {
    name: 'PulseTrack AMOLED Watch',
    sku: 'ELEC-PULSETRACK-42',
    category: 'Electronics',
    price: 179,
    stock: 22,
    imageUrl: '/products/wearable-kit.svg',
    description: 'AMOLED fitness smartwatch with SpO2 tracking, GPS workouts, sleep insights, and fast charging.'
  },
  {
    name: 'Nordic Ceramic Dinner Set',
    sku: 'HOME-NORDIC-16PC',
    category: 'Home',
    price: 74.5,
    stock: 48,
    imageUrl: '/products/home-bundle.svg',
    description: 'Sixteen-piece matte ceramic dinnerware set designed for modern kitchens and everyday durability.'
  },
  {
    name: 'HydraSteel Thermal Bottle',
    sku: 'HOME-HYDRA-950',
    category: 'Home',
    price: 32,
    stock: 96,
    imageUrl: '/products/home-bundle.svg',
    description: 'Vacuum insulated 950ml bottle with leak-proof lid, powder-coated finish, and 24-hour cold retention.'
  },
  {
    name: 'CloudWeave Travel Hoodie',
    sku: 'FASH-CLOUD-HOOD',
    category: 'Fashion',
    price: 68,
    stock: 57,
    imageUrl: '/products/fashion-pack.svg',
    description: 'Soft stretch hoodie with hidden passport pocket, breathable panels, and wrinkle-resistant fabric.'
  },
  {
    name: 'StrideFlex Knit Sneakers',
    sku: 'FASH-STRIDE-KNIT',
    category: 'Fashion',
    price: 92,
    stock: 39,
    imageUrl: '/products/fashion-pack.svg',
    description: 'Lightweight knit sneakers with cushioned foam midsole and grippy recycled rubber outsole.'
  }
];

export class ProductRepository {
  constructor({ dataDir }) {
    this.filePath = path.join(dataDir, 'products.runtime.json');
    this.products = [];
    this.byId = new Map();
    this.bySku = new Map();
    this.byToken = new Map();
    this.byCategory = new Map();
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      this.products = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      const migrated = this.#normalizeExistingProducts();
      if (migrated) await this.#persist();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const now = new Date().toISOString();
      this.products = seedProducts.map((product) => ({
        id: uuid(),
        ...product,
        active: true,
        createdAt: now,
        updatedAt: now
      }));
      await this.#persist();
    }
    this.#rebuildIndexes();
  }

  list(filters = {}) {
    let candidates = this.products;

    if (filters.category) {
      const ids = this.byCategory.get(normalizeText(filters.category)) || new Set();
      candidates = [...ids].map((id) => this.byId.get(id)).filter(Boolean);
    }

    if (filters.search) {
      const queryTokens = tokenize(filters.search);
      if (queryTokens.length) {
        let matchedIds = null;
        for (const token of queryTokens) {
          const ids = this.byToken.get(token) || new Set();
          matchedIds = matchedIds === null ? new Set(ids) : intersect(matchedIds, ids);
        }
        const indexed = matchedIds ? [...matchedIds].map((id) => this.byId.get(id)).filter(Boolean) : [];
        const needle = normalizeText(filters.search);
        candidates = indexed.length ? indexed : candidates.filter((product) => product.searchText.includes(needle));
      }
    }

    candidates = candidates.filter((product) => {
      if (filters.inStock === true && product.stock <= 0) return false;
      if (filters.inStock === false && product.stock > 0) return false;
      if (Number.isFinite(filters.minPrice) && product.price < filters.minPrice) return false;
      if (Number.isFinite(filters.maxPrice) && product.price > filters.maxPrice) return false;
      return true;
    });

    const sortBy = ['name', 'price', 'createdAt', 'updatedAt', 'stock'].includes(filters.sortBy)
      ? filters.sortBy
      : 'createdAt';
    const direction = filters.sortOrder === 'asc' ? 1 : -1;
    candidates = [...candidates].sort((left, right) => compare(left[sortBy], right[sortBy]) * direction);

    const pageSize = Math.min(Math.max(Number(filters.pageSize) || 10, 1), 50);
    const page = Math.max(Number(filters.page) || 1, 1);
    const total = candidates.length;
    const start = (page - 1) * pageSize;
    const items = candidates.slice(start, start + pageSize).map(toPublicProduct);

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      facets: this.facets(candidates)
    };
  }

  facets(scope = this.products) {
    const categories = allowedCategories;
    const visibleStock = scope.reduce((sum, product) => sum + Number(product.stock || 0), 0);
    const visibleValue = scope.reduce((sum, product) => sum + Number(product.stock || 0) * Number(product.price || 0), 0);
    return { categories, visibleStock, visibleValue: Math.round(visibleValue * 100) / 100 };
  }

  getById(id) {
    const product = this.byId.get(id);
    return product ? toPublicProduct(product) : null;
  }

  skuExists(sku, exceptId) {
    const product = this.bySku.get(normalizeText(sku));
    return Boolean(product && product.id !== exceptId);
  }

  async create(input) {
    const now = new Date().toISOString();
    const product = { id: uuid(), ...input, imageUrl: input.imageUrl || imageFor(input.category), active: true, createdAt: now, updatedAt: now };
    this.products.unshift(product);
    this.#rebuildIndexes();
    await this.#persist();
    return toPublicProduct(product);
  }

  async update(id, input) {
    const index = this.products.findIndex((product) => product.id === id);
    if (index === -1) return null;
    const updated = { ...this.products[index], ...input, updatedAt: new Date().toISOString() };
    this.products[index] = updated;
    this.#rebuildIndexes();
    await this.#persist();
    return toPublicProduct(updated);
  }

  async delete(id) {
    const index = this.products.findIndex((product) => product.id === id);
    if (index === -1) return false;
    this.products.splice(index, 1);
    this.#rebuildIndexes();
    await this.#persist();
    return true;
  }

  #rebuildIndexes() {
    this.byId = new Map();
    this.bySku = new Map();
    this.byToken = new Map();
    this.byCategory = new Map();

    for (const product of this.products) {
      product.category = normalizeCategory(product.category);
      product.imageUrl = product.imageUrl || imageFor(product.category, product.name);
      product.searchText = normalizeText(`${product.name} ${product.sku} ${product.category} ${product.description}`);
      this.byId.set(product.id, product);
      this.bySku.set(normalizeText(product.sku), product);

      const category = normalizeText(product.category);
      if (!this.byCategory.has(category)) this.byCategory.set(category, new Set());
      this.byCategory.get(category).add(product.id);

      for (const token of tokenize(product.searchText)) {
        if (!this.byToken.has(token)) this.byToken.set(token, new Set());
        this.byToken.get(token).add(product.id);
      }
    }
  }

  async #persist() {
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(this.products, null, 2));
    await fs.rename(tempPath, this.filePath);
  }

  #normalizeExistingProducts() {
    let changed = false;
    this.products = this.products.map((product) => {
      const category = normalizeCategory(product.category);
      const imageUrl = product.imageUrl || imageFor(category, product.name);
      if (category !== product.category || imageUrl !== product.imageUrl) changed = true;
      return { ...product, category, imageUrl };
    });
    return changed;
  }
}

function toPublicProduct(product) {
  const { searchText, ...publicProduct } = product;
  return publicProduct;
}

function intersect(left, right) {
  const result = new Set();
  for (const value of left) if (right.has(value)) result.add(value);
  return result;
}

function compare(left, right) {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right));
}

export function normalizeCategory(category) {
  const value = normalizeText(category);
  if (value === 'electronics') return 'Electronics';
  if (['home', 'office', 'furniture', 'kitchen'].includes(value)) return 'Home';
  if (['fashion', 'apparel', 'footwear', 'outdoor', 'bags'].includes(value)) return 'Fashion';
  return allowedCategories.includes(category) ? category : 'Electronics';
}

export function imageFor(category, name = '') {
  const normalizedName = normalizeText(name);
  if (normalizedName.includes('earbud') || normalizedName.includes('audio')) return '/products/audio-kit.svg';
  if (normalizedName.includes('watch') || normalizedName.includes('pulse')) return '/products/wearable-kit.svg';
  if (category === 'Home') return '/products/home-bundle.svg';
  if (category === 'Fashion') return '/products/fashion-pack.svg';
  return '/products/wearable-kit.svg';
}
