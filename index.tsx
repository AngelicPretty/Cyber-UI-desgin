
import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing';
import { OrbitControls, Float, Stars } from '@react-three/drei';
import * as HandsNS from '@mediapipe/hands';
import * as CameraNS from '@mediapipe/camera_utils';
import * as DrawingUtilsNS from '@mediapipe/drawing_utils';
import { Database, Activity, Terminal, Cpu, Zap, Radio, Lock, ShieldCheck, Box } from 'lucide-react';

// --- Types & Constants ---
type AppState = 'LOGIN' | 'LOADING' | 'MAIN';
const PARTICLE_COUNT = 25000;
const COLOR_FUI_RED = '#F75049';
const COLOR_FUI_CYAN = '#5EF6FF';
const COLOR_FUI_GREEN = '#1DED83';
const BG_COLOR_ACCENT = '#120a0b';

// Accessing MediaPipe classes
const Hands = (HandsNS.Hands || (HandsNS as any).default?.Hands || (window as any).Hands);
const Camera = (CameraNS.Camera || (CameraNS as any).default?.Camera || (window as any).Camera);
const HAND_CONNECTIONS = (HandsNS.HAND_CONNECTIONS || (HandsNS as any).default?.HAND_CONNECTIONS || (window as any).HAND_CONNECTIONS);
const drawConnectors = (DrawingUtilsNS.drawConnectors || (DrawingUtilsNS as any).default?.drawConnectors || (window as any).drawConnectors);
const drawLandmarks = (DrawingUtilsNS.drawLandmarks || (DrawingUtilsNS as any).default?.drawLandmarks || (window as any).drawLandmarks);

// --- Styled Components ---

const CyberDatabaseLogo = () => {
  return (
    <div className="cyber-logo-container" style={{
      width: '140px',
      height: '80px',
      position: 'relative',
      marginBottom: '30px',
      cursor: 'pointer',
      transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    }}>
      <style>{`
        .cyber-logo-container:hover { transform: scale(1.1); }
        .cyber-logo-container:hover .logo-svg { filter: drop-shadow(0 0 15px ${COLOR_FUI_RED}); }
        .cyber-logo-container:hover .scan-line { opacity: 1; top: 100%; }
        
        .logo-svg {
          width: 100%;
          height: 100%;
          transition: all 0.3s ease;
          filter: drop-shadow(0 0 5px ${COLOR_FUI_RED}66);
        }

        .scan-line {
          position: absolute;
          top: 0%;
          left: 0;
          width: 100%;
          height: 1px;
          background: ${COLOR_FUI_RED};
          box-shadow: 0 0 8px ${COLOR_FUI_RED};
          opacity: 0;
          transition: top 1.5s linear, opacity 0.3s ease;
          pointer-events: none;
        }

        @keyframes pulse-opacity {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
      `}</style>
      
      <svg className="logo-svg" viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Left Mountain */}
        <path d="M10 90L60 10L110 90" stroke={COLOR_FUI_RED} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M30 60L55 60" stroke={COLOR_FUI_RED} strokeWidth="2" strokeLinecap="round"/>
        <path d="M20 75L75 75" stroke={COLOR_FUI_RED} strokeWidth="2" strokeLinecap="round"/>
        <path d="M45 35L75 82" stroke={COLOR_FUI_RED} strokeWidth="2" strokeLinecap="round"/>
        
        {/* Right Mountain */}
        <path d="M90 90L140 10L190 90" stroke={COLOR_FUI_RED} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M110 60L135 60" stroke={COLOR_FUI_RED} strokeWidth="2" strokeLinecap="round"/>
        <path d="M100 75L155 75" stroke={COLOR_FUI_RED} strokeWidth="2" strokeLinecap="round"/>
        <path d="M125 35L155 82" stroke={COLOR_FUI_RED} strokeWidth="2" strokeLinecap="round"/>
      </svg>
      
      <div className="scan-line" />
    </div>
  );
};

