"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Sparkles } from "lucide-react";
import { useState } from "react";

interface Props {
  onCreated: () => void;
}

const PRIORITY_OPTIONS = [
  { value: "high", label: "高", color: "neon-red" },
  { value: "medium", label: "中", color: "neon-amber" },
  { value: "low", label: "低", color: "neon-green" },
];

const DOMAIN_SUGGESTIONS = ["AI编程", "科技", "创业", "AI产品", "投资", "通用"];

export default function KeywordForm({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    domain: "通用",
    priority: "medium",
    notifyBrowser: true,
    notifyEmail: false,
  });

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setOpen(false);
        setForm({ name: "", domain: "通用", priority: "medium", notifyBrowser: true, notifyEmail: false });
        onCreated();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/50 hover:border-neon-cyan text-sm font-medium text-neon-cyan transition-all"
      >
        <Plus className="w-4 h-4" />
        添加关键词
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !submitting && setOpen(false)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-bg-surface border border-border-default rounded-xl p-6 relative overflow-hidden"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-cyan to-transparent" />

              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-neon-cyan" />
                  <h2 className="text-lg font-bold gradient-text">新增监控关键词</h2>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* 名称 */}
                <div>
                  <label className="block text-xs font-mono text-text-secondary mb-2 uppercase tracking-wider">
                    关键词
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="例如：Claude 4.7"
                    autoFocus
                    className="w-full h-10 px-3 rounded-lg bg-bg-elevated border border-border-default text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-all"
                  />
                </div>

                {/* 领域 */}
                <div>
                  <label className="block text-xs font-mono text-text-secondary mb-2 uppercase tracking-wider">
                    监控领域
                  </label>
                  <input
                    type="text"
                    value={form.domain}
                    onChange={(e) => setForm({ ...form, domain: e.target.value })}
                    placeholder="例如：AI编程"
                    className="w-full h-10 px-3 rounded-lg bg-bg-elevated border border-border-default text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-cyan/50 transition-all mb-2"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {DOMAIN_SUGGESTIONS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setForm({ ...form, domain: d })}
                        className="px-2 py-1 rounded text-[11px] font-mono bg-bg-hover hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-colors"
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 优先级 */}
                <div>
                  <label className="block text-xs font-mono text-text-secondary mb-2 uppercase tracking-wider">
                    优先级
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {PRIORITY_OPTIONS.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setForm({ ...form, priority: p.value })}
                        className={`h-10 rounded-lg border text-sm font-medium transition-all ${
                          form.priority === p.value
                            ? "bg-bg-elevated"
                            : "bg-bg-hover/50 border-border-default text-text-secondary hover:text-text-primary"
                        }`}
                        style={
                          form.priority === p.value
                            ? {
                                borderColor: `var(--${p.color})`,
                                color: `var(--${p.color})`,
                                boxShadow: `0 0 8px var(--${p.color}, transparent)`,
                              }
                            : undefined
                        }
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 通知方式 */}
                <div>
                  <label className="block text-xs font-mono text-text-secondary mb-2 uppercase tracking-wider">
                    命中通知方式
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.notifyBrowser}
                        onChange={(e) => setForm({ ...form, notifyBrowser: e.target.checked })}
                        className="w-4 h-4 rounded accent-neon-cyan"
                      />
                      <span className="text-sm text-text-primary">浏览器实时推送</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.notifyEmail}
                        onChange={(e) => setForm({ ...form, notifyEmail: e.target.checked })}
                        className="w-4 h-4 rounded accent-neon-cyan"
                      />
                      <span className="text-sm text-text-primary">邮件推送</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* 按钮 */}
              <div className="flex gap-3 mt-6 pt-6 border-t border-border-default">
                <button
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                  className="flex-1 h-10 rounded-lg border border-border-default text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !form.name.trim()}
                  className="flex-1 h-10 rounded-lg bg-gradient-to-r from-neon-cyan to-neon-purple text-bg-primary text-sm font-bold transition-all disabled:opacity-50 hover:opacity-90"
                >
                  {submitting ? "添加中..." : "确认添加"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
