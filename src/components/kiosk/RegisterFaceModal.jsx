import { useState, useEffect, useRef } from "react";
import { X, UserPlus, CheckCircle, XCircle } from "lucide-react";
import { useFaceDetection } from "../../hooks/useFaceDetection";
import { registrarDescriptorFacial } from "../../services/biometricAuthService";
import { useCamera } from "../../context/CameraContext";
import * as faceapi from 'face-api.js';

export default function RegisterFaceModal({ onClose, empleadoId: propEmpleadoId = null }) {
  const [empleadoId, setEmpleadoId] = useState(propEmpleadoId || "");
  const [step, setStep] = useState(propEmpleadoId ? "capturing" : "input"); // input, capturing, success, error
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [proximityMessage, setProximityMessage] = useState("");

  // Hook de cámara singleton
  const { initCamera, releaseCamera } = useCamera();

  const {
    modelsLoaded,
    detectionError,
    loadModels,
  } = useFaceDetection();

  const cropCanvasRef = useRef(null);

  // Recortar video al area del ovalo guia
  const getCroppedOvalFrame = (video) => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

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

    const oLeft = 120 / 400, oTop = 35 / 300;
    const oW = 160 / 400, oH = 210 / 300;
    const cropX = sx + sw * oLeft;
    const cropY = sy + sh * oTop;
    const cropW = sw * oW;
    const cropH = sh * oH;

    if (!cropCanvasRef.current) {
      cropCanvasRef.current = document.createElement('canvas');
    }
    const canvas = cropCanvasRef.current;
    const cw = 280, ch = Math.round(280 * (cropH / cropW));
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cw / 2, ch / 2, cw / 2, ch / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cw, ch);
    ctx.restore();

    return canvas;
  };

  // Cargar modelos al montar
  useEffect(() => {
    loadModels();

    // Si viene con empleadoId, iniciar cámara automáticamente
    if (propEmpleadoId && step === "capturing") {
      initCamera()
        .then((mediaStream) => {
          const video = document.getElementById("registerVideo");
          if (video) {
            video.srcObject = mediaStream;
          }
        })
        .catch((err) => {
          setErrorMessage("No se pudo acceder a la cámara");
          setStep("input");
        });
    }
  }, [loadModels, propEmpleadoId, initCamera]);

  const handleStartCapture = () => {
    const idTrimmed = empleadoId.trim();
    if (!idTrimmed) {
      setErrorMessage("Por favor ingresa un ID de empleado");
      return;
    }

    if (idTrimmed.length > 8) {
      setErrorMessage("El ID del empleado debe tener máximo 8 caracteres");
      return;
    }

    setErrorMessage("");
    setStep("capturing");

    // Iniciar cámara usando el contexto singleton
    initCamera()
      .then((mediaStream) => {
        const video = document.getElementById("registerVideo");
        if (video) {
          video.srcObject = mediaStream;
        }
      })
      .catch((err) => {
        setErrorMessage("No se pudo acceder a la cámara");
        setStep("input");
      });
  };

  // Iniciar detección cuando el video esté listo
  useEffect(() => {
    if (step !== "capturing" || !modelsLoaded) return;

    const video = document.getElementById("registerVideo");
    if (!video) return;

    const handleVideoReady = () => {
      console.log("📹 Video listo para registro facial...");

      // Capturando directamente sin liveness
      let capturado = false;

      const captureInterval = setInterval(async () => {
        if (capturado) return;

        try {
          const croppedFrame = getCroppedOvalFrame(video);
          if (!croppedFrame) return;

          const detections = await faceapi
            .detectSingleFace(croppedFrame, new faceapi.TinyFaceDetectorOptions({
              inputSize: 224,
              scoreThreshold: 0.4
            }))
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (detections && detections.detection.score > 0.4) {
            setFaceDetected(true);

            // Validar posición de proximidad
            const box = detections.detection.box;
            const canvasW = 280;
            // cropH/cropW aspect is (3/4)*(0.7/0.4) = 1.3125
            const canvasH = 368;
            const faceCenterX = box.x + box.width / 2;
            const faceCenterY = box.y + box.height / 2;

            const widthRatio = box.width / canvasW;
            const heightRatio = box.height / canvasH;

            let isPositionGood = false;

            if (widthRatio < 0.35 || heightRatio < 0.35) {
              setProximityMessage("Acércate un poco más a la cámara");
            } else if (widthRatio > 0.85 || heightRatio > 0.85) {
              setProximityMessage("Aléjate un poco de la cámara");
            } else if (Math.abs(faceCenterX - canvasW / 2) > canvasW * 0.20 || Math.abs(faceCenterY - canvasH / 2) > canvasH * 0.20) {
              setProximityMessage("Centra tu rostro dentro del óvalo");
            } else {
              setProximityMessage("¡Posición perfecta! Registrando...");
              isPositionGood = true;
            }

            if (isPositionGood && !capturado) {
              capturado = true;
              clearInterval(captureInterval);
              const descriptor = Array.from(detections.descriptor);
              console.log("✅ Rostro capturado directamente");

              // Guardar directamente
              try {
                // Convertir descriptor a Base64 (igual que las huellas)
                const float32Array = new Float32Array(descriptor);
                const buffer = new Uint8Array(float32Array.buffer);
                let binary = '';
                for (let i = 0; i < buffer.length; i++) {
                  binary += String.fromCharCode(buffer[i]);
                }
                const descriptorBase64 = btoa(binary);

                console.log(`📦 Descriptor convertido a Base64: ${descriptorBase64.length} caracteres`);

                // Intentar usar el servicio primero (sin Electron)
                const response = await registrarDescriptorFacial(
                  empleadoId,
                  descriptorBase64
                );

                if (response.success) {
                  setSuccessMessage(`El rostro ha sido vinculado correctamente al sistema.`);
                  setStep("success");
                  setTimeout(() => {
                    handleClose();
                  }, 3000);
                } else {
                  setErrorMessage(response.error || "Error al registrar descriptor");
                  setStep("error");
                }
              } catch (error) {
                console.error("❌ Error registrando descriptor:", error);
                setErrorMessage(error.message);
                setStep("error");
              }
            }
          } else {
            setFaceDetected(false);
          }
        } catch (error) {
          console.error("❌ Error en detección:", error);
        }
      }, 400);

      // Timeout de 15 segundos
      setTimeout(() => {
        if (!capturado) {
          clearInterval(captureInterval);
          setErrorMessage("Tiempo agotado. No se detectó rostro.");
          setStep("error");
        }
      }, 15000);
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
    };
  }, [step, modelsLoaded, empleadoId]);

  // Limpiar cámara al cerrar
  useEffect(() => {
    return () => {
      releaseCamera();
    };
  }, [releaseCamera]);

  const handleClose = () => {
    setIsClosing(true);
    releaseCamera();
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <div className={`fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[9999] p-4 transition-all duration-300 animate-backdrop ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
      <div className={`bg-bg-primary rounded-xl shadow-2xl max-w-md sm:max-w-lg w-full overflow-hidden border border-border-subtle transition-all duration-300 animate-zoom-in ${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
        <div className="p-6 sm:p-8">
          {/* Header Minimalista (Estilo AsistenciaFacial) */}
          <div className="text-center mb-6 relative">
            <button
              onClick={handleClose}
              className="absolute -top-2 -right-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-md p-2 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-text-primary tracking-tight">Registro Facial</h2>
            <p className="text-text-tertiary text-xs mt-1 opacity-80 uppercase tracking-widest font-medium">Configuración Biométrica</p>
          </div>

          {/* Contenido */}
          <div className="space-y-4">
            {/* Paso 1: Ingresar ID (Solo si no hay propEmpleadoId) */}
            {step === "input" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-bg-secondary/40 border border-border-subtle rounded-xl p-5">
                  <label className="block text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-2 ml-1">
                    ID del Empleado
                  </label>
                  <input
                    type="text"
                    value={empleadoId}
                    onChange={(e) => setEmpleadoId(e.target.value.slice(0, 8))}
                    placeholder="Ejemplo: EMP001"
                    maxLength={8}
                    className="w-full px-4 py-3 rounded-lg border border-border-subtle bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-[#1976D2] uppercase font-bold tracking-wider transition-all"
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleStartCapture();
                      }
                    }}
                  />
                  {errorMessage && (
                    <p className="text-xs text-error mt-2 font-medium flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" />
                      {errorMessage}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleStartCapture}
                  className="w-full bg-[#1976D2] hover:bg-[#1565C0] text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#1976D2]/20 flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  <UserPlus className="w-5 h-5 font-bold" />
                  Capturar Rostro
                </button>

                <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 flex gap-3">
                  <div className="p-2 bg-accent/10 rounded-lg h-fit">
                    <XCircle className="w-4 h-4 text-[#1976D2]" />
                  </div>
                  <p className="text-[10px] text-text-secondary leading-normal">
                    <strong className="text-[#1976D2] uppercase">Protocolo:</strong> El descriptor facial generado será encriptado y guardado permanentemente para fines de autenticación administrativa y asistencia.
                  </p>
                </div>
              </div>
            )}

            {/* Paso 2: Capturando (Premium Camera UI) */}
            {step === "capturing" && (
              <div className="space-y-4 animate-in fade-in duration-500">
                <div className="relative bg-black rounded-xl overflow-hidden w-full aspect-[4/3] ring-1 ring-border-subtle shadow-inner">
                  <video
                    id="registerVideo"
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />

                  {/* Mascara SVG Estilo AsistenciaFacial */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
                      <defs>
                        <mask id="registerMask">
                          <rect width="400" height="300" fill="white" />
                          <ellipse cx="200" cy="140" rx="80" ry="105" fill="black" />
                        </mask>
                        <filter id="registerGlow">
                          <feGaussianBlur stdDeviation="4" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                        <linearGradient id="registerScanGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="transparent" />
                          <stop offset="30%" stopColor={faceDetected ? "rgba(25, 118, 210, 0.6)" : "rgba(255,255,255,0.3)"} />
                          <stop offset="50%" stopColor={faceDetected ? "rgba(25, 118, 210, 0.9)" : "rgba(255,255,255,0.5)"} />
                          <stop offset="70%" stopColor={faceDetected ? "rgba(25, 118, 210, 0.6)" : "rgba(255,255,255,0.3)"} />
                          <stop offset="100%" stopColor="transparent" />
                        </linearGradient>
                      </defs>
                      <rect width="400" height="300" fill="rgba(0,0,0,0.5)" mask="url(#registerMask)" />
                      <ellipse
                        cx="200" cy="140" rx="80" ry="105"
                        fill="none"
                        stroke={faceDetected ? "#1976D2" : "rgba(255,255,255,0.4)"}
                        strokeWidth={faceDetected ? "3" : "2"}
                        strokeDasharray={faceDetected ? "none" : "8 4"}
                        filter={faceDetected ? "url(#registerGlow)" : "none"}
                        style={{ transition: "all 0.4s ease" }}
                      />
                      {faceDetected && (
                        <ellipse
                          cx="200" cy="140" rx="84" ry="109"
                          fill="none"
                          stroke="#1976D2"
                          strokeWidth="2"
                          opacity="0.3"
                          style={{ animation: "facePulse 2s ease-in-out infinite" }}
                        />
                      )}
                      {!faceDetected && (
                        <line
                          x1="120" y1="140" x2="280" y2="140"
                          stroke="url(#registerScanGradient)"
                          strokeWidth="2"
                          style={{ animation: "scanLine 2.5s ease-in-out infinite" }}
                        />
                      )}
                      {/* Marcas de alineacion */}
                      <path d="M 135 55 L 135 40 L 155 40" fill="none" stroke={faceDetected ? "#1976D2" : "rgba(255,255,255,0.5)"} strokeWidth="3" strokeLinecap="round" />
                      <path d="M 265 55 L 265 40 L 245 40" fill="none" stroke={faceDetected ? "#1976D2" : "rgba(255,255,255,0.5)"} strokeWidth="3" strokeLinecap="round" />
                      <path d="M 135 245 L 135 260 L 155 260" fill="none" stroke={faceDetected ? "#1976D2" : "rgba(255,255,255,0.5)"} strokeWidth="3" strokeLinecap="round" />
                      <path d="M 265 245 L 265 260 L 245 260" fill="none" stroke={faceDetected ? "#1976D2" : "rgba(255,255,255,0.5)"} strokeWidth="3" strokeLinecap="round" />
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
                    `}</style>
                  </div>
                </div>

                <div className="bg-bg-secondary/40 border border-border-subtle rounded-xl p-4 text-center">
                  <p className={`text-sm font-semibold transition-colors duration-300 ${
                    proximityMessage.includes("Posición perfecta")
                      ? "text-success font-bold"
                      : "text-text-primary"
                  }`}>
                    {!modelsLoaded && "Iniciando captura..."}
                    {modelsLoaded && (proximityMessage || "Coloca tu rostro frente a la cámara")}
                  </p>
                  
                  {modelsLoaded && (
                    <div className="flex items-center justify-center gap-2 mt-2">
                       <div className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-[#1976D2] animate-pulse' : 'bg-text-disabled'}`} />
                       <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">
                         {faceDetected ? "Rostro Detectado" : "Buscando Rostro..."}
                       </span>
                    </div>
                  )}

                  {!modelsLoaded && (
                    <div className="flex items-center justify-center gap-2 mt-2">
                       <div className="w-4 h-4 border-2 border-[#1976D2] border-t-transparent rounded-full animate-spin" />
                       <span className="text-[10px] font-bold text-text-tertiary">Detectando modelos...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Paso 3: Éxito (Estilo Premium) */}
            {step === "success" && (
              <div className="text-center py-8 animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 mx-auto mb-6 bg-success/10 rounded-full flex items-center justify-center ring-4 ring-success/5">
                  <CheckCircle className="w-12 h-12 text-success" strokeWidth={2.5} />
                </div>
                <h4 className="text-2xl font-bold text-text-primary mb-6">
                  ¡Registro Exitoso!
                </h4>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-bg-secondary rounded-full border border-border-subtle">
                  <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Cerrando automáticamente</span>
                </div>
              </div>
            )}

            {/* Paso 4: Error (Estilo Premium) */}
            {step === "error" && (
              <div className="text-center py-8 animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 mx-auto mb-6 bg-error/10 rounded-full flex items-center justify-center ring-4 ring-error/5">
                  <XCircle className="w-12 h-12 text-error" strokeWidth={2.5} />
                </div>
                <h4 className="text-2xl font-bold text-text-primary mb-2">Error de Registro</h4>
                <p className="text-text-secondary text-sm mb-8 max-w-[280px] mx-auto">{errorMessage}</p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setStep(propEmpleadoId ? "capturing" : "input");
                      setErrorMessage("");
                      releaseCamera();
                      if (propEmpleadoId) {
                        setTimeout(() => handleStartCapture(), 100);
                      }
                    }}
                    className="w-full bg-[#1976D2] hover:bg-[#1565C0] text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-95"
                  >
                    Intentar de Nuevo
                  </button>
                  <button
                    onClick={handleClose}
                    className="w-full text-text-tertiary font-bold text-sm hover:text-text-primary transition-colors h-10"
                  >
                    Cancelar y Salir
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
