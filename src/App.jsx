import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TeamProfile from './TeamProfile.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/:username" element={<TeamProfile />} />
        <Route path="*" element={
          <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-950 via-indigo-900 to-slate-900 px-4 text-center">
            <h1 className="text-2xl font-bold text-white mb-2">SeloraX Team</h1>
            <p className="text-indigo-200">Visit /{'{username}'} to view a team profile.</p>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}
