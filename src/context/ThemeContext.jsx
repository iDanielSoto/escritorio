import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        // Cargar tema guardado del localStorage o usar 'light' por defecto
        const savedPreferences = localStorage.getItem('userPreferences');

        if (savedPreferences) {
            try {
                const prefs = JSON.parse(savedPreferences);
                const initialTheme = prefs.darkMode ? 'dark' : 'light';

                // Aplicar inmediatamente en el HTML
                document.documentElement.classList.remove('light', 'dark');
                document.documentElement.classList.add(initialTheme);

                return initialTheme;
            } catch (error) {
                return 'light';
            }
        }

        return 'light';
    });

    useEffect(() => {
        // Aplicar clase al elemento raíz HTML
        const root = document.documentElement;
        root.setAttribute('data-theme', theme);
        root.classList.remove('light', 'dark');
        root.classList.add(theme);

        // Solo actualizar darkMode en localStorage, preservando otras preferencias
        const savedPreferences = localStorage.getItem('userPreferences');
        if (savedPreferences) {
            try {
                const parsed = JSON.parse(savedPreferences);
                // Solo actualizar si el valor cambió para evitar re-renders innecesarios
                if (parsed.darkMode !== (theme === 'dark')) {
                    parsed.darkMode = theme === 'dark';
                    localStorage.setItem('userPreferences', JSON.stringify(parsed));
                }
            } catch (error) {
                // Si hay error, crear preferencias mínimas
                localStorage.setItem('userPreferences', JSON.stringify({ darkMode: theme === 'dark' }));
            }
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
    };

    const setDarkMode = (isDark) => {
        setTheme(isDark ? 'dark' : 'light');
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setDarkMode, isDarkMode: theme === 'dark' }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme debe ser usado dentro de un ThemeProvider');
    }
    return context;
};
