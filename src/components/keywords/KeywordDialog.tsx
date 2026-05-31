"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type KeywordDialogMode = "create" | "edit";

export interface KeywordFormValues {
  id?: string;
  name: string;
  domain: string;
  priority: string;
  notifyBrowser: boolean;
  notifyEmail: boolean;
  notifyWechat: boolean;
}

interface Props {
  open: boolean;
  mode: KeywordDialogMode;
  initial?: Partial<KeywordFormValues>;
  onClose: () => void;
  onSaved: () => void;
}

const PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const DOMAIN_SUGGESTIONS = ["AI编程", "科技", "创业", "AI产品", "投资", "通用"];

const DEFAULT_FORM: KeywordFormValues = {
  name: "",
  domain: "通用",
  priority: "medium",
  notifyBrowser: true,
  notifyEmail: false,
  notifyWechat: false,
};

export default function KeywordDialog({
  open,
  mode,
  initial,
  onClose,
  onSaved,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<KeywordFormValues>(DEFAULT_FORM);

  // 打开时把 initial 写入；关闭时重置
  useEffect(() => {
    if (open) {
      setForm({ ...DEFAULT_FORM, ...initial });
    }
  }, [open, initial]);

  const isEdit = mode === "edit";

  const handleSubmit = async () => {
    if (!isEdit && !form.name.trim()) return;
    setSubmitting(true);
    try {
      // 编辑不带 name（设计上 name 不可改）
      const body = isEdit
        ? {
            domain: form.domain,
            priority: form.priority,
            notifyBrowser: form.notifyBrowser,
            notifyEmail: form.notifyEmail,
            notifyWechat: form.notifyWechat,
          }
        : form;
      const res = await fetch(
        isEdit ? `/api/keywords/${form.id}` : "/api/keywords",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (res.ok) {
        onClose();
        onSaved();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !submitting && onClose()}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md card overflow-hidden shadow-lg"
            style={{ boxShadow: "var(--shadow-lg)" }}
          >
            <div className="flex items-center justify-between px-5 h-12 border-b border-border-default">
              <h2 className="text-[14px] font-semibold">
                {isEdit ? "Edit keyword" : "Add keyword"}
              </h2>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <Field label="关键词" required={!isEdit}>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例：Claude 4.7"
                  autoFocus={!isEdit}
                  disabled={isEdit}
                  className={cn(
                    "w-full h-9 px-3 rounded-md bg-bg-elevated border border-border-default text-[13.5px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent-soft transition-all",
                    isEdit && "opacity-60 cursor-not-allowed",
                  )}
                />
                {isEdit && (
                  <p className="mt-1 text-[11px] text-text-muted">
                    如需改名，请删除后重建（历史命中会一并清除）
                  </p>
                )}
              </Field>

              <Field label="监控领域">
                <input
                  type="text"
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  placeholder="例：AI 编程"
                  className="w-full h-9 px-3 rounded-md bg-bg-elevated border border-border-default text-[13.5px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent-soft transition-all mb-2"
                />
                <div className="flex flex-wrap gap-1.5">
                  {DOMAIN_SUGGESTIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setForm({ ...form, domain: d })}
                      className={cn(
                        "px-2 h-6 rounded text-[11px] border transition-colors",
                        form.domain === d
                          ? "border-accent/40 bg-accent-soft text-accent-bright"
                          : "border-border-default text-text-muted hover:text-text-secondary hover:border-border-strong",
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="优先级">
                <div className="grid grid-cols-3 gap-1.5">
                  {PRIORITY_OPTIONS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setForm({ ...form, priority: p.value })}
                      className={cn(
                        "h-9 rounded-md border text-[12.5px] font-medium transition-colors",
                        form.priority === p.value
                          ? "border-accent/40 bg-accent-soft text-accent-bright"
                          : "border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="通知方式">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
                  <Toggle
                    checked={form.notifyBrowser}
                    onChange={(v) => setForm({ ...form, notifyBrowser: v })}
                    label="浏览器推送"
                  />
                  <Toggle
                    checked={form.notifyEmail}
                    onChange={(v) => setForm({ ...form, notifyEmail: v })}
                    label="邮件"
                  />
                  <Toggle
                    checked={form.notifyWechat}
                    onChange={(v) => setForm({ ...form, notifyWechat: v })}
                    label="微信"
                  />
                </div>
              </Field>
            </div>

            <div className="flex gap-2 px-5 py-3 border-t border-border-default bg-bg-surface/40">
              <button
                onClick={onClose}
                disabled={submitting}
                className="flex-1 h-9 rounded-md border border-border-strong text-[12.5px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || (!isEdit && !form.name.trim())}
                className="flex-1 h-9 rounded-md bg-accent text-bg-primary text-[12.5px] font-semibold hover:bg-accent-bright shadow-sm transition-all disabled:opacity-50"
              >
                {submitting ? (isEdit ? "保存中…" : "创建中…") : isEdit ? "保存" : "创建"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11.5px] font-medium text-text-secondary mb-1.5">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 group"
    >
      <span
        className={cn(
          "relative rounded-full transition-colors",
          checked ? "bg-accent" : "bg-bg-active",
        )}
        style={{ height: "18px", width: "32px" }}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-[14px]",
          )}
        />
      </span>
      <span
        className={cn(
          "transition-colors",
          checked ? "text-text-primary" : "text-text-secondary",
        )}
      >
        {label}
      </span>
    </button>
  );
}
