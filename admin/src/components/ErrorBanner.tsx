import { errorMessage } from '@/lib/errors';

export function ErrorBanner({ error, onReload }: { error: unknown; onReload?: () => void }) {
  if (!error) return null;
  return (
    <div className="banner error" role="alert">
      {errorMessage(error)}
      {onReload && (
        <>
          {' '}
          <button type="button" className="secondary" onClick={onReload}>
            Reload record
          </button>
        </>
      )}
    </div>
  );
}
