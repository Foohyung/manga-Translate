'use client';

import { useRef, useState, type ButtonHTMLAttributes, type DragEvent } from 'react';
import { CloudUpload } from 'lucide-react';

interface ImagePickerButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type'> {
  onFiles: (files: File[]) => void;
}

/** A button that opens a multi-image file chooser. */
export function ImagePickerButton({ onFiles, ...buttonProps }: ImagePickerButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          onFiles([...(event.target.files ?? [])]);
          event.target.value = '';
        }}
      />
      <button type="button" {...buttonProps} onClick={() => inputRef.current?.click()} />
    </>
  );
}

export function UploadDropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    onFiles([...event.dataTransfer.files]);
  };

  return (
    <ImagePickerButton
      onFiles={onFiles}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex w-full flex-col items-center gap-4 rounded-3xl border-2 border-dashed px-6 py-16 text-center transition ${
        dragging ? 'scale-[1.01] border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-white/[0.02]'
      }`}
    >
      <span
        className={`flex size-16 items-center justify-center rounded-2xl ${
          dragging ? 'bg-primary/20 text-primary' : 'bg-white/5 text-muted'
        }`}
      >
        <CloudUpload size={32} />
      </span>
      <span className="text-lg font-semibold text-foreground">
        {dragging ? 'ปล่อยไฟล์ที่นี่' : 'ลากภาพมาวาง หรือคลิกเพื่อเลือกไฟล์'}
      </span>
      <span className="text-sm text-muted">รองรับ PNG, JPG, WEBP · เลือกได้หลายหน้าพร้อมกัน</span>
    </ImagePickerButton>
  );
}
