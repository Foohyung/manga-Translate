import { LoaderCircle } from 'lucide-react';

export function Spinner() {
  return (
    <div className="flex flex-1 items-center justify-center text-muted">
      <LoaderCircle size={28} className="animate-spin" aria-label="กำลังโหลด" />
    </div>
  );
}
