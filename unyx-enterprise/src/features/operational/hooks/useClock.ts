/**
 * useClock - Hook para gerenciar relógio em tempo real
 */

import { useEffect, useState } from "react"
import { nowMinutes } from "../utils/operationalCalculations"

interface UseClockOptions {
  interval?: number // millisegundos
  onTick?: (minutes: number) => void
}

export function useClock(options: UseClockOptions = {}) {
  const { interval = 30_000, onTick } = options
  const [now, setNow] = useState(nowMinutes)

  useEffect(() => {
    const id = setInterval(() => {
      const minutes = nowMinutes()
      setNow(minutes)
      onTick?.(minutes)
    }, interval)

    return () => clearInterval(id)
  }, [interval, onTick])

  return now
}
