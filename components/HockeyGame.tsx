import React, { useRef, useEffect, useState } from "react";

const PUCK_RADIUS = 10;
const FRICTION = 0.925; // Doubled friction (closer to 1 = less friction, closer to 0 = more friction)
const WALL_BOUNCE = 0.9;
const VELOCITY_THRESHOLD = 0.2; // Lowered threshold - puck will stop only when movement is imperceptible
const BORDER_WIDTH = 30; // Width of the side borders
const BORDER_COLOR = "#4a2506"; // Dark brown color for wooden borders
const TABLE_COLOR = "#1e293b"; // Existing table color
const HOLE_RADIUS = 30;
const SINK_ANIMATION_DURATION = 500; // milliseconds
const HOLE_VERTICAL_SPACING = 300; // Space between holes vertically
const TARGET_RADIUS = 15;
const DISK_BOUNCE = 0.95; // Slightly more bouncy than walls
const TARGETS_PER_SECTION = 3; // Number of targets to spawn per section
const DEBUG_MODE = true; // Add this to toggle collision boundary visualization
const COLLISION_MULTIPLIER = 1.2;

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

interface Target {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'blue' | 'red';
  scale: number;
  isVisible: boolean;
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
  const [targets, setTargets] = useState<Target[]>([]);
  const [score, setScore] = useState(0);

  // Generate random targets for a section
  const generateTargetsForSection = (sectionY: number) => {
    const newTargets: Target[] = [];
    for (let i = 0; i < TARGETS_PER_SECTION; i++) {
      const x = BORDER_WIDTH + TARGET_RADIUS + Math.random() * (canvasSize.width - 2 * (BORDER_WIDTH + TARGET_RADIUS));
      const y = sectionY + Math.random() * HOLE_VERTICAL_SPACING;
      newTargets.push({
        x,
        y,
        vx: 0,
        vy: 0,
        type: Math.random() > 0.7 ? 'red' : 'blue', // 30% chance for red targets
        scale: 1,
        isVisible: true
      });
    }
    return newTargets;
  };

  // Generate holes and targets for the fixed table
  useEffect(() => {
    // Fixed holes at regular intervals
    const newHoles: Hole[] = [];
    const newTargets: Target[] = [];
    const sections = Math.floor(canvasSize.height / HOLE_VERTICAL_SPACING);
    
    for (let i = 0; i <= sections; i++) {
      const y = (i + 0.5) * HOLE_VERTICAL_SPACING; // Center holes in each section
      if (y < canvasSize.height - HOLE_RADIUS) { // Only add if fully visible
        newHoles.push(
          { x: BORDER_WIDTH, y },
          { x: canvasSize.width - BORDER_WIDTH, y }
        );
        newTargets.push(...generateTargetsForSection(y));
      }
    }
    
    setHoles(newHoles);
    setTargets(newTargets);
  }, [canvasSize.height]);

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

  // Check collisions between puck and targets
  const handleTargetCollisions = (puckX: number, puckY: number, puckVx: number, puckVy: number) => {
    let finalPuckVx = puckVx;
    let finalPuckVy = puckVy;
    let hasCollision = false;

    setTargets(prev => prev.map(target => {
      if (!target.isVisible) return target;

      const dx = target.x - puckX;
      const dy = target.y - puckY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = (PUCK_RADIUS + TARGET_RADIUS) * COLLISION_MULTIPLIER;

      if (distance < minDistance) {
        hasCollision = true;

        // Normalize the collision vector
        const nx = dx / distance;
        const ny = dy / distance;

        // Get the puck's incoming velocity magnitude
        const speed = Math.sqrt(finalPuckVx * finalPuckVx + finalPuckVy * finalPuckVy);

        // Target moves in the direction of impact (opposite to the bounce)
        const newTargetVx = -finalPuckVx * DISK_BOUNCE;
        const newTargetVy = -finalPuckVy * DISK_BOUNCE;

        // Puck bounces back
        finalPuckVx = finalPuckVx * WALL_BOUNCE;
        finalPuckVy = finalPuckVy * WALL_BOUNCE;

        // Move objects apart to prevent sticking
        const overlap = minDistance - distance;
        const pushX = nx * overlap / 2;
        const pushY = ny * overlap / 2;

        return {
          ...target,
          x: target.x + pushX,
          y: target.y + pushY,
          vx: newTargetVx,
          vy: newTargetVy
        };
      }
      return target;
    }));

    return { vx: finalPuckVx, vy: finalPuckVy, hasCollision };
  };

