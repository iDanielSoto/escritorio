const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'affiliation', 'WelcomeScreen.jsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Añadir estado `sdkMissing`
code = code.replace(/const \[greeting, setGreeting\] = useState\(""\);/, 'const [greeting, setGreeting] = useState("");\n  const [sdkMissing, setSdkMissing] = useState(false);');

// 2. Simplificar useEffect
const newUseEffect = `useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Buenos días");
    else if (hour < 18) setGreeting("Buenas tardes");
    else setGreeting("Buenas noches");

    const initSetup = async () => {
      // 1. Info del sistema
      if (window.electronAPI && window.electronAPI.getSystemInfo) {
        try {
          const info = await window.electronAPI.getSystemInfo();
          setSystemInfo(prev => ({ 
            ...prev, 
            hostname: info.hostname || "Desconocido",
            ip: info.ipAddress || "No detectada"
          }));
        } catch (err) {
          console.error(err);
        }
      } else {
        getSystemInfo().then(info => {
          setSystemInfo(prev => ({
            ...prev,
            hostname: "Terminal Web", 
            ip: info.ipAddress || "No detectada"
          }));
        }).catch(err => console.error(err));
      }

      // 2. Verificar SDK
      if (window.electronAPI && window.electronAPI.checkDigitalPersonaSdk) {
        try {
          const status = await window.electronAPI.checkDigitalPersonaSdk();
          if (!status.installed) {
            setSdkMissing(true);
          }
        } catch (err) {
          console.error("Error verificando SDK:", err);
        }
      }
    };

    initSetup();
  }, []);`;

code = code.replace(/useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);/, newUseEffect);

// 3. Añadir Alert de SDK Missing en lugar de solo Info Box
const infoBoxRegex = /<div className="bg-bg-secondary\/50 border border-border-subtle p-5 rounded-lg flex gap-4 max-w-2xl w-full animate-fade-in">\s*<div className="w-10 h-10 rounded-lg bg-accent\/5 flex items-center justify-center shrink-0">[\s\S]*?<\/div>\s*<\/div>/;

const newInfoBox = `{sdkMissing ? (
          <div className="bg-error/10 border border-error/20 p-5 rounded-lg flex gap-4 max-w-2xl w-full animate-fade-in shadow-sm shadow-error/10">
            <div className="w-10 h-10 rounded-lg bg-error/20 flex items-center justify-center shrink-0">
              <span className="text-xl">⚠️</span>
            </div>
            <div className="text-sm">
              <h4 className="font-semibold text-error mb-1">Dependencia Biométrica Ausente</h4>
              <p className="text-text-secondary leading-normal">
                No se detectó el SDK de DigitalPersona instalado en este equipo. El instalador no finalizó o el controlador fue eliminado. Por favor, <strong>cierre e inicie de nuevo la instalación (Setup.exe)</strong>.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-bg-secondary/50 border border-border-subtle p-5 rounded-lg flex gap-4 max-w-2xl w-full animate-fade-in">
            <div className="w-10 h-10 rounded-lg bg-accent/5 flex items-center justify-center shrink-0">
              <Info className="w-5 h-5 text-accent" />
            </div>
            <div className="text-sm">
              <h4 className="font-semibold mb-1">Requisitos de inicio</h4>
              <p className="text-text-secondary leading-normal">
                Asegúrese de contar con el <span className="text-text-primary font-medium">Código de Empresa</span> proporcionado por administración y que los dispositivos biométricos estén conectados por USB.
              </p>
            </div>
          </div>
        )}`;

code = code.replace(infoBoxRegex, newInfoBox);

// 4. Modificar el botón
const buttonRegex = /<button\s*onClick=\{onClose\}[\s\S]*?<\/button>/;

const newButton = `<button
          onClick={onClose}
          disabled={sdkMissing}
          className={\`group px-8 py-3.5 text-white rounded-lg font-semibold transition-all duration-200 flex items-center gap-3 shadow-lg active:scale-95 mb-4 \${
            sdkMissing 
              ? "bg-border-divider/50 text-text-disabled cursor-not-allowed shadow-none" 
              : "bg-accent hover:bg-accent-hover shadow-accent/20"
          }\`}
        >
          Iniciar Configuración
          {!sdkMissing && <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
        </button>`;

code = code.replace(buttonRegex, newButton);

fs.writeFileSync(filePath, code, 'utf8');
console.log('WelcomeScreen refactorizado exitosamente.');
