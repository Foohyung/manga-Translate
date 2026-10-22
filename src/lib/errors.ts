export function errorMessage(error: unknown, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
