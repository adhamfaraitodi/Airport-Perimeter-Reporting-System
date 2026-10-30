# context project
Airport Perimeter Fence Reporting System is a location-based reporting application designed to document damaged perimeter fences and other issues found around the airport perimeter.

Authorized users can log in and submit reports containing photos and a description of the identified issue. Each report automatically records the reporter's GPS location along with the submitted information. The collected reports are then visualized on an airport map using location markers, allowing users to identify where each issue was reported and review its details.

# user roles
- `REPORTER` (basic user): membuat laporan dengan foto, deskripsi, dan lokasi GPS.
- Melihat status dan detail laporan yang telah di submit.
- `OPERATOR`: melihat peta laporan dengan indikator lokasi bermasalah (hot location indicator).
- Reporter memiliki daftar laporan miliknya dan dapat melihat status masing-masing laporan, termasuk laporan yang ditutup operator.
- Hanya operator yang dapat menghapus/menutup laporan melalui soft delete (`CLOSED`) dengan narasi alasan dan minimal satu foto wajib; data dan foto tidak dihapus secara fisik.
- Tugas operator nantinya mengatur beberapa data di website seperti jenis kerusakan, detail kerusakan.
- Tugas operator hanya dapat menutup/menghapus laporan bodong, dan mostly hanya sebagai pengamat.
- `TECHNICIAN`: melihat peta laporan dengan indikator lokasi bermasalah (hot location indicator) dan memperbarui status penanganan laporan.
- Memiliki kemampuan untuk memberikan update penanganan laporan, dengan memberikan narasi dan foto bukti telah dikerjakan/ditangani.

# authentication dengan better-auth
- Login menggunakan Nomor Induk Pekerja (NIP) dan password.
- Database menggunakan PostgreSQL native dengan Drizzle ORM.
- Data user yang disimpan mencakup NIP, nama, avatar, role (`REPORTER`, `OPERATOR`, `TECHNICIAN`), dan metadata autentikasi Better-Auth.
- Endpoint auth Next.js disajikan melalui App Router (e.g. `/api/auth/[...all]`).
- Session dan akses role dilindungi melalui middleware dan server-side session validation.

# project directory & route architecture (feature-colocated + i18n)
Gunakan struktur berbasis fitur (*feature-colocated*) di dalam dynamic segment `app/[locale]/` agar mudah dikembangkan dan siap untuk multi-bahasa (i18n).

Contoh pola standar untuk setiap modul fitur:
```text
app/[locale]/(internal)/reports/
├── page.tsx                      # Route entry point
├── layout.tsx                    # Route-specific layout
├── loading.tsx                   # Suspense loading UI
├── _components/                  # Route-specific UI components
│   ├── report-list.tsx
│   ├── create-report-dialog.tsx
│   ├── update-status-dialog.tsx
│   └── close-report-dialog.tsx
├── _lib/                         # Route-specific logic & separation of concerns
│   ├── reports.loader.ts         # Server-side data fetching (read queries)
│   ├── reports.actions.ts        # Server Actions (thin wrapper: auth + validation + call service)
│   ├── reports.service.ts        # Business logic (pure/testable domain rules)
│   ├── reports.service.test.ts   # Unit/feature tests
│   └── reports.schema.ts         # Zod validation schemas
└── [reportId]/                   # Nested dynamic route
    ├── page.tsx
    ├── _components/
    │   ├── report-detail-view.tsx
    │   ├── status-history-timeline.tsx
    │   └── photo-gallery.tsx
    └── _lib/
        ├── report-detail.loader.ts
        ├── report-detail.actions.ts
        └── report-detail.service.ts
```

