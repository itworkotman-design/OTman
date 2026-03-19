// app/login/page.tsx
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="w-full">
      <div className="mx-auto flex justify-center mt-30 px-4">
        <section className="w-full max-w-[420px]">
          {/* Logo */}
          <div className="flex justify-center">
            {/* Replace with your logo path or component */}
            <Image
              src="/logo.png"
              alt="Otman Transport"
              width={260}
              height={120}
              priority
              className="h-auto w-full"
            />
          </div>
          <div>
            <h1 className="text-center text-3xl font-semibold mt-6 text-logoblue">Forgot your password?</h1>
            <p className="text-center text-md font-base my-6">We&apos;ll email you instructions on how to reset your password</p>
          </div>

          {/* Form */}
          <form className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[20px] pl-2 font-semibold text-logoblue">
                Username / E-mail
              </label>
              <input
                id="email"
                required
                name="email"
                type="text"
                autoComplete="username"
                className="h-10 w-full rounded-lg border border-logoblue/30 px-3 text-sm outline-none focus:border-logoblue/60"
              />
            </div>
          <div className="flex items-center justify-between">
            <Link href="/client-login" className="text-logoblue font-semibold"><i className="fa-solid fa-arrow-left text-sm"></i> back</Link>
            <button
              type="submit"
              className="h-10 w-50 rounded-lg bg-logoblue text-lg font-semibold text-white hover:opacity-95 active:opacity-90 cursor-pointer"
            >
              Reset Password
            </button>
          </div>
            

          </form>
        </section>
      </div>
    </main>
  );
}
