"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Platform = Rect & {
  kind: "platform";
};

type BouncePad = Rect & {
  kind: "bounce";
  strength: number;
};

type Coin = {
  x: number;
  y: number;
  radius: number;
  collected: boolean;
};

type Goal = Rect;

type Status = "playing" | "won" | "lost";

type GameState = {
  player: {
    x: number;
    y: number;
    width: number;
    height: number;
    velocityX: number;
    velocityY: number;
    facing: 1 | -1;
    onGround: boolean;
  };
  platforms: Platform[];
  bouncePads: BouncePad[];
  surfaces: Array<Platform | BouncePad>;
  coins: Coin[];
  goal: Goal;
  camera: { x: number; y: number };
  timeLeft: number;
  collectedCoins: number;
  status: Status;
};

type UiSnapshot = {
  time: number;
  coins: number;
  totalCoins: number;
  status: Status;
};

type InputState = {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpQueued: boolean;
};

const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1200;
const INITIAL_TIME = 75;
const MOVE_SPEED = 360;
const JUMP_FORCE = -750;
const GRAVITY = 2200;
const MAX_FALL_SPEED = 1600;

const LEVEL_BLUEPRINT = {
  start: { x: 140, y: 720 },
  goal: { x: 2160, y: 240, width: 130, height: 160 } satisfies Goal,
  platforms: [
    { x: 0, y: 900, width: 720, height: 48, kind: "platform" },
    { x: 760, y: 900, width: 420, height: 48, kind: "platform" },
    { x: 1220, y: 840, width: 320, height: 42, kind: "platform" },
    { x: 1120, y: 680, width: 220, height: 32, kind: "platform" },
    { x: 960, y: 560, width: 180, height: 28, kind: "platform" },
    { x: 1360, y: 560, width: 220, height: 28, kind: "platform" },
    { x: 1580, y: 480, width: 210, height: 28, kind: "platform" },
    { x: 1780, y: 420, width: 190, height: 28, kind: "platform" },
    { x: 1960, y: 360, width: 180, height: 28, kind: "platform" },
    { x: 2100, y: 300, width: 220, height: 24, kind: "platform" },
    { x: 440, y: 760, width: 180, height: 28, kind: "platform" },
    { x: 620, y: 640, width: 160, height: 24, kind: "platform" },
    { x: 420, y: 520, width: 160, height: 24, kind: "platform" },
    { x: 300, y: 420, width: 140, height: 24, kind: "platform" },
    { x: 520, y: 340, width: 160, height: 24, kind: "platform" },
    { x: 760, y: 300, width: 160, height: 24, kind: "platform" },
  ] satisfies Platform[],
  bouncePads: [
    { x: 700, y: 852, width: 60, height: 16, kind: "bounce", strength: 1150 },
    { x: 1250, y: 804, width: 60, height: 16, kind: "bounce", strength: 1050 },
    { x: 1500, y: 448, width: 60, height: 16, kind: "bounce", strength: 1180 },
    { x: 1820, y: 384, width: 60, height: 16, kind: "bounce", strength: 1120 },
  ] satisfies BouncePad[],
  coins: [
    { x: 120, y: 840, radius: 18, collected: false },
    { x: 220, y: 840, radius: 18, collected: false },
    { x: 320, y: 840, radius: 18, collected: false },
    { x: 560, y: 700, radius: 18, collected: false },
    { x: 660, y: 580, radius: 18, collected: false },
    { x: 820, y: 520, radius: 18, collected: false },
    { x: 1080, y: 640, radius: 18, collected: false },
    { x: 1280, y: 520, radius: 18, collected: false },
    { x: 1480, y: 520, radius: 18, collected: false },
    { x: 1700, y: 420, radius: 18, collected: false },
    { x: 1880, y: 360, radius: 18, collected: false },
    { x: 2080, y: 280, radius: 18, collected: false },
    { x: 2200, y: 260, radius: 18, collected: false },
  ] satisfies Coin[],
};

const SOLID_FLOOR: Platform = {
  x: -600,
  y: 1040,
  width: WORLD_WIDTH + 1200,
  height: 160,
  kind: "platform",
};

function cloneCoins(): Coin[] {
  return LEVEL_BLUEPRINT.coins.map((coin) => ({ ...coin, collected: false }));
}

