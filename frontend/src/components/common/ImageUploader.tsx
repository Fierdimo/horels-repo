import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import apiClient from '@/api/client';
import toast from 'react-hot-toast';

interface ImageUploaderProps {
  /** Current list of image URLs (absolute or relative) */
  images: string[];
  /** Called with the updated URL array after uploads or removals */
  onChange: (images: string[]) => void;
  /** When true, hides upload button and remove buttons (read-only view) */
  disabled?: boolean;
  /** Maximum number of images allowed (default: 20) */
  maxImages?: number;
}

/**
 * Reusable image uploader component.
 * Uploads files to POST /api/uploads, shows thumbnails, supports removal.
 */
export default function ImageUploader({
  images,
  onChange,
  disabled = false,
  maxImages = 20,
}: ImageUploaderProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList) => {
    if (!files.length) return;

    const tooLarge = Array.from(files).filter((f) => f.size > 5 * 1024 * 1024);
    if (tooLarge.length > 0) {
      toast.error(t('common.imageTooLarge', 'Each image must be under 5 MB'));
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append('images', f));
      const { data } = await apiClient.post('/api/uploads', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange([...images, ...(data.urls as string[])]);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error ||
          t('common.uploadFailed', 'Upload failed. Please try again.')
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {/* Thumbnail grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((url, i) => (
            <div
              key={i}
              className="relative group aspect-video bg-gray-100 rounded-lg overflow-hidden"
            >
              <img
                src={url}
                alt={`Photo ${i + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                  title={t('common.remove', 'Remove')}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload trigger button */}
      {!disabled && images.length < maxImages && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
              {t('common.uploading', 'Uploading…')}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              {t('common.addPhotos', 'Add photos')}
              <span className="text-gray-400 font-normal">
                (JPG, PNG, WebP · {t('common.maxPerFile', 'max 5 MB each')})
              </span>
            </>
          )}
        </button>
      )}

      {/* Empty state when read-only and no images */}
      {disabled && images.length === 0 && (
        <p className="text-sm text-gray-400 italic py-2">
          {t('common.noPhotos', 'No photos added yet')}
        </p>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  );
}
