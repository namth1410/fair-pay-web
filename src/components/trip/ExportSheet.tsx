import { Button, Radio, RadioGroup } from '@heroui/react';
import { Download, FileText, Printer } from 'lucide-react';
import { useState } from 'react';

import { downloadTripHtml, type ExportScope, printTripPdf } from '../../services/export.service';
import type { GroupMember } from '../../services/group.service';
import type { TripExportData } from '../../utils/exportHtml';
import { showValidationError } from '../../utils/toast';
import { InfoBox, Pill, SegmentedTabs } from '../ui/Primitives';
import { Sheet } from '../ui/Sheet';

/** "Xuất PDF diễn giải": cả nhóm hoặc 1 thành viên → hộp thoại In/Lưu PDF của trình duyệt. */
export function ExportSheet({
  isOpen,
  onOpenChange,
  members,
  buildData,
}: {
  isOpen: boolean;
  onOpenChange: (o: boolean) => void;
  members: GroupMember[];
  buildData: () => TripExportData;
}) {
  const [mode, setMode] = useState<'group' | 'person'>('group');
  const [memberId, setMemberId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setMode('group');
      setMemberId(null);
    }
  }

  const scope: ExportScope | null =
    mode === 'group' ? { type: 'group' } : memberId ? { type: 'person', memberId } : null;

  const doPrint = async () => {
    if (!scope) return;
    setBusy(true);
    try {
      await printTripPdf(buildData(), scope);
      onOpenChange(false);
    } catch (e) {
      showValidationError('Không tạo được PDF', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isLocked={busy}
      title="Xuất PDF diễn giải"
      description="Chọn “Lưu dưới dạng PDF” trong hộp thoại in để gửi qua Zalo, email hoặc lưu vào máy."
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row-reverse">
          <Button className="sm:flex-1" isPending={busy} isDisabled={!scope} onPress={() => void doPrint()}>
            <Printer className="h-4 w-4" /> {busy ? 'Đang tạo PDF...' : 'Xuất PDF'}
          </Button>
          <Button
            variant="ghost"
            isDisabled={!scope || busy}
            onPress={() => scope && downloadTripHtml(buildData(), scope)}
          >
            <Download className="h-4 w-4" /> Tải file HTML
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <SegmentedTabs
          ariaLabel="Phạm vi xuất"
          stretch
          value={mode}
          onChange={setMode}
          tabs={[
            { id: 'group', label: 'Cả nhóm' },
            { id: 'person', label: 'Một thành viên' },
          ]}
        />
        {mode === 'group' ? (
          <InfoBox className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              <span className="block font-semibold">Diễn giải cho cả nhóm</span>
              <span className="text-muted">
                Bao gồm danh sách khoản chi, thanh toán đã ghi, số dư từng người và gợi ý quyết toán.
              </span>
            </span>
          </InfoBox>
        ) : (
          <div className="space-y-3">
            <p className="text-sm leading-5 text-muted">
              Chọn người cần xem diễn giải. PDF sẽ ghi rõ từng khoản chi mà họ đã trả hộ hoặc được trả hộ.
            </p>
            <RadioGroup aria-label="Thành viên" value={memberId} onChange={setMemberId} className="gap-1">
              {members.map((m) => (
                <Radio key={m.id} value={m.id}>
                  <Radio.Content className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-surface-secondary">
                    <Radio.Control>
                      <Radio.Indicator />
                    </Radio.Control>
                    <span className="text-sm text-foreground">{m.display_name}</span>
                    {m.is_virtual ? <Pill tone="muted">Thành viên ảo</Pill> : null}
                  </Radio.Content>
                </Radio>
              ))}
            </RadioGroup>
          </div>
        )}
      </div>
    </Sheet>
  );
}