function updateGame(game: GameState, delta: number, input: InputState) {
  game.timeLeft = Math.max(0, game.timeLeft - delta);
  if (game.timeLeft <= 0) {
    game.status = "lost";
    return;
  }

  const player = game.player;
  const wasGrounded = player.onGround;
  player.onGround = false;

  player.velocityX = 0;
  if (input.left) {
    player.velocityX -= MOVE_SPEED;
    player.facing = -1;
  }
  if (input.right) {
    player.velocityX += MOVE_SPEED;
    player.facing = 1;
  }

  if (input.jumpQueued && wasGrounded) {
    player.velocityY = JUMP_FORCE;
    player.onGround = false;
  }
  input.jumpQueued = false;

  player.velocityY = Math.min(player.velocityY + GRAVITY * delta, MAX_FALL_SPEED);

  let nextX = player.x + player.velocityX * delta;
  let nextY = player.y + player.velocityY * delta;

  const horizontalRect: Rect = {
    x: nextX,
    y: player.y,
    width: player.width,
    height: player.height,
  };

  for (const surface of game.surfaces) {
    if (!rectsOverlap(horizontalRect, surface)) continue;
    if (player.velocityX > 0) {
      nextX = surface.x - player.width;
    } else if (player.velocityX < 0) {
      nextX = surface.x + surface.width;
    }
    player.velocityX = 0;
    horizontalRect.x = nextX;
  }

  const verticalRect: Rect = {
    x: nextX,
    y: nextY,
    width: player.width,
    height: player.height,
  };
  for (const surface of game.surfaces) {
    if (!rectsOverlap(verticalRect, surface)) continue;

    if (player.velocityY > 0) {
      nextY = surface.y - player.height;
      if (surface.kind === "bounce") {
        player.velocityY = -surface.strength;
        player.onGround = false;
        nextY -= 2;
      } else {
        player.velocityY = 0;
        player.onGround = true;
      }
    } else if (player.velocityY < 0) {
      nextY = surface.y + surface.height;
      player.velocityY = 0.0001;
    }

    verticalRect.y = nextY;
  }

  player.x = clamp(nextX, 0, WORLD_WIDTH - player.width);
  player.y = Math.min(nextY, WORLD_HEIGHT + 320);

  if (player.y > WORLD_HEIGHT) {
    game.status = "lost";
  }

  const playerRect: Rect = {
    x: player.x,
    y: player.y,
    width: player.width,
    height: player.height,
  };

  for (const coin of game.coins) {
    if (coin.collected) continue;
    const dx = player.x + player.width / 2 - coin.x;
    const dy = player.y + player.height / 2 - coin.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < coin.radius + Math.min(player.width, player.height) / 2) {
      coin.collected = true;
      game.collectedCoins += 1;
    }
  }

  if (rectsOverlap(playerRect, game.goal)) {
    game.status = "won";
  }
}

