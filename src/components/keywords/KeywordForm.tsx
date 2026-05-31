"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import KeywordDialog from "./KeywordDialog";

interface Props {
  onCreated: () => void;
}

export default function KeywordForm({ onCreated }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent text-bg-primary text-[12.5px] font-medium hover:bg-accent-bright shadow-sm hover:shadow-md transition-all"
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
        Add keyword
      </button>

      <KeywordDialog
        open={open}
        mode="create"
        onClose={() => setOpen(false)}
        onSaved={onCreated}
      />
    </>
  );
}
