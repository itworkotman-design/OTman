import Link from "next/link";

export type ServiceWindowItemProps = {
  title: string;
  href: string;
};

export function ServiceWindowItem({ title, href }: ServiceWindowItemProps) {
  return (
    <Link href={href} className="w-[240px] h-[240px] rounded-xl bg-white p-4 shadow-md flex flex-col">
      {/* Icon */}
      <div className="flex-1 flex items-center justify-center">
        <div className="grid h-24 w-24 place-items-center rounded-lg border border-logoblue">
        </div>
      </div>

      {/* Title */}
      <h3 className="text-center text-[16px] font-bold">{title}</h3>
    </Link>
  );
}