import { API_BASE_URL } from '../constants/layout';

/**
 * Kirim graf ke backend dan kembalikan hasil yang sudah dinormalisasi:
 *   { status: 'success', preview }
 *   { status: 'conflict', message }   → nama proyek sudah ada (HTTP 409)
 *   { status: 'error', message, httpStatus }
 *   { status: 'offline' }             → backend tidak bisa dihubungi
 */
export async function generateProject({ nodes, edges, projectName, settings }) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/generate-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes, edges, projectName, settings }),
    });
  } catch (error) {
    console.error('Gagal terhubung ke backend:', error);
    return { status: 'offline' };
  }

  const data = await response.json().catch(() => ({}));

  if (response.ok && data.success) {
    const warnings = data.warnings?.length
      ? `\n\n⚠ Peringatan:\n${data.warnings.map((w) => `- ${w}`).join('\n')}`
      : '';
    return {
      status: 'success',
      preview: `${data.message}\n\nStruktur Direktori:\n${data.previewStructure}${warnings}`,
    };
  }
  if (response.status === 409) return { status: 'conflict', message: data.message };
  return {
    status: 'error',
    httpStatus: response.status,
    message: data.message ?? 'Respons tidak valid dari server',
  };
}
