import { useEffect, useState } from "react";

const portraitModules = import.meta.glob("/src/assets/hero/portraits-display/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const countries = [
  "saudi",
  "uae",
  "kuwait",
  "qatar",
  "bahrain",
  "oman",
  "yemen",
  "iraq",
  "jordan",
  "lebanon",
  "syria",
  "morocco",
  "algeria",
  "tunisia",
  "libya",
  "mauritania",
  "egypt",
  "sudan",
  "somalia",
  "djibouti",
  "comoros",
  "palestine",
] as const;

const europeanGroups = ["european-01", "european-02", "european-03", "european-04", "european-05", "european-06"] as const;

type Portrait = {
  src: string;
  key: string;
};

function makePair(group: string): [Portrait, Portrait] {
  return (["man", "woman"] as const).map((gender) => ({
    src: portraitModules[`/src/assets/hero/portraits-display/${group}-${gender}.webp`],
    key: `${group}-${gender}`,
  })) as [Portrait, Portrait];
}

const arabPairs = countries.map(makePair);
const europeanPairs = europeanGroups.map(makePair);
const europeanInsertions = new Map([
  [2, europeanPairs[0]],
  [6, europeanPairs[1]],
  [10, europeanPairs[2]],
  [13, europeanPairs[3]],
  [17, europeanPairs[4]],
  [20, europeanPairs[5]],
]);

const mixedPairs = arabPairs.flatMap((pair, index) => {
  const europeanPair = europeanInsertions.get(index);
  return europeanPair ? [pair, europeanPair] : [pair];
});

const upperRow = mixedPairs.filter((_, index) => index % 2 === 0).flat();
const lowerRow = mixedPairs.filter((_, index) => index % 2 === 1).flat();
const portraitSources = [...new Set([...upperRow, ...lowerRow].map((portrait) => portrait.src))];

function PersonPortrait({ portrait }: { portrait: Portrait }) {
  if (!portrait.src) return null;

  return (
    <span className="sahl-parade-card" aria-hidden="true">
      <img
        className="sahl-parade-portrait"
        src={portrait.src}
        alt=""
        width={1024}
        height={1280}
        loading="eager"
        decoding="async"
      />
    </span>
  );
}

function ParadeRow({ row, reverse = false }: { row: Portrait[]; reverse?: boolean }) {
  return (
    <div className="sahl-parade-window" aria-hidden="true">
      <div className={`sahl-parade-track${reverse ? " is-reverse" : ""}`}>
        {[0, 1].map((copy) => (
          <div className="sahl-parade-set" key={copy}>
            {row.map((portrait) => (
              <PersonPortrait portrait={portrait} key={`${copy}-${portrait.key}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PricingBeyondHero() {
  const [portraitsReady, setPortraitsReady] = useState(false);

  useEffect(() => {
    let active = true;

    Promise.allSettled(
      portraitSources.map(
        (src) =>
          new Promise<void>((resolve) => {
            const image = new Image();
            image.onload = () => {
              if (typeof image.decode === "function") {
                image.decode().catch(() => undefined).finally(resolve);
                return;
              }
              resolve();
            };
            image.onerror = () => resolve();
            image.src = src;
          }),
      ),
    ).then(() => {
      if (active) setPortraitsReady(true);
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="sahl-beyond" aria-labelledby="sahl-pricing-hero-title">
      <header className="sahl-beyond-copy">
        <h1 id="sahl-pricing-hero-title">
          <span>منصة</span>
          سهل
        </h1>
        <p>إمكانيات موظفين ذكاء اصطناعي لا حصر لها.</p>
      </header>

      <div className={`sahl-parade${portraitsReady ? " is-ready" : ""}`} aria-hidden="true">
        <ParadeRow row={upperRow} />
        <ParadeRow row={lowerRow} reverse />
      </div>
    </section>
  );
}