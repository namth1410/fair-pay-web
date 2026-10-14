import { Button } from '@heroui/react';
import { useState } from 'react';

import {
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_MIN_LENGTH,
  sanitizeFeedback,
  submitFeedback,
} from '../../services/feedback.service';
import { getErrorMessage } from '../../utils/error';
import { showSuccess } from '../../utils/toast';
import { TextAreaField } from '../ui/Field';
import { ErrorBox } from '../ui/Primitives';
import { Sheet } from '../ui/Sheet';

export function FeedbackSheet({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (o: boolean) => void }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(false);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setMessage('');
      setError(null);
    }
  }

  const length = sanitizeFeedback(message).length;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await submitFeedback(message);
      onOpenChange(false);
      showSuccess('Đã gửi góp ý', 'Cảm ơn bạn rất nhiều!');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isLocked={busy}
      title="Gửi góp ý"
      description="Mọi phản hồi của bạn đều giúp app tốt hơn. Hãy chia sẻ những gì bạn thấy chưa ổn hoặc tính năng bạn mong muốn."
      footer={
        <Button fullWidth isPending={busy} isDisabled={length < FEEDBACK_MIN_LENGTH} onPress={() => void submit()}>
          {busy ? 'Đang gửi...' : 'Gửi góp ý'}
        </Button>
      }
    >
      <div className="space-y-2">
        <TextAreaField
          value={message}
          onChange={setMessage}
          placeholder="Viết góp ý của bạn..."
          rows={6}
          maxLength={FEEDBACK_MAX_LENGTH}
        />
        <p className="text-right text-xs text-muted">
          Tối thiểu {FEEDBACK_MIN_LENGTH}, tối đa {FEEDBACK_MAX_LENGTH} ký tự · {length}/{FEEDBACK_MAX_LENGTH}
        </p>
        <ErrorBox>{error}</ErrorBox>
      </div>
    </Sheet>
  );
}
