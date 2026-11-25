import { useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Loader2, Rotate3d, Maximize2, Minimize2 } from "lucide-react";
import { panoramaThumbUrl, panoramaUrl, type TourRoom } from "@/lib/tour360";

interface Suite360ViewerProps {
  suiteName: string;
  rooms: TourRoom[];
  open: boolean;
  initialIndex?: number;
  onClose: () => void;
}

// Fullscreen-triangle shader that samples an equirectangular texture per pixel.
const VERT = `attribute vec2 p;varying vec2 v;void main(){v=p;gl_Position=vec4(p,0.,1.);}`;
const FRAG = `precision highp float;varying vec2 v;uniform sampler2D t;uniform float yaw,pitch,tf,asp;
const float PI=3.14159265359;
void main(){
  vec3 d=normalize(vec3(v.x*tf*asp,v.y*tf,1.));
  float cp=cos(pitch),sp=sin(pitch);d=vec3(d.x,d.y*cp+d.z*sp,-d.y*sp+d.z*cp);
  float cy=cos(yaw),sy=sin(yaw);d=vec3(d.x*cy+d.z*sy,d.y,-d.x*sy+d.z*cy);
  float lon=atan(d.x,d.z),lat=asin(clamp(d.y,-1.,1.));
  gl_FragColor=texture2D(t,vec2(lon/(2.*PI)+.5,.5-lat/PI));
}`;

const FOV_MIN = 35;
const FOV_MAX = 115;
const PITCH_MAX = 1.45;

type Gl = {
  gl: WebGLRenderingContext;
  tex: WebGLTexture;
  u: Record<"yaw" | "pitch" | "tf" | "asp", WebGLUniformLocation | null>;
};

function initGl(canvas: HTMLCanvasElement): Gl | null {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) return null;
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // No mipmaps: avoids a visible line where the panorama wraps around.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); // panoramas are 4096x2048 (power of two)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return {
    gl,
    tex,
    u: {
      yaw: gl.getUniformLocation(prog, "yaw"),
      pitch: gl.getUniformLocation(prog, "pitch"),
      tf: gl.getUniformLocation(prog, "tf"),
      asp: gl.getUniformLocation(prog, "asp"),
    },
  };
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();
function loadImage(src: string) {
  if (!imageCache.has(src)) {
    imageCache.set(
      src,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () => {
          imageCache.delete(src);
          reject(new Error(`Could not load ${src}`));
        };
        img.src = src;
      }),
    );
  }
  return imageCache.get(src)!;
}

