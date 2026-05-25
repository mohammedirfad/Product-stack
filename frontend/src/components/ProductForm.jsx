import { Save, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { categories, validateProductForm } from '../utils/products.js';
import { API_URL } from '../api/client.js';

export function ProductForm({ editing, onSubmit, onCancel, busy }) {
  const [errors, setErrors] = useState({});
  const [imageUrl, setImageUrl] = useState(editing?.imageUrl || '');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFileChange(file) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const session = JSON.parse(sessionStorage.getItem('catalog_session') || '{}');
      const token = session?.token;

      const response = await fetch(`${API_URL}/api/products/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || 'Failed to upload image.');
      }

      const data = await response.json();
      setImageUrl(data.imageUrl);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const validation = validateProductForm(Object.fromEntries(form.entries()));
    setErrors(validation.errors);
    if (!validation.ok) return;
    onSubmit(validation.value);
  }

  const dropzoneClass = `image-dropzone ${dragOver ? 'dragover' : ''} ${imageUrl ? 'has-image' : ''} ${uploading ? 'uploading' : ''}`;

  return (
    <form className="product-form" onSubmit={submit} key={editing?.id || 'create'} noValidate>
      <label>
        Name
        <input name="name" defaultValue={editing?.name || ''} maxLength="120" aria-invalid={Boolean(errors.name)} placeholder="Product name" />
        {errors.name && <span className="field-error">{errors.name}</span>}
      </label>
      <label>
        SKU
        <input name="sku" defaultValue={editing?.sku || ''} maxLength="64" aria-invalid={Boolean(errors.sku)} placeholder="e.g. ELEC-AURALUX-PRO" />
        {errors.sku && <span className="field-error">{errors.sku}</span>}
      </label>
      <label>
        Category
        <select name="category" defaultValue={editing?.category || 'Electronics'} aria-invalid={Boolean(errors.category)}>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        {errors.category && <span className="field-error">{errors.category}</span>}
      </label>
      <div className="form-grid">
        <label>
          Price
          <input name="price" type="number" step="0.01" min="0" defaultValue={editing?.price || ''} aria-invalid={Boolean(errors.price)} placeholder="0.00" />
          {errors.price && <span className="field-error">{errors.price}</span>}
        </label>
        <label>
          Stock
          <input name="stock" type="number" step="1" min="0" defaultValue={editing?.stock ?? ''} aria-invalid={Boolean(errors.stock)} placeholder="0" />
          {errors.stock && <span className="field-error">{errors.stock}</span>}
        </label>
      </div>
      <label>
        Description
        <textarea name="description" rows="3" maxLength="500" defaultValue={editing?.description || ''} aria-invalid={Boolean(errors.description)} placeholder="Provide details about the product..." />
        {errors.description && <span className="field-error">{errors.description}</span>}
      </label>
      
      <div className="form-image-upload">
        <label className="upload-label">Product Image</label>
        <div
          className={dropzoneClass}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            handleFileChange(file);
          }}
        >
          {uploading ? (
            <div className="upload-state">
              <div className="upload-spinner"></div>
              <p>Uploading image...</p>
            </div>
          ) : imageUrl ? (
            <div className="preview-state">
              <img src={imageUrl.startsWith('/') ? `${API_URL}${imageUrl}` : imageUrl} alt="Product preview" />
              <div className="preview-overlay">
                <button
                  type="button"
                  className="secondary compact"
                  onClick={() => document.getElementById('product-file-input').click()}
                >
                  Change
                </button>
                <button
                  type="button"
                  className="danger compact"
                  onClick={() => setImageUrl('')}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div
              className="placeholder-state"
              onClick={() => document.getElementById('product-file-input').click()}
            >
              <div className="upload-icon-container">
                <Upload size={20} />
              </div>
              <p><strong>Click to upload</strong> or drag and drop</p>
              <span>SVG, PNG, JPG, WEBP, or GIF (max. 5MB)</span>
            </div>
          )}

          <input
            id="product-file-input"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              handleFileChange(file);
            }}
            style={{ display: 'none' }}
          />
          <input type="hidden" name="imageUrl" value={imageUrl} />
        </div>
        {uploadError && <span className="field-error">{uploadError}</span>}
      </div>

      <button className="primary-action-button" type="submit" disabled={busy || uploading}>
        <Save size={18} />
        {busy ? 'Saving...' : editing ? 'Update product' : 'Add product'}
      </button>
    </form>
  );
}
