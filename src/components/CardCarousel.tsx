import React, { useMemo, useRef } from "react";

type Props = {
  children: React.ReactNode;     // ParamCards
  className?: string;            // p.ej. "hide-on-expand"
};

// chunk util
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function QuadCarousel({ children, className = "" }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const items = useMemo(() => React.Children.toArray(children), [children]);
  const pages = useMemo(() => chunk(items, 4), [items]); // 4 = 2x2

  const scrollByPage = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className={`quad-carousel ${className}`}>
      <button
        className="qc-btn qc-prev"
        aria-label="Anterior"
        onClick={() => scrollByPage(-1)}
      >
        ‹
      </button>

      <div className="qc-track hide-scrollbar" ref={trackRef}>
        {pages.map((page, i) => (
          <div className="qc-page" key={i}>
            {page.map((child, j) => (
              <div className="qc-cell" key={j}>{child}</div>
            ))}
          </div>
        ))}
      </div>

      <button
        className="qc-btn qc-next"
        aria-label="Siguiente"
        onClick={() => scrollByPage(1)}
      >
        ›
      </button>
    </div>
  );
}
