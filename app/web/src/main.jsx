import { createRoot } from 'react-dom/client';
import './styles.css';
import './app.css';
import './legacy.css';
import './landing-restore.css';
import './palette-teal.css';
import './palette-indigo.css';
import App from './App';
import { AuthProvider } from './auth';
import { ThemeProvider } from './theme';
import ErrorBoundary from './components/ErrorBoundary';
import { applyMotionPreference } from './motion';

// Applied before the first paint so no route flashes a still frame before its
// animations are armed.
applyMotionPreference();

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </ErrorBoundary>
);
