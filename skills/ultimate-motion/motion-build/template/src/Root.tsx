import { Composition } from "remotion";
import { Film } from "./film/Film";
import { SYNC } from "./film/story";

const FPS = 30;
// The composition runs on the playback clock: from the sync map's first to last point.
const duration = Math.ceil((SYNC[SYNC.length - 1][0] - SYNC[0][0]) * FPS);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Film-landscape" component={Film} width={1920} height={1080} fps={FPS} durationInFrames={duration} defaultProps={{ format: "landscape" as const }} />
    <Composition id="Film-portrait" component={Film} width={1080} height={1920} fps={FPS} durationInFrames={duration} defaultProps={{ format: "portrait" as const }} />
  </>
);
