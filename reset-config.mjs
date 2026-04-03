import { app } from 'electron';
import fs from 'fs';
import path from 'path';

// Since we cannot run this easily with electron context without a window, we can just find the app data path manually.
const getAppDataPath = () => {
    return process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + "/.local/share");
};

const appName = "Sistema de Asistencia"; // or "sistema-asistencia" based on package.json name and productName
const pathsToCheck = [
    path.join(getAppDataPath(), "Sistema de Asistencia", "app-config.json"),
    path.join(getAppDataPath(), "sistema-asistencia", "app-config.json"),
];

for (const p of pathsToCheck) {
    if (fs.existsSync(p)) {
        console.log(`Found config at ${p}, deleting...`);
        fs.unlinkSync(p);
        console.log('Deleted successfully.');
    }
}
