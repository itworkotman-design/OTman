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
      className="flex h-[220] w-[220] flex-col items-center justify-center gap-3 rounded-3xl bg-logoblue p-6 shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl active:scale-[0.98] cursor-pointer"
    >
      <div className="grid h-20 w-20 place-items-center">
        <img
          src={svg}
          alt={title}
          width={80}
          height={80}
          className="h-full w-full filter-[brightness(0)_invert(1)]"
        />
      </div>
      <h3 className="text-[18px] font-bold text-white text-center">{title}</h3>
    </button>
  );
}