Aturan arsitektur per layer di `_lib/`:
- `*.schema.ts`: Skema validasi Zod untuk form input dan payload Server Action.
- `*.loader.ts`: Fungsi data-fetching khusus Server Component (query Drizzle ORM, otorisasi baca).
- `*.actions.ts`: Next.js Server Actions (`"use server"`) yang tipis — hanya memvalidasi session, mem-parsing input dengan Zod schema, memanggil `*.service.ts`, dan melakukan `revalidatePath`.
- `*.service.ts`: Inti business logic (validasi aturan domain seperti mutual-exclusive karat, syarat bukti foto + narasi, penyimpanan DB & riwayat status) sehingga mudah di-unit test.
- `*.service.test.ts`: Unit/integration test untuk menguji service tanpa bergantung pada UI.

# report content and uploads
- Satu laporan harus mendukung banyak gambar (multi-image upload), bukan hanya satu foto, max 8 images, dan harus di-compress di sisi frontend sebelum dikirim.
- Laporan harus mendukung narasi teks panjang dengan paragraf/baris baru; gunakan textarea multiline, bukan input teks satu baris.
- Fokus awal narasi adalah plain text, bukan rich text/HTML; tampilkan dengan aman dan pertahankan pemisahan paragraf.
- Setiap gambar maksimal 3 MB tersimpan di storage/database. Compress selama kualitas gambar masih jelas dan terbaca.
- Narasi laporan maksimal 1.000 karakter, divalidasi di frontend dan backend. Tetapkan definisi penghitungan karakter yang konsisten saat implementasi.
- Validasi batas file maksimal 5 MB per file sebelum kompresi di frontend dan backend; kompresi tidak menggantikan validasi.
- Usulan UX upload: pilih banyak gambar, preview, hapus gambar sebelum kirim, indikator progres per gambar, dan retry gambar yang gagal tanpa menduplikasi laporan atau gambar yang berhasil.
- Usulan teknis: kompres/resize foto di frontend (canvas/browser-image-compression), validasi tipe dan ukuran di Next.js route handler / action, upload bertahap/chunked bila diperlukan.
- Kegagalan sebagian upload harus ditampilkan dengan jelas; laporan tidak boleh dinyatakan terkirim lengkap jika masih ada gambar yang gagal. Status upload terpisah dari status penanganan laporan. Gunakan Zustand store untuk manajemen state upload ini.

# perimeter parts and damage catalog
- Katalog berikut adalah daftar bagian perimeter dan jenis kerusakan yang disepakati pengguna. Untuk implementasi awal, simpan sebagai JSON/TypeScript data statis terpisah dari komponen React; selanjutnya dapat dimigrasikan ke tabel PostgreSQL bila diatur dinamis oleh Operator.
- Bagian perimeter tidak diurutkan berdasarkan abjad; pertahankan urutan pengguna: Pondasi, Tiang Pagar, Pagar Harmonika / BRC, Kawat Duri / Razor, Tiang Penyangga Kawat Duri.
- Hanya pilihan jenis kerusakan yang diurutkan berdasarkan abjad A–Z dengan locale Indonesia (`localeCompare`/`Intl.Collator('id')`). `Lainnya` mengikuti urutan abjad biasa, bukan otomatis dipindahkan ke paling akhir.
- Reporter dapat memilih satu atau lebih bagian perimeter, lalu satu atau lebih jenis kerusakan untuk masing-masing bagian. Simpan relasi kerusakan ke bagian terkait di database (relasional/JSONB), bukan daftar kerusakan global tanpa pengelompokan.
- Gunakan ID stabil pada data pilihan; label tampilan dan posisi urutan tidak menjadi identitas data.

| Bagian perimeter (urutan tetap) | Jenis kerusakan (A–Z) |
|---|---|
| Pondasi | Bercelah; Lainnya; Miring; Runtuh |
| Tiang Pagar | Berkarat berat; Berkarat sedang; Lainnya; Miring; Penyok |
| Pagar Harmonika / BRC | Berkarat berat; Berkarat sedang; Berlubang; Klem terlepas; Lainnya |
| Kawat Duri / Razor | Berkarat berat; Berkarat sedang; Lainnya; Terlepas; Tumpul |
| Tiang Penyangga Kawat Duri | Lainnya; Patah; Terlepas |

