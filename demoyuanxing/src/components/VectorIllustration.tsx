import React from "react";

interface VectorIllustrationProps {
  theme?: string;
  title?: string;
  className?: string;
  styleType?: string; // override style directly if needed
}

export function VectorIllustration({ theme = "", title = "", className = "w-full h-full", styleType }: VectorIllustrationProps) {
  // Determine illustration type based on title, theme, or override styleType
  const textToScan = `${theme} ${title}`.toLowerCase();
  
  let selectedStyle = "default";
  
  if (styleType) {
    selectedStyle = styleType;
  } else if (textToScan.includes("宇宙") || textToScan.includes("探险") || textToScan.includes("火箭") || textToScan.includes("太空") || textToScan.includes("想象") || textToScan.includes("星空")) {
    selectedStyle = "space";
  } else if (textToScan.includes("森林") || textToScan.includes("动物") || textToScan.includes("熊") || textToScan.includes("自然") || textToScan.includes("户外")) {
    selectedStyle = "forest";
  } else if (textToScan.includes("睡前") || textToScan.includes("安抚") || textToScan.includes("怕黑") || textToScan.includes("睡觉") || textToScan.includes("夜") || textToScan.includes("梦")) {
    selectedStyle = "bedtime";
  } else if (textToScan.includes("勇敢") || textToScan.includes("自信") || textToScan.includes("困难") || textToScan.includes("不怕") || textToScan.includes("克服")) {
    selectedStyle = "courage";
  } else if (textToScan.includes("习惯") || textToScan.includes("收拾") || textToScan.includes("玩具") || textToScan.includes("刷牙") || textToScan.includes("整理") || textToScan.includes("自理")) {
    selectedStyle = "habit";
  } else if (textToScan.includes("社交") || textToScan.includes("情商") || textToScan.includes("朋友") || textToScan.includes("沟通") || textToScan.includes("分享") || textToScan.includes("幼儿园")) {
    selectedStyle = "social";
  } else if (textToScan.includes("安全") || textToScan.includes("防范") || textToScan.includes("红绿灯") || textToScan.includes("危险")) {
    selectedStyle = "safety";
  }

  // Draw vector SVGs
  switch (selectedStyle) {
    case "space":
      return (
        <svg viewBox="0 0 400 300" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="spaceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e1b4b" />
              <stop offset="50%" stopColor="#311042" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <linearGradient id="rocketGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#b91c1c" />
            </linearGradient>
            <linearGradient id="planetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          {/* Background */}
          <rect width="400" height="300" rx="16" fill="url(#spaceGrad)" />
          
          {/* Star particles */}
          <circle cx="80" cy="60" r="1.5" fill="#ffffff" opacity="0.8" />
          <circle cx="320" cy="50" r="2" fill="#ffffff" opacity="0.9" />
          <circle cx="50" cy="180" r="1" fill="#ffffff" opacity="0.6" />
          <circle cx="350" cy="220" r="1.5" fill="#ffffff" opacity="0.7" />
          <circle cx="210" cy="40" r="2.5" fill="#fbbf24" opacity="0.85" className="animate-pulse" />
          
          {/* Constellations lines (vector look) */}
          <path d="M 80 60 L 130 90 L 170 80" stroke="#f1f5f9" strokeWidth="0.5" strokeDasharray="3,3" fill="none" opacity="0.4" />
          
          {/* Saturn-like planet */}
          <g transform="translate(300, 120)">
            <ellipse cx="0" cy="0" rx="35" ry="8" fill="none" stroke="#f59e0b" strokeWidth="4" transform="rotate(-15)" opacity="0.7" />
            <circle cx="0" cy="0" r="18" fill="url(#planetGrad)" />
            <ellipse cx="0" cy="0" rx="35" ry="8" fill="none" stroke="#f59e0b" strokeWidth="4" transform="rotate(-15)" clipPath="url(#planetClip)" />
          </g>

          {/* Glowing Nebula */}
          <circle cx="100" cy="220" r="60" fill="#a855f7" opacity="0.15" filter="blur(20px)" />
          
          {/* Rocket Ship (vector style) */}
          <g transform="translate(160, 110) rotate(25)">
            {/* Thruster Flame */}
            <path d="M -10 60 L 0 85 L 10 60 Z" fill="#f97316" />
            <path d="M -5 60 L 0 75 L 5 60 Z" fill="#facc15" />
            
            {/* Rocket Fins */}
            <path d="M -22 35 L -35 55 L -15 50 Z" fill="#475569" />
            <path d="M 22 35 L 35 55 L 15 50 Z" fill="#475569" />
            
            {/* Rocket Body */}
            <path d="M -18 10 C -18 -30 0 -55 0 -55 C 0 -55 18 -30 18 10 L 15 55 L -15 55 Z" fill="#f8fafc" />
            
            {/* Red nose and stripes */}
            <path d="M -14 -15 C -10 -35 0 -55 0 -55 C 0 -55 10 -35 14 -15 Z" fill="url(#rocketGrad)" />
            
            {/* Window */}
            <circle cx="0" cy="5" r="9" fill="#38bdf8" stroke="#cbd5e1" strokeWidth="3" />
            <circle cx="-3" cy="2" r="3" fill="#ffffff" opacity="0.6" />
          </g>

          {/* Small floating astronaut or star */}
          <g transform="translate(70, 130) scale(0.8)">
            <circle cx="0" cy="0" r="12" fill="#e2e8f0" />
            <rect x="-8" y="2" width="16" height="15" rx="4" fill="#cbd5e1" />
            <rect x="-6" y="-4" width="12" height="6" rx="2" fill="#1e293b" />
          </g>
        </svg>
      );
    
    case "forest":
      return (
        <svg viewBox="0 0 400 300" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="forestGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#064e3b" />
              <stop offset="60%" stopColor="#065f46" />
              <stop offset="100%" stopColor="#0f766e" />
            </linearGradient>
            <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ecfdf5" />
              <stop offset="100%" stopColor="#a7f3d0" />
            </linearGradient>
          </defs>
          {/* Background */}
          <rect width="400" height="300" rx="16" fill="url(#skyGrad)" />
          
          {/* Glowing fireflies / Sparkles */}
          <circle cx="60" cy="110" r="3" fill="#fef08a" opacity="0.8" />
          <circle cx="120" cy="80" r="2" fill="#fef08a" opacity="0.9" />
          <circle cx="280" cy="70" r="4" fill="#fef08a" opacity="0.75" />
          <circle cx="340" cy="120" r="2.5" fill="#fef08a" opacity="0.85" />
          
          {/* Distant Hills */}
          <path d="M -50 300 Q 100 180 250 300 Z" fill="#047857" opacity="0.3" />
          <path d="M 150 300 Q 280 200 450 300 Z" fill="#115e59" opacity="0.4" />

          {/* Cute Geometric Pine Trees */}
          {/* Tree Left */}
          <g transform="translate(80, 220) scale(0.9)">
            <rect x="-6" y="0" width="12" height="60" fill="#78350f" rx="3" />
            <polygon points="0,-80 -45,-10 45,-10" fill="#065f46" />
            <polygon points="0,-110 -35,-40 35,-40" fill="#047857" />
            <polygon points="0,-130 -25,-60 25,-60" fill="#10b981" />
          </g>

          {/* Tree Right */}
          <g transform="translate(320, 210) scale(0.8)">
            <rect x="-6" y="0" width="12" height="60" fill="#78350f" rx="3" />
            <polygon points="0,-80 -40,-10 40,-10" fill="#0f766e" />
            <polygon points="0,-110 -30,-40 30,-40" fill="#115e59" />
            <polygon points="0,-130 -20,-60 20,-60" fill="#14b8a6" />
          </g>

          {/* Cute Central Animal (Geometric Little Fox or Bear) */}
          <g transform="translate(200, 210)">
            {/* Bear Body */}
            <ellipse cx="0" cy="25" rx="30" ry="25" fill="#7c2d12" />
            {/* Head */}
            <circle cx="0" cy="-10" r="20" fill="#9a3412" />
            {/* Ears */}
            <circle cx="-16" cy="-24" r="7" fill="#7c2d12" />
            <circle cx="-16" cy="-24" r="4" fill="#fdba74" />
            <circle cx="16" cy="-24" r="7" fill="#7c2d12" />
            <circle cx="16" cy="-24" r="4" fill="#fdba74" />
            {/* Snout */}
            <ellipse cx="0" cy="-6" rx="8" ry="6" fill="#fdba74" />
            <circle cx="0" cy="-8" r="3" fill="#1e293b" />
            {/* Eyes */}
            <circle cx="-7" cy="-14" r="2.5" fill="#1e293b" />
            <circle cx="7" cy="-14" r="2.5" fill="#1e293b" />
            <circle cx="-6" cy="-15" r="0.8" fill="#ffffff" />
            <circle cx="8" cy="-15" r="0.8" fill="#ffffff" />
            {/* Rosy Cheeks */}
            <circle cx="-13" cy="-8" r="3" fill="#fca5a5" opacity="0.6" />
            <circle cx="13" cy="-8" r="3" fill="#fca5a5" opacity="0.6" />
          </g>

          {/* Grass & flower patches on ground */}
          <rect x="0" y="260" width="400" height="40" fill="#064e3b" rx="8" />
          <circle cx="160" cy="270" r="3" fill="#f43f5e" />
          <circle cx="240" cy="275" r="2.5" fill="#facc15" />
        </svg>
      );

    case "bedtime":
      return (
        <svg viewBox="0 0 400 300" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="nightGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e1b4b" />
              <stop offset="50%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#312e81" />
            </linearGradient>
            <linearGradient id="moonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#facc15" />
            </linearGradient>
          </defs>
          {/* Background */}
          <rect width="400" height="300" rx="16" fill="url(#nightGrad)" />
          
          {/* Gentle starry dust */}
          <g fill="#ffffff" opacity="0.6">
            <circle cx="40" cy="50" r="1" />
            <circle cx="90" cy="130" r="1.5" />
            <circle cx="320" cy="80" r="1" />
            <circle cx="360" cy="160" r="1.2" />
            <circle cx="180" cy="70" r="2" />
          </g>
          
          {/* Big sleeping moon */}
          <g transform="translate(140, 120)">
            {/* Back glowing halo */}
            <circle cx="40" cy="10" r="65" fill="#fef08a" opacity="0.12" filter="blur(10px)" />
            
            {/* Crescent Moon */}
            <path d="M 0,-50 A 50,50 0 1,0 80,40 A 40,40 0 1,1 0,-50 Z" fill="url(#moonGrad)" />
            
            {/* Sleepy eye */}
            <path d="M 22, -2 A 4,4 0 0,1 30, -2" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" fill="none" />
            <line x1="22" y1="-4" x2="21" y2="-1" stroke="#1e293b" strokeWidth="1.2" />
            <line x1="30" y1="-4" x2="31" y2="-1" stroke="#1e293b" strokeWidth="1.2" />
            
            {/* Cute rosy cheek */}
            <circle cx="22" cy="6" r="4.5" fill="#f87171" opacity="0.5" />
            
            {/* Sleeping Cap */}
            <path d="M 12,-48 C 10,-58 20,-68 35,-65 C 45,-60 55,-50 65,-58 C 70,-62 72,-70 80,-70" fill="none" stroke="#60a5fa" strokeWidth="6" strokeLinecap="round" />
            <circle cx="80" cy="-70" r="5" fill="#ffffff" />
          </g>

          {/* Dreamy Fluffy Clouds */}
          <g fill="#f1f5f9" opacity="0.95">
            {/* Cloud Bottom Left */}
            <path d="M 60,240 C 60,220 80,210 100,210 C 110,195 130,195 140,210 C 150,210 170,220 170,240 Z" />
            {/* Cloud Bottom Right */}
            <path d="M 220,250 C 220,230 240,220 260,220 C 275,205 295,205 310,220 C 320,220 340,230 340,250 Z" fill="#cbd5e1" opacity="0.8" />
          </g>

          {/* Floating Dream Bubbles */}
          <circle cx="110" cy="180" r="6" fill="#a7f3d0" opacity="0.4" />
          <circle cx="280" cy="180" r="8" fill="#fbcfe8" opacity="0.4" />
          <circle cx="305" cy="150" r="4" fill="#bfdbfe" opacity="0.4" />
        </svg>
      );

    case "courage":
      return (
        <svg viewBox="0 0 400 300" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="courageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="50%" stopColor="#0369a1" />
              <stop offset="100%" stopColor="#1e3a8a" />
            </linearGradient>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          {/* Background */}
          <rect width="400" height="300" rx="16" fill="url(#courageGrad)" />

          {/* Mountain Peaks (representing challenges to overcome) */}
          <polygon points="200,80 340,300 60,300" fill="#0f172a" opacity="0.4" />
          <polygon points="150,110 260,300 40,300" fill="#1e293b" opacity="0.5" />

          {/* Snow cap representing conquest */}
          <polygon points="200,80 221,115 179,115" fill="#f8fafc" />

          {/* Golden Ladder rising to the star */}
          <g stroke="#fef08a" strokeWidth="2.5" opacity="0.85">
            <line x1="185" y1="280" x2="192" y2="140" />
            <line x1="215" y1="280" x2="208" y2="140" />
            {/* Rungs */}
            <line x1="187" y1="260" x2="213" y2="260" />
            <line x1="189" y1="230" x2="211" y2="230" strokeWidth="2" />
            <line x1="190" y1="200" x2="210" y2="200" strokeWidth="2" />
            <line x1="191" y1="170" x2="209" y2="170" strokeWidth="2" />
            <line x1="192" y1="145" x2="208" y2="145" strokeWidth="2" />
          </g>

          {/* Big shining star of courage at the peak */}
          <g transform="translate(200, 70)">
            <circle cx="0" cy="0" r="25" fill="#fbbf24" opacity="0.3" filter="blur(6px)" />
            {/* 8-pointed star */}
            <path d="M 0,-18 L 4,-5 L 17,-5 L 7,3 L 11,15 L 0,8 L -11,15 L -7,3 L -17,-5 L -4,-5 Z" fill="url(#goldGrad)" />
          </g>

          {/* Shield of Confidence / Protection */}
          <g transform="translate(80, 80) scale(0.8)">
            {/* Shield shape */}
            <path d="M -20,-30 L 20,-30 C 20,-30 25,0 20,20 C 15,35 0,45 0,45 C 0,45 -15,35 -20,20 C -25,0 -20,-30 -20,-30 Z" fill="url(#goldGrad)" stroke="#ffffff" strokeWidth="2" />
            {/* Inner emblem */}
            <path d="M 0,-15 L 3,-4 L 14,-4 L 5,2 L 8,12 L 0,6 L -8,12 L -5,2 L -14,-4 L -3,-4 Z" fill="#ffffff" />
          </g>

          {/* Little champion child silhouette climbing */}
          <g transform="translate(140, 220) scale(0.7)">
            <circle cx="0" cy="0" r="10" fill="#fef08a" />
            <path d="M -5,12 L 5,12 L 10,35 L -10,35 Z" fill="#38bdf8" />
            {/* Raised arms */}
            <line x1="-5" y1="16" x2="-18" y2="2" stroke="#fef08a" strokeWidth="4" strokeLinecap="round" />
            <line x1="5" y1="16" x2="18" y2="2" stroke="#fef08a" strokeWidth="4" strokeLinecap="round" />
          </g>
        </svg>
      );

    case "habit":
      return (
        <svg viewBox="0 0 400 300" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="habitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0e7490" />
              <stop offset="100%" stopColor="#155e75" />
            </linearGradient>
            <linearGradient id="toyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          {/* Background */}
          <rect width="400" height="300" rx="16" fill="url(#habitGrad)" />

          {/* Grid/Shelves of Neat Room (Habit of organizing) */}
          <rect x="40" y="80" width="320" height="180" fill="#164e63" rx="12" />
          <line x1="40" y1="170" x2="360" y2="170" stroke="#0891b2" strokeWidth="4" />
          
          {/* Tidy Toys on top shelf */}
          {/* Toy 1: Teddy Bear Face */}
          <g transform="translate(100, 130) scale(0.9)">
            <circle cx="0" cy="0" r="22" fill="#d97706" />
            <circle cx="-16" cy="-18" r="8" fill="#b45309" />
            <circle cx="-16" cy="-18" r="4" fill="#fef08a" />
            <circle cx="16" cy="-18" r="8" fill="#b45309" />
            <circle cx="16" cy="-18" r="4" fill="#fef08a" />
            {/* Eyes */}
            <circle cx="-7" cy="-5" r="2.5" fill="#1e293b" />
            <circle cx="7" cy="-5" r="2.5" fill="#1e293b" />
            {/* Muzzle */}
            <ellipse cx="0" cy="6" rx="8" ry="6" fill="#fef08a" />
            <polygon points="-3,5 3,5 0,8" fill="#1e293b" />
          </g>

          {/* Toy 2: Alphabet Blocks */}
          <g transform="translate(200, 130)">
            <rect x="-18" y="-18" width="36" height="36" fill="url(#toyGrad)" rx="6" />
            <text x="0" y="8" fill="#ffffff" fontSize="22" fontWeight="bold" textAnchor="middle">A</text>
          </g>
          <g transform="translate(240, 135) rotate(15)">
            <rect x="-14" y="-14" width="28" height="28" fill="#eab308" rx="4" />
            <text x="0" y="6" fill="#ffffff" fontSize="16" fontWeight="bold" textAnchor="middle">B</text>
          </g>

          {/* Bottom Shelf - Sparkling Clean Stars and Organizer Box */}
          <g transform="translate(120, 220)">
            <rect x="-40" y="-15" width="80" height="30" fill="#334155" rx="6" />
            <rect x="-35" y="-10" width="70" height="8" fill="#f8fafc" rx="2" opacity="0.8" />
            <text x="0" y="16" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">玩具收纳箱</text>
          </g>

          {/* Big shiny sparkles showing cleanliness */}
          <g fill="#22d3ee" className="animate-pulse">
            <path d="M 310,120 L 314,128 L 322,130 L 314,132 L 310,140 L 306,132 L 298,130 L 306,128 Z" />
            <path d="M 70,200 L 72,205 L 77,206 L 72,207 L 70,212 L 68,207 L 63,206 L 68,205 Z" />
            <path d="M 320,210 L 322,215 L 327,216 L 322,217 L 320,222 L 318,217 L 313,216 L 318,215 Z" />
          </g>

          {/* Habit checklist vector style */}
          <g transform="translate(300, 70) scale(0.7)">
            <rect x="-15" y="-15" width="30" height="30" fill="#10b981" rx="8" />
            <path d="M -7,0 L -2,5 L 7,-4" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" fill="none" />
          </g>
        </svg>
      );

    case "social":
      return (
        <svg viewBox="0 0 400 300" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="socialGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#fb7185" />
            </linearGradient>
            <linearGradient id="bubbleGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f1f5f9" />
            </linearGradient>
          </defs>
          {/* Background */}
          <rect width="400" height="300" rx="16" fill="url(#socialGrad)" />

          {/* Dynamic friendly background waves */}
          <path d="M 0,220 Q 100,160 200,220 T 400,220 L 400,300 L 0,300 Z" fill="#ffe4e6" opacity="0.2" />

          {/* Interlocking Chat Bubbles */}
          <g transform="translate(140, 110)">
            <path d="M -60,-35 L 20,-35 C 30,-35 35,-27 35,-15 L 35,15 C 35,25 25,30 15,30 L -40,30 L -60,45 L -55,30 L -60,30 C -70,30 -75,25 -75,15 L -75,-15 C -75,-27 -70,-35 -60,-35 Z" fill="url(#bubbleGrad1)" stroke="#fda4af" strokeWidth="1.5" />
            {/* Heart inside first bubble */}
            <path d="M -20,-8 C -25,-15 -35,-12 -35,-5 C -35,5 -20,13 -20,13 C -20,13 -5,5 -5,-5 C -5,-12 -15,-15 -20,-8 Z" fill="#f43f5e" />
          </g>

          <g transform="translate(250, 160)">
            <path d="M -40,-30 L 40,-30 C 50,-30 55,-22 55,-10 L 55,20 C 55,30 45,35 35,35 L 20,35 L 10,48 L 12,35 L -40,35 C -50,35 -55,30 -55,20 L -55,-10 C -55,-22 -50,-30 -40,-30 Z" fill="#ffe4e6" stroke="#f43f5e" strokeWidth="1.5" />
            {/* Happy smiley eyes and smile */}
            <circle cx="-10" cy="-2" r="2.5" fill="#be123c" />
            <circle cx="15" cy="-2" r="2.5" fill="#be123c" />
            <path d="M -5,10 Q 2,16 10,10" stroke="#be123c" strokeWidth="2" strokeLinecap="round" fill="none" />
          </g>

          {/* Handshake/Holding hands vectors or cute overlapping stars */}
          <g transform="translate(80, 210) scale(0.8)">
            <circle cx="0" cy="0" r="15" fill="#fef08a" stroke="#ca8a04" strokeWidth="2" />
            <circle cx="-5" cy="-3" r="2" fill="#854d0e" />
            <circle cx="5" cy="-3" r="2" fill="#854d0e" />
            <path d="M -4,5 Q 0,9 4,5" stroke="#854d0e" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </g>
          <g transform="translate(115, 215) scale(0.7)">
            <circle cx="0" cy="0" r="15" fill="#bfdbfe" stroke="#2563eb" strokeWidth="2" />
            <circle cx="-5" cy="-3" r="2" fill="#1e3a8a" />
            <circle cx="5" cy="-3" r="2" fill="#1e3a8a" />
            <path d="M -4,5 Q 0,9 4,5" stroke="#1e3a8a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </g>
          {/* Linked line */}
          <line x1="80" y1="210" x2="115" y2="215" stroke="#be123c" strokeWidth="3" strokeLinecap="round" strokeDasharray="1,5" />
        </svg>
      );

    case "safety":
      return (
        <svg viewBox="0 0 400 300" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="safetyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e3a8a" />
              <stop offset="100%" stopColor="#1e1b4b" />
            </linearGradient>
            <linearGradient id="shieldGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
          </defs>
          <rect width="400" height="300" rx="16" fill="url(#safetyGrad)" />
          
          {/* Guardian Shield Vector */}
          <g transform="translate(200, 135) scale(1.3)">
            {/* Soft backdrop glow */}
            <circle cx="0" cy="0" r="45" fill="#fef08a" opacity="0.1" filter="blur(8px)" />
            
            {/* Outer Shield */}
            <path d="M -25,-35 L 25,-35 C 25,-35 30,-5 25,20 C 18,36 0,46 0,46 C 0,46 -18,36 -25,20 C -30,-5 -25,-35 -25,-35 Z" fill="url(#shieldGold)" stroke="#ffffff" strokeWidth="2" />
            
            {/* Inner green/secure check shield */}
            <path d="M -18,-29 L 18,-29 C 18,-29 22,-5 18,16 C 13,29 0,38 0,38 C 0,38 -13,29 -18,16 C -22,-5 -18,-29 -18,-29 Z" fill="#10b981" />
            
            {/* Giant clean check mark inside shield */}
            <path d="M -8,2 L -2,8 L 10,-4" fill="none" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>

          {/* Safety traffic elements (lights) */}
          <g transform="translate(70, 150) scale(0.9)">
            <rect x="-12" y="-30" width="24" height="68" fill="#334155" rx="6" />
            <circle cx="0" cy="-18" r="6" fill="#ef4444" />
            <circle cx="0" cy="4" r="6" fill="#facc15" opacity="0.4" />
            <circle cx="0" cy="26" r="6" fill="#22c55e" opacity="0.4" />
          </g>

          {/* Safety umbrella representing shelter */}
          <g transform="translate(320, 150) scale(0.9)">
            <path d="M -25,0 C -25,-25 25,-25 25,0 Z" fill="#60a5fa" />
            <path d="M -25,0 Q -12.5,-5 0,0 Q 12.5,-5 25,0 Z" fill="#2563eb" />
            {/* Handle */}
            <path d="M 0,0 L 0,20 Q 0,26 -5,26" fill="none" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
          </g>
        </svg>
      );

    default:
      // A beautiful magic fairytale book with opening pages and stars
      return (
        <svg viewBox="0 0 400 300" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="defaultGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="50%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
            <linearGradient id="bookCoverGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e1b4b" />
              <stop offset="100%" stopColor="#311042" />
            </linearGradient>
          </defs>
          {/* Background */}
          <rect width="400" height="300" rx="16" fill="url(#defaultGrad)" />
          
          {/* Sparkling magic particles */}
          <g fill="#ffffff" opacity="0.75" className="animate-pulse">
            <circle cx="120" cy="70" r="2.5" />
            <circle cx="280" cy="80" r="1.5" />
            <circle cx="70" cy="180" r="2" />
            <circle cx="340" cy="160" r="3" />
            <circle cx="200" cy="50" r="1.5" />
          </g>

          {/* Fairy dust swoosh */}
          <path d="M 60,110 Q 200,30 340,110" fill="none" stroke="#fef08a" strokeWidth="1.5" strokeDasharray="4,4" opacity="0.6" />

          {/* Magic Fairy Book */}
          <g transform="translate(110, 110)">
            {/* Book outer cover shadows */}
            <rect x="-10" y="5" width="200" height="110" rx="8" fill="#0f172a" opacity="0.4" />
            
            {/* Book Leather Cover */}
            <rect x="-8" y="0" width="196" height="110" rx="6" fill="url(#bookCoverGrad)" stroke="#fcd34d" strokeWidth="1" />
            
            {/* Book Spine */}
            <rect x="85" y="0" width="10" height="110" fill="#4c1d95" />

            {/* Left Page */}
            <path d="M 5,5 L 85,10 L 85,100 L 5,95 Z" fill="#f8fafc" />
            
            {/* Right Page */}
            <path d="M 175,5 L 95,10 L 95,100 L 175,95 Z" fill="#ffffff" />
            
            {/* Content text lines (vector block style) */}
            <line x1="15" y1="25" x2="70" y2="28" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
            <line x1="15" y1="40" x2="65" y2="43" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
            <line x1="15" y1="55" x2="75" y2="58" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
            <line x1="15" y1="70" x2="60" y2="73" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />

            {/* Right page cute illustration box */}
            <rect x="105" y="20" width="60" height="40" fill="#ede9fe" rx="4" />
            {/* Tiny illustration tree */}
            <polygon points="135,25 120,48 150,48" fill="#8b5cf6" />
            <rect x="133" y="48" width="4" height="8" fill="#7c3aed" />

            {/* Content text lines below right illustration */}
            <line x1="105" y1="72" x2="165" y2="69" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
            <line x1="105" y1="84" x2="155" y2="81" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
          </g>

          {/* Magic spark emanating from book center */}
          <g transform="translate(200, 115) scale(0.9)">
            <circle cx="0" cy="0" r="12" fill="#fbbf24" opacity="0.3" filter="blur(4px)" />
            <path d="M 0,-15 L 3,-4 L 14,-4 L 5,2 L 8,12 L 0,6 L -8,12 L -5,2 L -14,-4 L -3,-4 Z" fill="#fef08a" />
          </g>
        </svg>
      );
  }
}
