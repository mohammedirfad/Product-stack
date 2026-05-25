import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { parseProductFilters, validateProductInput } from '../services/productValidation.js';

export function createProductRoutes({ productRepository, cache, cacheConfig, requireAuth }) {
  const router = Router();

  const uploadsDir = path.join(path.dirname(productRepository.filePath), 'uploads');

  // Use memory storage so we can pipe the buffer through sharp before writing to disk
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB raw upload limit (sharp will compress down)
    fileFilter: (req, file, cb) => {
      const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowedExts.includes(ext)) {
        return cb(new Error('Invalid image type. Allowed: JPG, JPEG, PNG, GIF, WEBP, SVG'));
      }
      cb(null, true);
    }
  });

  router.post('/upload', requireAuth, (req, res) => {
    upload.single('image')(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              error: { code: 'file_too_large', message: 'Image must be under 10MB.' }
            });
          }
          return res.status(400).json({
            error: { code: 'upload_error', message: err.message }
          });
        }
        return res.status(400).json({
          error: { code: 'invalid_file', message: err.message }
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: { code: 'no_file', message: 'Please provide an image file under the field name "image".' }
        });
      }

      try {
        const isSvg = path.extname(req.file.originalname).toLowerCase() === '.svg';
        const uniqueName = crypto.randomUUID();

        let filename;
        if (isSvg) {
          // SVGs are vector — pass through unchanged
          filename = `${uniqueName}.svg`;
          await fs.writeFile(path.join(uploadsDir, filename), req.file.buffer);
        } else {
          // Raster images: resize to max 1200x900, convert to WebP for compact output
          filename = `${uniqueName}.webp`;
          await sharp(req.file.buffer)
            .resize({
              width: 1200,
              height: 900,
              fit: 'inside',        // preserves aspect ratio, never crops
              withoutEnlargement: true  // don't upscale small images
            })
            .webp({ quality: 82 })
            .toFile(path.join(uploadsDir, filename));
        }

        const imageUrl = `/uploads/${filename}`;
        return res.status(200).json({ imageUrl });
      } catch (processErr) {
        return res.status(500).json({
          error: { code: 'process_error', message: 'Failed to process the image. Please try again.' }
        });
      }
    });
  });

  router.get('/', async (req, res) => {
    const filters = parseProductFilters(req.query);
    const cacheKey = `products:list:${hash(JSON.stringify(filters))}`;
    const cached = await cache.getJson(cacheKey);
    if (cached) {
      res.setHeader('x-cache', 'HIT');
      return res.json(cached);
    }

    const result = productRepository.list(filters);
    await cache.setJson(cacheKey, result, cacheConfig.listTtlSeconds);
    res.setHeader('x-cache', 'MISS');
    return res.json(result);
  });

  router.get('/:id', async (req, res) => {
    const cacheKey = `products:detail:${req.params.id}`;
    const cached = await cache.getJson(cacheKey);
    if (cached) {
      res.setHeader('x-cache', 'HIT');
      return res.json(cached);
    }

    const product = productRepository.getById(req.params.id);
    if (!product) return notFound(res);
    await cache.setJson(cacheKey, product, cacheConfig.detailTtlSeconds);
    res.setHeader('x-cache', 'MISS');
    return res.json(product);
  });

  router.post('/', requireAuth, async (req, res) => {
    const validation = validateProductInput(req.body || {});
    if (!validation.ok) return validationError(res, validation.errors);
    if (productRepository.skuExists(validation.value.sku)) {
      return res.status(409).json({
        error: {
          code: 'sku_conflict',
          message: 'A product with this SKU already exists.'
        }
      });
    }

    const product = await productRepository.create(validation.value);
    await cache.delPrefix('products:');
    return res.status(201).json(product);
  });

  router.put('/:id', requireAuth, async (req, res) => {
    const validation = validateProductInput(req.body || {}, { partial: true });
    if (!validation.ok) return validationError(res, validation.errors);
    if (validation.value.sku && productRepository.skuExists(validation.value.sku, req.params.id)) {
      return res.status(409).json({
        error: {
          code: 'sku_conflict',
          message: 'A product with this SKU already exists.'
        }
      });
    }

    const product = await productRepository.update(req.params.id, validation.value);
    if (!product) return notFound(res);
    await cache.delPrefix('products:');
    return res.json(product);
  });

  router.delete('/:id', requireAuth, async (req, res) => {
    const deleted = await productRepository.delete(req.params.id);
    if (!deleted) return notFound(res);
    await cache.delPrefix('products:');
    return res.json({ deleted: true, id: req.params.id });
  });

  return router;
}

function validationError(res, details) {
  return res.status(422).json({
    error: {
      code: 'validation_failed',
      message: 'Product payload is invalid.',
      details
    }
  });
}

function notFound(res) {
  return res.status(404).json({
    error: {
      code: 'not_found',
      message: 'Product was not found.'
    }
  });
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 20);
}
