import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[#d8dfdb] bg-[#fafbfa] px-6 py-12 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-[#edf4f1] text-[#28745c]"><Icon size={22} /></span>
      <h3 className="text-[15px] font-semibold text-[#20302b]">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-[#75817d]">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
