import { useState } from 'react';
import { getConfiguredApiUrl, setApiUrl } from './api.js';
import seloraxLogo from './assets/SeloraX logo.png';

export default function Settings() {
  const [url, setUrl] = useState(getConfiguredApiUrl());
  const [status, setStatus] = useState(null); // null | 'testing' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const handleTest = async () => {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (!trimmed) {
      setStatus('error');
      setErrorMsg('Please enter a URL');
      return;
    }

    setStatus('testing');
    try {
      const res = await fetch(`${trimmed}/api/users?_t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.users) throw new Error('Invalid response');
      setApiUrl(trimmed);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(`Cannot connect: ${err.message}`);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-950 via-indigo-900 to-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={seloraxLogo} alt="SeloraX" className="h-10 brightness-0 invert mb-3" />
          <h1 className="text-xl font-bold text-white">Team Profile Setup</h1>
          <p className="text-sm text-indigo-300 mt-1">Connect to your SeloraX app</p>
        </div>

        <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-indigo-200 mb-1.5">SeloraX API URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setStatus(null); }}
              placeholder="https://your-selorax-app.vercel.app"
              className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2.5 text-sm text-white placeholder-indigo-300/50 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 transition-colors"
            />
          </div>

          <button
            onClick={handleTest}
            disabled={status === 'testing'}
            className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:from-indigo-500 hover:to-orange-400 disabled:opacity-50 transition-all cursor-pointer"
          >
            {status === 'testing' ? 'Testing connection...' : 'Save & Test Connection'}
          </button>

          {status === 'success' && (
            <div className="rounded-lg bg-green-500/20 border border-green-500/30 p-3 text-center">
              <p className="text-sm text-green-300 font-medium">Connected successfully!</p>
              <p className="text-xs text-green-300/70 mt-1">Profiles are now available at /{'{username}'}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="rounded-lg bg-red-500/20 border border-red-500/30 p-3 text-center">
              <p className="text-sm text-red-300">{errorMsg}</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-indigo-400/60 mt-6">
          This is saved in your browser. Change it anytime by visiting this page.
        </p>
      </div>
    </div>
  );
}
