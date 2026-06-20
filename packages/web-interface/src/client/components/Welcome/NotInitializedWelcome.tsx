import { Button } from '../common/Button';
import { IconInfo } from '../Tree/icons';

type NotInitializedWelcomeProps = {
  workspaceRoot: string;
  onStartInitialization: () => void;
};

export function NotInitializedWelcome(props: NotInitializedWelcomeProps) {
  return (
    <section className="welcome">
      <div className="welcomeCard">
        <div className="welcomeIcon accent">
          <IconInfo color="accent" />
        </div>
        <h1>初期化が必要です</h1>
        <p className="welcomeDescription">
          問題名、目的、言語、テスターを指定してワークスペースを初期化します。
        </p>

        <div className="welcomeActions">
          <Button variant="primary" onClick={props.onStartInitialization}>
            初期化を開始
          </Button>
        </div>

        <div className="welcomeMeta">
          <span>Workspace</span>
          <code>{props.workspaceRoot}</code>
        </div>
      </div>
    </section>
  );
}
