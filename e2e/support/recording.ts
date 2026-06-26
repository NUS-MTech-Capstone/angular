import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { WebDriver } from 'selenium-webdriver';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { config } from '../config';
import { activateBrowserWindow } from './foreground';

let suiteRecorder: ChildProcessWithoutNullStreams | null = null;
let suiteRecordingPath = '';

interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildRecordingPath(label: string): string {
  const dir = join(process.cwd(), 'e2e', 'recordings');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeLabel = label.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-');
  return join(dir, `${safeLabel}-${stamp}.mp4`);
}

function encodeArgs(outputPath: string): string[] {
  const framerate = config.presentation ? '24' : '15';
  const preset = config.presentation ? 'medium' : 'ultrafast';

  return [
    '-c:v',
    'libx264',
    '-preset',
    preset,
    '-pix_fmt',
    'yuv420p',
    outputPath,
  ];
}

function fullScreenCaptureArgs(outputPath: string): string[] {
  const framerate = config.presentation ? '24' : '15';

  if (process.platform === 'win32') {
    return [
      '-y',
      '-f',
      'gdigrab',
      '-framerate',
      framerate,
      '-draw_mouse',
      '1',
      '-i',
      'desktop',
      ...encodeArgs(outputPath),
    ];
  }

  return [
    '-y',
    '-f',
    'x11grab',
    '-framerate',
    framerate,
    '-i',
    ':0.0',
    ...encodeArgs(outputPath),
  ];
}

function windowCaptureArgs(rect: WindowRect, outputPath: string): string[] {
  const framerate = config.presentation ? '24' : '15';
  const width = Math.max(2, Math.round(rect.width));
  const height = Math.max(2, Math.round(rect.height));
  const x = Math.max(0, Math.round(rect.x));
  const y = Math.max(0, Math.round(rect.y));

  if (process.platform === 'win32') {
    return [
      '-y',
      '-f',
      'gdigrab',
      '-framerate',
      framerate,
      '-offset_x',
      String(x),
      '-offset_y',
      String(y),
      '-video_size',
      `${width}x${height}`,
      '-draw_mouse',
      '1',
      '-i',
      'desktop',
      ...encodeArgs(outputPath),
    ];
  }

  return [
    '-y',
    '-f',
    'x11grab',
    '-framerate',
    framerate,
    '-video_size',
    `${width}x${height}`,
    '-i',
    `:0.0+${x},${y}`,
    ...encodeArgs(outputPath),
  ];
}

async function waitForBrowserWindowReady(driver: WebDriver): Promise<void> {
  await driver.manage().window().maximize();

  await driver.wait(async () => {
    const readyState = await driver.executeScript<string>(
      'return document.readyState',
    );
    return readyState === 'complete' || readyState === 'interactive';
  }, config.pageLoadTimeoutMs);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const rect = await driver.manage().window().getRect();
    if (rect.width >= 800 && rect.height >= 600) {
      await sleep(400);
      await activateBrowserWindow(driver);
      return;
    }
    await sleep(150);
  }
}

export async function startBrowserRecording(driver: WebDriver): Promise<string> {
  if (!config.record || config.headless || suiteRecorder) {
    return suiteRecordingPath;
  }

  await waitForBrowserWindowReady(driver);

  const label = config.presentation ? 'e2e-presentation' : 'e2e-suite';
  suiteRecordingPath = buildRecordingPath(label);

  const ffmpegArgs = config.fullScreenRecord
    ? fullScreenCaptureArgs(suiteRecordingPath)
    : windowCaptureArgs(await driver.manage().window().getRect(), suiteRecordingPath);

  suiteRecorder = spawn(ffmpegInstaller.path, ffmpegArgs, {
    stdio: ['pipe', 'ignore', 'pipe'],
  });

  suiteRecorder.stderr?.on('data', () => {
    // ffmpeg progress goes to stderr; ignore to keep test output clean.
  });

  if (config.fullScreenRecord) {
    console.log(`Recording full screen to ${suiteRecordingPath}`);
  } else {
    const rect = await driver.manage().window().getRect();
    console.log(
      `Recording browser window (${rect.width}x${rect.height}) to ${suiteRecordingPath}`,
    );
  }

  if (config.recordLeadInMs > 0) {
    await sleep(config.recordLeadInMs);
  }

  return suiteRecordingPath;
}

export async function stopSuiteRecording(): Promise<string | null> {
  if (!suiteRecorder) {
    return null;
  }

  suiteRecorder.stdin.write('q');
  await new Promise<void>((resolve) => {
    suiteRecorder!.on('close', () => resolve());
    setTimeout(() => {
      suiteRecorder?.kill();
      resolve();
    }, 5000);
  });

  const path = suiteRecordingPath;
  suiteRecorder = null;
  suiteRecordingPath = '';
  return path;
}

export function getActiveRecordingPath(): string {
  return suiteRecordingPath;
}

export function isRecordingActive(): boolean {
  return suiteRecorder !== null;
}
