import { IconCross } from '../Tree/icons';

type NotInstalledWelcomeProps = {
  workspaceRoot: string;
};

export function NotInstalledWelcome(props: NotInstalledWelcomeProps) {
  return (
    <section className="welcome">
      <div className="welcomeCard">
        <div className="welcomeIcon danger">
          <IconCross color="danger" />
        </div>
        <h1>pahcer が見つかりません</h1>
        <p className="welcomeDescription">
          このワークスペースで pahcer コマンドを実行できる状態にしてください。pahcer は AHC
          ローカルテストの並列実行ツールです。
        </p>

        <ol className="welcomeSteps">
          <li>
            <code>cargo install pahcer</code> を実行する
          </li>
          <li>もしくは GitHub README の手順に従ってインストールする</li>
          <li>インストール後にこの画面を再読み込みする</li>
        </ol>

        <div className="welcomeActions">
          <a
            className="button primary"
            href="https://github.com/terry-u16/pahcer"
            target="_blank"
            rel="noreferrer"
          >
            pahcer を開く
          </a>
          <button
            type="button"
            className="button secondary"
            onClick={() => window.location.reload()}
          >
            再読み込み
          </button>
        </div>

        <div className="welcomeMeta">
          <span>Workspace</span>
          <code>{props.workspaceRoot}</code>
        </div>
      </div>
    </section>
  );
}
