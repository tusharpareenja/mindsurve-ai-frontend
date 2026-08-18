"use client"

import React, { useEffect, useState } from "react"
import { useSpring, useMotionValueEvent } from "framer-motion"

interface CountUpProps {
    value: number
    decimals?: number
    suffix?: string
    prefix?: string
    className?: string
}

/** Animates a number from 0 to the target value. */
export function CountUp({
    value,
    decimals = 0,
    suffix = "",
    prefix = "",
    className,
}: CountUpProps) {
    const spring = useSpring(0, {
        stiffness: 60,
        damping: 28,
        restDelta: 0.001,
    })
    const [display, setDisplay] = useState(0)

    useEffect(() => {
        spring.set(value)
    }, [value, spring])

    useMotionValueEvent(spring, "change", (v) => {
        setDisplay(v)
    })

    const formatted =
        decimals > 0
            ? display.toFixed(decimals)
            : Math.round(display).toString()

    return (
        <span className={className}>
            {prefix}{formatted}{suffix}
        </span>
    )
}