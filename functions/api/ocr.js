export async function onRequestPost(context) {
  try {
    const incoming = await context.request.formData();
    const file = incoming.get('file');
    if (!file || typeof file === 'string') {
      return json({ ok: false, error: 'missing_image' }, 400);
    }

    const upstream = new FormData();
    upstream.append('file', file, file.name || 'whatsapp.png');
    upstream.append('language', String(incoming.get('language') || 'eng'));
    upstream.append('isOverlayRequired', 'false');
    upstream.append('detectOrientation', 'true');
    upstream.append('scale', 'true');
    upstream.append('OCREngine', '2');

    const apiKey = context.env.OCRSPACE_API_KEY || 'helloworld';
    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { apikey: apiKey },
      body: upstream,
    });

    const text = await response.text();
    if (!response.ok) {
      return json({ ok: false, error: 'ocr_upstream_failed', status: response.status, detail: text.slice(0, 500) }, 502);
    }

    let data;
    try { data = JSON.parse(text); }
    catch { return json({ ok: false, error: 'invalid_ocr_response' }, 502); }

    if (data.IsErroredOnProcessing) {
      const message = Array.isArray(data.ErrorMessage) ? data.ErrorMessage.join('；') : (data.ErrorMessage || 'OCR 处理失败');
      return json({ ok: false, error: 'ocr_processing_failed', message }, 422);
    }

    const parsedText = (data.ParsedResults || []).map(x => x.ParsedText || '').join('\n').trim();
    return json({ ok: true, text: parsedText, engine: 2 });
  } catch (error) {
    return json({ ok: false, error: 'server_error', message: String(error?.message || error) }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store',
  };
}
