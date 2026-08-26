import React, { forwardRef } from "react";
import {
  Bell, Mic, Volume2, Moon, Search, Edit3, Trash2, Gift, Award, Sparkles,
  BookOpen, Compass, Share2, Copy, Clock, User, Settings, Info, RotateCcw,
  Headphones, Star, Heart, Home, Library, Folder, LogOut,
  Play, Pause, ChevronLeft, ChevronRight, ArrowRight, Plus, Check, X,
  type LucideIcon,
} from "lucide-react";

// ── Icon name union ──
export type IconName =
  // 28 个指定图标
  | "bell" | "mic" | "volume" | "moon" | "search" | "edit" | "trash"
  | "gift" | "award" | "sparkles" | "book-open" | "compass" | "share"
  | "copy" | "clock" | "user" | "settings" | "info" | "refresh"
  | "headphones" | "star" | "home" | "library" | "folder" | "logout"
  | "heart" | "heart-filled"
  // 8 个 legacy 图标
  | "play" | "pause" | "chevron-left" | "chevron-right"
  | "arrow-right" | "plus" | "check" | "x";

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
  onClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
  ariaLabel?: string;
}

// ── name → lucide component mapping ──
const iconMap: Record<IconName, LucideIcon> = {
  bell: Bell,
  mic: Mic,
  volume: Volume2,
  moon: Moon,
  search: Search,
  edit: Edit3,
  trash: Trash2,
  gift: Gift,
  award: Award,
  sparkles: Sparkles,
  "book-open": BookOpen,
  compass: Compass,
  share: Share2,
  copy: Copy,
  clock: Clock,
  user: User,
  settings: Settings,
  info: Info,
  refresh: RotateCcw,
  headphones: Headphones,
  star: Star,
  home: Home,
  library: Library,
  folder: Folder,
  logout: LogOut,
  heart: Heart,
  "heart-filled": Heart, // fill 由下方特殊处理
  // Legacy
  play: Play,
  pause: Pause,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "arrow-right": ArrowRight,
  plus: Plus,
  check: Check,
  x: X,
};

export const Icon = forwardRef<SVGSVGElement, IconProps>(
  ({ name, size = 16, color, className, onClick, ariaLabel }, ref) => {
    const LucideComponent = iconMap[name];
    const isHeartFilled = name === "heart-filled";

    return (
      <LucideComponent
        ref={ref}
        size={size}
        color={color}
        className={className}
        onClick={onClick}
        aria-label={ariaLabel}
        role={onClick ? "button" : ariaLabel ? "img" : undefined}
        tabIndex={onClick ? 0 : undefined}
        {...(isHeartFilled ? { fill: color || "currentColor" } : {})}
      />
    );
  }
);

Icon.displayName = "Icon";

export default React.memo(Icon, (prev, next) => {
  return (
    prev.name === next.name &&
    prev.size === next.size &&
    prev.color === next.color &&
    prev.className === next.className &&
    prev.onClick === next.onClick &&
    prev.ariaLabel === next.ariaLabel
  );
});
