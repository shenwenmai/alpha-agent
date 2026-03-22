import React, { useState, useEffect } from 'react';
import AppNavigator from './navigation/AppNavigator';
import AuthGate from './components/AuthGate';
import { collectVisit } from './services/collectService';
import './index.css';

export default function App() {
  // 记录每次访问
  useEffect(() => { collectVisit(); }, []);

  return (
    <AuthGate>
      <AppNavigator />
    </AuthGate>
  );
}
