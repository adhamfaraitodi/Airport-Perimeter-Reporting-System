"use client";

import * as React from "react";

interface PopoverContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function usePopoverContext() {
  const ctx = React.useContext(PopoverContext);
  if (!ctx) {
    throw new Error("Popover components must be used within a <Popover />");
  }
  return ctx;
}

export interface PopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Popover({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  React.useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, setOpen]);

  return (
    <PopoverContext.Provider value={{ open, setOpen, containerRef }}>
      <div
        ref={containerRef}
        data-slot="popover"
        className="relative inline-flex"
      >
        {children}
      </div>
    </PopoverContext.Provider>
  );
}

export interface PopoverTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

function PopoverTrigger({
  asChild = false,
  onClick,
  children,
  ...props
}: PopoverTriggerProps) {
  const { open, setOpen } = usePopoverContext();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (!e.defaultPrevented) {
      setOpen(!open);
    }
  };

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<
      React.HTMLAttributes<HTMLElement> & Record<string, unknown>
    >;
    return React.cloneElement(child, {
      "data-slot": "popover-trigger",
      "data-state": open ? "open" : "closed",
      "aria-expanded": open,
      "aria-haspopup": "dialog",
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        child.props.onClick?.(e);
        if (!e.defaultPrevented) {
          setOpen(!open);
        }
      },
    });
  }

  return (
    <button
      type="button"
      data-slot="popover-trigger"
      data-state={open ? "open" : "closed"}
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
}

export interface PopoverContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

function PopoverContent({
  className = "",
  align = "center",
  sideOffset = 8,
  style,
  children,
  ...props
}: PopoverContentProps) {
  const { open } = usePopoverContext();

  if (!open) return null;

  const alignClass =
    align === "end"
      ? "right-0"
      : align === "start"
        ? "left-0"
        : "left-1/2 -translate-x-1/2";

  return (
    <div
      role="dialog"
      data-slot="popover-content"
      data-state={open ? "open" : "closed"}
      style={{ marginTop: sideOffset, ...style }}
      className={`absolute top-full z-[650] w-80 rounded-2xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-4 text-[var(--rd-text)] shadow-xl outline-none animate-in fade-in-0 zoom-in-95 duration-100 ${alignClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

function PopoverHeader({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="popover-header"
      className={`flex flex-col gap-1 text-sm ${className}`}
      {...props}
    />
  );
}

function PopoverTitle({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      data-slot="popover-title"
      className={`m-0 font-semibold leading-none text-[var(--rd-text)] ${className}`}
      {...props}
    />
  );
}

function PopoverDescription({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="popover-description"
      className={`m-0 text-xs text-[var(--rd-muted)] ${className}`}
      {...props}
    />
  );
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
};
