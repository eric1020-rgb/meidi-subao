"use client";

import type { AppSettings } from "@/lib/types";

interface Props {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
  open: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ settings, onChange, open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-card border border-white/10 bg-surface-2 p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">設定 · Settings</h2>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink">
            ✕
          </button>
        </div>

        <Field label="漲跌色 · Color convention">
          <Seg
            value={settings.colorScheme}
            options={[
              { value: "us", label: "US (綠漲紅跌)" },
              { value: "tw", label: "TW (紅漲綠跌)" },
            ]}
            onChange={(v) => onChange({ colorScheme: v as AppSettings["colorScheme"] })}
          />
        </Field>

        <Field label="主題 · Theme">
          <Seg
            value={settings.theme}
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
            ]}
            onChange={(v) => onChange({ theme: v as AppSettings["theme"] })}
          />
        </Field>

        <Field label="字級 · Font size">
          <Seg
            value={settings.fontSize}
            options={[
              { value: "sm", label: "S" },
              { value: "md", label: "M" },
              { value: "lg", label: "L" },
            ]}
            onChange={(v) => onChange({ fontSize: v as AppSettings["fontSize"] })}
          />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 text-xs text-ink-muted">{label}</div>
      {children}
    </div>
  );
}

function Seg({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-surface-3 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
            value === o.value ? "bg-white/15 text-ink" : "text-ink-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
