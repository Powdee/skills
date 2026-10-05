import { Rise } from "../engine/Stage";
import { Copy, arrival, rows, tone, usage } from "./copy";

/*
 * The world: the product's workspace, laid out once on a 1280×720 stage and
 * animated purely through data-* timings (see engine/Stage.tsx). Recreate the
 * real product UI here — same layout, wording and data as the app/landing page —
 * and give the things the camera or cursor visits a data-focus name.
 */
export const World: React.FC<{ c: Copy }> = ({ c }) => {
  const max = Math.max(...usage);
  return (
    <div className="ui-world">
      <div className="ui-paper mo-paper" data-out="3.5 1.3 io" />

      <aside className="ui-rail fx-up" data-in="3.9 .6">
        <span className="ui-logo" />
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="ui-rail-item" />
        ))}
      </aside>

      <div className="ui-dashboard" data-focus="dashboard">
        <section className="ui-panel ui-list fx-up" data-in="4.05 .6" data-focus="list">
          <header className="ui-panel-header">
            <h3>{c.list.title}</h3>
          </header>
          <div className="ui-list-filter">
            <span>{c.list.sort}</span>
            <strong>{c.list.sortValue}</strong>
          </div>
          <ul className="ui-rows">
            {rows.map((row, i) => (
              <li
                key={row.name}
                className={`ui-row fx-up ${i === 0 ? "is-selected" : ""}`}
                data-in={`${(4.55 + arrival[i] * 0.045).toFixed(3)} .4`}
                data-slot={`${arrival[i]} ${i} ${(6.1 + i * 0.025).toFixed(3)} 1.15 io`}
                data-focus={i === 0 ? "row" : undefined}
              >
                {i === 0 ? <span className="ui-row-active" data-in="8.95 .25" /> : null}
                <span className="ui-score" data-tone={tone(row.score)}>
                  {row.score}
                </span>
                <strong>{row.name}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="ui-panel ui-detail fx-up" data-in="4.2 .6" data-focus="detail">
          <div className="ui-skeleton" data-out="9 .3">
            <span className="fx-shimmer" style={{ width: "46%" }} />
            <span className="fx-shimmer" style={{ width: "28%", height: 8 }} />
            <div>
              {[0, 1, 2, 3].map((i) => (
                <i key={i} className="fx-shimmer" />
              ))}
            </div>
            <b className="fx-shimmer" />
          </div>
          <div className="ui-detail-content" data-in="9.05 .4">
            <header className="ui-panel-header fx-up" data-in="9.05 .5">
              <div>
                <h3>{c.detail.name}</h3>
                <p>{c.detail.meta}</p>
              </div>
            </header>
            <div className="ui-detail-body">
              <dl className="ui-kpis">
                <div className="fx-up" data-in="9.15 .45">
                  <dt>{c.detail.kpis[0]}</dt>
                  <dd>
                    <span data-count="9.2 .9" data-value="38">0</span> / 100
                  </dd>
                </div>
                <div className="fx-up" data-in="9.22 .45">
                  <dt>{c.detail.kpis[1]}</dt>
                  <dd className="is-risk">{c.detail.risk}</dd>
                </div>
                <div className="fx-up" data-in="9.29 .45">
                  <dt>{c.detail.kpis[2]}</dt>
                  <dd>
                    € <span data-count="9.3 1.1" data-value="1.2" data-decimals="1">0</span>M
                  </dd>
                </div>
                <div className="fx-up" data-in="9.36 .45">
                  <dt>{c.detail.kpis[3]}</dt>
                  <dd>
                    <span data-count="9.4 .9" data-value="86">0</span> %
                  </dd>
                </div>
              </dl>
              <section className="ui-chart fx-up" data-in="9.4 .5" data-focus="chart">
                <div className="ui-section-heading">
                  <h4>{c.chart.title}</h4>
                  <span>{c.chart.unit}</span>
                </div>
                <div className="ui-bars">
                  <span className="ui-bars-highlight" data-in="11.4 .4" />
                  {usage.map((v, i) => (
                    <div key={i} className="ui-bar-col">
                      <div className="ui-bar fx-bar" style={{ height: `${(v / max) * 100}%` }} data-in={`${(9.6 + i * 0.08).toFixed(2)} .6`}>
                        <strong className="fx-up" data-in={`${(10 + i * 0.08).toFixed(2)} .3`}>{v}</strong>
                      </div>
                    </div>
                  ))}
                  <svg className="ui-trend" viewBox="0 0 120 100" preserveAspectRatio="none">
                    <path
                      className="fx-draw"
                      pathLength={1}
                      d={`M${usage.map((v, i) => `${i * 10 + 5} ${100 - (v / max) * 100 + 4}`).join(" L")}`}
                      data-in="10.6 1 io"
                    />
                  </svg>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>

      <aside className="ui-assistant">
        <div className="ui-assistant-skin" data-in="3.75 .7" />
        <header className="ui-assistant-header" data-in="3.95 .5">
          <strong>Assistant</strong>
        </header>
        <div className="ui-assistant-body">
          <h3 className="fx-up" data-in="3.65 .6">
            {c.question}
          </h3>
          <div className="ui-swap">
            <p className="ui-status fx-shimmer-text" data-in="4.3 .4" data-out="7.3 .3">
              {c.status}
            </p>
            <p className="ui-answer" data-type="7.4 9.6" data-text={c.answer} />
          </div>
          <div className="ui-insight fx-up" data-in="12.4 .5" data-focus="insight">
            <span className="ui-label">{c.insight.title}</span>
            <ol>
              {c.insight.reasons.map(([title, detail], i) => (
                <li key={title} className="fx-up" data-in={`${(12.6 + i * 0.4).toFixed(2)} .45`}>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </li>
              ))}
            </ol>
            <div className="ui-chips">
              {c.insight.sources.map((s, i) => (
                <span key={s} className="fx-pop" data-in={`${(13.5 + i * 0.12).toFixed(2)} .35 b`}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="ui-input" data-focus="input">
          <span className="ui-input-glow fx-spin-border" data-in="0.6 .8" data-out="3.4 .8" />
          <span className="ui-input-ring" data-in="0.1 1.1 io">
            <i className="fx-spin-border" />
          </span>
          <div className="ui-input-field">
            <span className="ui-placeholder" data-in="0.75 .3" data-out="1.25 .12">
              {c.ask}
            </span>
            <span className="ui-placeholder" data-in="3.7 .3">
              {c.ask}
            </span>
            <span className="fx-caret" data-type="1.3 3 3.6" data-text={c.question} data-in="1.25 .05" data-out="3.4 .2" />
          </div>
          <span className="ui-send" data-in="0.85 .45 b" data-pulse="3.2 .35" data-focus="send">
            ↑
          </span>
        </div>
      </aside>
    </div>
  );
};

/** Stage-space layer: title cards (intro at negative times), end card, notices. */
export const Overlay: React.FC<{ c: Copy }> = ({ c }) => (
  <>
    <div className="mo-titles">
      <h2 className="mo-title" data-out="-3.3 .5 io">
        <span className="mo-title-line is-soft">
          <Rise text={c.titles.hook} at={-5.8} />
        </span>
        <span className="mo-title-line">
          <span className="mo-word">
            <span className="ui-file fx-rise" data-in="-5.4 .7">
              <i>▦</i>
              <span>
                {c.titles.file}
                <span data-count="-4.7 1.2 l" data-from="1" data-value="7">
                  1
                </span>
                .xlsx
              </span>
            </span>
          </span>
        </span>
      </h2>
      <h2 className="mo-title" data-out="-0.55 .5 io">
        <span className="mo-title-line">
          <Rise text={c.titles.turn} at={-2.6} />
        </span>
      </h2>
      <span className="mo-backdrop mo-paper" data-in="15.8 .8 io" />
      <div className="ui-end">
        <span className="ui-end-logo fx-pop" data-in="16.2 .6 b" />
        <h2 className="mo-title">
          <span className="mo-title-line">
            <Rise text={c.titles.end} at={16.6} />
          </span>
        </h2>
      </div>
    </div>
    <span className="ui-disclaimer" data-in="4.2 .5" data-out="15.4 .4">
      {c.disclaimer}
    </span>
  </>
);
