export function BrandWordmark({ className = "" }: { className?: string }) {
  return <span className={`font-anurati brand-wordmark ${className}`}>Quantum Leap</span>;
}

export function Brand({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <div className="group/brand flex items-center gap-3">
      <img
        src={light ? "/logo-q-light.png" : "/logo-q.png"}
        alt=""
        width={32}
        height={32}
        aria-hidden="true"
        draggable={false}
        className="brand-logo size-8 shrink-0 sm:size-9"
      />
      {!compact && (
        <BrandWordmark className={`text-[15px] sm:text-[16px] ${light ? "text-white" : "text-[#12231e]"}`} />
      )}
    </div>
  );
}
