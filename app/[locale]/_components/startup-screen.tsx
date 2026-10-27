export interface StartupScreenProps {
  loading: boolean;
  error: string;
}

/** Shown while the session is being resolved, or when it fails to load. */
export function StartupScreen({ loading, error }: StartupScreenProps) {
  return (
    <main className="mx-auto my-[12vh] w-full max-w-[440px] p-[30px] text-center text-[#2b2f33]">
      <img
        src="/injourney-logo.webp"
        alt="InJourney Airports"
        className="mx-auto h-auto w-24"
      />
      <h1 className="mt-5 mb-2.5 text-[28px] leading-tight font-normal">
        Airport Perimeter
        <span className="text-[#6b7280]"> / YIA</span>
      </h1>
      <p className="mb-4 text-sm leading-relaxed text-[#6b7280]">
        Pelaporan kondisi perimeter bandara
      </p>
      {loading ? (
        <p role="status" className="text-sm">
          Memeriksa sesi Anda…
        </p>
      ) : (
        <div
          role="alert"
          className="rounded-lg border border-[#c4402f]/35 bg-[#c4402f]/10 p-3.5 text-left text-xs leading-relaxed text-[#c4402f] [overflow-wrap:anywhere]"
        >
          {error}
        </div>
      )}
    </main>
  );
}
