import Image from "next/image"

export const PersonItem = ({src, name, position, email}) => {
    return (
        <div className="w-full">
            <div className="w-full aspect-4/5 relative rounded-2xl overflow-clip">
                <Image src={src} alt={name} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover"/>
            </div>
            <div className="mt-3">
                <p className="text-logoblue font-semibold text-xl">{name}</p>
                <p className="text-black/50 text-md">{position}</p>
                <p className="text-md text-logoblue">{email}</p>
            </div>
        </div>
    )
}