## Input rules for damage selection
- `Berkarat sedang` dan `Berkarat berat` bersifat saling eksklusif per bagian/komponen: hanya salah satu boleh dipilih pada bagian yang sama. Bagian berbeda boleh memiliki tingkat korosi berbeda.
- Jenis kerusakan lain tetap dapat dipilih bersamaan dengan salah satu tingkat korosi. Ini bukan aturan single-select untuk seluruh daftar kerusakan.
- Implementasi UI harus mencegah kombinasi dua tingkat korosi tersebut dan validasi Zod / Drizzle backend harus menolaknya saat penyimpanan dibuat.
- `Lainnya` tersedia pada setiap bagian. Kewajiban keterangan tambahan khusus `Lainnya` belum ditentukan; jangan mengasumsikan adanya field wajib baru tanpa konfirmasi.

# location selection
- Form laporan memiliki pilihan sisi/lokasi pelaporan sebagai indikator awal, misalnya Timur, Barat, atau Tenggara; daftar pilihan final dapat dikonfigurasi.
- Label sisi lokasi terpisah dari koordinat dan tidak otomatis disimpulkan dari GPS untuk MVP.
- Ambil GPS otomatis jika tersedia di browser/device, lalu tampilkan peta Leaflet agar reporter dapat menyeret marker atau memilih titik untuk mengoreksi posisi sebenarnya sebelum mengirim.
- Simpan koordinat GPS awal dan akurasinya jika tersedia, koordinat final (latitude, longitude di PostgreSQL `numeric`/`double precision`), serta sumber lokasi (`GPS` atau `MANUAL`). Jika izin GPS ditolak/tidak tersedia, izinkan pemilihan manual.

# photo storage layout
- File foto disimpan di server filesystem (e.g. `/public/uploads` atau direktori storage dedicated di server / S3-compatible storage bila dibutuhkan) dengan referensi path/URL tersimpan di tabel foto PostgreSQL.
- Hierarki folder penyimpanan: tahun-bulan → tanggal → laporan → foto.
- Format folder: `YYYY-MM/YYYY-MM-DD/namaAtauNIP_YYYYMMDD-HHmmss_reportId/`.
- Format penamaan file foto: `sisiLokasi_YYYYMMDD-HHmmss_001.jpg` (atau `.webp`/`.png`), dengan timestamp waktu laporan dibuat dan nomor urut unik. Ekstensi harus sesuai MIME format file aktual.
- Timestamp laporan ditetapkan server; gunakan zona waktu `Asia/Jakarta` secara konsisten untuk struktur folder dan penamaan file.
- Sanitasi nama/NIP pelapor dan label lokasi untuk penamaan path. Tambahkan ID laporan agar nama/waktu yang sama tidak bentrok; identitas dan relasi data tetap memakai UUID / ID laporan.
- Foto awal dan foto penanganan dapat berada dalam grup laporan yang sama, tetapi dibedakan dengan metadata jenis foto (`REPORT_INITIAL`, `STATUS_UPDATE`, `SOFT_DELETE`) serta relasi foreign key ke tabel perubahan status.

# draft and upload recovery
- Zustand digunakan untuk state form, pilihan lokasi, katalog terpilih, daftar gambar, dan status antrean upload di frontend Next.js.
- Usulan persistensi: Zustand `persist` middleware untuk teks & metadata draft di `localStorage`. Jika foto draft perlu bertahan setelah page reload, simpan Blob/ArrayBuffer di IndexedDB.
- Tangani upload file secara bertahap via API Next.js dengan tracking status per file (menunggu, mengunggah, berhasil, gagal), retry untuk file gagal, dan proteksi idempotensi.
- Draft lokal dipisahkan per user NIP dan dibersihkan saat laporan berhasil terkirim atau pengguna logout.

