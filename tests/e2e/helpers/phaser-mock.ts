export class MockPostFXPipeline {
  public game: unknown;
  public name: string;
  constructor(config: { game: unknown; name: string }) {
    this.game = config.game;
    this.name = config.name;
  }
  set1f() {}
  set2f() {}
  set3f() {}
  set4f() {}
}

export class MockSinglePipeline {
  public config: unknown;
  public vertexCount = 0;
  constructor(config: unknown) {
    this.config = config;
  }
  flush() {
    this.vertexCount = 0;
  }
  set1f() {}
  set2f() {}
  set3f() {}
  set4f() {}
}

export class MockWebGLRenderer {}

export class Scene {
  constructor(_config?: unknown) {}
}

export const BlendModes = {
  NORMAL: 0,
  ADD: 1,
  MULTIPLY: 2,
  SCREEN: 3,
};

export const Scenes = {
  Events: {
    SHUTDOWN: 'shutdown',
  },
};

export const Renderer = {
  WebGL: {
    WebGLRenderer: MockWebGLRenderer,
    Pipelines: {
      PostFXPipeline: MockPostFXPipeline,
      SinglePipeline: MockSinglePipeline,
    },
  },
};

export const Input = {
  Keyboard: {
    KeyCodes: {
      W: 87,
      A: 65,
      S: 83,
      D: 68,
      E: 69,
      Q: 81,
      R: 82,
      SPACE: 32,
      ESC: 27,
      TAB: 9,
      ONE: 49,
      TWO: 50,
    },
  },
};

export const Math = {
  Clamp: (v: number, min: number, max: number) =>
    globalThis.Math.max(min, globalThis.Math.min(max, v)),
  Linear: (a: number, b: number, t: number) => a + (b - a) * t,
};

const PhaserMock = {
  Scene,
  BlendModes,
  Scenes,
  Renderer,
  Input,
  Math,
};

export default PhaserMock;
