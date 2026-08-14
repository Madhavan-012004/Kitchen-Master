import { Filesystem, Directory } from '@capacitor/filesystem';

export const saveFileAndroid = async (base64Data, filename) => {
    try {
        await Filesystem.writeFile({
            path: `ProBloom/${filename}`,
            data: base64Data,
            directory: Directory.Documents,
            recursive: true
        });
        alert(`Saved successfully to Documents/ProBloom/${filename}`);
        return true;
    } catch (e) {
        console.error("Failed to save to ProBloom folder, trying fallback", e);
        try {
            await Filesystem.writeFile({
                path: filename,
                data: base64Data,
                directory: Directory.Documents
            });
            alert(`Saved successfully to Documents/${filename}`);
            return true;
        } catch (e2) {
            console.error("Complete save failure", e2);
            alert("Error saving file to device storage: " + e2.message);
            return false;
        }
    }
};
