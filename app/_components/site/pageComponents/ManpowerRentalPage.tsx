export default function ManpowerRentalPage() {

  const benefits = [
    "Reliable and punctual staff",
    "Flexible booking based on your needs",
    "Suitable for private and business customers",
    "Practical, efficient support",
  ];

  const steps = [
    {
      number: "01",
      title: "Send your request",
      text: "Tell us what kind of help you need, where the job takes place, and when you need support.",
    },
    {
      number: "02",
      title: "We assess the job",
      text: "We review your needs and suggest a practical setup based on the scope of the work.",
    },
    {
      number: "03",
      title: "We provide manpower",
      text: "We arrange the right support so the work can be handled efficiently and smoothly.",
    },
  ];

  return (
    <div className="my-8">
      <section className="mb-10">
        <div className="overflow-hidden ">
          <div className="grid gap-10 md:grid-cols-2">
            <div className="flex flex-col justify-center">
              <h1 className="text-2xl lg:text-5xl font-semibold text-logoblue">
                Flexible manpower for transport, moving, and logistics
              </h1>
              <p className="mt-5 text-black/50">
                We provide reliable manpower for practical jobs where extra hands are needed. Suitable for both private and business customers.
              </p>
            </div>

            <div className="relative min-h-[320] overflow-hidden">
              <div className="relative flex h-full flex-col justify-between">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-3xl bg-logoblue p-5 text-white shadow-sm">
                    <div className="text-sm text-white">Suitable for</div>
                    <div className="mt-2 text-lg font-semibold">Moving jobs</div>
                  </div>
                  <div className="rounded-3xl p-5 shadow-sm">
                    <div className="text-sm text-black/50">Also used for</div>
                    <div className="mt-2 text-lg font-semibold text-textcolor">Warehouse support</div>
                  </div>
                  <div className="rounded-3xl p-5 shadow-sm">
                    <div className="text-sm text-black/50">Booking</div>
                    <div className="mt-2 text-lg font-semibold text-textcolor">Flexible and fast</div>
                  </div>
                  <div className="rounded-3xl p-5 shadow-sm">
                    <div className="text-sm text-black/50">Focus</div>
                    <div className="mt-2 text-lg font-semibold text-textcolor">Reliable extra help</div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {benefits.map((item) => (
                      <div key={item} className="flex items-start gap-3 text-sm text-black/50">
                        <span className="mt-0.5 inline-block h-2.5 w-2.5 rounded-full bg-lineSecondary" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto">
        <div className="lg:grid grid-cols-2 gap-20">
          <div className="rounded-3xl mb-10 lg:mb-0 bg-logoblue py-4 px-8 text-white">
            <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Simple process from request to completed work</h2>
            <div className="mt-8 space-y-5">
              {steps.map((step) => (
                <div key={step.number} className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/10">
                  <div className="text-sm font-semibold text-white/60 flex gap-10">
                    <p>{step.number}</p>
                    <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
                  </div>
                  
                  <p className="mt-2 text-sm leading-6 text-white/80">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="customContainer mb-10 lg:mb-0 py-4! px-8! rounded-3xl! flex flex-col">
            <div className="">
                <h2 className="mt-3 text-3xl font-semibold text-logoblue">Tell us what you need help with</h2>
                <p className="mt-4 text-base leading-7 text-slate-600">
                We can tailor the setup based on the type of work, duration, and number of people required.
                </p>
            </div>
            <form className="mt-8 space-y-6 flex-col">
                    <input className="rounded-2xl w-full custom bg-white px-4 py-3 ring-1 ring-slate-200 text-sm text-black/50" placeholder="Name / Company"/>
                    <input className="rounded-2xl w-full bg-white px-4 py-3 ring-1 ring-slate-200 text-sm text-black/50" placeholder="Phone or email"/>
                    <input className="rounded-2xl w-full bg-white px-4 py-3 ring-1 ring-slate-200 text-sm text-black/50" placeholder="Type of job"/>
                    <textarea className="min-h-[120] w-full rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200 text-sm text-black/50" placeholder="Short description of what kind of manpower you need"/>
            </form>
            <div className="mt-auto">
                <button className="customButtonEnabled w-full h-12">
                    Request an offer
                </button>
            </div>
            
          </div>
        </div>
      </section>
    </div>
  );
}