# report status
Mapping state dan nama tampilan resmi:
- `OPEN` : **Baru** — laporan baru dibuat, belum mulai ditangani (status default).
- `IN_PROGRESS` : **Ditangani** — laporan sedang dalam proses perbaikan/penanganan.
- `RESOLVED` : **Selesai** — penanganan telah selesai dikerjakan.
- `CLOSED` : **Ditutup** — laporan ditutup oleh operator (soft delete / laporan tidak valid).

Aturan alur status:
- Alur utama: `OPEN` (Baru) → `IN_PROGRESS` (Ditangani) → `RESOLVED` (Selesai).
- Operator/Technician dapat langsung mengubah `OPEN` menjadi `RESOLVED` jika masalah sudah selesai ditangani.
- Pembukaan kembali (*reopen*): dapat mengubah `RESOLVED` kembali menjadi `OPEN` jika masalah belum benar-benar tuntas, disertai alasan perubahan dan bukti foto.
- Setiap perubahan status oleh operator/teknisi **wajib menyertakan narasi tidak kosong dan minimal satu foto** sebagai bukti perubahan tersebut, bukan salah satu saja. Berlaku juga untuk pembukaan kembali dan penutupan (`CLOSED` / soft delete).
- Terapkan batas maksimal 2.000 karakter untuk narasi perubahan dan 3 MB per foto, dengan validasi frontend (Zod) dan backend API.
- Perubahan status baru dicatat ke PostgreSQL setelah bukti foto wajib tersimpan; kegagalan upload foto tidak boleh mengubah status laporan.
- Simpan riwayat perubahan status di tabel riwayat (`report_status_history`): status sebelumnya, status baru, waktu server, ID pengguna, narasi, serta relasi ke foto bukti penanganan.
- Saat laporan ditutup (`CLOSED` / soft delete): simpan `deletedAt`, `deletedBy`, `deletionReason`, dan referensi foto bukti penutupan wajib, sambil tetap mempertahankan audit riwayat sebelumnya.
- Laporan yang berstatus `CLOSED` (**Ditutup**) tetap muncul pada daftar reporter dengan label `Ditutup` dan keterangan penutupan, tetapi **tidak ditampilkan pada peta aktif** atau perhitungan heatmap.
- Laporan yang sudah `CLOSED` tidak menerima perubahan status penanganan biasa.

# report lifecycle icons and colors
- Gunakan ikon dari `lucide-react` dengan pemetaan berikut:

| State | Label UI | Kondisi | Ikon Lucide | Warna ikon light | Warna ikon dark |
|---|---|---|---|---|---|
| *(Summary)* | **Total laporan** | Ringkasan semua laporan dalam cakupan akses pengguna, termasuk yang ditutup | `ClipboardList` | `#0E7C86` | `#4EC4C6` |
| `OPEN` | **Baru** | Laporan baru, belum mulai ditangani, tidak ditutup | `ClipboardClock` | `#C4402F` | `#F58A7B` |
| `IN_PROGRESS` | **Ditangani** | Sedang ditangani, tidak ditutup | `ClipboardPen` | `#8B5E3C` | `#D4A373` |
| `RESOLVED` | **Selesai** | Selesai ditangani, tidak ditutup | `ClipboardCheck` | `#617A16` | `#B7D65B` |
| `CLOSED` | **Ditutup** | Laporan ditutup / soft delete (`deletedAt` terisi) | `ClipboardX` | `#6B7280` | `#9AA3AB` |

- Warna kategori: teal untuk total, coral untuk `OPEN` (Baru), brown untuk `IN_PROGRESS` (Ditangani), lime untuk `RESOLVED` (Selesai), dan abu-abu untuk `CLOSED` (Ditutup).
- Ikon tetap solid. Background kotak ikon menggunakan tint kategori sekitar 10–12% opacity pada light mode dan 15–18% pada dark mode.
- Khusus `IN_PROGRESS` (Ditangani): background light `rgba(139, 94, 60, 0.12)` dan dark `rgba(212, 163, 115, 0.16)`.
- Status `CLOSED` (**Ditutup**) mengambil prioritas tampilan atas status penanganan sebelumnya dan tidak dihitung sebagai `OPEN`/`IN_PROGRESS`/`RESOLVED` pada kartu ringkasan status terpisah.
- Kartu ringkasan gabungan aktif (jika ditampilkan sebagai `Perlu tindak lanjut`) menghitung `OPEN` + `IN_PROGRESS` yang tidak berstatus `CLOSED`.

