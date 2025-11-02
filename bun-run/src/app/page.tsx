import { BunRunGame } from "@/components/BunRunGame";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 py-14 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 md:px-10 lg:px-12">
        <header className="space-y-4 text-center md:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-cyan-200/80">
            Hyper Dash Challenge
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Bun Run
          </h1>
          <p className="max-w-3xl text-base text-cyan-100/80 md:text-lg">
            Sprint across a neon cityscape, bounce through launch pads, and scoop up every
            coin before the countdown hits zero. Every run is a shot at shaving down your
            best time—can you thread the portal before the world glitches out?
          </p>
        </header>

        <BunRunGame />
      </div>
    </div>
  );
}
