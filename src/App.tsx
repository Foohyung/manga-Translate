import { Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { FastTranslatePage } from './pages/FastTranslatePage';
import { HistoryPage } from './pages/HistoryPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/worktable" element={<FastTranslatePage />} />
      <Route path="/history" element={<HistoryPage />} />
    </Routes>
  );
}

export default App;
