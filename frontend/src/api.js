// src/utils/api.js// Backend must be running on this port (e.g. uvicorn app.main:app --reload)
// In Vite dev, use same origin so the dev-server proxy avoids CORS (see vite.config.js).
const devProxyBase =
  typeof import.meta !== 'undefined' && import.meta.env?.DEV ? '' : null;
const configuredBase =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL
    : null;
export const API_BASE_URL = devProxyBase ?? configuredBase ?? 'http://127.0.0.1:8003';
// export const API_BASE_URL = "https://api.menteetracker.com";
// export const API_BASE_URL = "http://192.168.104.237:8000";
// export const API_BASE_URL = "https://753cnrn9q8.execute-api.ap-south-1.amazonaws.com";



//export const API_BASE_URL = "https://szohjxut36nsuowag6zjrfnoyy0uxboa.lambda-url.ap-south-1.on.aws";










