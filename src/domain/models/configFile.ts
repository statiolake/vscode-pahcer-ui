import { DomainValidationError } from '../exceptions';

export type ConfigId = 'normal' | 'temporary';

/**
 * pahcer の設定ファイル（pahcer_config.toml）のドメインモデル
 *
 * 責務:
 * - startSeed, endSeed, objective の値を保持
 * - 値の取得・設定を提供
 */
export class PahcerConfig {
  constructor(
    private readonly _id: ConfigId,
    private readonly _path: string,
    private readonly _problemName: string,
    private _startSeed: number,
    private _endSeed: number,
    private _objective: 'max' | 'min',
  ) {
    if (this._startSeed < 0) {
      throw new DomainValidationError('startSeed は非負数である必要があります');
    }

    if (this._endSeed < this._startSeed) {
      throw new DomainValidationError('endSeed は startSeed 以上である必要があります');
    }
  }

  get id(): ConfigId {
    return this._id;
  }

  get path(): string {
    return this._path;
  }

  get problemName(): string {
    return this._problemName;
  }

  get startSeed(): number {
    return this._startSeed;
  }

  set startSeed(value: number) {
    this._startSeed = value;
  }

  get endSeed(): number {
    return this._endSeed;
  }

  set endSeed(value: number) {
    this._endSeed = value;
  }

  get objective(): 'max' | 'min' {
    return this._objective;
  }

  set objective(value: 'max' | 'min') {
    this._objective = value;
  }
}
