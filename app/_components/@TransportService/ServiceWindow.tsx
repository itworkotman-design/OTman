// src/components/ServiceWindow.tsx
import { ServiceWindowItem, type ServiceWindowItemProps } from "./ServiceWindowItem";

export function ServiceWindow({
  title = "Book a service",
  items,
}: {
  title?: string;
  items: ServiceWindowItemProps[];
}) {
  return (
    <section>
      <div className=" w-full">
        <div className="rounded-2xl bg-logoblue p-4 shadow-sm ">
          <h2 className="text-center text-2xl font-bold text-white">{title}</h2>
          <div className="mt-4 flex gap-8 pb-2 justify-self-center">
            {items.map((item) => (
              <ServiceWindowItem key={item.href} {...item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
