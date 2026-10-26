import { useRef, useState } from 'react';
import { getToken } from '../lib/api';
import { buttonClass, ghostClass } from './ui';

export default function ImageUpload({
  label = 'Upload image',
  entityType = '',
  entityId = '',
  currentUrl = '',
  onUploaded,
  onCleared,
}) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(currentUrl || '');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Choose a JPEG, PNG, WebP, or GIF image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5 MB or smaller.');
      return;
    }
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    setProgress(15);
    try {
      const body = new FormData();
      body.append('image', file);
      if (entityType) body.append('entityType', entityType);
      if (entityId) body.append('entityId', entityId);
      const token = getToken();
      setProgress(45);
      const response = await fetch('/api/uploads', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
      });
      setProgress(85);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Upload failed.');
      setPreview(payload.image.url);
      setProgress(100);
      onUploaded?.(payload.image);
    } catch (uploadError) {
      setError(uploadError.message);
      setProgress(0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div
        className={`rounded-2xl border border-dashed p-4 text-center transition ${dragging ? 'border-[#FF7518] bg-orange-50' : 'border-slate-300 bg-slate-50'}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); upload(event.dataTransfer.files?.[0]); }}
      >
        {preview ? (
          <img src={preview} alt="" className="mx-auto mb-3 h-28 w-28 rounded-xl object-cover" />
        ) : (
          <p className="mb-3 text-sm text-slate-500">Drag and drop an image here, or browse</p>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className={buttonClass} disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? 'Uploading…' : 'Choose file'}</button>
          {preview && (
            <button
              type="button"
              className={ghostClass}
              onClick={() => { setPreview(''); setProgress(0); onCleared?.(); }}
            >
              Remove
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => upload(event.target.files?.[0])} />
        {progress > 0 && progress < 100 && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-[#FF7518] transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
