// Shared model normalization must stay independent of browser settings and SDKs.
export const normalizeOCRModel=(provider,model)=>provider==='gemini'?model.trim().replace(/^models\//,''):model.trim();
export const genericGeminiModel=model=>/^(google\s+)?gemini$/i.test(model);
