import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/* كتلة معدن سائل متحولة — shader مخصص بضوضاء ثلاثية الأبعاد + انعكاس بيئي دافئ. */

const NOISE_GLSL = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const VERTEX = `
uniform float uTime; uniform float uAmp; uniform float uFreq; uniform int uOctaves;
uniform vec3 uPointer; uniform float uPointerForce;
varying vec3 vNormalW; varying vec3 vViewDir; varying float vDisp;
${NOISE_GLSL}

float field(vec3 p){
  float t = uTime;
  float n = snoise(p * uFreq + vec3(0.0, t * 0.28, t * 0.16));
  n += 0.28 * snoise(p * uFreq * 2.1 - vec3(t * 0.22, 0.0, t * 0.19));
  if (uOctaves > 2) { n += 0.09 * snoise(p * uFreq * 4.3 + vec3(t * 0.35)); }
  float ripple = 0.0;
  float d = distance(normalize(p), uPointer);
  ripple = -uPointerForce * exp(-d * d * 3.4) * (0.75 + 0.25 * sin(t * 3.0 - d * 6.0));
  return n * uAmp + ripple;
}

vec3 displaced(vec3 dir){ return dir * (1.0 + field(dir)); }

void main(){
  vec3 dir = normalize(position);
  vec3 pos = displaced(dir);
  // normals عبر فروق محدودة على سطح الكرة
  vec3 tangent = normalize(cross(dir, abs(dir.y) < 0.99 ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0)));
  vec3 bitan = normalize(cross(dir, tangent));
  float e = 0.045;
  vec3 pA = displaced(normalize(dir + tangent * e));
  vec3 pB = displaced(normalize(dir + bitan * e));
  vec3 nrm = normalize(cross(pA - pos, pB - pos));
  if (dot(nrm, dir) < 0.0) nrm = -nrm;

  vDisp = length(pos) - 1.0;
  vec4 world = modelMatrix * vec4(pos, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * nrm);
  vViewDir = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const FRAGMENT = `
precision highp float;
uniform float uTime; uniform vec3 uBase; uniform vec3 uGold; uniform vec3 uCream; uniform float uAberration;
varying vec3 vNormalW; varying vec3 vViewDir; varying float vDisp;

// بيئة إجرائية دافئة (كريمي/ذهبي/طيني) بدل ملف HDR
vec3 envColor(vec3 r){
  float y = r.y;
  float az = atan(r.z, r.x);
  vec3 ground = uBase * 0.04;
  vec3 sky = mix(uBase * 0.30, uCream * 1.15, smoothstep(-0.05, 0.95, y));
  vec3 col = mix(ground, sky, smoothstep(-0.22, 0.06, y));
  // شرائط إضاءة استوديو تعطي انعكاسات حادة (إحساس معدن سائل)
  float top = smoothstep(0.34, 0.40, y) * (1.0 - smoothstep(0.62, 0.70, y));
  float side = smoothstep(-0.62, -0.54, y) * (1.0 - smoothstep(-0.30, -0.22, y));
  float sweep = 0.5 + 0.5 * sin(az * 2.0 + uTime * 0.4);
  col += uCream * 2.4 * top * (0.35 + 0.65 * sweep);
  col += uGold * 2.0 * side * (0.4 + 0.6 * (1.0 - sweep));
  float rim = pow(max(0.0, sin(az * 5.0 + uTime * 0.25)), 12.0);
  col += uGold * rim * 0.5;
  return col;
}

