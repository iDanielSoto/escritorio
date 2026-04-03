import { useState, useEffect, useRef } from "react";
import {
  Camera,
  X,
  CheckCircle,
  CheckCircle2,
  XCircle,
  LogIn,
  Timer,
  Loader2,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import { useFaceDetection } from "../../hooks/useFaceDetection";
import { identificarPorFacial, guardarSesion } from "../../services/biometricAuthService";
import { useCamera } from "../../context/CameraContext";
import { API_CONFIG } from "../../config/apiEndPoint";

import { agregarEvento } from "../../services/bitacoraService";
import * as faceapi from 'face-api.js';
import { useConnectivity } from "../../hooks/useConnectivity";

const getFaceLuminance = (videoElement, faceBox) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  
  canvas.width = faceBox.width;
  canvas.height = faceBox.height;
  
  context.drawImage(
    videoElement, 
    faceBox.x, faceBox.y, faceBox.width, faceBox.height, 
    0, 0, faceBox.width, faceBox.height 
  );
  
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;
  
  let totalLuminance = 0;
  const totalPixels = imageData.length / 4;

  for (let i = 0; i < imageData.length; i += 4) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    
    // Aplicar la fórmula de luminancia a cada pixel
    const pixelLuminance = (0.299 * r) + (0.587 * g) + (0.114 * b);
    totalLuminance += pixelLuminance;
  }

  // Devolver el brillo promedio del rostro (será un valor entre 0 y 255)
  return totalLuminance / totalPixels;
};

