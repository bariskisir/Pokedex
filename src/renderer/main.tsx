/** Mounts the React application and loads the modular SCSS entrypoint. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/main.scss';

const container = document.getElementById('root');
if (!container) throw new Error('The application root is missing.');
createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
