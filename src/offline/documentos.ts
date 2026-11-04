/*
 * Manifiesto PDFs kept on the phone, so the driver can show the document at a roadside
 * check without signal. The PDF is the web's (with the RNDC QR), from GET /mobile/manifiestos/{id}/pdf.
 */
import { operationsService, type Manifiesto } from '../services/operations.service';
import { useAuthStore } from '../store/auth.store';
import { useCompanyStore } from '../store/company.store';
import { documentoKey, useDocumentosStore, type DocumentoGuardado } from '../store/documentos.store';
import { base64ToBytes, readBase64, removePath, writeBase64 } from './files';

/** A saved copy older than this is downloaded again when there's signal. */
const VIGENCIA_COPIA_MS = 12 * 60 * 60 * 1000;
/** Copies of manifiestos that are no longer active are deleted after this. */
const RETENCION_MS = 7 * 24 * 60 * 60 * 1000;

const companyCode = () => useCompanyStore.getState().company?.code ?? '';

export const documentoGuardado = (manifiestoId: number): DocumentoGuardado | undefined =>
  useDocumentosStore.getState().documentos[documentoKey(companyCode(), manifiestoId)];

/** Downloads the PDF, saves it on the phone (replacing the previous copy) and returns its record. */
export const descargarDocumento = async (manifiestoId: number, placa: string | null = null) => {
  const pdf = await operationsService.manifiestoPdf(manifiestoId);
  const code = companyCode();
  const key = documentoKey(code, manifiestoId);
  const path = `documentos/${code}/${manifiestoId}.pdf`;
  await writeBase64(path, pdf.pdfBase64);
  const doc: DocumentoGuardado = {
    key,
    companyCode: code,
    manifiestoId,
    numero: pdf.numero,
    placa: placa ?? useDocumentosStore.getState().documentos[key]?.placa ?? null,
    estado: pdf.estado,
    valido: pdf.valido,
    motivoNoValido: pdf.motivoNoValido,
    path,
    generadoEn: pdf.generadoEn,
    descargadoEn: new Date().toISOString(),
  };
  useDocumentosStore.getState().guardar(doc);
  return doc;
};

export const leerDocumento = async (doc: DocumentoGuardado) => base64ToBytes(await readBase64(doc.path));

export const borrarDocumento = async (doc: DocumentoGuardado) => {
  useDocumentosStore.getState().quitar(doc.key);
  await removePath(doc.path);
};

const copiaVencida = (doc: DocumentoGuardado | undefined) =>
  !doc || Date.now() - new Date(doc.descargadoEn).getTime() > VIGENCIA_COPIA_MS;

let preparando = false;

/**
 * For drivers (alcance "asignados"): keeps a fresh copy of every active manifiesto of
 * their vehicles, and drops old copies of the ones that are no longer active. Errors
 * are ignored: it runs again on the next launch, resume or reconnection.
 */
export const prepararDocumentosActivos = async () => {
  const user = useAuthStore.getState().user;
  if (preparando || user?.alcance !== 'asignados' || !companyCode()) return;
  preparando = true;
  try {
    const { items } = await operationsService.manifiestos({ estado: 'activo', pageSize: 20 });
    for (const m of items) {
      if (copiaVencida(documentoGuardado(m.id))) {
        try {
          await descargarDocumento(m.id, m.placa);
        } catch {
          // keep the previous copy, if any
        }
      }
    }
    await limpiarDocumentos(items);
  } catch {
    // no signal or no access: try later
  } finally {
    preparando = false;
  }
};

const limpiarDocumentos = async (activos: Manifiesto[]) => {
  const ids = new Set(activos.map((m) => m.id));
  const code = companyCode();
  const viejos = Object.values(useDocumentosStore.getState().documentos).filter(
    (d) => d.companyCode === code && !ids.has(d.manifiestoId) && Date.now() - new Date(d.descargadoEn).getTime() > RETENCION_MS
  );
  for (const doc of viejos) await borrarDocumento(doc);
};
