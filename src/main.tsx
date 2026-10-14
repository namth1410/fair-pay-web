import './utils/initialUrl';
import '@fontsource/onest/vietnamese-400.css';
import '@fontsource/onest/vietnamese-500.css';
import '@fontsource/onest/vietnamese-600.css';
import '@fontsource/onest/vietnamese-700.css';
import '@fontsource/onest/vietnamese-800.css';
import '@fontsource/onest/latin-400.css';
import '@fontsource/onest/latin-500.css';
import '@fontsource/onest/latin-600.css';
import '@fontsource/onest/latin-700.css';
import '@fontsource/onest/latin-800.css';
import '@fontsource/onest/latin-ext-400.css';
import '@fontsource/onest/latin-ext-500.css';
import '@fontsource/onest/latin-ext-600.css';
import '@fontsource/onest/latin-ext-700.css';
import '@fontsource/onest/latin-ext-800.css';
import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { applyCachedPreferences } from './utils/preferences';

// Áp theme/giảm chuyển động đã lưu TRƯỚC render đầu → không nháy sáng/tối.
applyCachedPreferences();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
