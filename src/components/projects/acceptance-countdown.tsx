"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface AcceptanceCountdownProps {
  deadlineIso: string;
}

/**
 * Display-only countdown component.
 *
 * SAFETY GUARANTEE:
 * The browser countdown is purely visual for user experience.
 * It NEVER determines or mutates authoritative project status.
 * Authoritative status derivation and expiry reconciliation always execute server-side.
 */
export function AcceptanceCountdown({ deadlineIso }: AcceptanceCountdownProps) {
  const router = useRouter();
  const hasRefreshedRef = useRef(false);
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  } | null>(null);

  useEffect(() => {
    function calculateTime() {
      const deadline = new Date(deadlineIso).getTime();
      const now = Date.now();
      const difference = deadline - now;

      if (difference <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
        if (!hasRefreshedRef.current) {
          hasRefreshedRef.current = true;
          router.refresh();
        }
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds, isExpired: false });
    }

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [deadlineIso, router]);

  if (!timeLeft) {
    return <div className="text-xs font-heading font-black text-black/60">Calculating deadline...</div>;
  }

  if (timeLeft.isExpired) {
    return (
      <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-200 text-black border-2 border-black neo-shadow-sm">
        <span className="w-2.5 h-2.5 rounded-full bg-black animate-pulse" />
        Acceptance window closed (Expired)
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#ffe17c] text-black border-2 border-black neo-shadow-sm">
      <span className="w-2.5 h-2.5 rounded-full bg-black animate-pulse" />
      <span>Discovery closes in:</span>
      <span className="font-mono font-black text-black">
        {String(timeLeft.hours).padStart(2, "0")}h :{" "}
        {String(timeLeft.minutes).padStart(2, "0")}m :{" "}
        {String(timeLeft.seconds).padStart(2, "0")}s
      </span>
    </div>
  );
}

interface DeadlineCountdownProps {
  deadlineIso: string;
  label?: string;
  expiredLabel?: string;
  variant?: "blue" | "amber" | "rose";
}

export function DeadlineCountdown({
  deadlineIso,
  label = "Deadline in:",
  expiredLabel = "Deadline passed",
  variant = "blue",
}: DeadlineCountdownProps) {
  const router = useRouter();
  const hasRefreshedRef = useRef(false);
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  } | null>(null);

  useEffect(() => {
    function calculateTime() {
      const deadline = new Date(deadlineIso).getTime();
      const now = Date.now();
      const difference = deadline - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        if (!hasRefreshedRef.current) {
          hasRefreshedRef.current = true;
          router.refresh();
        }
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
    }

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [deadlineIso, router]);

  if (!timeLeft) {
    return <div className="text-xs font-heading font-black text-black/60">Calculating deadline...</div>;
  }

  if (timeLeft.isExpired) {
    return (
      <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-200 text-black border-2 border-black neo-shadow-sm">
        <span className="w-2.5 h-2.5 rounded-full bg-black animate-pulse" />
        {expiredLabel}
      </div>
    );
  }

  const colorStyles = {
    blue: "bg-[#b7c6c2] text-black",
    amber: "bg-[#ffe17c] text-black",
    rose: "bg-rose-200 text-black",
  }[variant];

  return (
    <div className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm ${colorStyles}`}>
      <span className="w-2.5 h-2.5 rounded-full bg-black animate-pulse" />
      <span>{label}</span>
      <span className="font-mono font-black text-black">
        {timeLeft.days > 0 ? `${timeLeft.days}d ` : ""}
        {String(timeLeft.hours).padStart(2, "0")}h :{" "}
        {String(timeLeft.minutes).padStart(2, "0")}m :{" "}
        {String(timeLeft.seconds).padStart(2, "0")}s
      </span>
    </div>
  );
}
