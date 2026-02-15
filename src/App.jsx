import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TeamProfile from './TeamProfile.jsx';
import Settings from './Settings.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Settings />} />
        <Route path="/:username" element={<TeamProfile />} />
      </Routes>
    </BrowserRouter>
  );
}
