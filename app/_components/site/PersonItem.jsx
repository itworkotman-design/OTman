import Image from "next/image"

export const PersonItem = ({src, name, position, email}) => {
    return (
        <div className="w-full max-w-[360px] mb-6">
            <div className="w-full max-w-[360] aspect-square  relative rounded-2xl overflow-clip">
                <Image src={src} alt="prof-img" fill className="object-cover"/>
            </div>
            <div className="text-center">
                <p className="text-logoblue font-semibold text-xl mt-2">{name}</p>
                <p className="text-black/50 text-md">{position}</p>
                <p className="text-md text-logoblue underline">{email}</p>
            </div>
        </div>
    )
}