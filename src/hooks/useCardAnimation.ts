import { useState, useRef, useLayoutEffect } from "react";

export function useCardAnimation() {
  const [editing, setEditing] = useState(false);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [animating, setAnimating] = useState(false);
  const bigCardRef = useRef<HTMLDivElement | null>(null);
  const firstRectRef = useRef<DOMRect | null>(null);

  useLayoutEffect(() => {
    const el = bigCardRef.current;
    const first = firstRectRef.current;
    if (!animating || !el || !first) return;

    const last = el.getBoundingClientRect();
    const invertX = first.left - last.left;
    const invertY = first.top - last.top;
    const scaleX = first.width / last.width || 1;
    const scaleY = first.height / last.height || 1;

    el.style.willChange = "transform";
    el.style.transformOrigin = "left center";
    el.style.transform = `translate(${invertX}px, ${invertY}px) scale(${scaleX}, ${scaleY})`;
    el.getBoundingClientRect();
    el.classList.add("animating");
    el.style.transform = "";

    const onEnd = () => {
      el.classList.remove("animating");
      el.style.willChange = "";
      el.removeEventListener("transitionend", onEnd);
      setAnimating(false);
      firstRectRef.current = null;
    };
    el.addEventListener("transitionend", onEnd);
  }, [animating, editing]);

  function openEditor(currentParams: any) {
    if (!bigCardRef.current) return;
    firstRectRef.current = bigCardRef.current.getBoundingClientRect();
    setSnapshot(currentParams);
    setEditing(true);
    setAnimating(true);
  }

  function collapseEditor(restoreSnapshot: boolean, setParams: (p: any) => void) {
    if (!bigCardRef.current) return;
    if (restoreSnapshot && snapshot) setParams(snapshot);

    firstRectRef.current = bigCardRef.current.getBoundingClientRect();
    setEditing(false);
    setAnimating(true);
    setSnapshot(null);
  }

  return {
    editing,
    snapshot,
    bigCardRef,
    openEditor,
    collapseEditor,
  };
}