void main(){
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(vViewDir);
  vec3 r = reflect(-v, n);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 2.6);

  vec3 col;
  if (uAberration > 0.001) {
    float a = uAberration;
    col = vec3(
      envColor(normalize(r + n * a)).r,
      envColor(r).g,
      envColor(normalize(r - n * a)).b
    );
  } else {
    col = envColor(r);
  }

  col = mix(col * mix(uBase, uGold, 0.5), col, 0.65);
  col += uGold * fres * 1.9;
  col += uCream * pow(fres, 4.0) * 0.6;

  float pulse = 0.5 + 0.5 * sin(uTime * 0.6);
  float inner = smoothstep(-0.12, 0.22, vDisp);
  col += mix(uBase, uGold, 0.5) * inner * (0.18 + 0.22 * pulse);

  float spec = pow(max(dot(n, normalize(vec3(0.4, 0.8, 0.6))), 0.0), 60.0);
  col += vec3(1.0, 0.95, 0.86) * spec * 1.1;
  float spec2 = pow(max(dot(n, normalize(vec3(-0.6, 0.3, 0.7))), 0.0), 24.0);
  col += uGold * spec2 * 0.7;

  col = mix(col, uBase, 0.10);
  col *= 1.35;
  col = col / (col + vec3(0.85));
  col = pow(col, vec3(0.85));
  gl_FragColor = vec4(col, 1.0);
}`;

type Quality = "high" | "low";

function Blob({ quality, reduced }: { quality: Quality; reduced: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const { size } = useThree();
  const pointer = useRef(new THREE.Vector3(0, 0, 1));
  const force = useRef(0);
  const target = useRef(0);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: quality === "high" ? 0.28 : 0.22 },
      uFreq: { value: 0.95 },
      uOctaves: { value: quality === "high" ? 3 : 2 },
      uPointer: { value: new THREE.Vector3(0, 0, 1) },
      uPointerForce: { value: 0 },
      uAberration: { value: quality === "high" ? 0.045 : 0.0 },
      uBase: { value: new THREE.Color("#C1663A") },
      uGold: { value: new THREE.Color("#C9922A") },
      uCream: { value: new THREE.Color("#F3E4CD") },
    }),
    [quality],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -((e.clientY / window.innerHeight) * 2 - 1);
      pointer.current.set(x * 1.15, y * 1.15, 0.75).normalize();
      target.current = 0.3;
      window.clearTimeout((onMove as unknown as { t?: number }).t);
      (onMove as unknown as { t?: number }).t = window.setTimeout(() => {
        target.current = 0;
      }, 700);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [size]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    force.current += (target.current - force.current) * (1 - Math.exp(-3.5 * dt));
    uniforms.uPointerForce.value = force.current;
    uniforms.uPointer.value.copy(pointer.current);
    if (!reduced) uniforms.uTime.value += dt * 0.95;
    if (mesh.current) mesh.current.rotation.y += dt * 0.06;
  });

  return (
    <mesh ref={mesh} scale={1.32}>
      <icosahedronGeometry args={[1, quality === "high" ? 72 : 40]} />
      <shaderMaterial vertexShader={VERTEX} fragmentShader={FRAGMENT} uniforms={uniforms} />
    </mesh>
  );
}

/** قطرات ضوء تنفصل من الكتلة وتطير نحو بطاقة الموظف النشطة. */
function Droplets({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const drops = useRef<{ mesh: THREE.Mesh; t: number; from: THREE.Vector3; to: THREE.Vector3 }[]>(
    [],
  );
  const next = useRef(4);
  const { camera, size } = useThree();

  useFrame((_, delta) => {
    if (reduced || !group.current) return;
    const dt = Math.min(delta, 0.05);
    next.current -= dt;

    if (next.current <= 0) {
      next.current = 10 + Math.random() * 5;
      const card = document.querySelector(".cinematic-employee.is-active");
      const rect = card?.getBoundingClientRect();
      const to = new THREE.Vector3(0, 0, 0);
      if (rect) {
        const cx = ((rect.left + rect.width / 2) / size.width) * 2 - 1;
        const cy = -(((rect.top + rect.height / 2) / size.height) * 2 - 1);
        to.set(cx, cy, 0.5).unproject(camera);
      } else {
        to.set(2.4, 0.6, 0);
      }
      const geo = new THREE.SphereGeometry(0.075, 12, 12);
      const mat = new THREE.MeshBasicMaterial({ color: "#F4D590", transparent: true, opacity: 1 });
      const m = new THREE.Mesh(geo, mat);
      const from = new THREE.Vector3((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6, 1.2);
      m.position.copy(from);
      group.current.add(m);
      drops.current.push({ mesh: m, t: 0, from, to });
    }

    for (let i = drops.current.length - 1; i >= 0; i--) {
      const d = drops.current[i]!;
      d.t += dt / 2.4;
      const k = Math.min(d.t, 1);
      const ease = k * k * (3 - 2 * k);
      d.mesh.position.lerpVectors(d.from, d.to, ease);
      d.mesh.position.y += Math.sin(ease * Math.PI) * 0.55;
      const mat = d.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 1 - Math.pow(ease, 3);
      d.mesh.scale.setScalar(1 - ease * 0.5);
      if (k >= 1) {
        const card = document.querySelector(".cinematic-employee.is-active");
        card?.classList.add("is-sparked");
        window.setTimeout(() => card?.classList.remove("is-sparked"), 900);
        group.current.remove(d.mesh);
        d.mesh.geometry.dispose();
        mat.dispose();
        drops.current.splice(i, 1);
      }
    }
  });

  return <group ref={group} />;
}

export default function HeroObject3D() {
  const [quality, setQuality] = useState<Quality>("high");
  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    // فحص أداء بسيط: لو الإطارات بطيئة في أول ثانية، نزّل الجودة بدل إيقاف العنصر
    let frames = 0;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      frames++;
      if (performance.now() - start < 1000) raf = requestAnimationFrame(tick);
      else if (frames < 42) setQuality("low");
    };
    raf = requestAnimationFrame(tick);
    const cores = navigator.hardwareConcurrency ?? 8;
    if (cores <= 4) setQuality("low");
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="hero-liquid-metal" aria-hidden>
      <Canvas
        dpr={quality === "high" ? [1, 1.75] : [1, 1.15]}
        camera={{ position: [0, 0, 5.4], fov: 45 }}
        gl={{ antialias: quality === "high", alpha: true }}
      >
        <Blob quality={quality} reduced={reduced} />
        <Droplets reduced={reduced} />
      </Canvas>
    </div>
  );
}
