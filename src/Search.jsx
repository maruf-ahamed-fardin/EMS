import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import seloraxLogo from './assets/SeloraX logo.png';

export default function Search() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      navigate(`/${encodeURIComponent(trimmed)}`);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-b from-indigo-950 via-indigo-900 to-slate-900">
      <div className="w-full bg-gradient-to-r from-indigo-950 via-indigo-800 to-orange-500 pt-10 pb-28 px-4 flex flex-col items-center">
        <a href="https://selorax.io" target="_blank" rel="noopener noreferrer">
          <img src={seloraxLogo} alt="SeloraX" className="h-10 brightness-0 invert" />
        </a>
      </div>

      <div className="w-full max-w-sm px-4 -mt-16">
        <div className="rounded-3xl bg-white shadow-2xl overflow-hidden p-8">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-slate-800">Find a Team Member</h1>
            <p className="text-sm text-slate-400 mt-1">Search by username or employee ID</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 fill-current">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. ashekrabbani or SX-001"
                autoFocus
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-orange-500 px-4 py-3 text-sm font-semibold text-white hover:from-indigo-500 hover:to-orange-400 transition-all cursor-pointer"
            >
              View Profile
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