# map and hot location indicator
- Operator dan Technician melihat lokasi laporan pada peta interaktif Leaflet beserta status penanganannya.
- Marker dibedakan berdasarkan status dan disertai label/ikon ramah aksesibilitas (bukan hanya warna). Acuan warna: coral untuk `OPEN` (Baru), brown untuk `IN_PROGRESS` (Ditangani), lime untuk `RESOLVED` (Selesai).
- Laporan aktif pada peta adalah laporan berstatus `OPEN` atau `IN_PROGRESS` (dan opsional filter `RESOLVED`), sedangkan laporan `CLOSED` tidak ditampilkan di peta aktif.
- Hot location indicator pada MVP berupa marker lokasi per laporan yang dapat diklik untuk membuka modal/drawer detail.
- Klik marker membuka detail laporan: narasi lengkap, galeri multi-foto, status & riwayat penanganan, serta formulir update penanganan bagi teknisi/operator.
- Heatmap merupakan rencana pengembangan lanjutan (agregasi spasial/densitas), bukan prioritas MVP.

# map bounds and zoom (YIA)
- Peta difokuskan pada Bandara Yogyakarta International Airport (YIA). Gunakan geometri perimeter dari referensi OpenStreetMap: https://www.openstreetmap.org/way/544170813#map=15/-7.90054/110.05756
- Pertahankan atribusi OpenStreetMap dan patuhi kebijakan tile provider.
- Batasi area navigasi/panning dengan Leaflet `maxBounds`, berdasarkan bounding box perimeter yang diperluas buffer geografis 5–6 km pada setiap sisi.
- Gunakan `maxBoundsViscosity: 1.0` agar drag tidak bebas keluar dari area batas operasional bandara.
- Tampilan awal memanggil `fitBounds(perimeterBounds, { padding: ... })` agar perimeter bandara terlihat pas di tengah layar viewport.
- Tetapkan `minZoom` secara responsif menggunakan `getBoundsZoom(navigationBounds, true)` agar viewport tidak zoom out melampaui area navigasi.
- Batasi `maxZoom` secara eksplisit sesuai kemampuan native tile provider untuk menghindari tile error/pecah (*no overzoom* pada MVP).
- Sediakan tombol "Kembali ke Overview" / re-center untuk memusatkan kembali peta ke perimeter YIA setelah user melakukan panning atau zooming.
- Pengguna mobile maupun desktop harus dapat menggeser peta dengan lancar untuk memfokuskan segmen pagar yang sedang diperiksa.

# UI and responsive layout
- Reporter didominasi perangkat mobile: desain mobile-first, target sentuh ramah jari (min 44px), formulir cepat dan ringkas di lapangan.
- Halaman utama reporter: daftar laporan milik user yang sedang login, status terkini (`Baru`, `Ditangani`, `Selesai`, `Ditutup`), tombol buat laporan baru, dan detail laporan dengan thumbnail foto serta preview mini peta lokasi.
- Dashboard operator / teknisi: peta interaktif Leaflet sebagai konteks utama layar.
- Desain responsif dashboard:
  - Mobile/Tablet: Peta fullscreen dengan Bottom Sheet / Drawer untuk ringkasan dan detail laporan.
  - Desktop: Peta luas dengan collapsible Side Panel untuk daftar, filter, dan detail laporan.
- Galeri foto menggunakan lazy-loading agar tidak membebani performa perangkat mobile saat membuka laporan dengan banyak foto.

