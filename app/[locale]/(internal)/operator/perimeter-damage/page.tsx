"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  Fence,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  api,
  type SessionUser,
} from "../../../_lib/client-api";
import {
  getDamageCatalogAction,
  createPartAction,
  updatePartAction,
  deletePartAction,
  createDamageAction,
  updateDamageAction,
  deleteDamageAction,
  resetDamageCatalogAction,
  type CatalogPartDto as CatalogPart,
  type DamageItemDto as DamageItem,
} from "./_lib/damage-catalog.actions";
import { slugifyCatalogId } from "./_lib/damage-catalog.types";
import { message } from "../../../_lib/draft-store";
import {
  btnBase,
  btnCancelCoral,
  btnCloseCoral,
  btnDanger,
  btnIcon,
  btnPrimary,
  btnSecondary,
  fieldControl,
  fieldLabel,
  focusRing,
} from "../../../_lib/ui-classes";
import { useTheme } from "../../../_lib/use-theme";
import { AppHeader } from "../../../_components/app-header";
import { DashboardFooter } from "../_components/dashboard-footer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";

type ViewMode = "BY_PART" | "BY_DAMAGE";

interface PartModalState {
  mode: "CREATE" | "EDIT";
  partId?: string;
  name: string;
  damages: DamageItem[];
  newDamageName: string;
  newDamageExclusive: boolean;
}

interface DamageModalState {
  mode: "CREATE" | "EDIT";
  partId: string;
  damageId?: string;
  name: string;
  exclusiveKorosi: boolean;
}

interface DeleteTarget {
  type: "PART" | "DAMAGE";
  partId: string;
  partName: string;
  damageId?: string;
  damageName?: string;
}