  // Check if target is in a hole
  const checkTargetHoleCollision = (target: Target) => {
    return holes.some(hole => {
      const isOnCorrectSide = hole.x < canvasSize.width / 2 ? 
        target.x > hole.x : 
        target.x < hole.x;

      const dist = distance(target.x, target.y, hole.x, hole.y);
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
    if (dragging || (!isMoving && !targets.some(t => Math.abs(t.vx) > 0.1 || Math.abs(t.vy) > 0.1))) return;
    
    let animation: number;
    const step = () => {
      let { x, y, vx, vy } = puck;
      
      // Store previous position for collision resolution
      const prevX = x;
      const prevY = y;

      // Update puck position
      x += vx;
      y += vy;

      // Handle collisions with targets
      const newVelocities = handleTargetCollisions(x, y, vx, vy);
      
      // If collision occurred, adjust position and velocity
      if (newVelocities.hasCollision) {
        // Move back slightly from collision point
        x = prevX + (x - prevX) * 0.5;
        y = prevY + (y - prevY) * 0.5;
        vx = newVelocities.vx * DISK_BOUNCE;
        vy = newVelocities.vy * DISK_BOUNCE;
      } else {
        vx = newVelocities.vx;
        vy = newVelocities.vy;
      }

      // Apply friction after collision
      vx *= FRICTION;
      vy *= FRICTION;

      // Wall collisions for puck
      if (x - PUCK_RADIUS < BORDER_WIDTH) {
        x = BORDER_WIDTH + PUCK_RADIUS;
        vx = -vx * WALL_BOUNCE;
      }
      if (x + PUCK_RADIUS > canvasSize.width - BORDER_WIDTH) {
        x = canvasSize.width - BORDER_WIDTH - PUCK_RADIUS;
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

      // Update targets with continuous collision detection
      setTargets(prev => prev.map(target => {
        if (!target.isVisible) return target;

        let { x: tx, y: ty, vx: tvx, vy: tvy } = target;
        
        // Store previous position
        const prevTx = tx;
        const prevTy = ty;
        
        // Update position
        tx += tvx;
        ty += tvy;

        // Wall collisions for targets
        if (tx - TARGET_RADIUS < BORDER_WIDTH) {
          tx = BORDER_WIDTH + TARGET_RADIUS;
          tvx = -tvx * WALL_BOUNCE;
        }
        if (tx + TARGET_RADIUS > canvasSize.width - BORDER_WIDTH) {
          tx = canvasSize.width - BORDER_WIDTH - TARGET_RADIUS;
          tvx = -tvx * WALL_BOUNCE;
        }
        if (ty - TARGET_RADIUS < 0) {
          ty = TARGET_RADIUS;
          tvy = -tvy * WALL_BOUNCE;
        }
        if (ty + TARGET_RADIUS > canvasSize.height) {
          ty = canvasSize.height - TARGET_RADIUS;
          tvy = -tvy * WALL_BOUNCE;
        }

        // Apply friction after movement and collisions
        tvx *= FRICTION;
        tvy *= FRICTION;

        // Check if target fell in hole
        if (checkTargetHoleCollision(target)) {
          setScore(s => s + (target.type === 'red' ? 25 : 10));
          return { ...target, isVisible: false };
        }

        return { ...target, x: tx, y: ty, vx: tvx, vy: tvy };
      }));

      // Check for hole collision
      if (checkHoleCollision()) {
        setIsSinking(true);
        return;
      }

      // Check if everything has stopped moving
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
  }, [dragging, isMoving, puck, canvasSize, isSinking, targets]);

  // Draw everything
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Draw table background
    ctx.fillStyle = TABLE_COLOR;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // Draw borders
    ctx.fillStyle = BORDER_COLOR;
    ctx.fillRect(0, 0, BORDER_WIDTH, canvasSize.height); // Left border
    ctx.fillRect(canvasSize.width - BORDER_WIDTH, 0, BORDER_WIDTH, canvasSize.height); // Right border

    // Add cushion highlights
    const gradient = ctx.createLinearGradient(0, 0, BORDER_WIDTH, 0);
    gradient.addColorStop(0, "#3d1e05");
    gradient.addColorStop(1, "#5c2e07");
    
    ctx.fillStyle = gradient;
    ctx.fillRect(BORDER_WIDTH - 5, 0, 5, canvasSize.height);
    
    const gradientRight = ctx.createLinearGradient(canvasSize.width - BORDER_WIDTH, 0, canvasSize.width, 0);
    gradientRight.addColorStop(0, "#5c2e07");
    gradientRight.addColorStop(1, "#3d1e05");
    ctx.fillStyle = gradientRight;
    ctx.fillRect(canvasSize.width - BORDER_WIDTH, 0, 5, canvasSize.height);

    // Draw holes
    holes.forEach(hole => {
      ctx.beginPath();
      const startAngle = hole.x < canvasSize.width / 2 ? -Math.PI/2 : Math.PI/2;
      ctx.arc(hole.x, hole.y, HOLE_RADIUS, startAngle, startAngle + Math.PI);
      ctx.fillStyle = "#000000";
      ctx.fill();
      
      const holeGradient = ctx.createRadialGradient(
        hole.x, hole.y, 0,
        hole.x, hole.y, HOLE_RADIUS
      );
      holeGradient.addColorStop(0, "rgba(0, 0, 0, 0.8)");
      holeGradient.addColorStop(1, "rgba(0, 0, 0, 1)");
      ctx.fillStyle = holeGradient;
      ctx.fill();

      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw targets
    targets.forEach(target => {
      if (!target.isVisible) return;
      
      // Draw target disk
      ctx.beginPath();
      ctx.arc(target.x, target.y, TARGET_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = target.type === 'red' ? '#ef4444' : '#3b82f6';
      ctx.fill();
      
      // Draw stripes
      ctx.save();
      ctx.clip();
      for (let i = -TARGET_RADIUS; i <= TARGET_RADIUS; i += 8) {
        ctx.beginPath();
        ctx.moveTo(target.x - TARGET_RADIUS, target.y + i);
        ctx.lineTo(target.x + TARGET_RADIUS, target.y + i);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();
      
      ctx.strokeStyle = target.type === 'red' ? '#b91c1c' : '#1d4ed8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw collision boundary if debug mode is on
      if (DEBUG_MODE) {
        ctx.beginPath();
        ctx.arc(target.x, target.y, TARGET_RADIUS * 1.2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.lineWidth = 1;
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

    // Draw puck collision boundary if debug mode is on
    if (DEBUG_MODE) {
      ctx.beginPath();
      ctx.arc(puck.x, puck.y, PUCK_RADIUS * 1.2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw score
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "right";
    ctx.fillText(`Score: ${score}`, canvasSize.width - 40, 40);

    // Draw drag arrow
    if (dragging && dragStart && dragEnd) {
      const dx = dragStart.x - dragEnd.x;
      const dy = dragStart.y - dragEnd.y;
      const dragDistance = Math.sqrt(dx * dx + dy * dy);
      const maxLength = 150;
      const scale = Math.min(1, maxLength / (dragDistance || 1));
      drawArrow(ctx, puck.x, puck.y, dx * scale, dy * scale);
    }
  }, [puck, dragging, dragStart, dragEnd, canvasSize, puckScale, holes, targets, score]);

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