
import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { OrbitControls, Float } from '@react-three/drei';
import * as HandsNS from '@mediapipe/hands';
import * as CameraNS from '@mediapipe/camera_utils';
import * as DrawingUtilsNS from '@mediapipe/drawing_utils';
import { Database, Activity, Terminal, Cpu, Zap, Radio, Lock } from 'lucide-react';

// --- Types & Constants ---
type AppState = 'LOGIN' | 'LOADING' | 'MAIN';
const PARTICLE_COUNT = 20000;
const COLOR_FUI_RED = '#F75049';
const COLOR_FUI_CYAN = '#5EF6FF';
const COLOR_FUI_GREEN = '#1DED83';

// Accessing MediaPipe classes from the imported modules
const Hands = (HandsNS.Hands || (HandsNS as any).default?.Hands || (window as any).Hands);
const Camera = (CameraNS.Camera || (CameraNS as any).default?.Camera || (window as any).Camera);
const HAND_CONNECTIONS = (HandsNS.HAND_CONNECTIONS || (HandsNS as any).default?.HAND_CONNECTIONS || (window as any).HAND_CONNECTIONS);
const drawConnectors = (DrawingUtilsNS.drawConnectors || (DrawingUtilsNS as any).default?.drawConnectors || (window as any).drawConnectors);
const drawLandmarks = (DrawingUtilsNS.drawLandmarks || (DrawingUtilsNS as any).default?.drawLandmarks || (window as any).drawLandmarks);

// --- Particle System ---
const GalaxyParticles = ({ gesture }: { gesture: 'OPEN' | 'FIST' | 'NONE' }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 4 + Math.pow(Math.random(), 2) * 8;
      const spiralOffset = radius * 0.5;
      
      const x = Math.cos(angle + spiralOffset) * radius;
      const y = (Math.random() - 0.5) * (2 / (radius * 0.5 + 1));
      const z = Math.sin(angle + spiralOffset) * radius;

      temp.push({
        x, y, z,
        baseX: x, baseY: y, baseZ: z,
        scale: Math.random() * 0.04 + 0.01,
        speed: Math.random() * 0.001 + 0.0005,
        phase: Math.random() * Math.PI * 2
      });
    }
    return temp;
  }, []);

  const dummy = new THREE.Object3D();
  const targetScale = useRef(1);
  const currentScale = useRef(1);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    if (gesture === 'OPEN') {
      targetScale.current = 2.2;
    } else if (gesture === 'FIST') {
      targetScale.current = 0.25;
    } else {
      targetScale.current = 1.0;
    }
    currentScale.current = THREE.MathUtils.lerp(currentScale.current, targetScale.current, 0.08);

    particles.forEach((p, i) => {
      const rotSpeed = p.speed * (1 / (currentScale.current + 0.5));
      const angle = time * rotSpeed + p.phase;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      const rx = (p.baseX * cos - p.baseZ * sin) * currentScale.current;
      const rz = (p.baseX * sin + p.baseZ * cos) * currentScale.current;
      const ry = p.baseY * currentScale.current + Math.sin(time + p.phase) * 0.05;

      dummy.position.set(rx, ry, rz);
      const s = p.scale * (1 + Math.sin(time * 2 + p.phase) * 0.3);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.rotation.y += 0.0005;
  });

  return (
    <instancedMesh ref={meshRef} args={[null!, null!, PARTICLE_COUNT]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={COLOR_FUI_CYAN} transparent opacity={0.9} />
    </instancedMesh>
  );
};