export default function AsistenciaFacial({
  isOpen = false,
  onClose,
  onSuccess,
  onLoginRequest,
  backgroundMode = false
}) {
  const shouldMaintainConnection = isOpen || backgroundMode;

  const [step, setStep] = useState("liveness"); // liveness, capturing, identifying, success, error
  const [showModal, setShowModal] = useState(!backgroundMode);
  const [errorMessage, setErrorMessage] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [result, setResult] = useState(null);
  const [countdown, setCountdown] = useState(6);
  const [loginHabilitado, setLoginHabilitado] = useState(false);
  const [processingLogin, setProcessingLogin] = useState(false);

  // Liveness detection state (Point Challenge)
  const [challengePoint, setChallengePoint] = useState(null); // {x, y, angle}
  const [challengeDone, setChallengeDone] = useState(false);
  const [proximityMessage, setProximityMessage] = useState(""); // Guía visual de proximidad
  const [flashActive, setFlashActive] = useState(false); // <--- Add this

  const { isDatabaseConnected } = useConnectivity();
  const isDatabaseConnectedRef = useRef(isDatabaseConnected);

  // Refs
  const countdownIntervalRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const backgroundModeRef = useRef(backgroundMode);
  const isProcessingRef = useRef(false);
  const captureIntervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const cropCanvasRef = useRef(null);

  // Liveness refs (no re-render during loop)
  const livenessIntervalRef = useRef(null);
  const livenessTimeoutRef = useRef(null);
  const challengeDoneRef = useRef(false);
  const challengeSequenceRef = useRef(0); // 0 = primer punto, 1 = segundo punto
  const startNoseRef = useRef(null); // Guardar posicion inicial de la nariz
  const smoothedPoseRef = useRef(null); // Guardar la posición suavizada actual (filtro EMA)
  const currentChallengeRef = useRef(null); // Referencia al challenge actual para el closure de setInterval
  const framesHeldRef = useRef(0); // Para requerir múltiples fotogramas sostenidos
  const processingFlashRef = useRef(false); // Impide múltiple disparo de flash

  // Hook de camara singleton
  const { initCamera, releaseCamera } = useCamera();

  // ── Helpers de Liveness ──────────────────────────────────────────────────

  // Generar punto aleatorio dentro del óvalo
  const generateChallengePoint = () => {
    // Definimos el área visible: asumiendo viewBox de la máscara (400x300)
    // Angulo aleatorio entre 0 y 2PI (360 grados)
    const angle = Math.random() * Math.PI * 2;

    // Distancia aleatoria desde el centro (entre 45% y 80% del radio del óvalo)
    const scale = 0.45 + (Math.random() * 0.35);

    // Posicionamos
    const radiusX = 80 * scale;
    const radiusY = 105 * scale;

    // En el SVG original, el origin = (200, 140)
    const targetX = 200 + Math.cos(angle) * radiusX;
    const targetY = 140 + Math.sin(angle) * radiusY;

    return {
      x: targetX,
      y: targetY,
      angle: angle, // Angulo real de la dirección a mover
      direction: 'punto rojo'
    };
  };

  // Cleanup del loop de liveness
  const stopLiveness = () => {
    if (livenessIntervalRef.current) clearInterval(livenessIntervalRef.current);
    if (livenessTimeoutRef.current) clearTimeout(livenessTimeoutRef.current);
    livenessIntervalRef.current = null;
    livenessTimeoutRef.current = null;
  };

  // Iniciar loop de liveness Detection (Challenge-Response)
  const startLivenessLoop = (video) => {
    stopLiveness();
    challengeDoneRef.current = false;
    challengeSequenceRef.current = 0;
    startNoseRef.current = null;
    smoothedPoseRef.current = null;
    currentChallengeRef.current = null;
    framesHeldRef.current = 0;
    setChallengePoint(null);
    setChallengeDone(false);
    setFlashActive(false);
    processingFlashRef.current = false;

    const advanceToCapture = () => {
      stopLiveness();
      setTimeout(() => {
        setStep("capturing");
        setChallengePoint(null);
      }, 600);
    };

    livenessIntervalRef.current = setInterval(async () => {
      if (!video || video.paused || video.ended || processingFlashRef.current) return;
      try {
        const detections = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
          .withFaceLandmarks();

        if (!detections) return;

        // Obtener la punta de la nariz y los ojos
        const nose = detections.landmarks.getNose();
        const leftEye = detections.landmarks.getLeftEye();
        const rightEye = detections.landmarks.getRightEye();

        if (!nose || nose.length < 4 || !leftEye || !rightEye) {
          setProximityMessage("No se detecta correctamente el rostro");
          return;
        }

        // --- VALIDACIÓN DE PROXIMIDAD Y CENTRADO ---
        if (!challengeDoneRef.current) {
          const box = detections.detection.box;
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const faceCenterX = box.x + box.width / 2;
          const faceCenterY = box.y + box.height / 2;
          const idealCenterX = vw * 0.5;
          const idealCenterY = vh * 0.466; // El ovalo está un poco arriba del puro centro

          const heightRatio = box.height / vh;

          let positionGood = false;
          if (heightRatio < 0.25) {
            setProximityMessage("Acércate un poco más a la cámara");
          } else if (heightRatio > 0.60) {
            setProximityMessage("Aléjate un poco de la cámara");
          } else if (Math.abs(faceCenterX - idealCenterX) > vw * 0.15 || Math.abs(faceCenterY - idealCenterY) > vh * 0.15) {
            setProximityMessage("Centra tu rostro dentro del óvalo");
          } else {
            setProximityMessage("¡Posición perfecta!");
            positionGood = true;
          }

          // Si no está en una buena posición y aún no ha iniciado el reto, no lo generamos todavía
          if (!currentChallengeRef.current) {
            if (!positionGood) {
              startNoseRef.current = null;
              smoothedPoseRef.current = null;
              return;
            } else {
              const chal = generateChallengePoint();
              currentChallengeRef.current = chal;
              setChallengePoint(chal);
              console.log(`🎯 Nuevo Punto Liveness generado tras posición perfecta`);
            }
          }
        }

        const noseTip = nose[3]; // Punta de la nariz

        // Calcular el punto central entre ambos ojos
        const eyesCenterX = (leftEye[0].x + rightEye[3].x) / 2;
        const eyesCenterY = (leftEye[0].y + rightEye[3].y) / 2;

        // Calcular la posición RELATIVA de la nariz respecto al centro de los ojos
        const relativeNoseX = noseTip.x - eyesCenterX;
        const relativeNoseY = noseTip.y - eyesCenterY;

        // Medir distancia y ángulo de los ojos para Normalizar Escala y Rotación plana (2D)
        const eyeDistance = Math.sqrt(
          Math.pow(rightEye[3].x - leftEye[0].x, 2) + Math.pow(rightEye[3].y - leftEye[0].y, 2)
        );
        const eyeAngle = Math.atan2(rightEye[3].y - leftEye[0].y, rightEye[3].x - leftEye[0].x);

        // Rotar el vector de la nariz para ignorar la inclinación de la foto (Invariancia de Rotación 2D)
        const rotatedNoseX = relativeNoseX * Math.cos(-eyeAngle) - relativeNoseY * Math.sin(-eyeAngle);
        const rotatedNoseY = relativeNoseX * Math.sin(-eyeAngle) + relativeNoseY * Math.cos(-eyeAngle);

        // Normalizar por la distancia de los ojos para ignorar acercamiento/alejamiento de foto (Invariancia de Escala 2D)
        const normNoseX = rotatedNoseX / eyeDistance;
        const normNoseY = rotatedNoseY / eyeDistance;

        // --- COMPROBACIÓN 3D ANTI-SPOOFING (PARALLAX FACIAL) ---
        const jaw = detections.landmarks.getJawOutline();
        let parallaxRatio = 1.0;

        if (jaw && jaw.length === 17) {
          const leftJawEdge = jaw[0];
          const rightJawEdge = jaw[16];

          const distToLeftEdge = noseTip.x - leftJawEdge.x;
          const distToRightEdge = rightJawEdge.x - noseTip.x;

          if (distToRightEdge > 0 && distToLeftEdge > 0) {
            parallaxRatio = distToLeftEdge / distToRightEdge;
          }
        }

        // --- FILTRO DE ESTABILIZACIÓN (EMA) ---
        // Filtramos las pulsaciones rápidas (jitter de IA) o sacudidas irreales del papel
        const alpha = 0.3; // Factor de suavizado (menor = más suave/lento)
        if (!smoothedPoseRef.current) {
          smoothedPoseRef.current = { x: normNoseX, y: normNoseY };
        } else {
          smoothedPoseRef.current.x = (alpha * normNoseX) + ((1 - alpha) * smoothedPoseRef.current.x);
          smoothedPoseRef.current.y = (alpha * normNoseY) + ((1 - alpha) * smoothedPoseRef.current.y);
        }

        const stableNoseX = smoothedPoseRef.current.x;
        const stableNoseY = smoothedPoseRef.current.y;

        // Si es el primer cuadro detectado con éxito, guardamos la "pose" inicial normalizada y estable
        if (!startNoseRef.current) {
          startNoseRef.current = { x: stableNoseX, y: stableNoseY };
          return;
        }

        // Calcular cuánto cambió la POSICIÓN RELATIVA verdadera (Rotación 3D pura Pitch/Yaw)
        // Convertimos de vuelta a escala de píxeles para mantener la sensibilidad de umbral original
        const deltaX = -(stableNoseX - startNoseRef.current.x) * eyeDistance; // Invertido por Espejo
        const deltaY = (stableNoseY - startNoseRef.current.y) * eyeDistance;

        // Calcular magnitud de la rotación 3D (cuánto rotó la cabeza)
        const rotationMoved3D = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Si la cabeza rotó de forma evidente proporcional al tamaño de los ojos
        if (rotationMoved3D > eyeDistance * 0.22) {
          // Calcular ángulo de movimiento de la cabeza interactiva (-PI a PI)
          let userAngle = Math.atan2(deltaY, deltaX);
          if (userAngle < 0) userAngle += 2 * Math.PI; // Normalizar 0 a 2*PI

          // Calcular diferencia con el ángulo del target
          let angleDiff = Math.abs(userAngle - currentChallengeRef.current.angle);
          if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

          // Tolerancia de ~50 grados para movimiento diagonal natural
          if (angleDiff < Math.PI / 3.6) {

            // VALIDACIÓN ESTRICTA DE PROFUNDIDAD 3D (YAW)
            let isTrue3D = true;
            if (Math.abs(deltaX) > eyeDistance * 0.15) {
              const isLookingRight = deltaX > 0;
              if (isLookingRight && parallaxRatio > 0.85) {
                isTrue3D = false;
              } else if (!isLookingRight && parallaxRatio < 1.15) {
                isTrue3D = false;
              }
            }

            if (isTrue3D) {
              framesHeldRef.current += 1;
              if (framesHeldRef.current >= 3) {
                if (challengeSequenceRef.current === 0) {
                  if (!processingFlashRef.current) {
                    processingFlashRef.current = true;
                    setChallengeDone(true);
                    
                    setTimeout(() => {
                      challengeSequenceRef.current = 1;
                      framesHeldRef.current = 0;
                      startNoseRef.current = null;
                      smoothedPoseRef.current = null;
                      
                      const newChal = generateChallengePoint();
                      currentChallengeRef.current = newChal;
                      setChallengePoint(newChal);
                      setChallengeDone(false);
                      
                      processingFlashRef.current = false;
                    }, 500); 
                  }
                } else if (challengeSequenceRef.current === 1) {
                  if (!processingFlashRef.current) {
                    processingFlashRef.current = true;
                    // Tomar luminancia pre-flash
                    const baseLuminance = getFaceLuminance(video, detections.detection.box);
                    setFlashActive(true);
                    
                    setTimeout(() => {
                      // Tomar luminancia mid-flash
                      const midLuminance = getFaceLuminance(video, detections.detection.box);
                      setFlashActive(false);
                      
                      const diff = midLuminance - baseLuminance;
                      console.log(`[Flash Liveness] Base: ${baseLuminance.toFixed(2)}, Mid: ${midLuminance.toFixed(2)}, Diff: ${diff.toFixed(2)}`);
                      
                      if (diff > 2.0) { // Umbral de aumento de luz
                        console.log("✅ Rotación 3D intencional y Flash Liveness correctos");
                        challengeDoneRef.current = true;
                        setChallengeDone(true);
                        advanceToCapture();
                      } else {
                        console.log("❌ Posible video detectado (Flash no reflejado en rostro)");
                        setProximityMessage("Reflejo no detectado. Reiniciando prueba...");
                        
                        // Para evitar parpadeo infinito, reiniciamos el reto por completo
                        currentChallengeRef.current = null;
                        setChallengePoint(null);
                        framesHeldRef.current = 0;
                        startNoseRef.current = null;
                        challengeSequenceRef.current = 0;
                        
                        // Cooldown antes de permitir que comience de nuevo y parpadee
                        setTimeout(() => {
                          processingFlashRef.current = false;
                          setProximityMessage("");
                        }, 2000);
                      }
                    }, 400); // 400ms para la animación de "tenue a fuerte"
                  }
                }
              }
            } else {
              if (!processingFlashRef.current) {
                framesHeldRef.current = 0;
                setProximityMessage("Movimiento irreal. Gire el cuello, no la cámara.");
              }
            }
          } else {
            framesHeldRef.current = 0;
          }
        } else {
          framesHeldRef.current = Math.max(0, framesHeldRef.current - 1);
        }

      } catch (err) {
        // silenciar error de detección por frame
      }
    }, 150);

    // Timeout de 15s para liveness
    livenessTimeoutRef.current = setTimeout(() => {
      stopLiveness();
      setErrorMessage("Verificación de vida fallida. Tiempo de prueba agotado.");
      setStep("error");
    }, 15000);
  };

  // ── Fin helpers de Liveness ──────────────────────────────────────────────

  // Recortar video al area del ovalo guia
  const getCroppedOvalFrame = (video) => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    // Calcular area visible (object-cover con aspect 4:3)
    const displayAspect = 4 / 3;
    const videoAspect = vw / vh;
    let sx, sy, sw, sh;
    if (videoAspect > displayAspect) {
      sh = vh; sw = vh * displayAspect;
      sx = (vw - sw) / 2; sy = 0;
    } else {
      sw = vw; sh = vw / displayAspect;
      sx = 0; sy = (vh - sh) / 2;
    }

    // Mapear ovalo SVG (viewBox 400x300, ellipse cx=200 cy=140 rx=80 ry=105)
    const oLeft = 120 / 400, oTop = 35 / 300;
    const oW = 160 / 400, oH = 210 / 300;
    const cropX = sx + sw * oLeft;
    const cropY = sy + sh * oTop;
    const cropW = sw * oW;
    const cropH = sh * oH;

    // Reusar canvas
    if (!cropCanvasRef.current) {
      cropCanvasRef.current = document.createElement('canvas');
    }
    const canvas = cropCanvasRef.current;
    const cw = 280, ch = Math.round(280 * (cropH / cropW));
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');

    // Limpiar y aplicar clip eliptico
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cw / 2, ch / 2, cw / 2, ch / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cw, ch);
    ctx.restore();

    return canvas;
  };

  const {
    modelsLoaded,
    faceDetected,
    detectionError,
    loadModels,
    stopFaceDetection,
  } = useFaceDetection();

  // Mantener refs actualizadas
  useEffect(() => {
    onCloseRef.current = onClose;
    backgroundModeRef.current = backgroundMode;
    isDatabaseConnectedRef.current = isDatabaseConnected;
  }, [onClose, backgroundMode, isDatabaseConnected]);

  // Reset al montar
  useEffect(() => {
    setLoginHabilitado(false);
    setProcessingLogin(false);

    if (backgroundMode) {
      setShowModal(false);
    }

    return () => {
      setLoginHabilitado(false);
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      stopLiveness();
    };
  }, []);

  // Cargar modelos e iniciar camara al montar (patron identico a FacialAuthModal)
  useEffect(() => {
    if (!shouldMaintainConnection) return;

    // Verificar si la cámara está registrada antes de intentar usarla
    let isRegistered = false;
    try {
      isRegistered = JSON.parse(localStorage.getItem("cached_camera_registered") || "false");
    } catch {
      isRegistered = false;
    }

    if (!isRegistered) {
      console.warn("🚫 [AsistenciaFacial] Cámara no registrada. Abortando inicio de cámara.");
      setErrorMessage("La cámara no está registrada en el sistema. Contacte al administrador.");
      setStep("error");
      if (backgroundMode) setShowModal(true);
      return;
    }

    loadModels();

    // Iniciar camara directamente, igual que FacialAuthModal
    initCamera()
      .then((mediaStream) => {
        const video = document.getElementById("facialAttendanceVideo");
        if (video) {
          video.srcObject = mediaStream;
        }
      })
      .catch((err) => {
        console.error("Error accediendo a la camara:", err);
        setErrorMessage("No se pudo acceder a la camara");
        setStep("error");
        if (backgroundMode) setShowModal(true);
      });
  }, [loadModels, initCamera]);

  // Limpiar camara al desmontar (patron identico a FacialAuthModal)
  useEffect(() => {
    return () => {
      releaseCamera();
    };
  }, [releaseCamera]);

  // Iniciar liveness detection cuando los modelos esten listos
  useEffect(() => {
    if (step !== "liveness" || !modelsLoaded || !shouldMaintainConnection) return;

    const video = document.getElementById("facialAttendanceVideo");
    if (!video) return;

    const handleCanPlay = () => {
      if (video.readyState >= 2) startLivenessLoop(video);
    };

    video.addEventListener("loadeddata", handleCanPlay);
    video.addEventListener("canplay", handleCanPlay);

    if (video.readyState >= 2) startLivenessLoop(video);

    return () => {
      video.removeEventListener("loadeddata", handleCanPlay);
      video.removeEventListener("canplay", handleCanPlay);
      stopLiveness();
    };
  }, [step, modelsLoaded, shouldMaintainConnection]);

  // Iniciar deteccion facial (patron identico a FacialAuthModal)
  useEffect(() => {
    if (step !== "capturing" || !modelsLoaded || !shouldMaintainConnection) return;

    const video = document.getElementById("facialAttendanceVideo");
    if (!video) return;

    let capturado = false;

    const handleVideoReady = () => {
      console.log("Camara lista para registro facial...");

      captureIntervalRef.current = setInterval(async () => {
        if (capturado || isProcessingRef.current) return;

        try {
          // Recortar al area del ovalo guia
          const croppedFrame = getCroppedOvalFrame(video);
          if (!croppedFrame) return;

          const detections = await faceapi
            .detectSingleFace(croppedFrame, new faceapi.TinyFaceDetectorOptions({
              inputSize: 224,
              scoreThreshold: 0.4
            }))
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (detections && detections.detection.score > 0.4 && !capturado && !isProcessingRef.current) {
            capturado = true;
            isProcessingRef.current = true;
            clearInterval(captureIntervalRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);

            const descriptor = Array.from(detections.descriptor);
            console.log("Rostro capturado para registro");

            // Convertir descriptor a Base64
            const float32Array = new Float32Array(descriptor);
            const buffer = new Uint8Array(float32Array.buffer);
            let binary = '';
            for (let i = 0; i < buffer.length; i++) {
              binary += String.fromCharCode(buffer[i]);
            }
            const descriptorBase64 = btoa(binary);

            // Mostrar estado de identificacion
            setStep("identifying");
            if (backgroundMode) setShowModal(true);

            // Identificar y registrar asistencia
            await identificarYRegistrar(descriptorBase64);
          }
        } catch (error) {
          console.error("Error en deteccion:", error);
        }
      }, 500);

      // Timeout de 20 segundos
      timeoutRef.current = setTimeout(() => {
        if (!capturado && !isProcessingRef.current) {
          clearInterval(captureIntervalRef.current);
          setErrorMessage("Tiempo agotado. No se detecto un rostro valido.");
          setStep("error");
          if (backgroundMode) setShowModal(true);
        }
      }, 20000);
    };

    const handleCanPlay = () => {
      if (video.readyState >= 2) {
        handleVideoReady();
      }
    };

    video.addEventListener("loadeddata", handleCanPlay);
    video.addEventListener("canplay", handleCanPlay);

    if (video.readyState >= 2) {
      handleVideoReady();
    }

    return () => {
      video.removeEventListener("loadeddata", handleCanPlay);
      video.removeEventListener("canplay", handleCanPlay);
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      stopFaceDetection();
    };
  }, [step, modelsLoaded, shouldMaintainConnection, backgroundMode, stopFaceDetection]);

  // Identificar usuario y registrar asistencia (OFFLINE-FIRST)
  const identificarYRegistrar = async (descriptorBase64) => {
    let empleadoData = null;

    try {
      let empleadoId = null;

      // ── PASO 1: IDENTIFICAR AL EMPLEADO ──────────────────────────────────
      // Con conexión → API (identificación fresca).
      // Sin conexión → SQLite local en caché.
      if (isDatabaseConnectedRef.current) {
        // ── Identificación ONLINE ──
        console.log("🔐 [OfflineFirst/Facial] Identificando via API...");
        const response = await identificarPorFacial(descriptorBase64);

        if (!response.success) {
          throw new Error(response.error || "Rostro no reconocido en el sistema");
        }

        empleadoData = response.usuario;
        empleadoId = empleadoData?.id_empleado || empleadoData?.id;

        if (!empleadoId) {
          throw new Error("No se encontró información del empleado");
        }

      } else {
        // ── Identificación OFFLINE ──
        console.log("📴 [OfflineFirst/Facial] Sin conexión — identificando en SQLite...");
        const { identificarPorFacialOffline } = await import("../../services/offlineAuthService");

        const base64ToFloat32Array = (base64) => {
          const binary = window.atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          return new Float32Array(bytes.buffer);
        };

        const floatDescriptor = base64ToFloat32Array(descriptorBase64);
        const resultadoOffline = await identificarPorFacialOffline(floatDescriptor);

        if (!resultadoOffline) {
          throw new Error("Rostro no reconocido en base de datos local");
        }

        empleadoId = resultadoOffline.empleado_id;

        if (window.electronAPI?.offlineDB) {
          empleadoData = await window.electronAPI.offlineDB.getEmpleado(empleadoId);
        }
        empleadoData = empleadoData || resultadoOffline;

        if (!empleadoData) {
          throw new Error("Empleado no encontrado en base de datos local");
        }
      }

      console.log("👤 Empleado identificado:", empleadoData?.nombre || empleadoId);

      // ── PASO 2 + 3: GUARDAR LOCAL Y SINCRONIZAR INMEDIATAMENTE ──────────
      console.log("💾 [EagerSync/Facial] Guardando y sincronizando asistencia...");
      const { guardarYSincronizarAsistencia } = await import("../../services/offlineAuthService");
      const syncResult = await guardarYSincronizarAsistencia({
        empleadoId,
        metodoRegistro: "FACIAL",
        isDatabaseConnected: isDatabaseConnectedRef.current,
      });

      const horaActual = new Date().toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      });

      let resultPayload;

      if (syncResult.rechazado) {
        // ── Rechazado definitivamente por el servidor ──
        agregarEvento({
          user: empleadoData?.nombre || "Usuario",
          action: `Registro rechazado: ${syncResult.errorServidor} - Facial`,
          type: "error",
        });

        resultPayload = {
          success: false,
          message: syncResult.errorServidor,
          empleado: empleadoData,
          usuario: empleadoData,
          empleadoId,
          rechazado: true,
          hora: horaActual,
        };

      } else if (!syncResult.pendiente) {
        // ── Resultado REAL del servidor ──
        const tipoMovimiento = syncResult.tipo === "salida" ? "SALIDA" : "ENTRADA";
        const { obtenerInfoClasificacion } = await import("../../services/asistenciaLogicService");
        const { estadoTexto, tipoEvento } = obtenerInfoClasificacion(syncResult.estado, syncResult.tipo);

        const voiceMsg = syncResult.tipo === "salida" ? "Salida registrada" : "Entrada registrada";
        const utterance = new SpeechSynthesisUtterance(voiceMsg);
        utterance.lang = "es-MX";
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);

        agregarEvento({
          user: empleadoData?.nombre || "Usuario",
          action: `${tipoMovimiento} registrada (${estadoTexto}) - Facial`,
          type: tipoEvento,
        });

        resultPayload = {
          success: true,
          message: "Asistencia registrada",
          empleado: empleadoData,
          usuario: empleadoData,
          empleadoId,
          tipoMovimiento,
          hora: syncResult.hora || horaActual,
          estado: syncResult.estado,
          estadoTexto,
          clasificacion: syncResult.estado,
        };

      } else {
        // ── Pendiente: sin red o push falló temporalmente ──
        const utterance = new SpeechSynthesisUtterance("Registro pendiente");
        utterance.lang = "es-MX";
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);

        agregarEvento({
          user: empleadoData?.nombre || "Usuario",
          action: "Asistencia guardada localmente (pendiente de sincronizar) - Facial",
          type: "warning",
        });

        resultPayload = {
          success: true,
          message: "Registro pendiente",
          empleado: empleadoData,
          usuario: empleadoData,
          empleadoId,
          tipoMovimiento: "PENDIENTE",
          hora: horaActual,
          estado: "pendiente",
          estadoTexto: "⏳ Asistencia pendiente",
          clasificacion: "pendiente",
          pendiente: true,
        };
      }

      setResult(resultPayload);
      setStep(syncResult.rechazado ? "error" : "success");

      if (onSuccess && resultPayload.success) {
        onSuccess({
          empleado: empleadoData,
          tipo_movimiento: resultPayload.tipoMovimiento,
          hora: resultPayload.hora,
          estado: resultPayload.estado,
          clasificacion: resultPayload.clasificacion,
          pendiente: resultPayload.pendiente || false,
          dispositivo_origen: "escritorio",
        });
      }

    } catch (error) {
      console.error("❌ Error:", error);

      agregarEvento({
        user: empleadoData?.nombre || "Usuario",
        action: `Error en registro facial - ${error.message}`,
        type: "error",
      });

      const responseData = error.responseData;
      const isBlockCompletedError = error.message && (
        (error.message.includes("bloque") && error.message.includes("completado")) ||
        (error.message.includes("jornada") && error.message.includes("completada"))
      );

      let finalErrorMessage = error.message || "Error al registrar asistencia";
      if (finalErrorMessage.includes("falta directa")) {
        finalErrorMessage = "Registro denegado: Se te ha registrado una falta directa en este turno. No puedes registrar asistencia.";
      }

      setErrorMessage(finalErrorMessage);
      const empleadoIdLocal = empleadoData ? (empleadoData.id_empleado || empleadoData.id) : null;
      setResult({
        success: false,
        message: finalErrorMessage,
        empleado: empleadoData,
        usuario: empleadoData,
        empleadoId: empleadoIdLocal,
        noPuedeRegistrar: responseData?.noPuedeRegistrar || isBlockCompletedError,
        estadoHorario: responseData?.estadoHorario || (isBlockCompletedError ? "completado" : undefined),
        minutosRestantes: responseData?.minutosRestantes,
        noReconocida: error.message?.includes("no reconocido") || error.message?.includes("No se encontr"),
      });

      setStep("error");
    }
  };

  // Countdown para cierre automatico
  useEffect(() => {
    const debeIniciarCountdown = result?.success ||
      result?.noPuedeRegistrar ||
      result?.noReconocida ||
      (result && !result.success && result.empleadoId) ||
      (backgroundMode && result && !result.success);

    if (debeIniciarCountdown) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }

      setCountdown(6);

      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          const newValue = prev - 1;
          if (newValue <= 0) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
            setTimeout(() => {
              handleCloseModal();
            }, 500);
            return 0;
          }
          return newValue;
        });
      }, 1000);
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [result?.success, result?.noPuedeRegistrar, result?.noReconocida, result?.empleadoId, backgroundMode]);

  // Habilitar login despues de mostrar resultado
  useEffect(() => {
    if (result && result.empleadoId && showModal) {
      setLoginHabilitado(false);
      const timer = setTimeout(() => {
        setLoginHabilitado(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setLoginHabilitado(false);
    }
  }, [result, showModal]);

  // Procesar login biometrico
  const procesarLoginBiometrico = async () => {
    if (!loginHabilitado || !showModal || !result?.usuario) {
      console.warn("Login no habilitado o modal no visible");
      return;
    }

    setProcessingLogin(true);

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    try {
      const API_BASE = `${API_CONFIG.BASE_URL}/api`;

      const authResponse = await fetch(`${API_BASE}/auth/biometric`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ empleado_id: result.empleadoId }),
      });

      if (!authResponse.ok) {
        if (authResponse.status >= 500) {
          const error = new Error(`Server Error: ${authResponse.status}`);
          error.isApiOffline = true;
          throw error;
        }
        const errorData = await authResponse.json().catch(() => ({}));
        throw new Error(errorData.message || "Error al autenticar");
      }

      const authResult = await authResponse.json();

      if (!authResult.success) {
        throw new Error(authResult.message || "Error en autenticacion");
      }

      const { usuario, roles, permisos, esAdmin, token } = authResult.data;

      if (token) {
        localStorage.setItem('auth_token', token);
      }

      const usuarioCompleto = {
        ...usuario,
        roles,
        permisos,
        esAdmin,
        token,
        metodoAutenticacion: "FACIAL",
      };

      guardarSesion(usuarioCompleto);

      if (onClose) onClose();

      if (onLoginRequest) {
        onLoginRequest(usuarioCompleto);
      }

    } catch (error) {
      console.error("Error procesando login:", error);

      // === FALLBACK OFFLINE LOGIN ===
      const isNetworkError = !navigator.onLine
        || error.name === 'TypeError'
        || error.message.includes('Failed to fetch')
        || error.message.includes('NetworkError')
        || error.message.includes('ERR_INTERNET_DISCONNECTED')
        || error.isApiOffline
        || error.message.includes('Server Error');

      if (isNetworkError && window.electronAPI && window.electronAPI.offlineDB) {
        console.log('📴 [AsistenciaFacial] Sin conexión — intentando Login offline...');
        try {
          const empleadoId = result.empleadoId;
          const empleadoFull = await window.electronAPI.offlineDB.getEmpleado(empleadoId);
          if (empleadoFull) {
            const usuarioOffline = {
              id: empleadoFull.usuario_id,
              nombre: empleadoFull.nombre,
              usuario: empleadoFull.usuario || '',
              correo: empleadoFull.correo || '',
              foto: empleadoFull.foto || null,
              username: empleadoFull.usuario || empleadoFull.nombre,
              es_empleado: true,
              empleado_id: empleadoId,
              roles: [],
              permisos: [],
              esAdmin: false,
              offline: true,
              metodoAutenticacion: "FACIAL_OFFLINE",
              ...empleadoFull
            };

            guardarSesion(usuarioOffline);

            if (onClose) onClose();

            if (onLoginRequest) {
              onLoginRequest(usuarioOffline);
            }
            return;
          }
        } catch (offlineErr) {
          console.error('❌ [AsistenciaFacial] Error Login Offline:', offlineErr);
        }
      }

      setCountdown(6);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          const newValue = prev - 1;
          if (newValue <= 0) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
            setTimeout(() => {
              handleCloseModal();
            }, 500);
            return 0;
          }
          return newValue;
        });
      }, 1000);
    } finally {
      setProcessingLogin(false);
    }
  };

  // Cerrar modal (patron identico a FacialAuthModal)
  const handleCloseModal = () => {
    setLoginHabilitado(false);
    isProcessingRef.current = false;

    // En cualquier caso terminamos soltando la cámara para que no se quede encendida permanentemente.
    releaseCamera();

    if (backgroundMode) {
      setShowModal(false);
      setResult(null);
      setStep("liveness");
      setErrorMessage("");
    } else {
      setIsClosing(true);
      setTimeout(() => {
        if (onClose) onClose();
      }, 300);
    }
  };

  // Reintentar (vuelve al paso de liveness)
  const handleRetry = () => {
    stopLiveness();
    setStep("liveness");
    setResult(null);
    setErrorMessage("");
    isProcessingRef.current = false;
    challengeDoneRef.current = false;
    startNoseRef.current = null;
    setChallengeDone(false);
    setChallengePoint(null);

    // Reiniciar camara directamente
    initCamera()
      .then((mediaStream) => {
        const video = document.getElementById("facialAttendanceVideo");
        if (video) {
          video.srcObject = mediaStream;
        }
      })
      .catch((err) => {
        setErrorMessage("No se pudo acceder a la camara");
        setStep("error");
      });
  };

  // No renderizar si no debe mantener conexion
  if (!shouldMaintainConnection) {
    return null;
  }

  // En modo background, no mostrar UI hasta detectar rostro
  if (backgroundMode && !showModal) {
    return null;
  }

  return (
    <div className={`fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all duration-300 animate-backdrop ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
      {flashActive && <div className="fixed inset-0 bg-white z-[9999] pointer-events-none" style={{ animation: "flashFadeIn 400ms ease-out forwards" }}></div>}
      <div className={`bg-bg-primary rounded-lg shadow-2xl max-w-md sm:max-w-lg w-full overflow-hidden border border-border-subtle transition-all duration-300 animate-zoom-in ${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
        <div className="p-6 sm:p-8">
          {/* Header Minimalista */}
          <div className="text-center mb-6 relative">
            <button
              onClick={handleCloseModal}
              className="absolute -top-2 -right-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md p-2 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-text-primary tracking-tight">Registro de Asistencia</h2>
            <p className="text-text-tertiary text-xs mt-1 opacity-80 uppercase tracking-widest font-medium">Reconocimiento Facial</p>
          </div>

          {/* Contenido */}
          <div className="space-y-4">
            {/* Liveness Detection / Capturing */}
            {(step === "liveness" || step === "capturing") && (
              <div className="space-y-4">
                <div className="relative bg-black rounded-xl overflow-hidden w-full aspect-[4/3] ring-1 ring-border-subtle shadow-inner">
                  <video
                    id="facialAttendanceVideo"
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />

                  {/* Guias de captura - Ovalo facial con animaciones */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
                      <defs>
                        <mask id="faceMaskOverlay">
                          <rect width="400" height="300" fill="white" />
                          <ellipse cx="200" cy="140" rx="80" ry="105" fill="black" />
                        </mask>
                        <filter id="faceGuideGlow">
                          <feGaussianBlur stdDeviation="4" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                        <linearGradient id="scanLineGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="transparent" />
                          <stop offset="30%" stopColor={faceDetected ? "rgba(var(--accent), 0.6)" : "rgba(255,255,255,0.3)"} />
                          <stop offset="50%" stopColor={faceDetected ? "rgba(var(--accent), 0.9)" : "rgba(255,255,255,0.5)"} />
                          <stop offset="70%" stopColor={faceDetected ? "rgba(var(--accent), 0.6)" : "rgba(255,255,255,0.3)"} />
                          <stop offset="100%" stopColor="transparent" />
                        </linearGradient>
                      </defs>
                      <rect width="400" height="300" fill="rgba(0,0,0,0.5)" mask="url(#faceMaskOverlay)" />
                      <ellipse
                        cx="200" cy="140" rx="80" ry="105"
                        fill="none"
                        stroke={faceDetected ? "rgb(var(--accent))" : "rgba(255,255,255,0.4)"}
                        strokeWidth={faceDetected ? "3" : "2"}
                        strokeDasharray={faceDetected ? "none" : "8 4"}
                        filter={faceDetected ? "url(#faceGuideGlow)" : "none"}
                        style={{ transition: "all 0.4s ease" }}
                      />
                      {faceDetected && (
                        <ellipse
                          cx="200" cy="140" rx="84" ry="109"
                          fill="none"
                          stroke="rgb(var(--accent))"
                          strokeWidth="2"
                          opacity="0.3"
                          style={{ animation: "facePulse 2s ease-in-out infinite" }}
                        />
                      )}
                      {!faceDetected && (
                        <line
                          x1="120" y1="140" x2="280" y2="140"
                          stroke="url(#scanLineGradient)"
                          strokeWidth="2"
                          style={{ animation: "scanLine 2.5s ease-in-out infinite" }}
                        />
                      )}
                      {/* Marcas de alineacion */}
                      <path d="M 135 55 L 135 40 L 155 40" fill="none" stroke={faceDetected ? "rgb(var(--accent))" : "rgba(255,255,255,0.5)"} strokeWidth="3" strokeLinecap="round" />
                      <path d="M 265 55 L 265 40 L 245 40" fill="none" stroke={faceDetected ? "rgb(var(--accent))" : "rgba(255,255,255,0.5)"} strokeWidth="3" strokeLinecap="round" />
                      <path d="M 135 245 L 135 260 L 155 260" fill="none" stroke={faceDetected ? "rgb(var(--accent))" : "rgba(255,255,255,0.5)"} strokeWidth="3" strokeLinecap="round" />
                      <path d="M 265 245 L 265 260 L 245 260" fill="none" stroke={faceDetected ? "rgb(var(--accent))" : "rgba(255,255,255,0.5)"} strokeWidth="3" strokeLinecap="round" />
                      
                      {step === "liveness" && challengePoint && (
                        <circle
                          cx={challengePoint.x}
                          cy={challengePoint.y}
                          r={challengeDone ? "28" : "18"}
                          fill={challengeDone ? "rgb(var(--success))" : "rgb(var(--error))"}
                          opacity="1"
                          stroke="white"
                          strokeWidth="4"
                          style={{
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            animation: challengeDone ? 'none' : 'facePulse 1.5s infinite'
                          }}
                        />
                      )}
                    </svg>
                    
                    <style>{`
                      @keyframes scanLine {
                        0% { transform: translateY(-70px); opacity: 0; }
                        15% { opacity: 1; }
                        85% { opacity: 1; }
                        100% { transform: translateY(70px); opacity: 0; }
                      }
                      @keyframes facePulse {
                        0%, 100% { opacity: 0.3; transform: scale(1); }
                        50% { opacity: 0.6; transform: scale(1.02); }
                      }
                      @keyframes flashFadeIn {
                        from { opacity: 0.1; }
                        to { opacity: 1; }
                      }
                    `}</style>

                    {step === "liveness" && modelsLoaded && challengePoint && (
                      <div className="absolute bottom-4 left-4 right-4 text-center">
                        <div className="inline-block bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 ring-1 ring-black/20 shadow-xl">
                          <p className={`text-xs font-bold uppercase tracking-wider ${challengeDone ? 'text-success' : 'text-white'}`}>
                            {challengeDone ? '¡Excelente!' : 'Apunta con la nariz hacia el punto'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Indicators */}
                <div className="bg-bg-secondary/40 border border-border-subtle rounded-xl p-4 text-center">
                  <p className={`text-sm font-semibold transition-colors duration-300 ${
                    proximityMessage === "¡Posición perfecta!" || challengeDone
                      ? "text-success"
                      : "text-text-primary"
                  }`}>
                    {!modelsLoaded && "Cargando modelos..."}
                    {modelsLoaded && step === "liveness" && !challengePoint && (proximityMessage || "Coloca tu rostro en el óvalo")}
                    {modelsLoaded && step === "liveness" && challengePoint && !challengeDone && "Sigue el punto con tu rostro"}
                    {modelsLoaded && step === "capturing" && "Mantén la posición..."}
                  </p>
                  
                  {modelsLoaded && (
                    <div className="flex items-center justify-center gap-2 mt-2">
                       <div className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-accent animate-pulse' : 'bg-text-disabled'}`} />
                       <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">
                         {faceDetected ? "Rostro detectado" : "Buscando rostro..."}
                       </span>
                    </div>
                  )}

                  {detectionError && (
                    <p className="text-error text-[10px] font-bold uppercase tracking-widest mt-2">{detectionError}</p>
                  )}
                </div>
              </div>
            )}

            {/* Identifying Screen */}
            {step === "identifying" && (
              <div className="animate-in fade-in zoom-in duration-300">
                <div className="bg-accent/5 border border-accent/20 rounded-xl p-8 text-center">
                  <div className="relative inline-flex mb-4">
                    <Camera className="w-16 h-16 text-accent animate-pulse" />
                    <div className="absolute -inset-3 flex items-center justify-center">
                      <div className="w-20 h-20 border-2 border-accent/20 border-t-accent rounded-full animate-spin"></div>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-text-primary mb-1">Identificando...</h3>
                  <p className="text-text-tertiary text-xs">Por favor espera... verificando identidad</p>
                </div>
              </div>
            )}

            {/* Success Screen */}
            {step === "success" && result && (
              <div className="animate-in fade-in zoom-in duration-300">
                <div className={`rounded-xl p-6 text-center border ${
                  result.clasificacion === 'falta' ? "bg-error/5 border-error/20" :
                  (result.clasificacion?.includes('retardo') || result.clasificacion === 'salida_temprana') ? "bg-warning/5 border-warning/20" :
                  "bg-success/5 border-success/20"
                }`}>
                  {result.clasificacion === 'retardo_a' || result.clasificacion === 'retardo_b' || result.clasificacion === 'salida_temprana' ? (
                    <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-warning" />
                  ) : result.clasificacion === 'falta' ? (
                    <XCircle className="w-12 h-12 mx-auto mb-3 text-error" />
                  ) : (
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-success" />
                  )}

                  <h3 className={`text-lg font-bold mb-1 ${
                    result.clasificacion === 'falta' ? "text-error" :
                    (result.clasificacion?.includes('retardo') || result.clasificacion === 'salida_temprana') ? "text-warning" :
                    "text-success"
                  }`}>
                    {result.pendiente ? (result.message || "Registro pendiente") : "Asistencia Registrada"}
                  </h3>

                  {result.empleado?.nombre && (
                    <p className="text-text-primary text-base font-semibold mb-1">
                      {result.empleado.nombre}
                    </p>
                  )}

                  {result.tipoMovimiento && !result.pendiente && (
                    <div className="mt-1 text-center">
                      <p className="text-text-tertiary text-xs">
                        {result.tipoMovimiento === "ENTRADA" ? "Entrada" : "Salida"} registrada {result.hora && <>a las <span className="text-text-primary font-bold">{result.hora}</span></>}
                      </p>
                      <div className="flex justify-center mt-2">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${
                          result.clasificacion === "entrada" || result.clasificacion === "salida_puntual"
                            ? "bg-success/10 text-success ring-1 ring-success/20"
                            : result.clasificacion?.includes("retardo") || result.clasificacion === "salida_temprana"
                              ? "bg-warning/10 text-warning ring-1 ring-warning/20"
                              : result.clasificacion === "falta"
                                ? "bg-error/10 text-error ring-1 ring-error/20"
                                : "bg-bg-tertiary text-text-tertiary ring-1 ring-border-subtle"
                        }`}>
                          {result.estadoTexto || result.estado || "Registrado"}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-border-subtle flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-[9px] font-bold text-text-disabled uppercase tracking-widest">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Cerrando en {countdown}s
                    </div>

                    <button
                      onClick={procesarLoginBiometrico}
                      disabled={processingLogin || !loginHabilitado}
                      className="w-full py-2.5 bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border-subtle rounded-md font-bold text-xs transition-all flex items-center justify-center ring-1 ring-border-subtle shadow-sm disabled:opacity-50"
                    >
                      {processingLogin ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Iniciar sesión
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Error Screen */}
            {step === "error" && (
              <div className="animate-in fade-in zoom-in duration-300">
                <div className={`rounded-xl p-6 text-center border ${
                  result?.noPuedeRegistrar ? "bg-warning/5 border-warning/20" : "bg-error/5 border-error/20"
                }`}>
                  {result?.noPuedeRegistrar ? (
                    <>
                      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-warning" />
                      <h3 className="text-lg font-bold mb-1 text-warning">No Disponible</h3>
                      {result.empleado?.nombre && (
                        <p className="text-text-primary text-base font-semibold mb-1">{result.empleado.nombre}</p>
                      )}
                      <p className="text-text-tertiary text-xs mb-3">{result.message}</p>
                      <div className="flex justify-center mb-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${
                          result.estadoHorario === "completado" ? "bg-accent/10 text-accent ring-1 ring-accent/20" : "bg-warning/10 text-warning ring-1 ring-warning/20"
                        }`}>
                          {result.estadoHorario === "completado" ? "Jornada completada" : "Fuera de horario"}
                        </span>
                      </div>
                      
                      <div className="pt-4 border-t border-border-subtle flex flex-col items-center gap-3">
                        <button
                          onClick={procesarLoginBiometrico}
                          disabled={processingLogin || !loginHabilitado}
                          className="w-full py-2.5 bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border-subtle rounded-md font-bold text-xs transition-all flex items-center justify-center ring-1 ring-border-subtle shadow-sm disabled:opacity-50"
                        >
                          {processingLogin ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Iniciar sesión de todas formas
                        </button>
                        <div className="flex items-center gap-2 text-[9px] font-bold text-text-disabled uppercase tracking-widest">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          Cerrando en {countdown}s
                        </div>
                      </div>
                    </>
                  ) : result?.noReconocida ? (
                    <>
                      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-error" />
                      <h3 className="text-lg font-bold mb-1 text-error">Rostro No Reconocido</h3>
                      <p className="text-text-tertiary text-xs mb-6">El rostro no se encuentra registrado en el sistema.</p>
                      <div className="flex flex-col items-center gap-3">
                        <button onClick={handleRetry} className="w-full py-3 bg-accent hover:bg-accent-hover text-white rounded-md font-bold text-base shadow-lg shadow-accent/10 transition-all">
                          Intentar de nuevo
                        </button>
                        <div className="flex items-center gap-2 text-[9px] font-bold text-text-disabled uppercase tracking-widest">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          Cerrando en {countdown}s
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-error" />
                      <h3 className="text-lg font-bold mb-1 text-error">
                        {result?.message?.includes("Registro denegado") ? "Registro Denegado" : "Error en Registro"}
                      </h3>
                      {result?.empleado?.nombre && (
                        <p className="text-text-primary text-base font-semibold mb-1">{result.empleado.nombre}</p>
                      )}
                      <p className="text-text-tertiary text-xs mb-4">
                        {errorMessage?.replace("Registro denegado: ", "") || result?.message?.replace("Registro denegado: ", "") || "Ocurrió un error al procesar el registro."}
                      </p>
                      
                      <div className="flex flex-col gap-3">
                        {result?.empleadoId && (
                           <button
                             onClick={procesarLoginBiometrico}
                             disabled={processingLogin || !loginHabilitado}
                             className="w-full py-2.5 bg-bg-secondary hover:bg-bg-tertiary text-text-primary border border-border-subtle rounded-md font-bold text-xs transition-all flex items-center justify-center ring-1 ring-border-subtle shadow-sm disabled:opacity-50"
                           >
                             {processingLogin ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                             Iniciar sesión
                           </button>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <button onClick={handleRetry} className="py-2.5 bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-primary rounded-md font-bold text-xs transition-all">
                            Reintentar
                          </button>
                          <button onClick={handleCloseModal} className="py-2.5 bg-error/10 hover:bg-error/20 text-error rounded-md font-bold text-xs transition-all">
                            Cancelar
                          </button>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-[9px] font-bold text-text-disabled uppercase tracking-widest">
                           <Loader2 className="w-2.5 h-2.5 animate-spin" />
                           Cerrando en {countdown}s
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
