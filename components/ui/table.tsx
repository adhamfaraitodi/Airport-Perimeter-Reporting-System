import * as React from "react";

function Table({ className = "", ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={`w-full caption-bottom border-collapse text-sm ${className}`}
        {...props}
      />
    </div>
  );
}

function TableHeader({
  className = "",
  ...props
}: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={`border-b border-solid border-[var(--rd-border)] bg-[var(--rd-bg)]/70 [&_tr]:border-b ${className}`}
      {...props}
    />
  );
}

function TableBody({
  className = "",
  ...props
}: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={`divide-y divide-[var(--rd-border)] [&_tr:last-child]:border-0 ${className}`}
      {...props}
    />
  );
}

function TableFooter({
  className = "",
  ...props
}: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={`border-t border-solid border-[var(--rd-border)] bg-[var(--rd-bg)]/50 font-medium [&>tr]:last:border-b-0 ${className}`}
      {...props}
    />
  );
}

function TableRow({ className = "", ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={`border-b border-solid border-[var(--rd-border)] transition-colors hover:bg-[var(--rd-hover)] data-[state=selected]:bg-[var(--rd-active)] ${className}`}
      {...props}
    />
  );
}

function TableHead({ className = "", ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={`h-11 px-4 text-left align-middle text-xs font-semibold tracking-wide text-[var(--rd-muted)] whitespace-nowrap [&:has([role=checkbox])]:pr-0 ${className}`}
      {...props}
    />
  );
}

function TableCell({ className = "", ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={`p-4 align-middle text-sm text-[var(--rd-text)] [&:has([role=checkbox])]:pr-0 ${className}`}
      {...props}
    />
  );
}

function TableCaption({
  className = "",
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={`mt-4 text-xs text-[var(--rd-muted)] ${className}`}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
