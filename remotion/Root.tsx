import React from 'react';
import { Composition } from 'remotion';
import { TutorialDemo, getDurationInFrames } from './TutorialDemo';
import { TechExplainer, getTechDurationInFrames } from './TechExplainer';
import type { RemotionVideoInput } from './types';

const defaultInput: RemotionVideoInput = {
  project: {
    id: 'preview',
    title: 'Remotion 视频工厂预览',
    template: 'tech-explainer-v1',
    aspectRatio: '9:16',
    visualPreset: 'clarity-blue'
  },
  scenes: [
    {
      id: 'preview_scene_1',
      order: 1,
      shotType: 'title',
      visualType: 'slide',
      visualPrompt: '展示 Remotion composition 接管视频画面、节奏和字幕。',
      voiceover: '这是新的 Remotion 视频制作链路预览。',
      subtitle: 'Remotion 视频工厂预览',
      durationSec: 4
    },
    {
      id: 'preview_scene_2',
      order: 2,
      shotType: 'step',
      visualType: 'caption',
      visualPrompt: '用数据分镜驱动画面，后续可以替换为更丰富的模板。',
      voiceover: '每个镜头都来自项目分镜数据，后续可以继续升级视觉模板。',
      subtitle: '分镜数据驱动画面',
      durationSec: 5
    }
  ]
};

function TutorialDemoComposition(props: Record<string, unknown>) {
  return <TutorialDemo {...(props as unknown as RemotionVideoInput)} />;
}

function TechExplainerComposition(props: Record<string, unknown>) {
  return <TechExplainer {...(props as unknown as RemotionVideoInput)} />;
}

function getRenderSize(input: RemotionVideoInput) {
  return input.project.aspectRatio === '16:9'
    ? { width: 1920, height: 1080 }
    : { width: 1080, height: 1920 };
}

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="TutorialDemo"
        component={TutorialDemoComposition}
        durationInFrames={getDurationInFrames(defaultInput)}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ ...defaultInput, project: { ...defaultInput.project, template: 'tutorial-demo-v1' } } as unknown as Record<string, unknown>}
        calculateMetadata={({ props }) => ({
          durationInFrames: getDurationInFrames(props as unknown as RemotionVideoInput),
          fps: 30,
          ...getRenderSize(props as unknown as RemotionVideoInput)
        })}
      />
      <Composition
        id="TechExplainer"
        component={TechExplainerComposition}
        durationInFrames={getTechDurationInFrames(defaultInput)}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultInput as unknown as Record<string, unknown>}
        calculateMetadata={({ props }) => ({
          durationInFrames: getTechDurationInFrames(props as unknown as RemotionVideoInput),
          fps: 30,
          ...getRenderSize(props as unknown as RemotionVideoInput)
        })}
      />
    </>
  );
}