// --- Particle System (Galaxy Model) ---
const GalaxyParticles = ({ gesture }: { gesture: 'OPEN' | 'FIST' | 'PINCH' | 'NONE' }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null!);
  
  const particles = useMemo(() => {
    const temp = [];
    const coreCount = Math.floor(PARTICLE_COUNT * 0.2);
    const spiralCount = PARTICLE_COUNT - coreCount;

    // 1. Core Particles (Supernova center)
    for (let i = 0; i < coreCount; i++) {
      const r = Math.pow(Math.random(), 2) * 4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      temp.push({
        x, y, z,
        baseX: x, baseY: y, baseZ: z,
        scale: Math.random() * 0.08 + 0.02,
        speed: (Math.random() * 0.005 + 0.002),
        phase: Math.random() * Math.PI * 2,
        type: 'core'
      });
    }

    // 2. Spiral Arm Particles
    const arms = 2;
    for (let i = 0; i < spiralCount; i++) {
      const r = 4 + Math.pow(Math.random(), 1.5) * 12;
      const armIndex = i % arms;
      const armAngle = (armIndex * 2 * Math.PI) / arms;
      const spiralTurn = r * 0.4;
      
      const theta = armAngle + spiralTurn + (Math.random() - 0.5) * (4 / r);
      
      let x = r * Math.cos(theta);
      let z = r * Math.sin(theta);
      let y = (Math.random() - 0.5) * (3 / r); // Thinner at edges

      temp.push({
        x, y, z,
        baseX: x, baseY: y, baseZ: z,
        scale: Math.random() * 0.04 + 0.01,
        speed: (Math.random() * 0.0008 + 0.0002) * (10 / r),
        phase: Math.random() * Math.PI * 2,
        type: 'spiral'
      });
    }

    return temp;
  }, []);

  const dummy = new THREE.Object3D();
  const targetScale = useRef(1);
  const currentScale = useRef(1);
  const targetColor = useRef(new THREE.Color(COLOR_FUI_CYAN));
  const currentColor = useRef(new THREE.Color(COLOR_FUI_CYAN));

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    if (gesture === 'OPEN') targetScale.current = 2.0;
    else if (gesture === 'FIST') targetScale.current = 0.3;
    else targetScale.current = 1.0;

    if (gesture === 'PINCH') targetColor.current.set(COLOR_FUI_RED);
    else targetColor.current.set(COLOR_FUI_CYAN);

    currentScale.current = THREE.MathUtils.lerp(currentScale.current, targetScale.current, 0.08);
    currentColor.current.lerp(targetColor.current, 0.1);

    if (materialRef.current) materialRef.current.color.copy(currentColor.current);

    particles.forEach((p, i) => {
      const rotSpeed = p.speed * (1 / (currentScale.current + 0.2));
      const angle = time * rotSpeed + p.phase;
      
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      const rx = (p.baseX * cos - p.baseZ * sin) * currentScale.current;
      const rz = (p.baseX * sin + p.baseZ * cos) * currentScale.current;
      const ry = p.baseY * currentScale.current;

      dummy.position.set(rx, ry, rz);
      const s = p.scale * (1 + Math.sin(time * 3 + p.phase) * 0.4);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.rotation.y += 0.0005;
  });

  return (
    <instancedMesh ref={meshRef} args={[null!, null!, PARTICLE_COUNT]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial ref={materialRef} color={COLOR_FUI_CYAN} transparent opacity={0.8} />
    </instancedMesh>
  );
};

