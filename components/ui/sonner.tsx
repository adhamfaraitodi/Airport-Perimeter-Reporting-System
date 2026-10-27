"use client";

import { Toaster as Sonner, toast } from "sonner";
import { X } from "lucide-react";
import "sonner/dist/styles.css";

type ToasterProps = React.ComponentProps<typeof Sonner>;

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      richColors
      closeButton
      icons={{ close: <X className="!w-3 !h-3" strokeWidth={2.5} /> }}
      className="toaster group font-['Carlito',sans-serif]"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[var(--rd-surface,#fff)] group-[.toaster]:text-[var(--rd-text,#2b2f33)] group-[.toaster]:border-[var(--rd-border,#e5e9eb)] group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl group-[.toaster]:p-4",
          closeButton:
            "!w-6 !h-6 !min-w-0 !min-h-0 !p-0 !m-0 !leading-none !rounded-full !flex !items-center !justify-center !bg-[var(--rd-bg,#f7f9fa)] !text-[var(--rd-text,#2b2f33)] !border !border-[var(--rd-border,#e5e9eb)] hover:!bg-[var(--rd-hover,#eef1f3)]",
          description: "text-xs !text-[var(--rd-muted,#6b7280)]",
          actionButton:
            "!bg-[var(--rd-primary,#14848d)] !text-white hover:!bg-[var(--rd-primary-hover,#0f6e76)] text-xs font-semibold px-3 py-1.5 rounded-lg",
          cancelButton:
            "!bg-[var(--rd-bg,#f7f9fa)] !text-[var(--rd-text,#2b2f33)] text-xs px-3 py-1.5 rounded-lg",
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
