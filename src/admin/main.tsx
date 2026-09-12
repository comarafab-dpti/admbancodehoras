import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../App';
import { ErrorBoundary } from '../shared/components/ErrorBoundary';
import { InstitutionProvider } from '../shared/contexts/InstitutionContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '../shared/queryClient';
import '../index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="Administração COMARA">
      <InstitutionProvider>
        <QueryClientProvider client={queryClient}>
          <App />
          {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </QueryClientProvider>
      </InstitutionProvider>
    </ErrorBoundary>
  </StrictMode>,
);