// --- Hand Tracking Hook ---
const useHandTracking = (active: boolean) => {
  const [gesture, setGesture] = useState<'OPEN' | 'FIST' | 'PINCH' | 'NONE'>('NONE');
  const videoRef = useRef<HTMLVideoElement>(null!);
  const canvasRef = useRef<HTMLCanvasElement>(null!);

  useEffect(() => {
    if (!active || !Hands || !Camera) return;

    const hands = new Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    hands.onResults((results: any) => {
      const canvasCtx = canvasRef.current?.getContext('2d');
      if (!canvasCtx) return;

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        if (drawConnectors) drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: COLOR_FUI_GREEN, lineWidth: 2 });
        if (drawLandmarks) drawLandmarks(canvasCtx, landmarks, { color: COLOR_FUI_CYAN, lineWidth: 1, radius: 2 });

        const wrist = landmarks[0];
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const fingerTips = [8, 12, 16, 20];
        
        const distances = fingerTips.map(idx => {
          const tip = landmarks[idx];
          return Math.sqrt(Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2));
        });
        const thumbDistFromWrist = Math.sqrt(Math.pow(thumbTip.x - wrist.x, 2) + Math.pow(thumbTip.y - wrist.y, 2));
        const avgDist = (distances.reduce((a, b) => a + b, 0) + thumbDistFromWrist) / 5;

        const pinchDist = Math.sqrt(
          Math.pow(thumbTip.x - indexTip.x, 2) + 
          Math.pow(thumbTip.y - indexTip.y, 2)
        );

        if (pinchDist < 0.05) setGesture('PINCH');
        else if (avgDist < 0.18) setGesture('FIST');
        else if (avgDist > 0.35) setGesture('OPEN');
        else setGesture('NONE');
      } else {
        setGesture('NONE');
      }
      canvasCtx.restore();
    });

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        await hands.send({ image: videoRef.current });
      },
      width: 640,
      height: 480,
    });
    camera.start();

    return () => {
      camera.stop();
      hands.close();
    };
  }, [active]);

  return { gesture, videoRef, canvasRef };
};

// --- UI Sub-Components ---

const TerminalProtocolText = () => {
  const terminalLines = [
    "[+] KERNEL_ID: 0xFB82-991A",
    "[+] PROTOCOL — ONLY C3C5 CERTIFIED",
    "[+] AND DHS 5TH CLASS OFFICERS",
    "[+] ARE ALLOWED TO MANIPULATE,",
    "[+] ACCESS OR DISABLE THIS DEVICE."
  ];
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (currentIndex < terminalLines.length) {
      timeout = setTimeout(() => {
        setVisibleLines(prev => [...prev, terminalLines[currentIndex]]);
        setCurrentIndex(prev => prev + 1);
      }, 500);
    } else {
      timeout = setTimeout(() => {
        setVisibleLines([]);
        setCurrentIndex(0);
      }, 3000);
    }
    return () => clearTimeout(timeout);
  }, [currentIndex]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'Rajdhani', fontWeight: 500 }}>
      {visibleLines.map((line, i) => (
        <div key={i} style={{ opacity: 0.7, whiteSpace: 'nowrap' }}>{line}</div>
      ))}
      <div style={{ 
        width: '6px', 
        height: '10px', 
        background: COLOR_FUI_RED, 
        marginTop: visibleLines.length > 0 ? '4px' : '0px',
        animation: 'terminal-blink 1s infinite'
      }} />
    </div>
  );
};

