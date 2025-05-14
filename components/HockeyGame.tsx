import React, { useRef, useEffect, useState } from "react";

const PUCK_RADIUS = 10;
const FRICTION = 0.9; // Doubled friction (closer to 1 = less friction, closer to 0 = more friction)
const WALL_BOUNCE = 0.9;
const VELOCITY_THRESHOLD = 0.15; // Lowered threshold - puck will stop only when movement is imperceptible

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

export default function HockeyGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [puck, setPuck] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2, vx: 0, vy: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);
  const [isMoving, setIsMoving] = useState(false);

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

  // Draw everything
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Draw table
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // Draw puck
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, PUCK_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw drag arrow
    if (dragging && dragStart && dragEnd) {
      const dx = dragStart.x - dragEnd.x;
      const dy = dragStart.y - dragEnd.y;
      // Scale the arrow length based on drag distance
      const dragDistance = Math.sqrt(dx * dx + dy * dy);
      const maxLength = 150; // Maximum arrow length
      const scale = Math.min(1, maxLength / (dragDistance || 1));
      drawArrow(ctx, puck.x, puck.y, dx * scale, dy * scale);
    }
  }, [puck, dragging, dragStart, dragEnd, canvasSize]);

  // Physics loop
  useEffect(() => {
    if (dragging || !isMoving) return;
    
    let animation: number;
    const step = () => {
      let { x, y, vx, vy } = puck;
      x += vx;
      y += vy;
      vx *= FRICTION;
      vy *= FRICTION;

      // Wall collision
      if (x - PUCK_RADIUS < 0) {
        x = PUCK_RADIUS;
        vx = -vx * WALL_BOUNCE;
      }
      if (x + PUCK_RADIUS > canvasSize.width) {
        x = canvasSize.width - PUCK_RADIUS;
        vx = -vx * WALL_BOUNCE;
      }
      if (y - PUCK_RADIUS < 0) {
        y = PUCK_RADIUS;
        vy = -vy * WALL_BOUNCE;
      }
      if (y + PUCK_RADIUS > canvasSize.height) {
        y = canvasSize.height - PUCK_RADIUS;
        vy = -vy * WALL_BOUNCE;
      }

      // Check if puck has slowed enough to stop
      if (Math.abs(vx) < VELOCITY_THRESHOLD && Math.abs(vy) < VELOCITY_THRESHOLD) {
        setPuck({ x, y, vx: 0, vy: 0 }); // Stop completely
        setIsMoving(false);
        return;
      }

      setPuck({ x, y, vx, vy });
      animation = requestAnimationFrame(step);
    };
    
    animation = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animation);
  }, [dragging, isMoving, puck, canvasSize]);

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