function updateCamera(game: GameState, viewportWidth: number, viewportHeight: number) {
  const player = game.player;
  const desiredX = player.x + player.width / 2 - viewportWidth / 2;
  const desiredY = player.y + player.height / 2 - viewportHeight / 2;
  game.camera.x = clamp(desiredX, 0, Math.max(0, WORLD_WIDTH - viewportWidth));
  game.camera.y = clamp(desiredY, 0, Math.max(0, WORLD_HEIGHT - viewportHeight));
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  size: { width: number; height: number },
  game: GameState,
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size.width * dpr, size.height * dpr);
  ctx.scale(dpr, dpr);

  const gradient = ctx.createLinearGradient(0, 0, 0, size.height);
  gradient.addColorStop(0, "#051937");
  gradient.addColorStop(1, "#031224");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size.width, size.height);

  ctx.save();
  ctx.translate(-game.camera.x, -game.camera.y);

  drawGrid(ctx, game.camera, size);
  drawGoal(ctx, game.goal);
  drawPlatforms(ctx, game.platforms);
  drawBouncePads(ctx, game.bouncePads);
  drawCoins(ctx, game.coins);
  drawPlayer(ctx, game.player);

  ctx.restore();
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  camera: { x: number; y: number },
  viewport: { width: number; height: number },
) {
  ctx.save();
  ctx.strokeStyle = "rgba(45, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  const gridSize = 80;
  const startX = Math.floor(camera.x / gridSize) * gridSize;
  const startY = Math.floor(camera.y / gridSize) * gridSize;
  const endX = camera.x + viewport.width + gridSize;
  const endY = camera.y + viewport.height + gridSize;

  for (let x = startX; x <= endX; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  for (let y = startY; y <= endY; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlatforms(ctx: CanvasRenderingContext2D, platforms: Platform[]) {
  for (const platform of platforms) {
    const gradient = ctx.createLinearGradient(
      platform.x,
      platform.y,
      platform.x,
      platform.y + platform.height,
    );
    gradient.addColorStop(0, "rgba(13, 162, 245, 0.95)");
    gradient.addColorStop(1, "rgba(4, 82, 140, 0.9)");

    ctx.fillStyle = gradient;
    ctx.fillRect(platform.x, platform.y, platform.width, platform.height);

    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 2;
    ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
  }
}

function drawBouncePads(ctx: CanvasRenderingContext2D, bouncePads: BouncePad[]) {
  for (const pad of bouncePads) {
    const gradient = ctx.createLinearGradient(
      pad.x,
      pad.y,
      pad.x + pad.width,
      pad.y + pad.height,
    );
    gradient.addColorStop(0, "rgba(251, 191, 36, 0.95)");
    gradient.addColorStop(1, "rgba(248, 113, 113, 0.9)");

    ctx.fillStyle = gradient;
    const radius = 10;
    ctx.beginPath();
    ctx.moveTo(pad.x + radius, pad.y);
    ctx.lineTo(pad.x + pad.width - radius, pad.y);
    ctx.quadraticCurveTo(pad.x + pad.width, pad.y, pad.x + pad.width, pad.y + radius);
    ctx.lineTo(pad.x + pad.width, pad.y + pad.height - radius);
    ctx.quadraticCurveTo(
      pad.x + pad.width,
      pad.y + pad.height,
      pad.x + pad.width - radius,
      pad.y + pad.height,
    );
    ctx.lineTo(pad.x + radius, pad.y + pad.height);
    ctx.quadraticCurveTo(pad.x, pad.y + pad.height, pad.x, pad.y + pad.height - radius);
    ctx.lineTo(pad.x, pad.y + radius);
    ctx.quadraticCurveTo(pad.x, pad.y, pad.x + radius, pad.y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawCoins(ctx: CanvasRenderingContext2D, coins: Coin[]) {
  for (const coin of coins) {
    if (coin.collected) continue;
    const gradient = ctx.createRadialGradient(
      coin.x - coin.radius / 2,
      coin.y - coin.radius / 2,
      coin.radius / 4,
      coin.x,
      coin.y,
      coin.radius,
    );
    gradient.addColorStop(0, "rgba(250, 204, 21, 1)");
    gradient.addColorStop(1, "rgba(245, 158, 11, 0.9)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawGoal(ctx: CanvasRenderingContext2D, goal: Goal) {
  const gradient = ctx.createLinearGradient(goal.x, goal.y, goal.x + goal.width, goal.y);
  gradient.addColorStop(0, "rgba(56, 189, 248, 0.2)");
  gradient.addColorStop(0.5, "rgba(236, 72, 153, 0.5)");
  gradient.addColorStop(1, "rgba(244, 114, 182, 0.7)");
  ctx.fillStyle = gradient;
  ctx.fillRect(goal.x, goal.y, goal.width, goal.height);

  const rings = 5;
  for (let i = 0; i < rings; i += 1) {
    const inset = (goal.width / (rings * 2)) * i;
    ctx.strokeStyle = `rgba(255,255,255,${0.25 - i * 0.04})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(goal.x + inset, goal.y + inset, goal.width - inset * 2, goal.height - inset * 2);
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: GameState["player"]) {
  const { x, y, width, height, facing } = player;

  ctx.save();

  ctx.fillStyle = "rgba(165, 243, 252, 0.95)";
  roundedRectPath(ctx, x, y, width, height, 14);
  ctx.fill();

  const visorWidth = width * 0.6;
  const visorHeight = height * 0.28;
  const visorX = x + width * 0.2;
  const visorY = y + height * 0.22;

  const visorGradient = ctx.createLinearGradient(visorX, visorY, visorX + visorWidth, visorY);
  visorGradient.addColorStop(0, "rgba(14, 165, 233, 0.95)");
  visorGradient.addColorStop(1, "rgba(59, 130, 246, 0.75)");

  ctx.fillStyle = visorGradient;
  roundedRectPath(ctx, visorX, visorY, visorWidth, visorHeight, 12);
  ctx.fill();

  const earOffset = facing === 1 ? width * 0.55 : width * 0.1;
  ctx.fillStyle = "rgba(244, 114, 182, 0.9)";
  ctx.beginPath();
  ctx.ellipse(x + earOffset, y + height * 0.1, width * 0.15, height * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function buildGameState(): GameState {
  const platforms = [SOLID_FLOOR, ...LEVEL_BLUEPRINT.platforms.map((p) => ({ ...p }))];
  const bouncePads = LEVEL_BLUEPRINT.bouncePads.map((pad) => ({ ...pad }));
  const surfaces: Array<Platform | BouncePad> = [...platforms, ...bouncePads];

  return {
    player: {
      x: LEVEL_BLUEPRINT.start.x,
      y: LEVEL_BLUEPRINT.start.y,
      width: 46,
      height: 60,
      velocityX: 0,
      velocityY: 0,
      facing: 1,
      onGround: false,
    },
    platforms,
    bouncePads,
    surfaces,
    coins: cloneCoins(),
    goal: { ...LEVEL_BLUEPRINT.goal },
    camera: { x: 0, y: 0 },
    timeLeft: INITIAL_TIME,
    collectedCoins: 0,
    status: "playing",
  };
}

function rectsOverlap(a: Rect, b: Rect) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function BunRunGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<GameState | null>(null);
  const keysRef = useRef<InputState>({
    left: false,
    right: false,
    jump: false,
    jumpQueued: false,
  });
  const lastTimeRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 960, height: 540 });
  const totalCoins = LEVEL_BLUEPRINT.coins.length;
  const bestTimeRef = useRef<number | null>(null);
  const uiSnapshotRef = useRef<UiSnapshot>({
    time: INITIAL_TIME,
    coins: 0,
    totalCoins,
    status: "playing",
  });
  const [ui, setUi] = useState<UiSnapshot>({
    time: INITIAL_TIME,
    coins: 0,
    totalCoins,
    status: "playing",
  });
  const [bestTime, setBestTime] = useState<number | null>(null);

  const resetGame = useCallback(() => {
    gameRef.current = buildGameState();
    keysRef.current = { left: false, right: false, jump: false, jumpQueued: false };
    uiSnapshotRef.current = {
      time: INITIAL_TIME,
      coins: 0,
      totalCoins,
      status: "playing",
    };
    setUi(uiSnapshotRef.current);
    lastTimeRef.current = null;
  }, [totalCoins]);

  useEffect(() => {
    resetGame();
  }, [resetGame]);

  useEffect(() => {
    function handleResize() {
      const containerWidth = containerRef.current?.clientWidth ?? 960;
      const maxWidth = Math.min(960, containerWidth);
      const width = Math.max(320, Math.floor(maxWidth));
      const height = Math.floor((width / 16) * 9);
      setCanvasSize({ width, height });
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if (["arrowleft", "a"].includes(key)) {
        keysRef.current.left = true;
        event.preventDefault();
      } else if (["arrowright", "d"].includes(key)) {
        keysRef.current.right = true;
        event.preventDefault();
      } else if (key === " " || key === "arrowup" || key === "w") {
        if (!keysRef.current.jump) {
          keysRef.current.jumpQueued = true;
        }
        keysRef.current.jump = true;
        event.preventDefault();
      } else if (key === "r") {
        event.preventDefault();
        resetGame();
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if (["arrowleft", "a"].includes(key)) {
        keysRef.current.left = false;
        event.preventDefault();
      } else if (["arrowright", "d"].includes(key)) {
        keysRef.current.right = false;
        event.preventDefault();
      } else if (key === " " || key === "arrowup" || key === "w") {
        keysRef.current.jump = false;
        keysRef.current.jumpQueued = false;
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [resetGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    function syncCanvasSize() {
      if (!canvas) {
        return;
      }
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      canvas.width = Math.floor(canvasSize.width * dpr);
      canvas.height = Math.floor(canvasSize.height * dpr);
      canvas.style.width = `${canvasSize.width}px`;
      canvas.style.height = `${canvasSize.height}px`;
    }

    syncCanvasSize();

    let frameId: number;

    const loop = (timestamp: number) => {
      if (!gameRef.current) {
        frameId = requestAnimationFrame(loop);
        return;
      }

      const game = gameRef.current;
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const rawDelta =
        lastTimeRef.current !== null ? (timestamp - lastTimeRef.current) / 1000 : 0;
      const delta = Math.min(rawDelta, 1 / 30);
      lastTimeRef.current = timestamp;

      if (game.status === "playing") {
        updateGame(game, delta, keysRef.current);
        updateCamera(game, canvasSize.width, canvasSize.height);
        updateUiSnapshot(game);
      }

      drawScene(context, dpr, canvasSize, game);

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    animationRef.current = frameId;

    function updateUiSnapshot(game: GameState) {
      const roundedTime = Math.max(0, Math.round(game.timeLeft * 10) / 10);
      const snapshot: UiSnapshot = {
        time: roundedTime,
        coins: game.collectedCoins,
        totalCoins,
        status: game.status,
      };

      const reference = uiSnapshotRef.current;
      if (
        reference.time !== snapshot.time ||
        reference.coins !== snapshot.coins ||
        reference.status !== snapshot.status
      ) {
        uiSnapshotRef.current = snapshot;
        setUi(snapshot);
      }

      if (game.status === "won") {
        const elapsed = INITIAL_TIME - game.timeLeft;
        if (bestTimeRef.current === null || elapsed < bestTimeRef.current) {
          bestTimeRef.current = elapsed;
          setBestTime(elapsed);
        }
      }
    }

    return () => {
      cancelAnimationFrame(frameId);
      animationRef.current = null;
    };
  }, [canvasSize, totalCoins]);

  const isGameOver = ui.status !== "playing";
  const timeDisplay = ui.time.toFixed(1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-cyan-100/80 md:text-base">
        <div className="font-medium uppercase tracking-[0.3em] text-cyan-200">
          Bun Run
        </div>
        <div className="flex items-center gap-4 text-cyan-100/70">
          <span>⬅️ / ➡️ or A / D to dash</span>
          <span>Space to jump</span>
          <span>Hit bounce pads for boosts</span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-3xl border border-cyan-200/20 bg-slate-950/80 shadow-[0_40px_120px_-45px_rgba(0,255,255,0.45)] backdrop-blur"
      >
        <canvas ref={canvasRef} className="block w-full select-none" />

        <div className="pointer-events-none absolute left-5 top-5 flex flex-col gap-1 text-cyan-100">
          <span className="text-xs uppercase tracking-[0.35em] text-cyan-300/80">
            Time
          </span>
          <span
            className={`text-3xl font-semibold ${
              ui.time <= 10 ? "text-amber-300" : "text-white"
            }`}
          >
            {timeDisplay}s
          </span>
        </div>

        <div className="pointer-events-none absolute right-5 top-5 flex flex-col gap-1 text-cyan-100">
          <span className="text-xs uppercase tracking-[0.35em] text-cyan-300/80">
            Coins
          </span>
          <span className="text-3xl font-semibold text-white">
            {ui.coins}/{ui.totalCoins}
          </span>
        </div>

        {bestTime !== null && (
          <div className="pointer-events-none absolute right-5 bottom-5 rounded-lg bg-white/5 px-4 py-2 text-xs text-cyan-100/80 backdrop-blur">
            Personal best: {bestTime.toFixed(2)}s
          </div>
        )}

        <div className="pointer-events-none absolute bottom-6 left-1/2 max-w-md -translate-x-1/2 text-center text-xs uppercase tracking-[0.25em] text-cyan-200/80">
          Collect coins, catch the goal portal before the clock hits zero.
        </div>

        {isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-slate-950/80 px-6 text-center text-cyan-100 backdrop-blur-md">
            <div className="space-y-2">
              <h2 className="text-4xl font-semibold uppercase tracking-[0.4em] text-white">
                {ui.status === "won" ? "Goal Reached!" : "Out of Time"}
              </h2>
              <p className="text-base text-cyan-100/80">
                {ui.status === "won"
                  ? "You threaded the neon maze and hit the portal in time."
                  : "The clock hit zero or you fell off the grid. Take another run."}
              </p>
            </div>
            <button
              type="button"
              onClick={resetGame}
              className="rounded-full bg-cyan-400 px-8 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-slate-950 shadow-[0_12px_30px_rgba(34,211,238,0.45)] transition hover:bg-cyan-300"
            >
              Restart Run
            </button>
          </div>
        )}
      </div>
    </div>
  );

}