const LoginScreen = ({ onLogin }: { onLogin: () => void }) => {
  return (
    <div style={{
      height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: BG_COLOR_ACCENT,
      fontFamily: "'Orbitron', sans-serif", position: 'relative', overflow: 'hidden'
    }}>
      <style>{`
        @keyframes terminal-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
      
      <div style={{ 
        position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none',
        backgroundImage: `radial-gradient(circle at center, ${COLOR_FUI_CYAN}33 0%, transparent 70%), linear-gradient(${COLOR_FUI_CYAN}11 1px, transparent 1px), linear-gradient(90deg, ${COLOR_FUI_CYAN}11 1px, transparent 1px)`,
        backgroundSize: '100% 100%, 50px 50px, 50px 50px',
        zIndex: 0
      }} />

      <div style={{ position: 'absolute', top: 40, left: 40, color: COLOR_FUI_RED, fontSize: '0.7rem', zIndex: 2}}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Terminal size={14} />
          <span style={{ letterSpacing: 4 }}>SYS_AUTH_READY: [TRUE]</span>
        </div>
        <div style={{ marginTop: 5, opacity: 0.5 }}>WELECOM TO THE DATABASE</div>
      </div>

      <div style={{ position: 'absolute', bottom: 40, left: 40, color: COLOR_FUI_RED, fontSize: '0.75rem', minHeight: '100px', zIndex: 2}}>
        <TerminalProtocolText />
      </div>

      <div style={{ textAlign: 'center', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <CyberDatabaseLogo />
        <h1 style={{ fontSize: '4rem', margin: 0, letterSpacing: 15, fontWeight: 900, color: '#FFF' }}>
          DATABASE <span style={{ color: COLOR_FUI_RED }}>LOGIN</span>
        </h1>
        <p style={{ color: COLOR_FUI_RED, letterSpacing: 5, fontSize: '0.9rem', marginTop: 10, opacity: 0.8 }}>CENTRAL OPERATING SYSTEM ACCESS TERMINAL</p>
      </div>

      <button 
        onClick={onLogin}
        className="login-btn"
        style={{
          marginTop: 60, background: 'transparent', border: `2px solid ${COLOR_FUI_RED}`, 
          color: COLOR_FUI_RED, padding: '15px 70px', fontSize: '1.2rem', cursor: 'pointer', 
          fontFamily: 'Orbitron', transition: 'all 0.4s cubic-bezier(0.19, 1, 0.22, 1)',
          boxShadow: `0 0 10px ${COLOR_FUI_RED}44`, position: 'relative', zIndex: 10
        }}
      >
        CONNECT
        <style>{`
          .login-btn:hover { background: ${COLOR_FUI_RED}; color: #000; box-shadow: 0 0 40px ${COLOR_FUI_RED}; letter-spacing: 5px; }
          .login-btn::before { content: ''; position: absolute; top: -8px; left: -8px; width: 8px; height: 8px; border-top: 2px solid ${COLOR_FUI_RED}; border-left: 2px solid ${COLOR_FUI_RED}; }
          .login-btn::after { content: ''; position: absolute; bottom: -8px; right: -8px; width: 8px; height: 8px; border-bottom: 2px solid ${COLOR_FUI_RED}; border-right: 2px solid ${COLOR_FUI_RED}; }
        `}</style>
      </button>
    </div>
  );
};

const LoadingScreen = () => {
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const bootLogs = [
    "> Initializing cTOS Kernel...",
    "> Accessing Database Cluster 0x01",
    "> Mounting File Systems...",
    "> Securing Neural Link...",
    "> Activating Camera Module...",
    "> handshake_success: Biometric Scan Ready",
    "> cTOS DATABASE ACCESS GRANTED"
  ];

  useEffect(() => {
    let currentLogIndex = 0;
    const startTime = Date.now();
    const duration = 4000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const calculatedProgress = Math.min(100, (elapsed / duration) * 100);
      setProgress(calculatedProgress);
      const logThreshold = (bootLogs.length * (calculatedProgress / 100));
      if (currentLogIndex < logThreshold && currentLogIndex < bootLogs.length) {
        setLog(prev => [...prev, bootLogs[currentLogIndex]]);
        currentLogIndex++;
      }
      if (calculatedProgress >= 100) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: BG_COLOR_ACCENT, color: COLOR_FUI_CYAN
    }}>
      <div style={{ width: 400, textAlign: 'left', fontFamily: 'monospace', fontSize: '0.8rem', height: 150 }}>
        {log.map((l, i) => <div key={i} style={{ marginBottom: 4, color: i === log.length - 1 ? COLOR_FUI_GREEN : COLOR_FUI_CYAN }}>{l}</div>)}
      </div>
      <div style={{ width: 400, height: 2, background: '#111', marginTop: 20, position: 'relative' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: COLOR_FUI_RED, boxShadow: `0 0 15px ${COLOR_FUI_RED}` }} />
      </div>
      <div style={{ marginTop: 15, color: COLOR_FUI_RED, fontSize: '0.6rem', letterSpacing: 4 }}>{Math.floor(progress)}% AUTHENTICATING_SESSION</div>
    </div>
  );
};

const MainFUI = () => {
  const { gesture, videoRef, canvasRef } = useHandTracking(true);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#000' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Canvas camera={{ position: [0, 0, 22], fov: 45 }}>
          <color attach="background" args={['#000']} />
          <ambientLight intensity={0.5} />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          <Suspense fallback={null}>
            <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
                <GalaxyParticles gesture={gesture} />
            </Float>
            {/* Background Orbits */}
            <mesh rotation={[Math.PI / 2, 0.1, 0]}>
                <ringGeometry args={[18, 18.05, 128]} />
                <meshBasicMaterial color={COLOR_FUI_RED} transparent opacity={0.05} side={THREE.DoubleSide} />
            </mesh>
            <mesh rotation={[Math.PI / 2.5, -0.2, 0]}>
                <ringGeometry args={[22, 22.02, 128]} />
                <meshBasicMaterial color={COLOR_FUI_CYAN} transparent opacity={0.05} side={THREE.DoubleSide} />
            </mesh>
          </Suspense>
          <EffectComposer>
            <Bloom intensity={1.5} luminanceThreshold={0.1} mipmapBlur />
            <Noise opacity={0.02} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
          </EffectComposer>
          <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
        </Canvas>
      </div>

      <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
        
        {/* Header HUD */}
        <div style={{ 
          position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}>
          <h2 style={{
            fontFamily: "'Rajdhani', sans-serif", fontSize: '2.5rem', margin: 0, color: COLOR_FUI_RED,
            fontWeight: 700, letterSpacing: 15, textShadow: `0 0 15px ${COLOR_FUI_RED}88`
          }}>
            SYSTEM DATABASE
          </h2>
          <div style={{ display: 'flex', gap: 30, marginTop: 10, alignItems: 'center' }}>
            <div style={{ height: 1, width: 150, background: `linear-gradient(90deg, transparent, ${COLOR_FUI_CYAN})` }} />
            <div style={{ display: 'flex', gap: 15, color: COLOR_FUI_RED, fontSize: '0.65rem', fontFamily: 'monospace' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Cpu size={12} /> CPU: 42%</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Zap size={12} /> MEM: 64.2GB</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Radio size={12} /> SIGNAL: 100%</div>
            </div>
            <div style={{ height: 1, width: 150, background: `linear-gradient(90deg, ${COLOR_FUI_CYAN}, transparent)` }} />
          </div>
        </div>

        {/* Traffic Analytics */}
        <div style={{ position: 'absolute', top: 140, right: 50, width: 220, pointerEvents: 'auto' }}>
            <div style={{ borderLeft: `2px solid ${COLOR_FUI_RED}`, paddingLeft: 15, background: 'rgba(247, 80, 73, 0.05)', padding: '10px 15px' }}>
                <div style={{ color: COLOR_FUI_RED, fontSize: '0.8rem', fontWeight: 700, letterSpacing: 2 }}>TRAFFIC ANALYTICS</div>
                <div style={{ marginTop: 10 }}>
                    {[...Array(4)].map((_, i) => (
                        <div key={i} style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', color: COLOR_FUI_RED, opacity: 0.8 }}>
                                <span>NET_NODE_{i}</span>
                                <span>{Math.floor(Math.random() * 1000)}kb/s</span>
                            </div>
                            <div style={{ height: 1, background: '#222', marginTop: 4 }}>
                                <div style={{ height: '100%', width: `${Math.random() * 100}%`, background: COLOR_FUI_RED }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Biometric Viewport */}
        <div style={{ position: 'absolute', bottom: 50, left: 50, pointerEvents: 'auto' }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                <div style={{
                    padding: '6px 15px', fontSize: '0.7rem', fontFamily: 'Rajdhani',
                    border: `1px solid ${gesture === 'OPEN' ? COLOR_FUI_GREEN : COLOR_FUI_RED}`, 
                    color: gesture === 'OPEN' ? COLOR_FUI_GREEN : COLOR_FUI_RED,
                    background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700
                }}>
                    <div style={{ 
                      width: 8, height: 8, borderRadius: '50%', 
                      background: gesture === 'OPEN' ? COLOR_FUI_GREEN : '#333',
                      transition: 'background 0.2s ease'
                    }} />
                    EXPLODE
                </div>

                <div style={{
                    padding: '6px 15px', fontSize: '0.7rem', fontFamily: 'Rajdhani',
                    border: `1px solid ${gesture === 'FIST' ? COLOR_FUI_GREEN : COLOR_FUI_RED}`,
                    color: gesture === 'FIST' ? COLOR_FUI_GREEN : COLOR_FUI_RED,
                    background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700
                }}>
                    <div style={{ 
                      width: 8, height: 8, borderRadius: '50%', 
                      background: gesture === 'FIST' ? COLOR_FUI_GREEN : '#333',
                      transition: 'background 0.2s ease'
                    }} />
                    SCALING
                </div>
            </div>

            <div style={{ 
                width: 240, height: 180, border: `1px solid rgba(94, 246, 255, 0.2)`, 
                background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ 
                  background: 'rgba(94, 246, 255, 0.1)', height: 25, display: 'flex', 
                  alignItems: 'center', padding: '0 10px', justifyContent: 'space-between',
                  borderBottom: `1px solid rgba(94, 246, 255, 0.1)`
                }}>
                  <div style={{ color: COLOR_FUI_CYAN, fontSize: '0.5rem', letterSpacing: 2 }}>BIOMETRIC_LINK_v4</div>
                  <ShieldCheck size={10} color={COLOR_FUI_GREEN} />
                </div>
                
                <canvas ref={canvasRef} width={240} height={180} style={{ position: 'absolute', inset: 0, transform: 'scaleX(-1) translateY(12px)' }} />
                <video ref={videoRef} style={{ display: 'none' }} playsInline muted />
                
                <div style={{ position: 'absolute', top: 25, left: 0, width: 2, height: 15, background: COLOR_FUI_CYAN }} />
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 15, height: 2, background: COLOR_FUI_RED }} />
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(94,246,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(94,246,255,0.03) 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none' }} />
            </div>
            <div style={{ marginTop: 10, color: COLOR_FUI_CYAN, fontSize: '0.6rem', opacity: 0.5, letterSpacing: 1 }}>/DEV/NODE/PRIMARY_CAM</div>
        </div>

        {/* Nodal Status HUD */}
        <div style={{ position: 'absolute', bottom: 50, right: 50, width: 220, pointerEvents: 'auto' }}>
            <div style={{ borderRight: `2px solid ${COLOR_FUI_CYAN}`, paddingRight: 15, textAlign: 'right', background: 'rgba(94, 246, 255, 0.05)', padding: '10px 15px' }}>
                <div style={{ color: COLOR_FUI_RED, fontSize: '0.8rem', fontWeight: 700, letterSpacing: 2 }}>NODAL STATUS</div>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ color: COLOR_FUI_GREEN, fontSize: '0.6rem' }}>● CORE_CLUSTER: STABLE</div>
                    <div style={{ color: COLOR_FUI_GREEN, fontSize: '0.6rem' }}>● NEURAL_SYNC: ACTIVE</div>
                    <div style={{ color: gesture !== 'NONE' ? COLOR_FUI_GREEN : COLOR_FUI_RED, fontSize: '0.6rem' }}>
                      {gesture !== 'NONE' ? '●' : '○'} GESTURE_OVERRIDE: {gesture !== 'NONE' ? 'ON' : 'OFF'}
                    </div>
                </div>
            </div>
        </div>

        {/* Post Process Overlays */}
        <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.02) 50%)',
            backgroundSize: '100% 4px', zIndex: 10
        }} />
        <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            boxShadow: `inset 0 0 100px rgba(0,0,0,0.8)`, zIndex: 11
        }} />
      </div>
    </div>
  );
};

// --- Application Entry ---
const App = () => {
  const [view, setView] = useState<AppState>('LOGIN');

  const handleLogin = () => {
    setView('LOADING');
    setTimeout(() => {
      setView('MAIN');
    }, 4500);
  };

  return (
    <>
      {view === 'LOGIN' && <LoginScreen onLogin={handleLogin} />}
      {view === 'LOADING' && <LoadingScreen />}
      {view === 'MAIN' && <MainFUI />}
    </>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
