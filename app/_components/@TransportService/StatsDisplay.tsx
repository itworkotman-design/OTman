//This file needs to intake data from the DB
export const StatsDisplay = () => {
  return (
    <>
        <section className="w-full py-[40px]">
            <div className="grid grid-cols-1 md:grid-cols-3 w-[800px] justify-self-center">
                <div className="text-center">
                    <h1 className="text-[40px] text-logoblue font-bold">737 363</h1>
                    <p>Newspapers delivered</p>
                </div>
                <div className="text-center">
                    <h1 className="text-[40px] text-logoblue font-bold">101 236</h1>
                    <p>Km driven</p>
                </div>
                <div className="text-center">
                    <h1 className="text-[40px] text-logoblue font-bold">49 696</h1>
                    <p>Packages delivered</p>
                </div>
            </div>
        </section>  
    </>
  )
}