import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

/**
 * Small shared form controls for the admin CRUD dialogs. Keeping the input
 * styling here means every maintain form looks the same and stays readable.
 */

export const adminInputClass =
  "w-full rounded-2xl border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary/30";

export function AdminField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{label}</span>
      {children}
      {hint ? <span className="text-xs text-ink-faint">{hint}</span> : null}
    </label>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function AdminTextInput({ label, hint, ...props }: TextInputProps) {
  return (
    <AdminField label={label} hint={hint}>
      <input {...props} className={adminInputClass} />
    </AdminField>
  );
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
};

export function AdminTextArea({ label, hint, ...props }: TextAreaProps) {
  return (
    <AdminField label={label} hint={hint}>
      <textarea {...props} className={adminInputClass} />
    </AdminField>
  );
}

export function AdminCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-2xl border border-line bg-background px-3 py-2 text-sm font-medium text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-primary"
      />
      {label}
    </label>
  );
}
