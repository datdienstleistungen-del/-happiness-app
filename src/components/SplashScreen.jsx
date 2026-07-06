import { useEffect, useState } from 'react';
import Logo from './Logo';

export default function SplashScreen({ children }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  if (show) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#FFFFFF',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
      }}>
        <div style={{ fontSize: '56px' }}>
          <Logo />
        </div>
      </div>
    );
  }
  return children;
}