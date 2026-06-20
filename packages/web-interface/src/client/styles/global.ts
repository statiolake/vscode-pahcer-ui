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
  line-height: var(--lh-base);
}
button, .button, input, select, textarea { font: inherit; letter-spacing: 0; }
button, .button {
  min-height: var(--control-base);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text);
  padding: var(--space-1) var(--space-3);
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
  outline: var(--size-focus-ring) solid var(--accent-line);
  outline-offset: var(--size-hairline);
}
button:disabled {
  color: var(--soft);
  background: var(--surface-muted);
  cursor: not-allowed;
}
.button.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--on-accent);
  font-weight: 650;
}
.button.primary:hover { background: var(--accent-strong); border-color: var(--accent-strong); }
.button.secondary { background: var(--surface); }
input, select, textarea {
  min-height: var(--control-base);
  width: 100%;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text);
  padding: var(--space-1) var(--space-2);
}
textarea { resize: vertical; line-height: var(--lh-base); }
input::placeholder, textarea::placeholder { color: var(--soft); }
main { min-height: 100vh; display: flex; flex-direction: column; }
.commandBar {
  min-height: var(--bar-base);
  border-bottom: 1px solid var(--line);
  background: var(--surface-translucent);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-4);
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  backdrop-filter: blur(var(--blur-sm));
}
.commandBarCenter { flex: 1 1 auto; min-width: var(--space-5); }
.brand { display: grid; min-width: 0; gap: var(--size-hairline); }
.brand strong { font-size: var(--fs-lg); line-height: var(--lh-tight); }
.brand span {
  color: var(--muted);
  font-size: var(--fs-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 52vw;
}
.statusChip {
  min-height: var(--control-md);
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
  color: var(--muted);
  font-size: var(--fs-sm);
  font-weight: 650;
  padding: var(--space-1) var(--space-2);
  white-space: nowrap;
}
.topBarActions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  justify-content: flex-end;
}
.sectionLabel {
  color: var(--muted);
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
.chipBadge {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-pill);
  background: var(--surface-muted);
  color: var(--muted);
  font-size: var(--fs-xs);
  font-weight: 600;
  padding: var(--space-1) var(--space-2);
  white-space: nowrap;
}
.iconButton {
  min-height: var(--control-md);
  min-width: var(--control-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  line-height: var(--lh-solid);
  padding: 0;
  transition:
    background 120ms ease,
    color 120ms ease,
    border-color 120ms ease,
    opacity 160ms ease;
}
.iconButton.sm {
  min-height: var(--control-sm);
  min-width: var(--control-sm);
}
.iconButton.ghost:hover:not(:disabled) {
  border-color: transparent;
  background: var(--surface-muted);
  color: var(--text);
}
.iconButton.ghost.active {
  border-color: transparent;
  background: var(--accent-soft);
  color: var(--accent-text);
}
.iconButton.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--on-accent);
}
.iconButton.primary:hover:not(:disabled) {
  border-color: var(--accent-strong);
  background: var(--accent-strong);
}
.iconButton:disabled {
  opacity: 0.45;
  pointer-events: none;
}
.iconButton:focus-visible {
  outline: var(--size-focus-ring) solid var(--accent-line);
  outline-offset: var(--size-hairline);
}
.commands { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.srOnly {
  position: absolute;
  width: var(--size-hairline);
  height: var(--size-hairline);
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
.notice {
  margin: var(--space-2) var(--space-4) 0;
  border: 1px solid var(--accent-line);
  border-left: var(--size-accent-line) solid var(--accent);
  border-radius: var(--radius-md);
  background: var(--surface);
  padding: var(--space-2) var(--space-3);
  color: var(--accent-bg-text);
}
.notice.error {
  border-color: var(--danger-line);
  border-left-color: var(--danger);
  color: var(--danger-text);
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
  width: min(var(--width-welcome), 100%);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}
.welcomeIcon {
  width: var(--size-icon-frame);
  height: var(--size-icon-frame);
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
  border-color: var(--danger-line);
  background: var(--danger-soft);
}
.welcomeIcon .treeIcon {
  width: var(--size-icon-lg);
  height: var(--size-icon-lg);
  flex-basis: var(--size-icon-lg);
}
.welcome h1 {
  margin: 0 0 var(--space-2);
  font-size: var(--fs-2xl);
  line-height: var(--lh-tight);
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
  padding-left: var(--space-4);
  color: var(--muted);
}
.welcomeSteps code, .welcomeMeta code {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  padding: var(--size-hairline) var(--space-1);
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
  width: min(var(--width-panel-narrow), 100%);
}
.globalLoading {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: var(--z-loading);
  height: var(--size-loading-line);
  overflow: hidden;
  background: var(--loading-track);
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
  right: var(--space-4);
  bottom: var(--space-4);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: min(var(--width-toast), calc(100vw - (var(--space-4) * 2)));
}
.toast {
  position: relative;
  min-height: var(--control-lg);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  overflow: hidden;
  border: 1px solid var(--line);
  border-left: var(--size-accent-line) solid var(--accent);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  color: var(--text);
  padding: var(--space-2);
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
  color: var(--accent-text);
}
.toast.error {
  border-color: var(--danger-line);
  border-left-color: var(--danger);
  background: var(--danger-soft);
  color: var(--danger-text);
}
.toast.closing {
  opacity: 0;
  transform: translateY(calc(var(--space-2) * 0.75));
}
.toastClose {
  min-height: var(--control-sm);
  width: var(--control-sm);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  padding: 0;
}
.toastClose:hover {
  border-color: transparent;
  background: var(--danger-hover-bg);
}
@keyframes toastEnter {
  from {
    opacity: 0;
    transform: translateY(calc(var(--space-2) * 0.75));
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
  grid-template-columns: minmax(var(--width-sidebar-min), var(--width-sidebar-max)) minmax(0, 1fr);
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
  min-height: var(--control-lg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}
.panelHeader p {
  margin: var(--space-1) 0 0;
  color: var(--muted);
  font-size: var(--fs-sm);
}
.treeToolbar {
  min-height: var(--control-lg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}
.treeToolbar > .toggleGroup {
  flex: 0 0 auto;
}
.treeToolbar > .sortControl {
  flex: 0 0 auto;
  margin-left: auto;
}
.treeToolbar select {
  width: auto;
  min-width: 0;
  max-width: var(--width-sort-control);
}
.sortControl {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--muted);
}
.sortControl .treeIcon {
  color: var(--muted);
}
.panelTabs button {
  min-height: var(--control-base);
  border: 0;
  border-bottom: var(--size-tree-line) solid transparent;
  border-radius: 0;
  background: transparent;
  color: var(--muted);
  padding: var(--space-1) var(--space-3);
  font-weight: 500;
}
.panelTabs button:hover:not(:disabled):not(.active) {
  background: var(--surface-muted);
  color: var(--text);
}
.panelTabs button.active {
  border-bottom-color: var(--accent);
  background: transparent;
  color: var(--accent-text);
  font-weight: 650;
}
.panelTabs button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.panelTabsActions .button {
  border-color: var(--line);
  background: var(--surface);
  color: var(--text);
  padding: var(--space-1) var(--space-3);
}
.tree { overflow: auto; padding: var(--space-2); }
.treeGroup {
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  padding: var(--space-1);
}
.treeGroup + .treeGroup { margin-top: var(--space-1); }
.treeGroup:focus-within, .treeGroup:hover {
  background: var(--surface-muted);
  border-color: var(--line);
}
.treeRow {
  position: relative;
  min-height: var(--control-base);
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  text-align: left;
  border: 0;
  border-left: var(--size-tree-line) solid transparent;
  background: transparent;
  padding: var(--space-1) var(--space-2) var(--space-1) calc(var(--space-2) - var(--size-tree-line));
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
  color: var(--danger-text);
  background: var(--danger-soft);
}
.caseRow.failed .description {
  color: var(--danger-text);
}
.seedExecutionRow.failed .treeLabel {
  color: var(--danger-text);
}
.disclosure {
  min-height: var(--control-sm);
  width: var(--size-icon-md);
  flex: 0 0 var(--size-icon-md);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--soft);
  font-size: var(--fs-xs);
  line-height: var(--lh-solid);
}
.disclosure:hover { background: transparent; border-color: transparent; color: var(--text); }
.treeCheckbox {
  width: var(--size-icon-sm);
  height: var(--size-icon-sm);
  min-height: var(--size-icon-sm);
  flex: 0 0 auto;
  margin: 0;
  accent-color: var(--accent);
}
.treeIcon {
  width: var(--size-icon-sm);
  height: var(--size-icon-sm);
  flex: 0 0 var(--size-icon-sm);
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
  min-height: var(--control-sm);
}
button.treeLabel:hover {
  background: transparent;
  border-color: transparent;
  color: var(--text);
}
.description {
  min-width: 0;
  flex: 0 1 auto;
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
  position: absolute;
  top: 50%;
  right: var(--space-2);
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding-left: var(--space-4);
  opacity: 0;
  pointer-events: none;
  background: linear-gradient(
    to right,
    transparent,
    var(--surface) 30%,
    var(--surface) 100%
  );
  border-radius: var(--radius-md);
  transition: opacity 120ms ease;
}
.treeRow:hover .rowActions,
.treeRow:focus-within .rowActions {
  opacity: 1;
  pointer-events: auto;
}
.treeRow:hover .rowActions {
  background: linear-gradient(
    to right,
    transparent,
    var(--surface-muted) 30%,
    var(--surface-muted) 100%
  );
}
.rowActions button {
  min-height: var(--control-sm);
  width: var(--control-sm);
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
  margin-left: var(--control-md);
  border-left: 1px solid var(--line);
  padding: var(--space-1) 0 var(--space-1) var(--space-2);
}
.summaryRow {
  margin: var(--space-1) 0 var(--space-1);
  padding: var(--space-2);
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  min-height: var(--control-lg);
  border-bottom: 1px solid var(--line);
  background: var(--surface);
  overflow: auto;
}
.panelTabsList {
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
}
.panelTabsActions {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
}
.panelContent { min-height: 0; overflow: auto; padding: var(--space-4); }
.panelContent.narrow { max-width: var(--width-panel-narrow); }
.panelHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin: 0 0 var(--space-4);
}
.panelHeader > div { min-width: 0; }
h2, h3 { margin: 0; letter-spacing: 0; }
h2 { font-size: var(--fs-xl); line-height: var(--lh-tight); }
h3 { font-size: var(--fs-base); line-height: var(--lh-tight); }
label {
  display: grid;
  gap: var(--space-1);
  color: var(--muted);
  font-size: var(--fs-sm);
  font-weight: 600;
}
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: var(--width-form);
  margin-top: var(--space-4);
}
.formIntro {
  margin: 0 0 var(--space-3);
  color: var(--muted);
  font-size: var(--fs-sm);
  max-width: var(--width-form);
}
.formIntro + .form {
  margin-top: 0;
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
  line-height: var(--lh-tight);
}
.checkboxControl {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--control-base);
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
  min-height: var(--control-base);
  color: var(--text);
  font-weight: 500;
}
.checkLabel input { width: auto; }
.checkLabel span { display: grid; gap: var(--space-1); }
.fieldHelp, label small {
  color: var(--muted);
  font-size: var(--fs-xs);
  font-weight: 400;
  line-height: var(--lh-base);
}
.comparisonControlPanel {
  margin: 0;
  padding: 0;
  border: 0;
}
.comparisonSection {
  padding-top: var(--space-3);
  margin-top: var(--space-3);
  border-top: 1px solid var(--line);
}
.comparisonSection:first-child {
  padding-top: 0;
  margin-top: 0;
  border-top: 0;
}
.comparisonSection .sectionLabel {
  margin-bottom: var(--space-2);
}
.comparisonSection > .formField + .checkboxControl,
.comparisonSection > .checkboxControl + .formField {
  margin-top: var(--space-3);
}
.fieldGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}
.comparisonControlPanel .formField > label {
  color: var(--text);
  font-size: var(--fs-md);
  font-weight: 600;
}
.comparisonControlPanel .checkboxField {
  justify-content: end;
}
.comparisonControlPanel .checkboxField .checkLabel {
  align-items: center;
}
.formField.invalid input,
.formField.invalid select,
.formField.invalid textarea {
  border-color: var(--danger-line);
  background: var(--danger-soft);
}
.formField .fieldError {
  color: var(--danger-text);
  font-size: var(--fs-xs);
  margin-top: var(--space-1);
}
.comparisonStatsSection {
  margin-bottom: var(--space-4);
  padding: var(--space-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
}
.fieldInvalid input,
.fieldInvalid select,
.fieldInvalid textarea {
  border-color: var(--danger-line);
  background: var(--danger-soft);
  outline: var(--size-focus-ring) solid var(--danger);
  outline-offset: 0;
}
.fieldError {
  color: var(--danger-text);
  font-size: var(--fs-xs);
  font-weight: 500;
  line-height: var(--lh-tight);
}
.comparisonDetails {
  color: var(--muted);
  margin-top: var(--space-4);
}
.comparisonDetails summary {
  cursor: pointer;
  user-select: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--muted);
  font-size: var(--fs-sm);
  list-style: none;
}
.comparisonDetails summary::-webkit-details-marker {
  display: none;
}
.comparisonDetails .chevronIcon {
  transition: transform 160ms ease;
}
.comparisonDetails[open] .chevronIcon {
  transform: rotate(180deg);
}
.comparisonDetailsBody {
  margin-top: var(--space-2);
  padding-left: var(--space-4);
  color: var(--muted);
  font-size: var(--fs-sm);
}
.comparisonDetailsBody p {
  margin: 0 0 var(--space-2);
}
.comparisonDetailsBody p:last-child {
  margin-bottom: 0;
}
.comparisonDetailsBody ul {
  margin: var(--space-1) 0 var(--space-2);
  padding-left: var(--space-4);
}
.comparisonDetailsBody code {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 0.92em;
  padding: var(--size-hairline) var(--space-1);
}
.comparisonChart {
  position: relative;
  height: var(--height-chart);
  margin-top: var(--space-4);
}
.comparisonPopupBackdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal-backdrop);
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
  z-index: var(--z-modal);
  max-height: var(--height-popup);
  overflow-y: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface);
  box-shadow: var(--shadow-popover);
  padding: var(--space-2);
  transform: translate(var(--space-3), var(--space-3));
}
.comparisonPopupTitle {
  margin-bottom: var(--space-2);
  color: var(--text);
  font-weight: 700;
}
.comparisonPopupList {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.comparisonPopupItem {
  min-height: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--accent-text);
  cursor: pointer;
  font: inherit;
  padding: var(--space-1) var(--space-2);
  text-align: left;
}
.comparisonPopupItem:hover {
  border-color: transparent;
  background: var(--accent-soft);
  text-decoration: underline;
}
.comparisonSectionTitle {
  margin-bottom: var(--space-2);
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
  padding: var(--space-2);
  font-size: var(--fs-md);
}
.comparisonStatsTable th {
  color: var(--muted);
  background: var(--surface-muted);
  font-weight: 650;
}
.comparisonStatsTable th:not(:first-child),
.comparisonStatsTable td:not(:first-child) {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.comparisonStatsTable tr:last-child td { border-bottom: 0; }
.toggleGroup {
  display: inline-flex;
  align-items: stretch;
  min-inline-size: 0;
  max-width: 100%;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  padding: 0;
}
fieldset.toggleGroup {
  margin: 0;
  padding: 0;
  min-inline-size: 0;
}
fieldset.toggleGroup > legend.srOnly {
  margin: 0;
  padding: 0;
}
.panelContent > .toggleGroup { margin: 0 0 var(--space-4); }
.toggleGroup button {
  min-height: var(--control-md);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--muted);
  font-size: var(--fs-md);
  padding: 0 var(--space-3);
}
.toggleGroup button + button { border-left: 1px solid var(--line); }
.toggleGroup button:hover {
  background: var(--surface-muted);
  color: var(--text);
}
.toggleGroup button.active,
.toggleGroup button[aria-pressed="true"] {
  background: var(--accent-soft);
  color: var(--accent-text);
  font-weight: 650;
}
.sourceFileSelect {
  width: min(var(--width-source-select), 100%);
  margin-bottom: var(--space-4);
}
.codeBlock {
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-4);
  overflow: hidden;
  background: var(--surface);
}
.codeBlockHeader {
  min-height: var(--control-lg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--line);
  background: var(--surface-muted);
}
.codeBlockTitle {
  flex: 1;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--text);
  font-size: var(--fs-md);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.codeBlockActions {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}
