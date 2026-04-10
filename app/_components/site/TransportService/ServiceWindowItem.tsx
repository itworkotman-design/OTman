import Image from "next/image";

export type ServiceWindowItemProps = {
  title: string;
  subtitle?: string;
  svg: string;
  onClick?: () => void;
};

export function ServiceWindowItem({
  title,
  subtitle,
  svg,
  onClick,
}: ServiceWindowItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex h-[250] w-[240] flex-col rounded-[28px] border border-white/70 bg-white p-5 shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl active:scale-[0.98] cursor-pointer"
    >
      <div className="flex-1 flex items-center justify-center">
        <div className="grid h-40 w-40 place-items-center">
          <Image src={svg} alt={title} width={160} height={160} />
        </div>
      </div>
      <div className="space-y-2 text-center">
        <h3 className="text-[17px] font-bold text-logoblue">{title}</h3>
      </div>
    </button>
  );
}
