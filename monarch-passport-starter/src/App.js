import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Claim from './pages/Claim';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/passport" element={<Dashboard />} />
        <Route path="/claim" element={<Claim />} />
      </Routes>
    </Router>
  );
}

export default App;