import { Description, FieldError, Input, Label, TextArea, TextField } from '@heroui/react';
import type { ReactNode } from 'react';

interface TextInputFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url';
  maxLength?: number;
  error?: string | null;
  description?: ReactNode;
  autoFocus?: boolean;
  autoComplete?: string;
  isDisabled?: boolean;
  name?: string;
  inputMode?: 'text' | 'numeric' | 'email' | 'search' | 'decimal';
  onEnter?: () => void;
  className?: string;
  /** Nội dung đặt bên phải nhãn (vd bộ đếm ký tự). */
  labelEnd?: ReactNode;
  suffix?: ReactNode;
  inputClassName?: string;
}

/** TextField HeroUI + nhãn + lỗi — dùng chung cho mọi form. */
export function TextInputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  maxLength,
  error,
  description,
  autoFocus,
  autoComplete,
  isDisabled,
  name,
  inputMode,
  onEnter,
  className = '',
  labelEnd,
  suffix,
  inputClassName = '',
}: TextInputFieldProps) {
  return (
    <TextField
      className={`w-full ${className}`}
      value={value}
      onChange={onChange}
      isInvalid={!!error}
      isDisabled={isDisabled}
      name={name}
      type={type}
      autoFocus={autoFocus}
      aria-label={label ? undefined : placeholder}
    >
      {label ? (
        <div className="flex items-end justify-between gap-2">
          <Label>{label}</Label>
          {labelEnd}
        </div>
      ) : null}
      <div className="relative">
        <Input
          fullWidth
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete={autoComplete}
          inputMode={inputMode}
          className={`${suffix ? 'pr-10' : ''} ${inputClassName}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onEnter && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onEnter();
            }
          }}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">
            {suffix}
          </span>
        ) : null}
      </div>
      {description && !error ? <Description>{description}</Description> : null}
      <FieldError>{error}</FieldError>
    </TextField>
  );
}

interface TextAreaFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  error?: string | null;
  description?: ReactNode;
  isDisabled?: boolean;
  className?: string;
  labelEnd?: ReactNode;
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 3,
  error,
  description,
  isDisabled,
  className = '',
  labelEnd,
}: TextAreaFieldProps) {
  return (
    <TextField
      className={`w-full ${className}`}
      value={value}
      onChange={onChange}
      isInvalid={!!error}
      isDisabled={isDisabled}
      aria-label={label ? undefined : placeholder}
    >
      {label ? (
        <div className="flex items-end justify-between gap-2">
          <Label>{label}</Label>
          {labelEnd}
        </div>
      ) : null}
      <TextArea fullWidth rows={rows} placeholder={placeholder} maxLength={maxLength} />
      {description && !error ? <Description>{description}</Description> : null}
      <FieldError>{error}</FieldError>
    </TextField>
  );
}