export default function PerimeterDamageMasterPage() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale || "id";
  const { theme, dark, toggleTheme } = useTheme();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [parts, setParts] = useState<CatalogPart[]>([]);
  const [actionBusy, setActionBusy] = useState(false);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDamageCatalogAction();
      if (res.success) {
        setParts(res.catalog);
      } else if (res.errorMessage) {
        toast.error(res.errorMessage);
      }
    } catch (e) {
      toast.error(message(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const [viewMode, setViewMode] = useState<ViewMode>("BY_PART");
  const [search, setSearch] = useState("");
  const [partFilter, setPartFilter] = useState("ALL");

  const [partModal, setPartModal] = useState<PartModalState | null>(null);
  const [confirmDiscardPart, setConfirmDiscardPart] = useState(false);

  const [damageModal, setDamageModal] = useState<DamageModalState | null>(null);
  const [confirmDiscardDamage, setConfirmDiscardDamage] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const session = await api.getSession();
        if (!session) {
          window.location.href = `/${locale}/login`;
          return;
        }
        if (session.role !== "OPERATOR") {
          window.location.href = `/${locale}/${
            session.role === "TECHNICIAN" ? "technician" : "reports"
          }`;
          return;
        }
        if (active) setUser(session);
        const res = await getDamageCatalogAction();
        if (active && res.success) {
          setParts(res.catalog);
        }
      } catch (e) {
        if (active) toast.error(message(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [locale]);

  const totalParts = parts.length;
  const totalDamages = parts.reduce((sum, p) => sum + p.damages.length, 0);
  const totalExclusive = parts.reduce(
    (sum, p) => sum + p.damages.filter((d) => Boolean(d.exclusiveGroup)).length,
    0
  );

  const normalizedQuery = search.trim().toLocaleLowerCase("id");

  const filteredParts = parts.filter((part) => {
    if (partFilter !== "ALL" && part.id !== partFilter) return false;
    if (!normalizedQuery) return true;
    const matchPart =
      part.name.toLocaleLowerCase("id").includes(normalizedQuery) ||
      part.id.toLocaleLowerCase("id").includes(normalizedQuery);
    const matchDamage = part.damages.some((d) =>
      d.name.toLocaleLowerCase("id").includes(normalizedQuery)
    );
    return matchPart || matchDamage;
  });

  const flatDamages = parts.flatMap((part) =>
    part.damages.map((damage) => ({
      partId: part.id,
      partName: part.name,
      damage,
    }))
  );

  const filteredFlatDamages = flatDamages.filter((item) => {
    if (partFilter !== "ALL" && item.partId !== partFilter) return false;
    if (!normalizedQuery) return true;
    return (
      item.damage.name.toLocaleLowerCase("id").includes(normalizedQuery) ||
      item.partName.toLocaleLowerCase("id").includes(normalizedQuery) ||
      item.damage.id.toLocaleLowerCase("id").includes(normalizedQuery)
    );
  });

  function openCreatePartModal() {
    setConfirmDiscardPart(false);
    setPartModal({
      mode: "CREATE",
      name: "",
      damages: [{ id: "lainnya", name: "Lainnya" }],
      newDamageName: "",
      newDamageExclusive: false,
    });
  }

  function openEditPartModal(part: CatalogPart) {
    setConfirmDiscardPart(false);
    setPartModal({
      mode: "EDIT",
      partId: part.id,
      name: part.name,
      damages: part.damages.map((d) => ({ ...d })),
      newDamageName: "",
      newDamageExclusive: false,
    });
  }

  function isPartModalDirty(): boolean {
    if (!partModal) return false;
    if (partModal.mode === "CREATE") {
      const defaultDamagesOnly =
        partModal.damages.length === 1 && partModal.damages[0]?.id === "lainnya";
      return (
        partModal.name.trim() !== "" ||
        partModal.newDamageName.trim() !== "" ||
        partModal.newDamageExclusive ||
        !defaultDamagesOnly
      );
    }
    const original = parts.find((p) => p.id === partModal.partId);
    if (!original) return false;
    const damagesChanged =
      partModal.damages.length !== original.damages.length ||
      partModal.damages.some((d, idx) => {
        const orig = original.damages[idx];
        return (
          !orig ||
          d.id !== orig.id ||
          d.name !== orig.name ||
          (d.exclusiveGroup || "") !== (orig.exclusiveGroup || "")
        );
      });
    return (
      partModal.name.trim() !== original.name.trim() ||
      partModal.newDamageName.trim() !== "" ||
      damagesChanged
    );
  }

  function requestClosePartModal() {
    if (isPartModalDirty() && !confirmDiscardPart) {
      setConfirmDiscardPart(true);
      return;
    }
    setConfirmDiscardPart(false);
    setPartModal(null);
  }

  function addDraftDamageInPartModal() {
    if (!partModal) return;
    const trimmed = partModal.newDamageName.trim();
    if (!trimmed) return;
    const baseId = slugifyCatalogId(trimmed) || `kerusakan-${Date.now()}`;
    if (
      partModal.damages.some(
        (d) =>
          d.id === baseId ||
          d.name.toLocaleLowerCase("id") === trimmed.toLocaleLowerCase("id")
      )
    ) {
      toast.error("Jenis kerusakan sudah ada pada bagian ini.");
      return;
    }
    setConfirmDiscardPart(false);
    setPartModal({
      ...partModal,
      damages: [
        ...partModal.damages,
        {
          id: baseId,
          name: trimmed,
          ...(partModal.newDamageExclusive ? { exclusiveGroup: "korosi" } : {}),
        },
      ],
      newDamageName: "",
      newDamageExclusive: false,
    });
  }

  async function handleSavePartModal(e: FormEvent) {
    e.preventDefault();
    if (!partModal || actionBusy) return;
    const cleanedName = partModal.name.trim();
    if (!cleanedName) {
      toast.error("Nama bagian pagar wajib diisi.");
      return;
    }
    if (partModal.damages.length === 0) {
      toast.error("Tambahkan minimal 1 jenis kerusakan untuk bagian pagar ini.");
      return;
    }

    setActionBusy(true);
    try {
      if (partModal.mode === "CREATE") {
        const res = await createPartAction({
          name: cleanedName,
          damages: partModal.damages.map((d) => ({
            name: d.name,
            exclusiveGroup: d.exclusiveGroup,
          })),
        });
        if (res.success && res.part) {
          toast.success("Bagian pagar ditambahkan", {
            description: `"${res.part.name}" beserta ${res.part.damages.length} jenis kerusakan berhasil disimpan.`,
          });
          await loadCatalog();
        } else {
          toast.error(res.errorMessage || "Gagal menambahkan bagian pagar.");
        }
      } else if (partModal.partId) {
        const res = await updatePartAction(partModal.partId, {
          name: cleanedName,
          damages: partModal.damages.map((d) => ({
            id: d.id,
            name: d.name,
            exclusiveGroup: d.exclusiveGroup,
          })),
        });
        if (res.success && res.part) {
          toast.success("Bagian pagar diperbarui", {
            description: `Perubahan pada "${cleanedName}" berhasil disimpan.`,
          });
          await loadCatalog();
        } else {
          toast.error(res.errorMessage || "Gagal memperbarui bagian pagar.");
        }
      }
      setConfirmDiscardPart(false);
      setPartModal(null);
    } catch (err) {
      toast.error(message(err));
    } finally {
      setActionBusy(false);
    }
  }

  function openCreateDamageModal(defaultPartId?: string) {
    const targetPartId =
      defaultPartId ||
      (partFilter !== "ALL" ? partFilter : parts[0]?.id || "");
    if (!targetPartId) {
      toast.error("Buat bagian pagar terlebih dahulu.");
      return;
    }
    setConfirmDiscardDamage(false);
    setDamageModal({
      mode: "CREATE",
      partId: targetPartId,
      name: "",
      exclusiveKorosi: false,
    });
  }

  function openEditDamageModal(partId: string, damage: DamageItem) {
    setConfirmDiscardDamage(false);
    setDamageModal({
      mode: "EDIT",
      partId,
      damageId: damage.id,
      name: damage.name,
      exclusiveKorosi: damage.exclusiveGroup === "korosi",
    });
  }

  function isDamageModalDirty(): boolean {
    if (!damageModal) return false;
    if (damageModal.mode === "CREATE") {
      return damageModal.name.trim() !== "" || damageModal.exclusiveKorosi;
    }
    const part = parts.find((p) => p.id === damageModal.partId);
    const original = part?.damages.find((d) => d.id === damageModal.damageId);
    if (!original) return false;
    return (
      damageModal.name.trim() !== original.name.trim() ||
      damageModal.exclusiveKorosi !== (original.exclusiveGroup === "korosi")
    );
  }

  function requestCloseDamageModal() {
    if (isDamageModalDirty() && !confirmDiscardDamage) {
      setConfirmDiscardDamage(true);
      return;
    }
    setConfirmDiscardDamage(false);
    setDamageModal(null);
  }

  async function handleSaveDamageModal(e: FormEvent) {
    e.preventDefault();
    if (!damageModal || actionBusy) return;
    const cleanedName = damageModal.name.trim();
    if (!cleanedName) {
      toast.error("Nama jenis kerusakan wajib diisi.");
      return;
    }
    const exclusiveGroup = damageModal.exclusiveKorosi ? "korosi" : undefined;
    const targetPart = parts.find((p) => p.id === damageModal.partId);

    setActionBusy(true);
    try {
      if (damageModal.mode === "CREATE") {
        if (
          targetPart?.damages.some(
            (d) =>
              d.name.toLocaleLowerCase("id") ===
              cleanedName.toLocaleLowerCase("id")
          )
        ) {
          toast.error("Jenis kerusakan tersebut sudah terdaftar di bagian ini.");
          setActionBusy(false);
          return;
        }
        const res = await createDamageAction({
          partId: damageModal.partId,
          name: cleanedName,
          exclusiveGroup,
        });
        if (res.success && res.damage) {
          toast.success("Jenis kerusakan ditambahkan", {
            description: `"${cleanedName}" ditambahkan ke bagian ${targetPart?.name || ""}.`,
          });
          await loadCatalog();
        } else {
          toast.error(res.errorMessage || "Gagal menambahkan jenis kerusakan.");
        }
      } else if (damageModal.damageId) {
        const res = await updateDamageAction(damageModal.partId, damageModal.damageId, {
          name: cleanedName,
          exclusiveGroup,
        });
        if (res.success && res.damage) {
          toast.success("Jenis kerusakan diperbarui", {
            description: `"${cleanedName}" pada ${targetPart?.name || ""} berhasil diperbarui.`,
          });
          await loadCatalog();
        } else {
          toast.error(res.errorMessage || "Gagal memperbarui jenis kerusakan.");
        }
      }
      setConfirmDiscardDamage(false);
      setDamageModal(null);
    } catch (err) {
      toast.error(message(err));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || actionBusy) return;
    setActionBusy(true);
    try {
      if (deleteTarget.type === "PART") {
        const res = await deletePartAction(deleteTarget.partId);
        if (res.success) {
          if (partFilter === deleteTarget.partId) {
            setPartFilter("ALL");
          }
          toast.success("Bagian pagar dihapus", {
            description: `"${deleteTarget.partName}" telah dihapus dari daftar data master.`,
          });
          await loadCatalog();
        } else {
          toast.error(res.errorMessage || "Gagal menghapus bagian pagar.");
        }
      } else if (deleteTarget.damageId) {
        const res = await deleteDamageAction(deleteTarget.partId, deleteTarget.damageId);
        if (res.success) {
          toast.success("Jenis kerusakan dihapus", {
            description: `"${deleteTarget.damageName}" dihapus dari ${deleteTarget.partName}.`,
          });
          await loadCatalog();
        } else {
          toast.error(res.errorMessage || "Gagal menghapus jenis kerusakan.");
        }
      }
    } catch (err) {
      toast.error(message(err));
    } finally {
      setActionBusy(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div
      className="operator-dashboard flex min-h-dvh flex-col bg-[var(--rd-bg)] text-[var(--rd-text)]"
      data-theme={theme}
    >
      <AppHeader
        user={user}
        dark={dark}
        onToggleTheme={toggleTheme}
        roleLabel="Operator perimeter"
        containerClassName="max-w-[1700px] min-[1100px]:px-[5%]"
      />

      <main className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col px-3 pt-4 md:px-[3%] md:pt-6 min-[1100px]:px-[5%]">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="mb-3 flex items-center gap-2 text-xs md:text-[13px]"
        >
          <Link
            href={`/${locale}/operator`}
            className="text-[var(--rd-muted)] transition-colors hover:text-[var(--rd-link)]"
          >
            Dashboard
          </Link>
          <span className="text-[var(--rd-muted)]/50 select-none">/</span>
          <span className="font-medium text-[var(--rd-link)]">
            Kerusakan Perimeter
          </span>
        </nav>

        {/* Page Title & Actions */}
        <div className="mb-5 flex flex-col justify-between gap-3 px-1.5 sm:flex-row sm:items-end md:mb-6 md:px-0">
          <div>
            <h1 className="m-0 mb-1.5 text-xl leading-tight font-normal sm:text-3xl">
              Data Master Kerusakan Perimeter,
            </h1>
            <p className="m-0 text-xs text-[var(--rd-muted)] sm:text-sm">
              Kelola bagian pagar perimeter dan daftar klasifikasi jenis
              kerusakan untuk formulir pelaporan petugas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openCreateDamageModal()}
              className={btnSecondary}
            >
              <Plus size={16} aria-hidden="true" />
              <span>Tambah Jenis Kerusakan</span>
            </button>
            <button
              type="button"
              onClick={openCreatePartModal}
              className={btnPrimary}
            >
              <Plus size={16} aria-hidden="true" />
              <span>Tambah Bagian Pagar</span>
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-5 grid grid-cols-3 gap-2.5 sm:gap-4 md:mb-6">
          <div className="rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] px-2.5 py-2.5 sm:flex sm:items-center sm:gap-3.5 sm:rounded-[14px] sm:p-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--rd-active)] text-[var(--rd-link)] sm:size-11 sm:rounded-xl">
              <Fence className="size-[18px] sm:size-[22px]" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="mt-2 block text-[10px] min-[390px]:text-[11px] leading-tight text-[var(--rd-muted)] sm:mt-0 sm:text-xs">
                <span className="sm:hidden">Bagian Pagar</span>
                <span className="hidden sm:inline">Bagian Pagar Perimeter</span>
              </span>
              {loading ? (
                <Skeleton className="mt-2 h-[25px] w-10 rounded-md sm:mt-1 sm:h-6 sm:w-20" />
              ) : (
                <strong className="mt-2 block px-0.5 text-xl font-semibold leading-tight text-[var(--rd-text)] sm:mt-0 sm:px-0">
                  {totalParts}{" "}
                  <span className="hidden text-xs font-normal text-[var(--rd-muted)] sm:inline">
                    bagian
                  </span>
                </strong>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] px-2.5 py-2.5 sm:flex sm:items-center sm:gap-3.5 sm:rounded-[14px] sm:p-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--rd-active)] text-[var(--rd-link)] sm:size-11 sm:rounded-xl">
              <Wrench className="size-[18px] sm:size-[21px]" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="mt-2 block text-[10px] min-[390px]:text-[11px] leading-tight text-[var(--rd-muted)] sm:mt-0 sm:text-xs">
                <span className="sm:hidden">Jenis Kerusakan</span>
                <span className="hidden sm:inline">Total Jenis Kerusakan</span>
              </span>
              {loading ? (
                <Skeleton className="mt-2 h-[25px] w-10 rounded-md sm:mt-1 sm:h-6 sm:w-24" />
              ) : (
                <strong className="mt-2 block px-0.5 text-xl font-semibold leading-tight text-[var(--rd-text)] sm:mt-0 sm:px-0">
                  {totalDamages}{" "}
                  <span className="hidden text-xs font-normal text-[var(--rd-muted)] sm:inline">
                    klasifikasi
                  </span>
                </strong>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] px-2.5 py-2.5 sm:flex sm:items-center sm:gap-3.5 sm:rounded-[14px] sm:p-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--rd-brown)]/15 text-[var(--rd-brown)] sm:size-11 sm:rounded-xl">
              <ShieldAlert className="size-[18px] sm:size-[21px]" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="mt-2 block text-[10px] min-[390px]:text-[11px] leading-tight text-[var(--rd-muted)] sm:mt-0 sm:text-xs">
                <span className="sm:hidden">Grup Eksklusif</span>
                <span className="hidden sm:inline">Opsi Grup Eksklusif (Korosi)</span>
              </span>
              {loading ? (
                <Skeleton className="mt-2 h-[25px] w-10 rounded-md sm:mt-1 sm:h-6 sm:w-28" />
              ) : (
                <strong className="mt-2 block px-0.5 text-xl font-semibold leading-tight text-[var(--rd-text)] sm:mt-0 sm:px-0">
                  {totalExclusive}{" "}
                  <span className="hidden text-xs font-normal text-[var(--rd-muted)] sm:inline">
                    opsi tingkat korosi
                  </span>
                </strong>
              )}
            </div>
          </div>
        </div>

        {/* Main Table Card */}
        <section
          aria-label="Tabel Data Master Kerusakan Perimeter"
          className="flex flex-1 flex-col overflow-hidden rounded-[14px] border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)]"
        >
          {/* Toolbar: View Switcher, Part Filter, Search */}
          <div className="flex flex-col gap-3 border-b border-solid border-[var(--rd-border)] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div
                role="tablist"
                aria-label="Mode tampilan tabel"
                className="inline-flex max-w-full overflow-x-auto rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] p-1 scrollbar-none"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "BY_PART"}
                  onClick={() => setViewMode("BY_PART")}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${focusRing} ${
                    viewMode === "BY_PART"
                      ? "bg-[var(--rd-surface)] text-[var(--rd-link)] shadow-xs"
                      : "text-[var(--rd-muted)] hover:text-[var(--rd-text)]"
                  }`}
                >
                  <Fence size={15} aria-hidden="true" />
                  <span>Per Bagian Pagar ({parts.length})</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "BY_DAMAGE"}
                  onClick={() => setViewMode("BY_DAMAGE")}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${focusRing} ${
                    viewMode === "BY_DAMAGE"
                      ? "bg-[var(--rd-surface)] text-[var(--rd-link)] shadow-xs"
                      : "text-[var(--rd-muted)] hover:text-[var(--rd-text)]"
                  }`}
                >
                  <Wrench size={15} aria-hidden="true" />
                  <span>Semua Jenis Kerusakan ({totalDamages})</span>
                </button>
              </div>

              {/* Filter by Bagian Pagar */}
              <select
                aria-label="Filter bagian pagar"
                value={partFilter}
                onChange={(e) => setPartFilter(e.target.value)}
                className={`min-h-9 rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] px-3 py-1.5 text-xs font-medium text-[var(--rd-text)] ${focusRing}`}
              >
                <option value="ALL">Semua Bagian Pagar</option>
                {parts.map((part) => (
                  <option key={part.id} value={part.id}>
                    {part.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <label className="flex w-full items-center gap-2 rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] px-3 lg:max-w-xs focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--rd-link)]">
              <Search
                size={16}
                className="shrink-0 text-[var(--rd-muted)]"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Cari bagian pagar atau jenis kerusakan"
                placeholder="Cari bagian pagar atau kerusakan…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent py-2 text-xs text-[var(--rd-text)] outline-none placeholder:text-[var(--rd-muted)] sm:text-sm"
              />
            </label>
          </div>

          {/* Table Content */}
          {viewMode === "BY_PART" ? (
            <Table className="min-w-[680px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 text-center">No</TableHead>
                  <TableHead className="w-64">Bagian Pagar Perimeter</TableHead>
                  <TableHead>Daftar Jenis Kerusakan</TableHead>
                  <TableHead className="w-32 text-center">Total Opsi</TableHead>
                  <TableHead className="w-36 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [0, 1, 2].map((index) => (
                    <TableRow key={index}>
                      <TableCell className="text-center">
                        <Skeleton className="mx-auto h-4 w-6 rounded" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="mb-1.5 h-4 w-40 rounded" />
                        <Skeleton className="h-3 w-24 rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          <Skeleton className="h-6 w-24 rounded-lg" />
                          <Skeleton className="h-6 w-28 rounded-lg" />
                          <Skeleton className="h-6 w-20 rounded-lg" />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Skeleton className="mx-auto h-5 w-16 rounded-full" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex justify-end gap-1.5">
                          <Skeleton className="size-8 rounded-lg" />
                          <Skeleton className="size-8 rounded-lg" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <>
                    {filteredParts.map((part, index) => {
                      const sortedDamages = [...part.damages].sort((a, b) => {
                        const aOther = a.name.trim().toLowerCase().startsWith("lainnya");
                        const bOther = b.name.trim().toLowerCase().startsWith("lainnya");
                        if (aOther && !bOther) return 1;
                        if (!aOther && bOther) return -1;
                        return a.name.localeCompare(b.name, "id");
                      });
                      return (
                        <TableRow key={part.id}>
                          <TableCell className="text-center font-medium text-[var(--rd-muted)]">
                            {index + 1}
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="font-semibold text-[var(--rd-text)]">
                              {part.name}
                            </div>
                            <span className="mt-0.5 inline-block font-mono text-[11px] text-[var(--rd-muted)]">
                              ID: {part.id}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {sortedDamages.map((damage) => (
                                <span
                                  key={damage.id}
                                  className="group inline-flex items-center gap-1.5 rounded-lg border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] px-2.5 py-1 text-xs font-medium text-[var(--rd-text)] transition-colors hover:border-[var(--rd-primary)]/40 hover:bg-[var(--rd-hover)]"
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEditDamageModal(part.id, damage)
                                    }
                                    title="Klik untuk ubah jenis kerusakan ini"
                                    className={`inline-flex items-center gap-1.5 text-left ${focusRing}`}
                                  >
                                    <span>{damage.name}</span>
                                    {damage.exclusiveGroup && (
                                      <span
                                        title="Grup eksklusif: hanya satu opsi korosi dapat dipilih per bagian"
                                        className="rounded bg-[var(--rd-brown)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--rd-brown)]"
                                      >
                                        {damage.exclusiveGroup}
                                      </span>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDeleteTarget({
                                        type: "DAMAGE",
                                        partId: part.id,
                                        partName: part.name,
                                        damageId: damage.id,
                                        damageName: damage.name,
                                      })
                                    }
                                    aria-label={`Hapus ${damage.name} dari ${part.name}`}
                                    title="Hapus jenis kerusakan"
                                    className="ml-0.5 rounded p-0.5 text-[var(--rd-muted)] transition-colors hover:bg-[var(--rd-coral)]/15 hover:text-[var(--rd-coral)]"
                                  >
                                    <X size={12} aria-hidden="true" />
                                  </button>
                                </span>
                              ))}

                              <button
                                type="button"
                                onClick={() => openCreateDamageModal(part.id)}
                                className={`inline-flex items-center gap-1 rounded-lg border border-dashed border-[var(--rd-primary)]/50 bg-[var(--rd-active)]/50 px-2.5 py-1 text-xs font-semibold text-[var(--rd-link)] transition-colors hover:bg-[var(--rd-active)] ${focusRing}`}
                              >
                                <Plus size={13} aria-hidden="true" />
                                <span>Tambah</span>
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center rounded-full bg-[var(--rd-active)] px-2.5 py-0.5 text-xs font-semibold text-[var(--rd-link)]">
                              {part.damages.length} jenis
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditPartModal(part)}
                                className={btnIcon}
                                title={`Ubah ${part.name}`}
                                aria-label={`Ubah ${part.name}`}
                              >
                                <Pencil size={16} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteTarget({
                                    type: "PART",
                                    partId: part.id,
                                    partName: part.name,
                                  })
                                }
                                className={`${btnIcon} hover:!bg-[var(--rd-coral)]/15 hover:!text-[var(--rd-coral)]`}
                                title={`Hapus ${part.name}`}
                                aria-label={`Hapus ${part.name}`}
                              >
                                <Trash2 size={16} aria-hidden="true" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredParts.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-12 text-center text-[var(--rd-muted)]"
                        >
                          Tidak ada bagian pagar yang cocok dengan filter pencarian.
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          ) : (
            <Table className="min-w-[680px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 text-center">No</TableHead>
                  <TableHead>Jenis Kerusakan</TableHead>
                  <TableHead>Bagian Pagar Perimeter</TableHead>
                  <TableHead className="w-48">Aturan Pilihan</TableHead>
                  <TableHead className="w-36 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [0, 1, 2].map((index) => (
                    <TableRow key={index}>
                      <TableCell className="text-center">
                        <Skeleton className="mx-auto h-4 w-6 rounded" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="mb-1.5 h-4 w-36 rounded" />
                        <Skeleton className="h-3 w-20 rounded" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-36 rounded-lg" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-32 rounded-full" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex justify-end gap-1.5">
                          <Skeleton className="size-8 rounded-lg" />
                          <Skeleton className="size-8 rounded-lg" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <>
                    {filteredFlatDamages.map((item, index) => (
                      <TableRow key={`${item.partId}:${item.damage.id}`}>
                        <TableCell className="text-center font-medium text-[var(--rd-muted)]">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-[var(--rd-text)]">
                            {item.damage.name}
                          </div>
                          <span className="font-mono text-[11px] text-[var(--rd-muted)]">
                            ID: {item.damage.id}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] px-2.5 py-1 text-xs font-medium text-[var(--rd-text)]">
                            <Fence
                              size={13}
                              className="text-[var(--rd-link)]"
                              aria-hidden="true"
                            />
                            {item.partName}
                          </span>
                        </TableCell>
                        <TableCell>
                          {item.damage.exclusiveGroup ? (
                            <span className="inline-flex items-center rounded-full bg-[var(--rd-brown)]/15 px-2.5 py-0.5 text-xs font-semibold text-[var(--rd-brown)]">
                              Eksklusif ({item.damage.exclusiveGroup})
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--rd-muted)]">
                              Pilihan majemuk (bebas)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                openEditDamageModal(item.partId, item.damage)
                              }
                              className={btnIcon}
                              title={`Ubah ${item.damage.name}`}
                              aria-label={`Ubah ${item.damage.name}`}
                            >
                              <Pencil size={16} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  type: "DAMAGE",
                                  partId: item.partId,
                                  partName: item.partName,
                                  damageId: item.damage.id,
                                  damageName: item.damage.name,
                                })
                              }
                              className={`${btnIcon} hover:!bg-[var(--rd-coral)]/15 hover:!text-[var(--rd-coral)]`}
                              title={`Hapus ${item.damage.name}`}
                              aria-label={`Hapus ${item.damage.name}`}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredFlatDamages.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-12 text-center text-[var(--rd-muted)]"
                        >
                          Tidak ada jenis kerusakan yang cocok dengan filter
                          pencarian.
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          )}
        </section>

        <DashboardFooter />
      </main>

      {/* Modal: Create / Edit Bagian Pagar Perimeter */}
      {partModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="part-modal-title"
          className="fixed inset-0 z-[700] grid place-items-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestClosePartModal();
          }}
        >
          <div className="my-auto w-full max-w-lg rounded-2xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-5 text-[var(--rd-text)] shadow-xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 id="part-modal-title" className="m-0 text-lg font-semibold">
                {partModal.mode === "CREATE"
                  ? "Tambah Bagian Pagar Perimeter"
                  : "Kelola Bagian Pagar Perimeter"}
              </h2>
              <button
                type="button"
                onClick={requestClosePartModal}
                className={btnCloseCoral}
                aria-label="Tutup dialog"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSavePartModal}>
              <label className={fieldLabel}>
                Nama Bagian Pagar
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pintu Darurat / Gate Perimeter"
                  value={partModal.name}
                  onChange={(e) => {
                    setConfirmDiscardPart(false);
                    setPartModal({ ...partModal, name: e.target.value });
                  }}
                  className={fieldControl}
                />
              </label>

              <div className="mb-4">
                <span className="mb-2 block text-xs font-semibold">
                  Daftar Jenis Kerusakan ({partModal.damages.length})
                </span>
                <div className="mb-3 flex flex-wrap gap-1.5 rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] p-3">
                  {partModal.damages.map((d) => (
                    <span
                      key={d.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] px-2.5 py-1 text-xs font-medium"
                    >
                      <span>{d.name}</span>
                      {d.exclusiveGroup && (
                        <span className="rounded bg-[var(--rd-brown)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--rd-brown)]">
                          {d.exclusiveGroup}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDiscardPart(false);
                          setPartModal({
                            ...partModal,
                            damages: partModal.damages.filter(
                              (item) => item.id !== d.id
                            ),
                          });
                        }}
                        className="rounded p-0.5 text-[var(--rd-muted)] transition-colors hover:bg-[var(--rd-coral)]/15 hover:text-[var(--rd-coral)]"
                        aria-label={`Hapus ${d.name}`}
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  {partModal.damages.length === 0 && (
                    <span className="text-xs text-[var(--rd-muted)]">
                      Belum ada jenis kerusakan ditambahkan.
                    </span>
                  )}
                </div>

                {/* Add new damage inside part modal */}
                <div className="flex flex-col gap-2 rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)]/50 p-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ketik jenis kerusakan baru (mis. Engsel patah)…"
                      value={partModal.newDamageName}
                      onChange={(e) => {
                        setConfirmDiscardPart(false);
                        setPartModal({
                          ...partModal,
                          newDamageName: e.target.value,
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addDraftDamageInPartModal();
                        }
                      }}
                      className="min-h-9 flex-1 rounded-lg border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] px-3 py-1.5 text-xs text-[var(--rd-text)] placeholder:text-[var(--rd-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-link)]"
                    />
                    <button
                      type="button"
                      onClick={addDraftDamageInPartModal}
                      className={btnSecondary}
                    >
                      <Plus size={15} aria-hidden="true" />
                      <span>Tambah</span>
                    </button>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[var(--rd-muted)]">
                    <input
                      type="checkbox"
                      checked={partModal.newDamageExclusive}
                      onChange={(e) => {
                        setConfirmDiscardPart(false);
                        setPartModal({
                          ...partModal,
                          newDamageExclusive: e.target.checked,
                        });
                      }}
                      className="size-4 accent-[var(--rd-primary)]"
                    />
                    <span>
                      Termasuk grup eksklusif <strong>korosi</strong> (hanya
                      bisa dipilih salah satu tingkat korosi)
                    </span>
                  </label>
                </div>
              </div>

              {confirmDiscardPart && (
                <div
                  role="alert"
                  className="mb-4 rounded-xl border border-solid border-[var(--rd-coral)]/40 bg-[var(--rd-coral)]/10 p-3 text-xs leading-relaxed text-[var(--rd-text)]"
                >
                  <strong className="block font-semibold text-[var(--rd-coral)]">
                    Batalkan perubahan bagian pagar?
                  </strong>
                  <span className="text-[var(--rd-muted)]">
                    Data yang sudah Anda isi belum disimpan dan akan hilang
                    jika dialog ditutup.
                  </span>
                  <div className="mt-2.5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDiscardPart(false)}
                      className={`${btnBase} min-h-8 rounded-lg border-[var(--rd-border)] bg-[var(--rd-surface)] px-3 py-1 text-xs text-[var(--rd-text)] hover:bg-[var(--rd-hover)]`}
                    >
                      Lanjut Mengisi
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDiscardPart(false);
                        setPartModal(null);
                      }}
                      className={`${btnBase} min-h-8 rounded-lg bg-[var(--rd-coral)] px-3 py-1 text-xs text-white hover:brightness-95`}
                    >
                      Ya, Batalkan
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={requestClosePartModal}
                  className={btnCancelCoral}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className={`${btnPrimary} disabled:opacity-50`}
                >
                  {actionBusy ? "Menyimpan…" : "Simpan Bagian Pagar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Jenis Kerusakan */}
      {damageModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="damage-modal-title"
          className="fixed inset-0 z-[700] grid place-items-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestCloseDamageModal();
          }}
        >
          <div className="my-auto w-full max-w-md rounded-2xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-5 text-[var(--rd-text)] shadow-xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 id="damage-modal-title" className="m-0 text-lg font-semibold">
                {damageModal.mode === "CREATE"
                  ? "Tambah Jenis Kerusakan"
                  : "Ubah Jenis Kerusakan"}
              </h2>
              <button
                type="button"
                onClick={requestCloseDamageModal}
                className={btnCloseCoral}
                aria-label="Tutup dialog"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveDamageModal}>
              <label className={fieldLabel}>
                Bagian Pagar Perimeter
                <select
                  value={damageModal.partId}
                  disabled={damageModal.mode === "EDIT"}
                  onChange={(e) => {
                    setConfirmDiscardDamage(false);
                    setDamageModal({ ...damageModal, partId: e.target.value });
                  }}
                  className={`${fieldControl} disabled:opacity-60`}
                >
                  {parts.map((part) => (
                    <option key={part.id} value={part.id}>
                      {part.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={fieldLabel}>
                Nama Jenis Kerusakan
                <input
                  type="text"
                  required
                  placeholder="Contoh: Berlubang / Miring / Klem terlepas"
                  value={damageModal.name}
                  onChange={(e) => {
                    setConfirmDiscardDamage(false);
                    setDamageModal({ ...damageModal, name: e.target.value });
                  }}
                  className={fieldControl}
                />
              </label>

              <label className="mb-5 flex cursor-pointer items-start gap-2.5 rounded-xl border border-solid border-[var(--rd-border)] bg-[var(--rd-bg)] p-3 text-xs leading-relaxed">
                <input
                  type="checkbox"
                  checked={damageModal.exclusiveKorosi}
                  onChange={(e) => {
                    setConfirmDiscardDamage(false);
                    setDamageModal({
                      ...damageModal,
                      exclusiveKorosi: e.target.checked,
                    });
                  }}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--rd-primary)]"
                />
                <span>
                  <strong className="block text-[var(--rd-text)]">
                    Grup Eksklusif Tingkat Korosi
                  </strong>
                  <span className="text-[var(--rd-muted)]">
                    Aktifkan jika kerusakan ini adalah tingkatan korosi (misal:
                    Berkarat sedang / Berkarat berat) agar pelapor hanya memilih
                    salah satu.
                  </span>
                </span>
              </label>

              {confirmDiscardDamage && (
                <div
                  role="alert"
                  className="mb-4 rounded-xl border border-solid border-[var(--rd-coral)]/40 bg-[var(--rd-coral)]/10 p-3 text-xs leading-relaxed text-[var(--rd-text)]"
                >
                  <strong className="block font-semibold text-[var(--rd-coral)]">
                    Batalkan pengisian jenis kerusakan?
                  </strong>
                  <span className="text-[var(--rd-muted)]">
                    Data yang sudah Anda isi belum disimpan dan akan hilang
                    jika dialog ditutup.
                  </span>
                  <div className="mt-2.5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDiscardDamage(false)}
                      className={`${btnBase} min-h-8 rounded-lg border-[var(--rd-border)] bg-[var(--rd-surface)] px-3 py-1 text-xs text-[var(--rd-text)] hover:bg-[var(--rd-hover)]`}
                    >
                      Lanjut Mengisi
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDiscardDamage(false);
                        setDamageModal(null);
                      }}
                      className={`${btnBase} min-h-8 rounded-lg bg-[var(--rd-coral)] px-3 py-1 text-xs text-white hover:brightness-95`}
                    >
                      Ya, Batalkan
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={requestCloseDamageModal}
                  className={btnCancelCoral}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className={`${btnPrimary} disabled:opacity-50`}
                >
                  {actionBusy ? "Menyimpan…" : "Simpan Jenis Kerusakan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          className="fixed inset-0 z-[700] grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-5 text-[var(--rd-text)] shadow-xl sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 text-[var(--rd-coral)]">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--rd-coral)]/15">
                  <AlertTriangle size={20} aria-hidden="true" />
                </span>
                <h2 id="delete-modal-title" className="m-0 text-base font-semibold">
                  {deleteTarget.type === "PART"
                    ? "Hapus Bagian Pagar?"
                    : "Hapus Jenis Kerusakan?"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className={btnCloseCoral}
                aria-label="Tutup dialog"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="m-0 mb-5 text-xs leading-relaxed text-[var(--rd-muted)] sm:text-sm">
              {deleteTarget.type === "PART" ? (
                <>
                  Bagian pagar{" "}
                  <strong className="text-[var(--rd-text)]">
                    {deleteTarget.partName}
                  </strong>{" "}
                  beserta seluruh jenis kerusakan di dalamnya akan dihapus dari
                  daftar pilihan pelaporan.
                </>
              ) : (
                <>
                  Jenis kerusakan{" "}
                  <strong className="text-[var(--rd-text)]">
                    {deleteTarget.damageName}
                  </strong>{" "}
                  pada bagian{" "}
                  <strong className="text-[var(--rd-text)]">
                    {deleteTarget.partName}
                  </strong>{" "}
                  akan dihapus.
                </>
              )}
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setDeleteTarget(null)}
                className={btnCancelCoral}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={handleConfirmDelete}
                className={`${btnDanger} disabled:opacity-50`}
              >
                {actionBusy ? "Menghapus…" : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reset Confirmation */}
      {confirmReset && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
          className="fixed inset-0 z-[700] grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmReset(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-solid border-[var(--rd-border)] bg-[var(--rd-surface)] p-5 text-[var(--rd-text)] shadow-xl sm:p-6">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 id="reset-modal-title" className="m-0 text-base font-semibold">
                Kembalikan Data Master Bawaan?
              </h2>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className={btnCloseCoral}
                aria-label="Tutup dialog"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="m-0 mb-5 text-xs leading-relaxed text-[var(--rd-muted)] sm:text-sm">
              Seluruh bagian pagar perimeter dan jenis kerusakan akan
              dikembalikan ke konfigurasi awal sistem.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className={btnCancelCoral}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={async () => {
                  setActionBusy(true);
                  try {
                    const res = await resetDamageCatalogAction();
                    if (res.success) {
                      setParts(res.catalog);
                      toast.success("Data master dikembalikan ke setelan bawaan.");
                    } else {
                      toast.error(res.errorMessage || "Gagal mengembalikan data master.");
                    }
                  } catch (err) {
                    toast.error(message(err));
                  } finally {
                    setActionBusy(false);
                    setConfirmReset(false);
                  }
                }}
                className={btnPrimary}
              >
                Ya, Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
