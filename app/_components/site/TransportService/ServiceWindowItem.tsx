export type ServiceWindowItemProps = {
  title: string;
  svg: string;
  onClick?: () => void;
};

export function ServiceWindowItem({
  title,
  svg,
  onClick,
}: ServiceWindowItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex h-[300] w-[288] flex-col rounded-[28px] border border-white/70 bg-white p-6 shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl active:scale-[0.98] cursor-pointer"
    >
      <div className="flex-1 flex items-center justify-center">
        <div className="grid h-48 w-48 place-items-center">
          <img src={svg} alt={title} width={192} height={192} />
        </div>
      </div>
      <div className="space-y-2 text-center">
        <h3 className="text-[20px] font-bold text-logoblue">{title}</h3>
      </div>
    </button>
  );
}