.codeBlockSubtitle {
  overflow: hidden;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  padding: var(--space-1) var(--space-3);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.codeBlock pre {
  max-height: 60vh;
  margin: 0;
  padding: var(--space-3);
  overflow: auto;
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  line-height: var(--lh-base);
  white-space: pre;
}
.codeBlock pre.wrap {
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.diffLine {
  display: block;
  min-height: var(--line-box-base);
  margin: 0 calc(var(--space-3) * -1);
  padding: 0 var(--space-3);
}
.codeBlock pre .diff-add {
  display: block;
  background: var(--success-soft);
  color: var(--success);
}
.codeBlock pre .diff-remove {
  display: block;
  background: var(--danger-soft);
  color: var(--danger);
}
.codeBlock pre .diff-hunk {
  display: block;
  color: var(--muted);
  font-weight: 600;
}
.diffList {
  display: grid;
  gap: var(--space-2);
}
.diffFile {
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  overflow: hidden;
}
.diffFile summary {
  min-height: var(--control-lg);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  list-style: none;
  background: var(--surface-muted);
  color: var(--text);
  font-weight: 650;
  overflow-wrap: anywhere;
}
.diffFile summary::-webkit-details-marker { display: none; }
.diffFile summary > .chevronIcon {
  flex: 0 0 auto;
  transition: transform 160ms ease;
}
.diffFile summary > span:first-of-type {
  flex: 1 1 auto;
  min-width: 0;
}
.diffFile[open] summary {
  border-bottom: 1px solid var(--line);
}
.diffFile[open] summary > .chevronIcon {
  transform: rotate(90deg);
}
.diffFile .codeBlock {
  margin: 0;
  border: 0;
  border-radius: 0;
}
.diffStats {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--muted);
  font-size: var(--fs-sm);
}
.diffAdded {
  color: var(--success);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.diffRemoved {
  color: var(--danger);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.empty {
  min-height: var(--height-empty);
  display: grid;
  place-items: center;
  padding: var(--space-5);
  color: var(--muted);
  text-align: center;
}
.empty > * + * { margin-top: var(--space-2); }
.emptyIcon { color: var(--soft); }
.emptyIcon .treeIcon {
  width: var(--size-icon-lg);
  height: var(--size-icon-lg);
  flex-basis: var(--size-icon-lg);
}
.emptyText { font-size: var(--fs-base); color: var(--muted); font-weight: 600; }
.emptyHint {
  font-size: var(--fs-sm);
  color: var(--soft);
  max-width: 38ch;
  line-height: var(--lh-base);
  font-weight: 400;
}
.visualizerPanel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.visualizerToolbar {
  min-height: var(--control-lg);
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
.visualizerActions {
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
  z-index: var(--z-modal);
  display: grid;
  place-items: center;
  padding: var(--space-4);
  animation: modalBackdropEnter 120ms ease-out;
  background: var(--overlay-bg);
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
  width: min(var(--width-modal), 100%);
  max-height: calc(100vh - (var(--space-5) * 2));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  animation: modalEnter 160ms cubic-bezier(.2, .7, .3, 1);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}
.modalHeader {
  min-height: var(--control-lg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--line);
}
.modalHeader h3 {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.modalClose {
  min-height: var(--control-md);
  width: var(--control-md);
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
@keyframes modalBackdropEnter {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes modalEnter {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@media (max-width: 51.25rem) {
  .commandBar { align-items: stretch; flex-direction: column; }
  .commandBarCenter { display: none; }
  .topBarActions { justify-content: space-between; }
  .brand span { max-width: 100%; }
  .welcome { padding: var(--space-4) var(--space-2); }
  .welcomeCard { padding: var(--space-4); }
  .welcomeActions .button { width: 100%; }
  .toastContainer { right: var(--space-2); bottom: var(--space-2); width: calc(100vw - (var(--space-2) * 2)); }
  .initializationShell { padding: var(--space-2); }
  .workbench { grid-template-columns: 1fr; padding: var(--space-2); }
  .sideBar { max-height: 48vh; }
  .panelHeader { align-items: flex-start; flex-direction: column; }
  .diffFile summary { align-items: flex-start; }
}
@media (max-width: 45rem) {
  .fieldGrid { grid-template-columns: 1fr; }
}
`;
