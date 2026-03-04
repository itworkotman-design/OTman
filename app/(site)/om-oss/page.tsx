import { PersonItem } from "@/app/_components/site/PersonItem";
import { PartnersDisplay } from "@/app/_components/site/TransportService/PartnersDisplay";
import Image from "next/image";

export default function Kontakt() {
  return (
    <div className="">
      <section>
        <div className="absolute left-0 w-full h-[400]">

            <Image
            src="/IMG-1.png"
            alt="bg-img"
            fill
            className="object-cover object-[center_40%]"
            />

            {/* Overlay */}
            <div className="absolute inset-0 backdrop-blur-xs flex items-center justify-center">
                <h1 className="text-4xl lg:text-6xl text-center text-white font-semibold">
                    About us
                </h1>
            </div>

        </div>
        </section>
        <section className="pt-[400]">
            <p className="my-10 text-xl">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum</p>
        </section>
        <section>
            <div className="mx-auto px-6 max-w-7xl my-20">
                <h1 className="text-center text-4xl font-semibold text-logoblue mb-8">Our History</h1>
                <p className="text-xl">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum</p>
            </div>
        </section>
        <section>
            <div className="mx-auto px-6 my-20">
                <h1 className="text-center text-4xl font-semibold text-logoblue mb-8">Our Team</h1>
                <div className="grid grid-cols-3">
                    <PersonItem src="/IMG-1.png" name="Janis Otmanis" position="Owner" email="janis@otman.no"/>
                    <PersonItem src="/IMG-1.png" name="Janis Otmanis" position="Owner" email="janis@otman.no"/>
                    <PersonItem src="/IMG-1.png" name="Janis Otmanis" position="Owner" email="janis@otman.no"/>
                    <PersonItem src="/IMG-1.png" name="Janis Otmanis" position="Owner" email="janis@otman.no"/>
                    <PersonItem src="/IMG-1.png" name="Janis Otmanis" position="Owner" email="janis@otman.no"/>
                    <PersonItem src="/IMG-1.png" name="Janis Otmanis" position="Owner" email="janis@otman.no"/>
                </div>
            </div>
        </section>
        <PartnersDisplay/>
    </div>
)
}