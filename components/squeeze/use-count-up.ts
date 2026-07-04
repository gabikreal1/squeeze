"use client"

import { useEffect, useRef, useState } from "react"

export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(target)
  const prev = useRef(target)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    const from = prev.current
    const to = target
    if (from === to) return
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(from + (to - from) * eased)
      if (t < 1) {
        raf.current = requestAnimationFrame(tick)
      } else {
        prev.current = to
      }
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [target, duration])

  return value
}