const Suite360Viewer = ({ suiteName, rooms, open, initialIndex = 0, onClose }: Suite360ViewerProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<Gl | null>(null);
  const hasTexture = useRef(false);
  const cam = useRef({ yaw: 0, pitch: 0, fov: 90, ty: 0, tp: 0, tf: 90 });
  const lastInput = useRef(0);
  const autoRef = useRef(true);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef({ d: 0, fov: 0 });

  const [index, setIndex] = useState(initialIndex);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [noWebGl, setNoWebGl] = useState(false);
  const [auto, setAuto] = useState(true);
  const [showHint, setShowHint] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const defaultFov = () => (window.innerWidth < window.innerHeight ? 110 : 88);

  // The parent mounts this component per opening, so initial state is the reset.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => setShowHint(false), 4500);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    autoRef.current = auto;
  }, [auto]);

  // GL setup and render loop while open.
  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const ctx = initGl(canvasRef.current);
    if (!ctx) {
      setNoWebGl(true);
      return;
    }
    glRef.current = ctx;
    hasTexture.current = false;
    const canvas = canvasRef.current;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    const frame = () => {
      const c = cam.current;
      if (autoRef.current && hasTexture.current && performance.now() - lastInput.current > 2500) c.ty += 0.0011;
      c.yaw += (c.ty - c.yaw) * 0.18;
      c.pitch += (c.tp - c.pitch) * 0.18;
      c.fov += (c.tf - c.fov) * 0.18;
      if (hasTexture.current) {
        const { gl, u } = ctx;
        gl.uniform1f(u.yaw, c.yaw);
        gl.uniform1f(u.pitch, c.pitch);
        gl.uniform1f(u.tf, Math.tan((c.fov * Math.PI) / 360));
        gl.uniform1f(u.asp, canvas.width / canvas.height);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ctx.gl.getExtension("WEBGL_lose_context")?.loseContext();
      glRef.current = null;
      hasTexture.current = false;
    };
  }, [open]);

  // Load the current room.
  useEffect(() => {
    if (!open || noWebGl) return;
    let cancelled = false;
    const room = rooms[index];
    loadImage(panoramaUrl(room.key))
      .then((img) => {
        const ctx = glRef.current;
        if (cancelled || !ctx) return;
        const { gl, tex } = ctx;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        hasTexture.current = true;
        const c = cam.current;
        c.yaw = c.ty = 0;
        c.pitch = c.tp = 0;
        c.fov = c.tf = defaultFov();
        setLoadedKey(room.key);
        // Warm the next room so switching feels instant.
        loadImage(panoramaUrl(rooms[(index + 1) % rooms.length].key)).catch(() => {});
      })
      .catch(() => {
        if (!cancelled) setLoadedKey(room.key);
      });
    return () => {
      cancelled = true;
    };
  }, [open, index, rooms, noWebGl]);

  const go = useCallback((i: number) => setIndex(((i % rooms.length) + rooms.length) % rooms.length), [rooms.length]);

  const poke = () => {
    lastInput.current = performance.now();
    setShowHint(false);
  };
  const zoomTo = (f: number) => {
    cam.current.tf = Math.max(FOV_MIN, Math.min(FOV_MAX, f));
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Keyboard.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const c = cam.current;
      poke();
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") c.ty -= 0.12;
      else if (e.key === "ArrowRight") c.ty += 0.12;
      else if (e.key === "ArrowUp") c.tp = Math.min(PITCH_MAX, c.tp + 0.1);
      else if (e.key === "ArrowDown") c.tp = Math.max(-PITCH_MAX, c.tp - 0.1);
      else if (e.key === "+" || e.key === "=") zoomTo(c.tf / 1.2);
      else if (e.key === "-") zoomTo(c.tf * 1.2);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Wheel zoom (non-passive so the page does not scroll).
  useEffect(() => {
    const el = canvasRef.current;
    if (!open || !el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      poke();
      zoomTo(cam.current.tf * Math.exp(e.deltaY * 0.0012));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    poke();
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), fov: cam.current.tf };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    poke();
    const c = cam.current;
    if (pointers.current.size === 1) {
      const k = ((c.fov * Math.PI) / 180) / window.innerHeight;
      c.ty -= (e.clientX - p.x) * k;
      c.tp = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, c.tp + (e.clientY - p.y) * k));
    }
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.current.size === 2 && pinch.current.d) {
      const [a, b] = [...pointers.current.values()];
      zoomTo((pinch.current.fov * pinch.current.d) / Math.hypot(a.x - b.x, a.y - b.y));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current.d = 0;
  };

  if (!open) return null;
  const room = rooms[index];
  const loading = !noWebGl && loadedKey !== room.key;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[100] bg-[#111] text-white select-none"
      role="dialog"
      aria-modal="true"
      aria-label={`${suiteName} 360° tour`}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      {/* Header */}
      <div className="absolute top-0 inset-x-0 p-4 md:p-6 flex items-start justify-between gap-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div>
          <p className="text-[11px] md:text-xs uppercase tracking-[0.14em] text-white/70">{suiteName} · 360° tour</p>
          <h2 className="font-playfair text-2xl md:text-4xl font-semibold leading-tight mt-1">{room.name}</h2>
        </div>
        <div className="flex gap-2 pointer-events-auto">
          <button
            onClick={() => setAuto((a) => !a)}
            className={`w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center backdrop-blur transition-colors ${auto ? "bg-accent text-white" : "bg-black/50 hover:bg-black/70"}`}
            aria-label={auto ? "Stop auto-rotate" : "Start auto-rotate"}
            aria-pressed={auto}
          >
            <Rotate3d className="w-5 h-5" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="hidden md:flex w-11 h-11 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur items-center justify-center"
            aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <button
            onClick={onClose}
            className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur flex items-center justify-center"
            aria-label="Close 360° tour"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Prev / next */}
      {rooms.length > 1 && (
        <>
          <button
            onClick={() => go(index - 1)}
            className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur flex items-center justify-center"
            aria-label="Previous room"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={() => go(index + 1)}
            className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur flex items-center justify-center"
            aria-label="Next room"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Hint / loading / fallback */}
      {loading && !noWebGl && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 className="w-9 h-9 animate-spin text-white/80" />
        </div>
      )}
      {!loading && showHint && !noWebGl && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/60 rounded-full px-5 py-2.5 text-sm pointer-events-none whitespace-nowrap">
          Drag to look around · Pinch or scroll to zoom
        </div>
      )}
      {noWebGl && (
        <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
          <img src={panoramaUrl(room.key)} alt={`${suiteName} ${room.name}`} className="absolute inset-0 w-full h-full object-cover opacity-60" />
          <p className="relative max-w-md bg-black/60 rounded-xl p-5">
            Your browser can't show the interactive 360° view. Try a current version of Chrome, Safari, Edge or Firefox.
          </p>
        </div>
      )}

      {/* Room tabs */}
      <div className="absolute bottom-0 inset-x-0 p-3 md:p-6 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex gap-2 md:gap-3 justify-start md:justify-center overflow-x-auto pb-1">
          {rooms.map((r, i) => (
            <button
              key={r.key}
              onClick={() => go(i)}
              className={`shrink-0 rounded-lg overflow-hidden text-left transition-all ${i === index ? "ring-2 ring-accent" : "opacity-75 hover:opacity-100"}`}
              aria-current={i === index}
            >
              <img src={panoramaThumbUrl(r.key)} alt="" className="w-28 h-16 md:w-36 md:h-20 object-cover" loading="lazy" />
              <span className="block bg-black/70 px-2 py-1 text-xs md:text-sm">{r.name}</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] md:text-[11px] text-white/55 text-center mt-2">
          Digitally created 360° visualisation based on photographs of our ICONIA Zamalek suites. Layouts vary by unit.
        </p>
      </div>
    </div>
  );
};

export default Suite360Viewer;
