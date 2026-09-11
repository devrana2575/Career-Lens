import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../lib/api.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.jsx';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [status, setStatus] = useState('verifying');

  useEffect(() => {
    apiFetch('/auth/verify-email', { body: { token } })
      .then(() => setStatus('verified'))
      .catch(() => setStatus('failed'));
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl">Email verification</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-sm">
          {status === 'verifying' && <p className="text-slate-500">Verifying your email…</p>}
          {status === 'verified' && (
            <p className="text-green-700">Your email is verified. You're all set.</p>
          )}
          {status === 'failed' && (
            <p className="text-red-600">This verification link is invalid or has expired.</p>
          )}
          <p className="mt-4">
            <Link to="/login" className="font-medium text-indigo-600 hover:underline">
              Go to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}