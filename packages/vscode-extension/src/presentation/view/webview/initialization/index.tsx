import { createRoot } from 'react-dom/client';
import { InitializationView } from './InitializationView';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<InitializationView />);
}