# frontend components and design workflow
- Komponen UI menggunakan Tailwind CSS v4 + konsep komponen headless/shadcn/ui (Button, Dialog, Sheet/Drawer, Select, Textarea, Badge, Tabs, Alert Dialog).
- Ikon menggunakan `lucide-react`.
- Tipografi: font **Carlito** untuk seluruh teks aplikasi (`font-family: 'Carlito', sans-serif`), dipasang via `@fontsource/carlito`.
- Integrasi Leaflet pada Next.js Client Component menggunakan dynamic import (`next/dynamic` dengan `ssr: false`) untuk mencegah error SSR `window is not defined`.

# testing approach
- Fokus pada unit test di `*.service.test.ts` dan feature test alur bisnis:
  - Reporter membuat laporan valid → data tersimpan di PostgreSQL dengan status `OPEN` (Baru).
  - Operator/Teknisi memperbarui status ke `IN_PROGRESS` (Ditangani) atau `RESOLVED` (Selesai) dengan narasi + foto bukti → riwayat tersimpan, status berubah.
  - Penutupan laporan (`CLOSED` / Ditutup) oleh operator → reporter melihat status `Ditutup`, marker hilang dari peta aktif.
  - Proteksi otorisasi: request tanpa auth ditolak, reporter tidak boleh mengubah status atau menutup laporan.
- Validasi data input ketat menggunakan Zod (`*.schema.ts`) di client dan server.

# techstack
- **Framework:** Next.js 16 (App Router) + React 19
- **Runtime:** Node.js
- **Database:** PostgreSQL (Native)
- **ORM & Migrations:** Drizzle ORM + Drizzle Kit (`drizzle-orm`, `drizzle-kit`, `pg`)
- **Authentication:** Better-Auth (`better-auth`) berbasis NIP dan Password, mendukung role `REPORTER`, `OPERATOR`, `TECHNICIAN`
- **State Management:** Zustand (`zustand`)
- **Styling & UI:** Tailwind CSS v4 (`tailwindcss`, `@tailwindcss/postcss`), Radix UI / shadcn style
- **Icons:** Lucide React (`lucide-react`)
- **Maps:** Leaflet (`leaflet`, `@types/leaflet`)
- **Data Validation:** Zod (`zod`)
- **Font:** Carlito (`@fontsource/carlito`)

# color pallete

| Token         | Light Mode              | Dark Mode                | Used For                               |
|---------------|--------------------------|----------------------------|------------------------------------------|
| `--primary`       | `#14848D`               | `#14848D`                | Sign in button background, brand primary |
| `--primary-hover` | `#0F6E76`               | `#1A9AA5`                | Button hover state                       |
| `--on-primary`    | `#FFFFFF`               | `#FFFFFF`                | Button text                              |
| `--link`          | `#0E7C86`               | `#4EC4C6`                | Links, focus ring                        |
| `--panel`         | `#EAF6F6`               | `#2B2F33`                | Left brand panel background              |
| `--panel-text`    | `#2B2F33`               | `#FFFFFF`                | Text on the panel                        |
| `--text`          | `#2B2F33`               | `#E8ECEE`                | Main body text                           |
| `--muted`         | `#6B7280`               | `#9AA3AB`                | Secondary / helper text                  |
| `--bg`            | `#F7F9FA`               | `#121618`                | Page background                          |
| `--surface`       | `#FFFFFF`               | `#1B2124`                | Card & modal background                  |
| `--border`        | `#E5E9EB`               | `#2C3438`                | Input & card borders                     |
| `--coral`         | `#EE6956`               | `#EE6956`                | Top accent stripe, status OPEN (Baru)    |
| `--amber`         | `#FBAE42`               | `#FBAE42`                | Accent stripe                            |
| `--teal`          | `#4EC4C6`               | `#4EC4C6`                | Total reports summary                    |
| `--lime`          | `#9FBD3B`               | `#9FBD3B`                | Status RESOLVED (Selesai)                |
| `--coral-text`    | `#C4402F`               | `#F58A7B`                | Error message text                       |
| `--coral-tint`    | `rgba(238,105,86,.12)`  | `rgba(238,105,86,.12)`   | Error message background                 |
