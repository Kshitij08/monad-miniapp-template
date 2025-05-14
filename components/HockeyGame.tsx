import React, { useRef, useEffect, useState } from "react";

const PUCK_RADIUS = 10;
const FRICTION = 0.9; // Doubled friction (closer to 1 = less friction, closer to 0 = more friction)
const WALL_BOUNCE = 0.9;
const VELOCITY_THRESHOLD = 0.15; // Lowered threshold - puck will stop only when movement is imperceptible
const BORDER_WIDTH = 30; // Width of the side borders
const BORDER_COLOR = "#4a2506"; // Dark brown color for wooden borders
const TABLE_COLOR = "#1e293b"; // Existing table color
const HOLE_RADIUS = 30;
const SINK_ANIMATION_DURATION = 500; // milliseconds
const HOLE_VERTICAL_SPACING = 300; // Space between holes vertically

function distance(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function drawArrow(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, dx: number, dy: number) {
  const headLength = 20; // Length of arrow head
  const angle = Math.atan2(dy, dx);
  const length = Math.sqrt(dx * dx + dy * dy);

  // Draw the main line
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(fromX + dx, fromY + dy);
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw the arrow head
  ctx.beginPath();
  ctx.moveTo(fromX + dx, fromY + dy);
  ctx.lineTo(
    fromX + dx - headLength * Math.cos(angle - Math.PI / 6),
    fromY + dy - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    fromX + dx - headLength * Math.cos(angle + Math.PI / 6),
    fromY + dy - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fillStyle = "#38bdf8";
  ctx.fill();
}

interface Hole {
  x: number;
  y: number;
}

export default function HockeyGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [puck, setPuck] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2, vx: 0, vy: 0 });
  const [puckScale, setPuckScale] = useState(1); // New state for puck scaling animation
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isSinking, setIsSinking] = useState(false); // New state for sinking animation
  const [viewOffset, setViewOffset] = useState(0); // Track vertical scroll position
  const [holes, setHoles] = useState<Hole[]>([]); // Dynamic holes array

  // Generate holes for a given vertical range
  const generateHolesForRange = (startY: number, endY: number) => {
    const newHoles: Hole[] = [];
    const startSection = Math.floor(startY / HOLE_VERTICAL_SPACING);
    const endSection = Math.ceil(endY / HOLE_VERTICAL_SPACING);

    for (let i = startSection; i <= endSection; i++) {
      const y = i * HOLE_VERTICAL_SPACING;
      newHoles.push(
        { x: BORDER_WIDTH, y }, // Left hole
        { x: canvasSize.width - BORDER_WIDTH, y } // Right hole
      );
    }
    return newHoles;
  };

  // Update holes when view changes
  useEffect(() => {
    const visibleStart = viewOffset - canvasSize.height;
    const visibleEnd = viewOffset + canvasSize.height * 2;
    setHoles(generateHolesForRange(visibleStart, visibleEnd));
  }, [viewOffset, canvasSize.height]);

  // Function to check if puck is in a hole
  const checkHoleCollision = () => {
    return holes.some(hole => {
      const isOnCorrectSide = hole.x < canvasSize.width / 2 ? 
        puck.x > hole.x : 
        puck.x < hole.x;

      const dist = distance(puck.x, puck.y + viewOffset, hole.x, hole.y);
      return dist < HOLE_RADIUS && isOnCorrectSide;
    });
  };

  // Function to reset puck to center
  const resetPuck = () => {
    setPuck({
      x: canvasSize.width / 2,
      y: canvasSize.height / 2,
      vx: 0,
      vy: 0
    });
    setPuckScale(1);
    setIsSinking(false);
    setIsMoving(false);
  };

  // Handle puck sinking animation
  useEffect(() => {
    if (isSinking) {
      let startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / SINK_ANIMATION_DURATION, 1);
        setPuckScale(1 - progress);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resetPuck();
        }
      };
      requestAnimationFrame(animate);
    }
  }, [isSinking]);

  // Responsive canvas
  useEffect(() => {
    function handleResize() {
      if (containerRef.current) {
        const width = window.innerWidth;
        const height = window.innerHeight - 40; // Account for the instruction text
        setCanvasSize({ width, height });
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Physics loop
  useEffect(() => {
    if (dragging || !isMoving || isSinking) return;
    
    let animation: number;
    const step = () => {
      let { x, y, vx, vy } = puck;
      x += vx;
      y += vy;
      vx *= FRICTION;
      vy *= FRICTION;

      // Update view offset when puck moves vertically
      if (y > canvasSize.height * 0.7) {
        const diff = y - canvasSize.height * 0.7;
        y -= diff;
        setViewOffset(prev => prev + diff);
      } else if (y < canvasSize.height * 0.3) {
        const diff = canvasSize.height * 0.3 - y;
        y += diff;
        setViewOffset(prev => prev - diff);
      }

      // Horizontal wall collision
      if (x - PUCK_RADIUS < BORDER_WIDTH) {
        x = BORDER_WIDTH + PUCK_RADIUS;
        vx = -vx * WALL_BOUNCE;
      }
      if (x + PUCK_RADIUS > canvasSize.width - BORDER_WIDTH) {
        x = canvasSize.width - BORDER_WIDTH - PUCK_RADIUS;
        vx = -vx * WALL_BOUNCE;
      }

      // Check for hole collision
      if (checkHoleCollision()) {
        setIsSinking(true);
        return;
      }

      // Check if puck has slowed enough to stop
      if (Math.abs(vx) < VELOCITY_THRESHOLD && Math.abs(vy) < VELOCITY_THRESHOLD) {
        setPuck({ x, y, vx: 0, vy: 0 });
        setIsMoving(false);
        return;
      }

      setPuck({ x, y, vx, vy });
      animation = requestAnimationFrame(step);
    };
    
    animation = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animation);
  }, [dragging, isMoving, puck, canvasSize, isSinking, viewOffset]);

  // Draw everything
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Draw table background
    ctx.fillStyle = TABLE_COLOR;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // Draw borders (only sides now)
    ctx.fillStyle = BORDER_COLOR;
    ctx.fillRect(0, 0, BORDER_WIDTH, canvasSize.height); // Left border
    ctx.fillRect(canvasSize.width - BORDER_WIDTH, 0, BORDER_WIDTH, canvasSize.height); // Right border

    // Add cushion highlights (only for side borders)
    const gradient = ctx.createLinearGradient(0, 0, BORDER_WIDTH, 0);
    gradient.addColorStop(0, "#3d1e05");
    gradient.addColorStop(1, "#5c2e07");
    
    // Left cushion highlight
    ctx.fillStyle = gradient;
    ctx.fillRect(BORDER_WIDTH - 5, 0, 5, canvasSize.height);
    
    // Right cushion highlight
    const gradientRight = ctx.createLinearGradient(canvasSize.width - BORDER_WIDTH, 0, canvasSize.width, 0);
    gradientRight.addColorStop(0, "#5c2e07");
    gradientRight.addColorStop(1, "#3d1e05");
    ctx.fillStyle = gradientRight;
    ctx.fillRect(canvasSize.width - BORDER_WIDTH, 0, 5, canvasSize.height);

    // Draw holes
    holes.forEach(hole => {
      const adjustedY = hole.y - viewOffset;
      
      // Only draw holes that are visible
      if (adjustedY > -HOLE_RADIUS && adjustedY < canvasSize.height + HOLE_RADIUS) {
        ctx.beginPath();
        const startAngle = hole.x < canvasSize.width / 2 ? -Math.PI/2 : Math.PI/2;
        ctx.arc(hole.x, adjustedY, HOLE_RADIUS, startAngle, startAngle + Math.PI);
        ctx.fillStyle = "#000000";
        ctx.fill();
        
        const holeGradient = ctx.createRadialGradient(
          hole.x, adjustedY, 0,
          hole.x, adjustedY, HOLE_RADIUS
        );
        holeGradient.addColorStop(0, "rgba(0, 0, 0, 0.8)");
        holeGradient.addColorStop(1, "rgba(0, 0, 0, 1)");
        ctx.fillStyle = holeGradient;
        ctx.fill();

        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // Draw puck
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, PUCK_RADIUS * puckScale, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2 * puckScale;
    ctx.stroke();

    // Draw drag arrow
    if (dragging && dragStart && dragEnd) {
      const dx = dragStart.x - dragEnd.x;
      const dy = dragStart.y - dragEnd.y;
      const dragDistance = Math.sqrt(dx * dx + dy * dy);
      const maxLength = 150;
      const scale = Math.min(1, maxLength / (dragDistance || 1));
      drawArrow(ctx, puck.x, puck.y, dx * scale, dy * scale);
    }
  }, [puck, dragging, dragStart, dragEnd, canvasSize, puckScale, viewOffset, holes]);

  // Mouse/touch handlers
  const getPointerPos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvasSize.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvasSize.height;
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isMoving) return; // Don't allow new shots while puck is moving
    const pos = getPointerPos(e);
    setDragging(true);
    setDragStart(pos);
    setDragEnd(pos);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || isMoving) return;
    const pos = getPointerPos(e);
    setDragEnd(pos);
  };

  const handlePointerUp = () => {
    if (dragging && dragStart && dragEnd && !isMoving) {
      // Calculate velocity based on drag vector (from start to end)
      const dx = dragStart.x - dragEnd.x;
      const dy = dragStart.y - dragEnd.y;
      // Scale the velocity based on drag distance
      const dragDistance = Math.sqrt(dx * dx + dy * dy);
      const scale = 0.1; // Adjust this value to control shot power
      setPuck((p) => ({
        ...p,
        vx: dx * scale,
        vy: dy * scale,
      }));
      setIsMoving(true);
    }
    setDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  return (
    <div ref={containerRef} style={{ width: "100vw", height: "100vh", margin: 0, padding: 0 }}>
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        style={{
          background: "#1e293b",
          touchAction: "none",
          width: "100%",
          height: "calc(100% - 40px)",
          display: "block"
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div className="text-center mt-2 text-sm text-gray-400">
        Drag anywhere to shoot the puck!
      </div>
    </div>
  );
} 