export function base64Encode(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  let i = 0;
  const len = str.length;
  while (i < len) {
    const c1 = str.charCodeAt(i++) & 0xff;
    if (i === len) {
      out += chars.charAt(c1 >> 2);
      out += chars.charAt((c1 & 0x3) << 4);
      out += '==';
      break;
    }
    const c2 = str.charCodeAt(i++);
    if (i === len) {
      out += chars.charAt(c1 >> 2);
      out += chars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xf0) >> 4));
      out += chars.charAt((c2 & 0xf) << 2);
      out += '=';
      break;
    }
    const c3 = str.charCodeAt(i++);
    out += chars.charAt(c1 >> 2);
    out += chars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xf0) >> 4));
    out += chars.charAt(((c2 & 0xf) << 2) | ((c3 & 0xc0) >> 6));
    out += chars.charAt(c3 & 0x3f);
  }
  return out;
}

export function base64Decode(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let idx = 0; idx < chars.length; idx++) {
    lookup[chars.charCodeAt(idx)] = idx;
  }
  
  let bufferLength = str.length * 0.75;
  if (str[str.length - 1] === '=') {
    bufferLength--;
    if (str[str.length - 2] === '=') {
      bufferLength--;
    }
  }
  
  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let idx = 0; idx < str.length; idx += 4) {
    const encoded1 = lookup[str.charCodeAt(idx)];
    const encoded2 = lookup[str.charCodeAt(idx + 1)];
    const encoded3 = lookup[str.charCodeAt(idx + 2)];
    const encoded4 = lookup[str.charCodeAt(idx + 3)];
    
    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (p < bufferLength) {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (p < bufferLength) {
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
  }
  
  let result = '';
  for (let idx = 0; idx < bytes.length; idx++) {
    result += String.fromCharCode(bytes[idx]);
  }
  
  try {
    return decodeURIComponent(escape(result));
  } catch (e) {
    return result;
  }
}

export function decodeIfNeeded(str?: string): string {
  if (!str) return '';
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:') || str.startsWith('file://')) return str;
  try {
    const decoded = base64Decode(str);
    if (decoded.startsWith('http://') || decoded.startsWith('https://')) return decoded;
    return str;
  } catch {
    return str;
  }
}
