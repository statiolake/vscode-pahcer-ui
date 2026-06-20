import type { FileView } from '../../types';
import { CodeBlock } from './CodeBlock';

export function FileBlock(props: { file: FileView }) {
  return (
    <CodeBlock title={props.file.title} subtitle={props.file.path} content={props.file.content} />
  );
}