// --- Hand Tracking Hook ---
const useHandTracking = (active: boolean) => {
  const [gesture, setGesture] = useState<'OPEN' | 'FIST' | 'NONE'>('NONE');
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
        
        if (drawConnectors) drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: COLOR_FUI_GREEN, lineWidth: 2.5 });
        if (drawLandmarks) drawLandmarks(canvasCtx, landmarks, { color: COLOR_FUI_CYAN, lineWidth: 1, radius: 2.5 });

        const wrist = landmarks[0];
        const thumbTip = landmarks[4];
        const fingerTips = [8, 12, 16, 20];
        
        const distances = fingerTips.map(idx => {
          const tip = landmarks[idx];
          return Math.sqrt(Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2));
        });
        const thumbDist = Math.sqrt(Math.pow(thumbTip.x - wrist.x, 2) + Math.pow(thumbTip.y - wrist.y, 2));
        const avgDist = (distances.reduce((a, b) => a + b, 0) + thumbDist) / 5;

        if (avgDist < 0.18) {
          setGesture('FIST');
        } else if (avgDist > 0.35) {
          setGesture('OPEN');
        } else {
          setGesture('NONE');
        }
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
const LoginScreen = ({ onLogin }: { onLogin: () => void }) => (
  <div style={{
    height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', background: '#000',
    fontFamily: "'Orbitron', sans-serif", position: 'relative', overflow: 'hidden'
  }}>
    <div style={{ position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: '10%', left: '10%', width: '80%', height: '80%', border: `1px solid ${COLOR_FUI_CYAN}`, borderRadius: '50%' }} />
      <div style={{ position: 'absolute', top: '20%', left: '20%', width: '60%', height: '60%', border: `1px dashed ${COLOR_FUI_RED}`, borderRadius: '50%' }} />
    </div>

    <div style={{ position: 'absolute', top: 40, left: 40, color: COLOR_FUI_RED, fontSize: '0.7rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Terminal size={14} />
        <span style={{ letterSpacing: 4 }}>SYS_AUTH_READY: [TRUE]</span>
      </div>
      <div style={{ marginTop: 5, opacity: 0.5 }}>KERNEL_ID: 0xFB82-991A</div>
    </div>

    <div style={{ textAlign: 'center', zIndex: 10 }}>
      <Database size={100} color={COLOR_FUI_CYAN} style={{ filter: `drop-shadow(0 0 15px ${COLOR_FUI_CYAN})`, marginBottom: 30 }} />
      <h1 style={{ fontSize: '4rem', margin: 0, letterSpacing: 15, fontWeight: 900, color: '#FFF' }}>
        CTOS <span style={{ color: COLOR_FUI_CYAN }}>LOGIN</span>
      </h1>
      <p style={{ color: COLOR_FUI_RED, letterSpacing: 5, fontSize: '0.9rem', marginTop: 10, opacity: 0.8 }}>CENTRAL OPERATING SYSTEM ACCESS TERMINAL</p>
    </div>

    <button 
      onClick={onLogin}
      className="login-btn"
      style={{
        marginTop: 60, background: 'transparent', border: `2px solid ${COLOR_FUI_RED}`, 
        color: COLOR_FUI_RED, padding: '20px 80px', fontSize: '1.4rem', cursor: 'pointer', 
        fontFamily: 'Orbitron', transition: 'all 0.4s cubic-bezier(0.19, 1, 0.22, 1)',
        boxShadow: `0 0 10px ${COLOR_FUI_RED}44`, position: 'relative'
      }}
    >
      CONNECT
      <style>{`
        .login-btn:hover { background: ${COLOR_FUI_RED}; color: #000; box-shadow: 0 0 30px ${COLOR_FUI_RED}; letter-spacing: 5px; }
        .login-btn::before { content: ''; position: absolute; top: -10px; left: -10px; width: 10px; height: 10px; border-top: 2px solid ${COLOR_FUI_RED}; border-left: 2px solid ${COLOR_FUI_RED}; }
        .login-btn::after { content: ''; position: absolute; bottom: -10px; right: -10px; width: 10px; height: 10px; border-bottom: 2px solid ${COLOR_FUI_RED}; border-right: 2px solid ${COLOR_FUI_RED}; }
      `}</style>
    </button>
  </div>
);

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

      if (calculatedProgress >= 100) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#000', color: COLOR_FUI_CYAN
    }}>
      <div style={{ width: 400, textAlign: 'left', fontFamily: 'monospace', fontSize: '0.8rem', height: 150 }}>
        {log.map((l, i) => <div key={i} style={{ marginBottom: 4, color: i === log.length - 1 ? COLOR_FUI_GREEN : COLOR_FUI_CYAN }}>{l}</div>)}
      </div>
      <div style={{ width: 400, height: 4, background: '#111', marginTop: 20, position: 'relative' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: COLOR_FUI_RED, boxShadow: `0 0 10px ${COLOR_FUI_RED}` }} />
      </div>
      <div style={{ marginTop: 10, color: COLOR_FUI_RED, fontSize: '0.6rem', letterSpacing: 2 }}>{Math.floor(progress)}% Authenticating</div>
    </div>
  );
};

