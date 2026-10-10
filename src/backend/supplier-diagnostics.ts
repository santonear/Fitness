/** Opt-in operator diagnostics: never accept request data, error messages, URLs or identifiers. */
export function supplierDiagnostics(enabled: boolean, write: (event: unknown) => void = event => console.warn(event)) {
  return (event: { stage: string; httpStatus?: number }) => {
    if (!enabled || !['encode', 'network', 'http', 'decode', 'timeout', 'candidate'].includes(event.stage)) return;
    const status = event.httpStatus;
    try { write({ event: 'supplier_failure', stage: event.stage,
      ...(Number.isInteger(status) && status! >= 100 && status! <= 599 ? { httpStatus: status } : {}) }); } catch { /* Diagnostics cannot change the request outcome. */ }
  };
}
