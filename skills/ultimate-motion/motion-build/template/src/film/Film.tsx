import { Soundtrack } from "../engine/Soundtrack";
import { Stage } from "../engine/Stage";
import { copy } from "./copy";
import { AUDIO, LOCALE, NUMBER_LOCALE, STORY, SYNC } from "./story";
import "./film.css";
import { Overlay, World } from "./Scene";

export const Film: React.FC<{ format: "landscape" | "portrait" }> = ({ format }) => {
  const c = copy[LOCALE as keyof typeof copy];
  return (
    <>
      <Stage
        story={STORY}
        sync={SYNC}
        format={format}
        locale={NUMBER_LOCALE}
        className="film"
        world={<World c={c} />}
        overlay={<Overlay c={c} />}
      />
      <Soundtrack config={AUDIO} sync={SYNC} clicks={STORY.clicks} />
    </>
  );
};
