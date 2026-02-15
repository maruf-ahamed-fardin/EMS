import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TeamProfile from './TeamProfile.jsx';
import Search from './Search.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Search />} />
        <Route path="/:username" element={<TeamProfile />} />
      </Routes>
    </BrowserRouter>
  );
}
