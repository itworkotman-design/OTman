import Image from "next/image";

export type ServiceWindowItemProps = {
  title: string;
  svg: string;
  onClick?: () => void;
};

export function ServiceWindowItem({ title, svg, onClick }: ServiceWindowItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-[240] h-[240] rounded-2xl bg-white p-4 shadow-md flex flex-col hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 cursor-pointer"
    >
      <div className="flex-1 flex items-center justify-center">
        <div className="grid h-40 w-40 place-items-center">
          <Image src={svg} alt={title} width={160} height={160} />
        </div>
      </div>
      <h3 className="text-center text-[16px] font-bold text-logoblue">{title}</h3>
    </button>
  );
}