const MainFUI = () => {
  const { gesture, videoRef, canvasRef } = useHandTracking(true);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Canvas camera={{ position: [0, 0, 18], fov: 50 }}>
          <color attach="background" args={['#000']} />
          <ambientLight intensity={0.5} />
          <Suspense fallback={null}>
            <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
                <GalaxyParticles gesture={gesture} />
            </Float>
            <mesh rotation={[Math.PI / 2, 0.2, 0]}>
                <ringGeometry args={[12, 12.1, 128]} />
                <meshBasicMaterial color={COLOR_FUI_RED} transparent opacity={0.1} side={THREE.DoubleSide} />
            </mesh>
            <mesh rotation={[Math.PI / 2.5, -0.4, 0]}>
                <ringGeometry args={[15, 15.05, 128]} />
                <meshBasicMaterial color={COLOR_FUI_CYAN} transparent opacity={0.1} side={THREE.DoubleSide} />
            </mesh>
          </Suspense>
          <EffectComposer>
            <Bloom intensity={2.5} luminanceThreshold={0.1} mipmapBlur />
          </EffectComposer>
          <OrbitControls enableZoom={false} enablePan={false} />
        </Canvas>
      </div>

      <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
        
        <div style={{ 
          position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}>
          <h2 style={{
            fontFamily: "'Rajdhani', sans-serif", fontSize: '3rem', margin: 0, color: COLOR_FUI_RED,
            fontWeight: 700, letterSpacing: 15, textShadow: `0 0 15px ${COLOR_FUI_RED}88`
          }}>
            CTOS DATABASE
          </h2>
          <div style={{ display: 'flex', gap: 40, marginTop: 10, alignItems: 'center' }}>
            <div style={{ height: 1, width: 200, background: `linear-gradient(90deg, transparent, ${COLOR_FUI_CYAN})` }} />
            <div style={{ display: 'flex', gap: 10, color: COLOR_FUI_RED, fontSize: '0.7rem', fontFamily: 'monospace' }}>
                <Cpu size={14} /> <span>CPU: 42%</span>
                <Zap size={14} /> <span>MEM: 64.2GB</span>
                <Radio size={14} /> <span>SIGNAL: 100%</span>
            </div>
            <div style={{ height: 1, width: 200, background: `linear-gradient(90deg, ${COLOR_FUI_CYAN}, transparent)` }} />
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: 50, left: 50, pointerEvents: 'auto' }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                {/* EXPLODE STATUS LIGHT */}
                <div style={{
                    padding: '8px 20px', fontSize: '0.8rem', fontFamily: 'Rajdhani',
                    border: `1px solid ${COLOR_FUI_RED}`, 
                    color: COLOR_FUI_RED,
                    background: 'rgba(0,0,0,0.5)',
                    boxShadow: 'none',
                    transition: 'all 0.2s ease',
                    display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700
                }}>
                    <div style={{ 
                      width: 10, height: 10, borderRadius: '50%', 
                      background: gesture === 'OPEN' ? COLOR_FUI_GREEN : '#333',
                      transition: 'background 0.2s ease',
                      boxShadow: 'none' 
                    }} />
                    EXPLODE
                </div>

                {/* SCALING STATUS LIGHT */}
                <div style={{
                    padding: '8px 20px', fontSize: '0.8rem', fontFamily: 'Rajdhani',
                    border: `1px solid ${COLOR_FUI_RED}`,
                    color: COLOR_FUI_RED,
                    background: 'rgba(0,0,0,0.5)',
                    boxShadow: 'none',
                    transition: 'all 0.2s ease',
                    display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700
                }}>
                    <div style={{ 
                      width: 10, height: 10, borderRadius: '50%', 
                      background: gesture === 'FIST' ? COLOR_FUI_GREEN : '#333',
                      transition: 'background 0.2s ease',
                      boxShadow: 'none' 
                    }} />
                    SCALING
                </div>
            </div>

            <div style={{ 
                width: 240, height: 180, border: `1px solid rgba(94, 246, 255, 0.4)`, 
                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', position: 'relative',
                overflow: 'hidden', boxShadow: '0 0 20px rgba(0,0,0,0.5)'
            }}>
                <div style={{ 
                  background: 'rgba(94, 246, 255, 0.1)', height: 25, display: 'flex', 
                  alignItems: 'center', padding: '0 10px', justifyContent: 'space-between',
                  borderBottom: `1px solid rgba(94, 246, 255, 0.2)`
                }}>
                  <div style={{ color: COLOR_FUI_CYAN, fontSize: '0.5rem', letterSpacing: 1.5 }}>BIOMETRIC_v02</div>
                  <Lock size={10} color={COLOR_FUI_RED} />
                </div>
                
                <canvas ref={canvasRef} width={240} height={180} style={{ position: 'absolute', inset: 0, transform: 'scaleX(-1) translateY(12px)' }} />
                <video ref={videoRef} style={{ display: 'none' }} playsInline muted />
                
                <div style={{ position: 'absolute', top: 25, left: 0, width: 2, height: 15, background: COLOR_FUI_CYAN }} />
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 15, height: 2, background: COLOR_FUI_RED }} />
                
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(94,246,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(94,246,255,0.05) 1px, transparent 1px)', backgroundSize: '15px 15px', pointerEvents: 'none' }} />
            </div>
            <div style={{ marginTop: 10, color: COLOR_FUI_CYAN, fontSize: '0.6rem', opacity: 0.6 }}>SYSTEM_SOURCE: /dev/camera/video0</div>
        </div>

        <div style={{ position: 'absolute', bottom: 50, right: 50, width: 220, pointerEvents: 'auto' }}>
            <div style={{ borderLeft: `3px solid ${COLOR_FUI_RED}`, paddingLeft: 15, marginBottom: 30 }}>
                <div style={{ color: COLOR_FUI_RED, fontSize: '0.9rem', fontWeight: 700, letterSpacing: 2 }}>TRAFFIC ANALYTICS</div>
                <div style={{ marginTop: 10 }}>
                    {[...Array(4)].map((_, i) => (
                        <div key={i} style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: COLOR_FUI_RED, opacity: 0.9 }}>
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
            
            <div style={{ borderRight: `3px solid ${COLOR_FUI_CYAN}`, paddingRight: 15, textAlign: 'right' }}>
                <div style={{ color: COLOR_FUI_RED, fontSize: '0.9rem', fontWeight: 700, letterSpacing: 2 }}>NODAL STATUS</div>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ color: COLOR_FUI_GREEN, fontSize: '0.6rem' }}>● GALAXY_CORE: STABLE</div>
                    <div style={{ color: COLOR_FUI_GREEN, fontSize: '0.6rem' }}>● SYNC_STATE: ACTIVE</div>
                    <div style={{ color: COLOR_FUI_RED, fontSize: '0.6rem' }}>○ GESTURE_OVERRIDE: OFF</div>
                </div>
            </div>
        </div>

        <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.05) 50%)',
            backgroundSize: '100% 4px', zIndex: 10, opacity: 0.5
        }} />
        <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            boxShadow: `inset 0 0 150px rgba(0,0,0,1)`, zIndex: 11
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
