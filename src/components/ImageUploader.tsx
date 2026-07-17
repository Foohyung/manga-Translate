import { useCallback, useState, useRef } from 'react';
import { UploadCloud, X, Image as ImageIcon } from 'lucide-react';

interface ImageUploaderProps {
  images: { file: File; url: string }[];
  onImagesChange: (images: { file: File; url: string }[]) => void;
  maxFiles?: number;
}

export function ImageUploader({ images, onImagesChange, maxFiles = 50 }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter((f) =>
        f.type.startsWith('image/')
      );

      const newImages = fileArray.slice(0, maxFiles - images.length).map((file) => ({
        file,
        url: URL.createObjectURL(file),
      }));

      onImagesChange([...images, ...newImages]);
    },
    [images, onImagesChange, maxFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const removeImage = (index: number) => {
    const newImages = [...images];
    if (newImages[index]?.url.startsWith('blob:')) {
      URL.revokeObjectURL(newImages[index].url);
    }
    newImages.splice(index, 1);
    onImagesChange(newImages);
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 ${
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border hover:border-primary/50 hover:bg-white/[0.02]'
        } ${images.length === 0 ? 'py-16' : 'py-8'}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              handleFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />

        <div className="flex flex-col items-center gap-3 text-center px-4">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
              isDragging
                ? 'bg-primary/20 text-primary'
                : 'bg-white/5 text-muted'
            }`}
          >
            <UploadCloud size={32} />
          </div>
          <div>
            <p className="text-foreground font-semibold">
              {isDragging ? 'วางไฟล์ที่นี่!' : 'ลากไฟล์มาวาง หรือคลิกเลือก'}
            </p>
            <p className="text-sm text-muted mt-1">
              รองรับ PNG, JPG, WEBP · สูงสุด {maxFiles} ไฟล์
            </p>
          </div>
        </div>
      </div>

      {/* Image Grid */}
      {images.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted">
              <ImageIcon size={14} className="inline mr-1" />
              {images.length} หน้า
            </p>
            <button
              onClick={() => {
                images.forEach((img) => {
                  if (img.url.startsWith('blob:')) {
                    URL.revokeObjectURL(img.url);
                  }
                });
                onImagesChange([]);
              }}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              ลบทั้งหมด
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {images.map((img, idx) => (
              <div
                key={idx}
                className="relative group rounded-xl overflow-hidden border border-border bg-surface aspect-[3/4]"
              >
                <img
                  src={img.url}
                  alt={`หน้า ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                {/* Page number */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <span className="text-xs font-bold text-white">
                    หน้า {idx + 1}
                  </span>
                </div>
                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(idx);
                  }}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
