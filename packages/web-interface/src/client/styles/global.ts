import { designTokens } from './tokens';

export const globalStyles = `
${designTokens}

* { box-sizing: border-box; }
html, body, #root { min-height: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: var(--fs-base);
  line-height: 1.45;
}
button, .button, input, select, textarea { font: inherit; letter-spacing: 0; }
button, .button {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text);
  padding: 5px var(--space-3);
  cursor: pointer;
  text-decoration: none;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    color 120ms ease,
    box-shadow 120ms ease,
    opacity 160ms ease;
}
button:hover, .button:hover { background: var(--surface-muted); border-color: var(--line-strong); }
button:focus-visible, .button:focus-visible, input:focus-visible, select:focus-visible {
  outline: 2px solid var(--accent-line);
  outline-offset: 1px;
}
button:disabled {
  color: var(--soft);
  background: var(--surface-muted);
  cursor: not-allowed;
}
.button.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: #ffffff;
  font-weight: 650;
}
.button.primary:hover { background: #225c42; border-color: #225c42; }
.button.secondary { background: var(--surface); }
input, select, textarea {
  min-height: 32px;
  width: 100%;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text);
  padding: 5px 9px;
}
textarea { resize: vertical; line-height: 1.5; }
input::placeholder, textarea::placeholder { color: var(--soft); }
main { min-height: 100vh; display: flex; flex-direction: column; }
.commandBar {
  min-height: 52px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.94);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: 9px var(--space-4);
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(10px);
}
.brand { display: grid; min-width: 0; gap: 1px; }
.brand strong { font-size: 15px; line-height: 1.2; }
.brand span {
  color: var(--muted);
  font-size: var(--fs-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 52vw;
}
.statusChip {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
  color: var(--muted);
  font-size: var(--fs-sm);
  font-weight: 650;
  padding: 3px 9px;
}
.commands { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.srOnly {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
.notice {
  margin: 10px var(--space-4) 0;
  border: 1px solid var(--accent-line);
  border-left: 4px solid var(--accent);
  border-radius: var(--radius-md);
  background: var(--surface);
  padding: 9px var(--space-3);
  color: #244b39;
}
.notice.error {
  border-color: #e2b1ac;
  border-left-color: var(--danger);
  color: #8d2d25;
  background: var(--danger-soft);
}
.welcome {
  flex: 1;
  width: 100%;
  display: grid;
  place-items: center;
  padding: var(--space-5) var(--space-4);
}
.welcomeCard {
  width: min(720px, 100%);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}
.welcomeIcon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  margin-bottom: var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface-muted);
}
.welcomeIcon.accent {
  border-color: var(--accent-line);
  background: var(--accent-soft);
}
.welcomeIcon.danger {
  border-color: #e2b1ac;
  background: var(--danger-soft);
}
.welcomeIcon .treeIcon {
  width: 22px;
  height: 22px;
  flex-basis: 22px;
}
.welcome h1 {
  margin: 0 0 var(--space-2);
  font-size: 24px;
  line-height: 1.2;
}
.welcomeDescription {
  margin: 0;
  color: var(--muted);
  font-size: var(--fs-base);
}
.welcomeSteps {
  display: grid;
  gap: var(--space-2);
  margin: var(--space-4) 0 0;
  padding-left: 20px;
  color: var(--muted);
}
.welcomeSteps code, .welcomeMeta code {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  padding: 1px 4px;
}
.welcomeActions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-5);
}
.welcomeMeta {
  display: grid;
  gap: var(--space-1);
  margin-top: var(--space-5);
  color: var(--muted);
  font-size: var(--fs-sm);
}
.welcomeMeta code {
  display: block;
  width: 100%;
  overflow-wrap: anywhere;
}
.initializationShell {
  flex: 1;
  min-height: 0;
  display: flex;
  justify-content: center;
  padding: var(--space-3);
}
.initializationMainPanel {
  width: min(760px, 100%);
}
.globalLoading {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  height: 2px;
  overflow: hidden;
  background: rgba(42, 111, 80, 0.18);
}
.globalLoading::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 45%;
  background: var(--accent);
  opacity: 0.82;
  animation: globalLoadingSweep 1.2s ease-in-out infinite;
}
@keyframes globalLoadingSweep {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(260%); }
}
.toastContainer {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(360px, calc(100vw - 32px));
}
.toast {
  position: relative;
  min-height: 40px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  overflow: hidden;
  border: 1px solid var(--line);
  border-left: 4px solid var(--accent);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  color: var(--text);
  padding: 9px 10px;
  animation: toastEnter 160ms ease-out;
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}
.toast span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.toast.success {
  border-color: var(--accent-line);
  border-left-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}
.toast.error {
  border-color: #e2b1ac;
  border-left-color: var(--danger);
  background: var(--danger-soft);
  color: var(--danger);
}
.toast.closing {
  opacity: 0;
  transform: translateY(6px);
}
.toastClose {
  min-height: 24px;
  width: 24px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  padding: 0;
}
.toastClose:hover {
  border-color: transparent;
  background: rgba(176, 70, 59, 0.1);
}
@keyframes toastEnter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.workbench {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(320px, 400px) minmax(0, 1fr);
  padding: var(--space-3);
  gap: var(--space-3);
}
.sideBar, .mainPanel {
  min-height: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.sideBar { display: flex; flex-direction: column; }
.resultHeader {
  display: grid;
  gap: 10px;
  padding: 14px 14px var(--space-3);
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}
.resultHeader h2 { font-size: var(--fs-lg); }
.resultHeader p, .panelHeader p {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: var(--fs-sm);
}
.contextActions {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: var(--space-2);
}
.treeToolbar {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  gap: var(--space-2);
  padding: 10px;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}
.treeToolbar button, .panelTabs button {
  min-height: 30px;
  border-color: transparent;
  background: transparent;
  color: var(--muted);
}
.treeToolbar button.active, .panelTabs button.active {
  border-color: var(--accent-line);
  background: var(--accent-soft);
  color: #18553b;
  font-weight: 650;
}
.tree { overflow: auto; padding: var(--space-2); }
.treeGroup {
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  padding: 3px;
}
.treeGroup + .treeGroup { margin-top: var(--space-1); }
.treeGroup:focus-within, .treeGroup:hover {
  background: var(--surface-muted);
  border-color: var(--line);
}
.treeRow {
  min-height: 32px;
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  text-align: left;
  border: 0;
  border-left: 2px solid transparent;
  background: transparent;
  padding: var(--space-1) var(--space-2) var(--space-1) calc(var(--space-2) - 2px);
  border-radius: var(--radius-md);
  color: var(--text);
}
.treeRow:hover { background: var(--surface-muted); }
.treeRow.latest {
  border-left-color: var(--accent);
}
.treeRow.latest .treeLabel {
  font-weight: 600;
}
.caseRow.failed {
  color: var(--danger);
  background: var(--danger-soft);
}
.caseRow.failed .description {
  color: var(--danger);
}
.seedExecutionRow.failed .treeLabel {
  color: var(--danger);
}
.disclosure {
  min-height: 24px;
  width: 18px;
  flex: 0 0 18px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--soft);
  font-size: 11px;
  line-height: 1;
}
.disclosure:hover { background: transparent; border-color: transparent; color: var(--text); }
.treeCheckbox {
  width: 14px;
  height: 14px;
  min-height: 14px;
  flex: 0 0 auto;
  margin: 0;
  accent-color: var(--accent);
}
.treeIcon {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
}
.treeLabel {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  color: inherit;
  font-weight: 500;
}
button.treeLabel {
  border: 0;
  background: transparent;
  padding: 0;
  min-height: 24px;
}
button.treeLabel:hover {
  background: transparent;
  border-color: transparent;
  color: var(--text);
}
.description {
  min-width: 0;
  flex: 0 2 auto;
  max-width: 42%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--muted);
  font-size: var(--fs-sm);
}
.executionRow .description {
  color: var(--muted);
}
.rowActions {
  display: inline-flex;
  gap: var(--space-1);
  opacity: 0;
  margin-left: auto;
  transition: opacity 120ms ease;
}
.treeRow:hover .rowActions, .treeRow:focus-within .rowActions {
  opacity: 1;
}
.rowActions button {
  min-height: 24px;
  width: 24px;
  display: inline-grid;
  place-items: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--muted);
  padding: 0;
}
.rowActions button:hover {
  background: var(--surface-muted);
  border-color: transparent;
  color: var(--text);
}
.children {
  margin-left: 28px;
  border-left: 1px solid var(--line);
  padding: var(--space-1) 0 5px 10px;
}
.summaryRow {
  margin: 3px 0 5px;
  padding: 7px 9px;
  background: var(--surface-muted);
  color: var(--muted);
  font-size: var(--fs-sm);
}
.summaryRow .treeLabel {
  color: var(--muted);
  font-weight: 500;
}
.mainPanel { min-width: 0; display: flex; flex-direction: column; }
.panelTabs {
  min-height: 44px;
  display: flex;
  gap: var(--space-1);
  align-items: center;
  border-bottom: 1px solid var(--line);
  padding: 7px 10px;
  overflow: auto;
  background: var(--surface);
}
.panelContent { min-height: 0; overflow: auto; padding: 18px; }
.panelContent.narrow { max-width: 760px; }
.panelHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin: 0 0 14px;
}
.panelHeader > div { min-width: 0; }
h2, h3 { margin: 0; letter-spacing: 0; }
h2 { font-size: var(--fs-xl); line-height: 1.25; }
h3 { font-size: var(--fs-base); line-height: 1.35; }
label {
  display: grid;
  gap: 5px;
  color: var(--muted);
  font-size: var(--fs-sm);
  font-weight: 600;
}
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 600px;
  margin-top: var(--space-4);
}
.formField {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.formField > label,
.checkboxControl label {
  display: block;
  color: var(--text);
  font-size: var(--fs-base);
  font-weight: 700;
  line-height: 1.35;
}
.checkboxControl {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 32px;
}
.checkboxControl input {
  flex: 0 0 auto;
  width: auto;
  margin: 0;
}
.checkboxControl label { cursor: pointer; }
.formActions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}
.checkLabel {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--space-2);
  min-height: 32px;
  color: var(--text);
  font-weight: 500;
}
.checkLabel input { width: auto; }
.checkLabel span { display: grid; gap: var(--space-1); }
.fieldHelp, label small {
  color: var(--muted);
  font-size: var(--fs-xs);
  font-weight: 400;
  line-height: 1.45;
}
.comparisonSection {
  margin-bottom: 20px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
}
.comparisonControls {
  display: grid;
  grid-template-columns: minmax(240px, 300px) minmax(200px, 1fr);
  gap: 10px;
  align-items: start;
}
.comparisonControls.secondary {
  grid-template-columns: minmax(120px, 150px) minmax(180px, 1fr) minmax(180px, 1fr) auto;
  margin-top: 10px;
}
.comparisonCheck {
  min-height: 32px;
  padding-top: 24px;
}
.fieldInvalid input,
.fieldInvalid select,
.fieldInvalid textarea {
  border-color: var(--danger);
  background: var(--danger-soft);
  outline: 2px solid var(--danger);
  outline-offset: 0;
}
.fieldError {
  color: var(--danger);
  font-size: var(--fs-xs);
  font-weight: 500;
  line-height: 1.35;
}
.comparisonDetails {
  margin-top: 10px;
  color: var(--muted);
  font-size: var(--fs-sm);
}
.comparisonDetails summary {
  cursor: pointer;
  user-select: none;
}
.comparisonDetailsBody {
  margin-top: 8px;
  padding-left: 20px;
}
.comparisonDetailsBody p {
  margin: 0 0 10px;
}
.comparisonDetailsBody p:last-child {
  margin-bottom: 0;
}
.comparisonDetailsBody ul {
  margin: 5px 0 10px;
  padding-left: 20px;
}
.comparisonDetailsBody code {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 0.92em;
  padding: 1px 4px;
}
.comparisonChart {
  position: relative;
  height: 600px;
  margin-top: 20px;
}
.comparisonPopupBackdrop {
  position: fixed;
  inset: 0;
  z-index: 999;
  min-height: 0;
  width: 100%;
  border: 0;
  border-radius: 0;
  background: transparent;
  cursor: default;
  padding: 0;
}
.comparisonPopupBackdrop:hover {
  border-color: transparent;
  background: transparent;
}
.comparisonPopup {
  position: fixed;
  z-index: 1000;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  padding: 10px;
}
.comparisonPopupTitle {
  margin-bottom: 8px;
  color: var(--text);
  font-weight: 700;
}
.comparisonPopupList {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.comparisonPopupItem {
  min-height: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  font: inherit;
  padding: 4px 8px;
  text-align: left;
}
.comparisonPopupItem:hover {
  border-color: transparent;
  background: var(--accent-soft);
  text-decoration: underline;
}
.comparisonSectionTitle {
  margin-bottom: 10px;
  color: var(--muted);
  font-size: var(--fs-sm);
}
.comparisonStatsTable {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.comparisonStatsTable th,
.comparisonStatsTable td {
  text-align: left;
  border-bottom: 1px solid var(--line);
  padding: 9px 10px;
  font-size: var(--fs-md);
}
.comparisonStatsTable th {
  color: var(--muted);
  background: var(--surface-muted);
  font-weight: 650;
}
.comparisonStatsTable tr:last-child td { border-bottom: 0; }
.toggleGroup {
  display: inline-flex;
  align-items: stretch;
  min-inline-size: 0;
  max-width: 100%;
  margin: 0 0 14px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  padding: 0;
}
.toggleGroup button {
  min-height: 32px;
  border: 0;
  border-right: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
  color: var(--muted);
  padding: 5px 14px;
}
.toggleGroup button:last-child { border-right: 0; }
.toggleGroup button:hover {
  background: var(--surface-muted);
  border-color: var(--line);
}
.toggleGroup button[aria-pressed="true"] {
  background: var(--accent-soft);
  color: var(--text);
  font-weight: 650;
  box-shadow: inset 0 0 0 1px var(--accent);
}
.sourceFileSelect {
  width: min(460px, 100%);
  margin-bottom: 14px;
}
.codeBlock {
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  margin-bottom: 14px;
  overflow: hidden;
  background: var(--surface);
}
.codeBlockHeader {
  min-height: 46px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 8px var(--space-3);
  background: var(--surface-muted);
  border-bottom: 1px solid var(--line);
}
.codeBlockTitle {
  min-width: 0;
  display: grid;
  gap: 2px;
}
.codeBlockTitle p {
  margin: 0;
  color: var(--muted);
  font-size: var(--fs-sm);
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.codeBlockActions {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}
.codeBlockAction {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 3px 8px;
  color: var(--muted);
}
.codeBlockAction[aria-pressed="true"] {
  border-color: var(--accent-line);
  background: var(--accent-soft);
  color: var(--text);
}
.codeBlockPre {
  max-height: 60vh;
  margin: 0;
  padding: var(--space-3);
  overflow: auto;
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  line-height: 1.55;
  white-space: pre;
}
.codeBlockPre.wrap {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.diffLine {
  display: block;
  min-height: 1.55em;
  margin: 0 calc(var(--space-3) * -1);
  padding: 0 var(--space-3);
}
.diff-add {
  background: var(--success-soft);
  color: var(--success);
}
.diff-remove {
  background: var(--danger-soft);
  color: var(--danger);
}
.diff-hunk {
  background: var(--surface-muted);
  color: var(--muted);
}
.diffList {
  display: grid;
  gap: 10px;
}
.diffFile {
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  overflow: hidden;
}
.diffFile summary {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 9px var(--space-3);
  cursor: pointer;
  background: var(--surface-muted);
  color: var(--text);
  font-weight: 650;
  overflow-wrap: anywhere;
}
.diffFile[open] summary {
  border-bottom: 1px solid var(--line);
}
.diffFile .codeBlock {
  margin: 0;
  border: 0;
  border-radius: 0;
}
.diffStats {
  flex: 0 0 auto;
  color: var(--muted);
  font-size: var(--fs-sm);
  font-weight: 600;
}
.empty {
  min-height: 160px;
  display: grid;
  place-items: center;
  padding: 28px;
  color: var(--muted);
  text-align: center;
}
.visualizerPanel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.visualizerToolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--line);
  background: var(--surface-muted);
  font-size: var(--fs-sm);
  color: var(--muted);
}
.visualizerMeta {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.visualizerMeta span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.visualizerToolbar .visualizerTitle {
  color: var(--text);
  font-weight: 600;
}
.visualizerToolbar .visualizerActions {
  display: inline-flex;
  flex: 0 0 auto;
  gap: var(--space-1);
}
.visualizer {
  flex: 1;
  min-height: 0;
  width: 100%;
  border: 0;
  background: var(--surface);
}
.visualizerUrlDescription {
  margin: 0 0 var(--space-3);
  color: var(--muted);
}
.visualizerUrlError {
  margin-top: var(--space-1);
}
.modalBackdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: rgba(26, 34, 29, 0.36);
}
.modalBackdropButton {
  position: absolute;
  inset: 0;
  min-height: 0;
  width: 100%;
  border: 0;
  border-radius: 0;
  background: transparent;
  padding: 0;
}
.modalBackdropButton:hover {
  background: transparent;
  border-color: transparent;
}
.modalDialog {
  position: relative;
  z-index: 1;
  width: min(480px, 100%);
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}
.modalHeader {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 10px var(--space-3);
  border-bottom: 1px solid var(--line);
}
.modalHeader h3 {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.modalClose {
  min-height: 28px;
  width: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--muted);
}
.modalClose:hover {
  background: var(--surface-muted);
  border-color: transparent;
  color: var(--text);
}
.modalBody {
  overflow: auto;
  padding: var(--space-3);
}
.modalBody label {
  color: var(--text);
}
.modalFooter {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-3);
  border-top: 1px solid var(--line);
  background: var(--surface-muted);
}
@media (max-width: 820px) {
  .commandBar { align-items: stretch; flex-direction: column; }
  .brand span { max-width: 100%; }
  .welcome { padding: var(--space-4) var(--space-2); }
  .welcomeCard { padding: var(--space-4); }
  .welcomeActions .button { width: 100%; }
  .toastContainer { right: 8px; bottom: 8px; width: calc(100vw - 16px); }
  .initializationShell { padding: var(--space-2); }
  .workbench { grid-template-columns: 1fr; padding: var(--space-2); }
  .sideBar { max-height: 48vh; }
  .comparisonControls { grid-template-columns: 1fr; }
  .comparisonCheck { padding-top: 0; }
  .panelHeader { align-items: flex-start; flex-direction: column; }
  .codeBlockHeader { align-items: flex-start; flex-direction: column; }
  .codeBlockActions { width: 100%; flex-wrap: wrap; }
  .diffFile summary { align-items: flex-start; flex-direction: column; }
}
`;
