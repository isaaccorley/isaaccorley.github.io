"use client";

import { useEffect, useRef, ReactNode, useCallback } from "react";

const observerMap = new Map<string, IntersectionObserver>();

function getSharedObserver(
  threshold: number,
  rootMargin: string,
  callback: (entry: IntersectionObserverEntry) => void,
): IntersectionObserver {
  const key = `${threshold}-${rootMargin}`;

  if (!observerMap.has(key)) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            callback(entry);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin },
    );
    observerMap.set(key, observer);
  }

  return observerMap.get(key)!;
}

interface AnimateOnScrollProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function AnimateOnScroll({ children, className = "", delay = 0 }: AnimateOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entry: IntersectionObserverEntry) => {
      setTimeout(() => {
        entry.target.classList.add("visible");
      }, delay);
    },
    [delay],
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      element.classList.add("visible");
      return;
    }

    const observer = getSharedObserver(0.1, "0px 0px -50px 0px", handleIntersect);
    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [handleIntersect]);

  return (
    <div ref={ref} className={`animate-on-scroll ${className}`}>
      {children}
    </div>
  );
}
