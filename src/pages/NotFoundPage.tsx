import { Button } from '@heroui/react';
import { useNavigate } from 'react-router';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <img src="/stickers/09_mtp.webp" alt="" className="h-28 w-28 object-contain" draggable={false} />
      <h1 className="mt-4 text-xl font-bold text-foreground">Không tìm thấy trang</h1>
      <p className="mt-1 text-sm text-muted">Link có thể đã cũ hoặc bị gõ nhầm.</p>
      <Button className="mt-6" onPress={() => navigate('/', { replace: true })}>
        Về trang chủ
      </Button>
    </div>
  );
}
