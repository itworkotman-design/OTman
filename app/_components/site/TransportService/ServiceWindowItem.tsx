export type ServiceWindowItemProps = {
  title: string;
  description?: string;
  svg: string;
  badgeText?: string;
  onClick?: () => void;
};

export function ServiceWindowItem({
  title,
  description,
  svg,
  badgeText,
  onClick,
}: ServiceWindowItemProps) {
  return (
    <button
      onClick={onClick}
      className="relative flex h-[260] w-[240] flex-col items-center justify-center rounded-3xl bg-logoblue p-6 shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl active:scale-[0.98] cursor-pointer"
    >
      {badgeText ? (
        <span className="absolute top-3 right-3 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white">
          {badgeText}
        </span>
      ) : null}

      <div className="grid h-34 w-34 place-items-center">
        <img
          src={svg}
          alt={title}
          width={96}
          height={96}
          className="h-full w-full filter-[brightness(0)_invert(1)]"
        />
      </div>
      <h3 className="text-[18px] font-bold text-white text-center">{title}</h3>
      {description ? (
        <p className="text-[13px] leading-snug text-white/80 text-center">{description}</p>
      ) : null}
    </button>
  );
}
