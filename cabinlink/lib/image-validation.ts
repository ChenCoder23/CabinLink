export function validImage(value: unknown, maxBytes = 2 * 1024 * 1024): value is string {
    if (value === '')
        return true;
    if (typeof value !== 'string' || value.length > Math.ceil(maxBytes / 3) * 4 + 40)
        return false;
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match)
        return false;
    try {
        const bytes = atob(match[2]);
        if (bytes.length > maxBytes)
            return false;
        return match[1] === 'png' ? bytes.startsWith('\x89PNG\r\n\x1a\n') : match[1] === 'jpeg' ? bytes.startsWith('\xff\xd8\xff') : bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP';
    }
    catch {
        return false;
    }
}
