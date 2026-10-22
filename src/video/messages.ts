export interface VideoOpen {
  type: "open";
  file: File;
  maxWidth: number;
  maxHeight: number;
  maxSeconds: number;
  bufferFrames: number;
}

export interface VideoUse {
  type: "use";
  start: number;
  seconds: number;
  epoch: number;
}

export interface VideoPlay {
  type: "play";
  time: number;
}

export interface VideoPause {
  type: "pause";
}

export interface VideoSeek {
  type: "seek";
  time: number;
  epoch: number;
}

export interface VideoAck {
  type: "ack";
}

export interface VideoClose {
  type: "close";
}

export type VideoCommand = VideoOpen | VideoUse | VideoPlay | VideoPause | VideoSeek | VideoAck | VideoClose;

export interface VideoInfoMessage {
  type: "info";
  duration: number;
  displayWidth: number;
  displayHeight: number;
  frameRate: number;
  tooLong: boolean;
}

export interface VideoFrameMessage {
  type: "frame";
  bitmap: ImageBitmap;
  time: number;
  index: number;
  rangeStart: number;
  rangeEnd: number;
  frameCount: number;
  epoch: number;
}

export interface VideoEndedMessage {
  type: "ended";
}

export interface VideoErrorMessage {
  type: "error";
  message: string;
}

export type VideoEvent = VideoInfoMessage | VideoFrameMessage | VideoEndedMessage | VideoErrorMessage;
