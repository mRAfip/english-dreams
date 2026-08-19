"use client";

import * as React from "react";
import { Loader2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ss = String(s).padStart(2, "0");
  if (h > 0) {
    const mm = String(m).padStart(2, "0");
    return `${h}:${mm}:${ss}`;
  }
  return `${m}:${ss}`;
}

interface AudioPlayerProps extends React.HTMLAttributes<HTMLDivElement> {
  src: string;
  className?: string;
  compact?: boolean;
  autoPlay?: boolean;
  variant?: "default" | "bubble" | "ghost";
}

export function AudioPlayer({
  src,
  className,
  compact = false,
  autoPlay = false,
  variant = "default",
  ...props
}: AudioPlayerProps) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isMuted, setIsMuted] = React.useState(false);
  const [playbackRate, setPlaybackRate] = React.useState(1);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Reset state on src change
    setIsLoading(true);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);

    const onLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
      setIsLoading(false);
    };

    const onDurationChange = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onCanPlay = () => {
      setIsLoading(false);
    };

    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => {
      setIsLoading(false);
      setIsPlaying(true);
    };
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => console.error("Playback failed:", err));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleSpeed = () => {
    const rates = [1, 1.25, 1.5, 2];
    const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIndex];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 rounded-full px-3 py-1.5 text-foreground shadow-2xs transition-colors border select-none min-w-[200px] max-w-full",
        variant === "bubble"
          ? "border-black/10 bg-black/10 text-current"
          : variant === "ghost"
          ? "border-transparent bg-muted/50"
          : "border-border/60 bg-muted/80 hover:border-border",
        compact ? "h-9 text-xs" : "h-10 text-xs sm:text-sm",
        className,
      )}
      {...props}
    >
      <audio ref={audioRef} src={src} autoPlay={autoPlay} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause audio" : "Play audio"}
        className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-xs transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : isPlaying ? (
          <Pause className="size-3.5 fill-current" />
        ) : (
          <Play className="size-3.5 fill-current ml-0.5" />
        )}
      </button>

      {/* Time Display */}
      <div className="flex shrink-0 items-center font-mono text-[10px] sm:text-[11px] opacity-80 select-none">
        <span>{formatTime(currentTime)}</span>
        <span className="mx-0.5 opacity-60">/</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Responsive Draggable Progress Slider */}
      <div className="relative flex min-w-8 flex-1 items-center h-4">
        {/* Visual Track */}
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-current/20">
          <div
            className="h-full bg-primary transition-all duration-75 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {/* Range Slider for Touch/Mouse Dragging */}
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          aria-label="Audio seeker"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 touch-none"
        />
      </div>

      {/* Playback speed toggle */}
      {!compact && (
        <button
          type="button"
          onClick={toggleSpeed}
          title="Playback speed"
          className="hidden shrink-0 font-mono text-[10px] font-semibold opacity-70 transition-opacity hover:opacity-100 sm:inline-block"
        >
          {playbackRate}x
        </button>
      )}

      {/* Mute button */}
      {!compact && (
        <button
          type="button"
          onClick={toggleMute}
          title={isMuted ? "Unmute" : "Mute"}
          className="hidden shrink-0 opacity-70 transition-opacity hover:opacity-100 md:inline-block"
        >
          {isMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
        </button>
      )}
    </div>
  );
}
