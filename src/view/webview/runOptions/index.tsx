import { createRoot } from 'react-dom/client';
import { RunOptionsView } from './RunOptionsView';

const container = document.getElementById('root');
if (container) {
	const root = createRoot(container);
	root.render(<RunOptionsView />);
}
