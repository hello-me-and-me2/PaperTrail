import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';
import Analysis from './pages/Analysis';

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/analysis/:type/:name" element={<Analysis />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
