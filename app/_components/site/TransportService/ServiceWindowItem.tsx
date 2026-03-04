import Link from "next/link";
import Image from "next/image";

export type ServiceWindowItemProps = {
  title: string;
  href: string;
  svg: string;
};

export function ServiceWindowItem({ title, href, svg }: ServiceWindowItemProps) {
  return (
    <Link href={href} className="w-[240] h-[240] rounded-2xl bg-white p-4 shadow-md flex flex-col">
      {/* Icon */}
      <div className="flex-1 flex items-center justify-center">
        <div className="grid h-40 w-40  place-items-center">
          <Image src={svg} alt="svg" width={160} height={160} />
        </div>
      </div>

      {/* Title */}
      <h3 className="text-center text-[16px] font-bold text-logoblue">{title}</h3>
    </Link>
  );
}