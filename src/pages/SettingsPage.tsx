import { Button, Label, Switch } from '@heroui/react';
import { ChevronRight, LogOut, MessageSquareHeart, Monitor, Moon, Pencil, Sun } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { FeedbackSheet } from '../components/common/FeedbackSheet';
import { TabPage } from '../components/layout/LargeTitleHeader';
import { Avatar } from '../components/ui/Avatar';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { TextInputField } from '../components/ui/Field';
import { Panel } from '../components/ui/Primitives';
import { APP_VERSION, DISPLAY_NAME_MAX_LENGTH } from '../config/constants';
import { DEFAULT_SETTINGS, type UserSettings } from '../services/user.service';
import { useAuthStore } from '../stores/auth.store';
import { showError, showWarning } from '../utils/toast';

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="mb-2 mt-6 px-5 text-[13px] font-bold text-muted">{children}</p>;
}

function SettingSwitch({
  label,
  hint,
  isSelected,
  onChange,
}: {
  label: string;
  hint: string;
  isSelected: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Switch isSelected={isSelected} onChange={onChange} className="w-full">
      <Switch.Content className="flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-3.5">
        <span className="min-w-0">
          <Label className="text-sm font-medium text-foreground">{label}</Label>
          <span className="block text-xs leading-5 text-muted">{hint}</span>
        </span>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Content>
    </Switch>
  );
}

const THEME_OPTIONS: { value: UserSettings['dark_mode']; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Theo hệ thống', icon: Monitor },
  { value: 'light', label: 'Sáng', icon: Sun },
  { value: 'dark', label: 'Tối', icon: Moon },
];

export default function SettingsPage() {
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const updateSetting = useAuthStore((s) => s.updateSetting);
  const updateDisplayName = useAuthStore((s) => s.updateDisplayName);
  const signOut = useAuthStore((s) => s.signOut);
  const settings = profile?.settings ?? DEFAULT_SETTINGS;

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const toggle = async <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    if (!profile) {
      showWarning('Chưa sẵn sàng', 'Hồ sơ chưa tải xong, vui lòng thử lại.');
      return;
    }
    try {
      await updateSetting(key, value);
    } catch (e) {
      showError(e);
    }
  };

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === profile?.display_name) return;
    setSavingName(true);
    try {
      await updateDisplayName(trimmed);
      setEditingName(false);
    } catch (e) {
      showError(e);
    } finally {
      setSavingName(false);
    }
  };

  return (
    <TabPage title="Cài đặt">

      <SectionTitle>Hồ sơ</SectionTitle>
      <Panel className="mx-4 p-4">
        <div className="flex items-center gap-4">
          <Avatar
            seed={profile?.display_name || user?.email || 'user'}
            label={profile?.display_name}
            photoUrl={profile?.photo_url}
            size={60}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-foreground">{profile?.display_name ?? 'Đang tải...'}</p>
            <p className="truncate text-sm text-muted">{profile?.email ?? user?.email}</p>
          </div>
          {!editingName ? (
            <Button
              isIconOnly
              variant="secondary"
              aria-label="Đổi tên hiển thị"
              isDisabled={!profile}
              onPress={() => {
                setName(profile?.display_name ?? '');
                setEditingName(true);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        {editingName ? (
          <form
            className="mt-4 space-y-3 border-t border-border pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              void saveName();
            }}
          >
            <TextInputField
              label="Tên hiển thị"
              value={name}
              onChange={(v) => setName(v.slice(0, DISPLAY_NAME_MAX_LENGTH))}
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              autoFocus
              labelEnd={<span className="text-xs text-muted">{name.trim().length}/{DISPLAY_NAME_MAX_LENGTH}</span>}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" isDisabled={savingName} onPress={() => setEditingName(false)}>
                Hủy
              </Button>
              <Button
                type="submit"
                isPending={savingName}
                isDisabled={!name.trim() || name.trim() === profile?.display_name}
              >
                {savingName ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </div>
          </form>
        ) : null}
      </Panel>

      <SectionTitle>Tùy chỉnh</SectionTitle>
      <Panel className="mx-4 divide-y divide-border">
        <div className="px-4 py-3.5">
          <p className="text-sm font-medium text-foreground">Giao diện</p>
          <p className="text-xs text-muted">Đồng bộ với app Android của bạn</p>
          <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Giao diện">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
              const active = settings.dark_mode === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => void toggle('dark_mode', value)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition-colors ${
                    active ? 'border-accent bg-primary-soft text-accent' : 'border-border text-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <SettingSwitch
          label="Hiệu ứng chuyển động"
          hint="Tắt nếu máy giật/lag hoặc bạn không thích animation"
          isSelected={settings.animations_enabled}
          onChange={(v) => void toggle('animations_enabled', v)}
        />
      </Panel>

      <SectionTitle>Thông báo</SectionTitle>
      <Panel className="mx-4 divide-y divide-border">
        <SettingSwitch
          label="Hoạt động nhóm"
          hint="Khoản chi mới, sửa/xóa, đóng chuyến đi"
          isSelected={settings.notify_activity}
          onChange={(v) => void toggle('notify_activity', v)}
        />
        <SettingSwitch
          label="Thanh toán"
          hint="Khi có người trả tiền cho bạn hoặc ghi nhận thanh toán"
          isSelected={settings.notify_payment}
          onChange={(v) => void toggle('notify_payment', v)}
        />
        <SettingSwitch
          label="Thành viên"
          hint="Yêu cầu tham gia, được duyệt, đổi vai trò"
          isSelected={settings.notify_member}
          onChange={(v) => void toggle('notify_member', v)}
        />
        <SettingSwitch
          label="Gợi ý thông minh"
          hint="Nhắc thanh toán khi nợ kéo dài"
          isSelected={settings.notify_smart}
          onChange={(v) => void toggle('notify_smart', v)}
        />
      </Panel>
      <p className="mx-4 mt-2 px-1 text-xs leading-5 text-muted">
        Thông báo đẩy (khi đóng app) hiện chỉ có trên app Android. Trên web, thông báo mới hiện ngay khi bạn đang mở trang.
      </p>

      <SectionTitle>Phản hồi</SectionTitle>
      <Panel className="mx-4">
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
            <MessageSquareHeart className="h-5 w-5 text-accent" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">Gửi góp ý</span>
            <span className="block text-xs text-muted">Chia sẻ trải nghiệm hoặc đề xuất tính năng mới</span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted" />
        </button>
      </Panel>

      <div className="mx-4 mt-8">
      <Button fullWidth variant="danger-soft" onPress={() => setLogoutOpen(true)}>
        <LogOut className="h-4 w-4" /> Đăng xuất
      </Button>
      </div>
      <p className="mt-4 text-center text-xs text-muted">Fair Pay web · phiên bản {APP_VERSION}</p>

      <FeedbackSheet isOpen={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <ConfirmDialog
        isOpen={logoutOpen}
        onOpenChange={setLogoutOpen}
        title="Đăng xuất?"
        description="Bạn sẽ đăng xuất khỏi trình duyệt này. App Android không bị ảnh hưởng."
        confirmLabel="Đăng xuất"
        onConfirm={async () => {
          try {
            await signOut();
          } catch (e) {
            showError(e, 'Lỗi đăng xuất');
            throw e;
          }
        }}
      />
    </TabPage>
  );
}
