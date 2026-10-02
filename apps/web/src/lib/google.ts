/** Google Identity Services (GIS) loader + копче (ADR-002). Го користи активниот Google профил
 * на прелистувачот; враќа `id_token` (credential) кон callback-от. */
interface GoogleCredentialResponse {
  credential: string;
}
interface GoogleIdApi {
  initialize(cfg: { client_id: string; callback: (r: GoogleCredentialResponse) => void }): void;
  renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

let loading: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Google скриптата не се вчита.'));
      document.head.appendChild(s);
    });
  }
  return loading;
}

export async function renderGoogleButton(
  el: HTMLElement,
  clientId: string,
  onCredential: (idToken: string) => void,
): Promise<void> {
  await loadGis();
  const id = window.google!.accounts.id;
  id.initialize({ client_id: clientId, callback: (r) => onCredential(r.credential) });
  id.renderButton(el, { theme: 'outline', size: 'large', width: 320, text: 'signin_with' });
}
