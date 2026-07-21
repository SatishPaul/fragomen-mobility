import { Suspense } from "react";
import Image from "next/image";
import { AuthPanel } from "@/components/AuthPanel";
import { brand } from "@/config/brand";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_480px]">
      <section className="hidden items-end p-12 lg:flex">
        <div className="max-w-xl">
          <Image src={brand.logo} alt={brand.name} width={180} height={48} priority />
          <p className="mt-8 font-serif text-4xl leading-tight text-heading">
            Create once. Publish with confidence. Measure what travels.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center border-l border-edge bg-background/70 p-6">
        <Suspense>
          <AuthPanel mode="login" />
        </Suspense>
      </section>
    </main>
  );
}
