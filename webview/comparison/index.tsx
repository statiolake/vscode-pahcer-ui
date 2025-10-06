import React from 'react';
import { createRoot } from 'react-dom/client';
import { ComparisonView } from './ComparisonView';
import type { ComparisonData } from './types';

// Get initial data from window
declare global {
	interface Window {
		initialData: ComparisonData;
	}
}

const container = document.getElementById('root');
if (container) {
	const root = createRoot(container);
	root.render(<ComparisonView initialData={window.initialData} />);
}
