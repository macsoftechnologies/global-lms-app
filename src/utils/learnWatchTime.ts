import {
  CourseLesson,
  CourseProgressData,
  WatchTimeUpdateResponse,
} from '../types';

export const REWATCH_RESTRICTED_MESSAGE =
  'You have already completed this video. Rewatching is not available.';

export const CURRICULUM_LOCKED_MESSAGE =
  'This lesson is currently locked by course prerequisites.';

export type PlayerLifecycleEventType =
  | 'ready'
  | 'duration'
  | 'play'
  | 'pause'
  | 'buffering'
  | 'timeupdate'
  | 'seeked'
  | 'ended';

export interface PlayerTelemetryEvent {
  source: 'lms-player';
  type: PlayerLifecycleEventType;
  currentTime?: number;
  duration?: number;
  percent?: number;
}

export interface VideoSourceInfo {
  type: 'vimeo' | 'youtube' | 'direct' | 'none';
  embedUrl: string;
  html: string;
}

export interface EvaluatedLessonWatchState {
  completed: boolean;
  watchedSeconds: number;
  isWatchRestricted: boolean;
  isCurriculumLocked: boolean;
  restrictionReason: string;
}

/**
 * Parses a duration string ("MM:SS", "HH:MM:SS", or numeric seconds) into seconds.
 * Returns 0 when absent or unparseable.
 */
export function parseDurationStringToSeconds(raw?: string | number | null): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  }
  if (!raw || typeof raw !== 'string') return 0;
  const trimmed = raw.trim();
  if (!trimmed) return 0;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const val = Math.floor(Number(trimmed));
    return Number.isFinite(val) && val > 0 ? val : 0;
  }

  const parts = trimmed.split(':').map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return 0;

  if (parts.length === 2) {
    return Math.floor(parts[0] * 60 + parts[1]);
  }
  if (parts.length === 3) {
    return Math.floor(parts[0] * 3600 + parts[1] * 60 + parts[2]);
  }
  return 0;
}

/**
 * Extracts genuine backend lesson duration in seconds before UI fallback strings are applied.
 */
export function parseBackendLessonDurationSeconds(
  lesson?: Pick<CourseLesson, 'duration' | 'durationMinutes' | 'durationSeconds'> | null
): number {
  if (!lesson) return 0;
  if (typeof lesson.durationSeconds === 'number' && lesson.durationSeconds > 0) {
    return Math.floor(lesson.durationSeconds);
  }
  if (typeof lesson.durationMinutes === 'number' && lesson.durationMinutes > 0) {
    return Math.floor(lesson.durationMinutes * 60);
  }
  return parseDurationStringToSeconds(lesson.duration);
}

/**
 * Formats seconds cleanly into MM:SS or H:MM:SS.
 */
export function formatClockSeconds(secs: number): string {
  const safe = Number.isFinite(secs) && secs > 0 ? Math.floor(secs) : 0;
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const remSecs = safe % 60;
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
}

/**
 * Resolves authoritative completion, watched seconds, and one-time viewing restrictions
 * strictly from backend course progress and lesson metadata (never local-only storage).
 */
export function evaluateLessonWatchState(
  lesson: CourseLesson | null | undefined,
  courseProgress?: CourseProgressData | null,
  watchTimeOverride?: WatchTimeUpdateResponse | null,
  backendDurationSeconds?: number
): EvaluatedLessonWatchState {
  if (!lesson) {
    return {
      completed: false,
      watchedSeconds: 0,
      isWatchRestricted: false,
      isCurriculumLocked: false,
      restrictionReason: '',
    };
  }

  const lessonId = lesson.id;
  const completedSet = new Set<string>([
    ...(courseProgress?.completedLessons || []),
    ...(courseProgress?.completedLessonIds || []),
  ]);
  const progressEntry = courseProgress?.lessonProgressById?.[lessonId];

  const isCurriculumLocked = Boolean(
    lesson.isLocked ||
      lesson.locked ||
      progressEntry?.isLocked ||
      String(lesson.accessStatus || '').toUpperCase() === 'LOCKED'
  );

  const explicitWatchDeny = Boolean(
    lesson.canWatch === false ||
      lesson.rewatchAllowed === false ||
      lesson.allowRewatch === false ||
      lesson.watchLimitReached === true ||
      lesson.maxWatchesReached === true ||
      lesson.viewingRestricted === true ||
      progressEntry?.canWatch === false ||
      progressEntry?.rewatchAllowed === false ||
      progressEntry?.watchLimitReached === true ||
      watchTimeOverride?.canWatch === false ||
      watchTimeOverride?.rewatchAllowed === false ||
      watchTimeOverride?.allowRewatch === false ||
      watchTimeOverride?.watchLimitReached === true ||
      watchTimeOverride?.maxWatchesReached === true ||
      watchTimeOverride?.viewingRestricted === true
  );

  const completed = Boolean(
    watchTimeOverride?.completed ||
      watchTimeOverride?.isCompleted ||
      progressEntry?.completed ||
      completedSet.has(lessonId) ||
      lesson.completed ||
      lesson.isCompleted ||
      lesson.isWatched ||
      lesson.fullyWatched ||
      watchTimeOverride?.isWatched ||
      watchTimeOverride?.fullyWatched
  );

  const watchedSeconds = Math.max(
    0,
    Math.floor(
      Math.max(
        Number(watchTimeOverride?.watchedSeconds || 0),
        Number(progressEntry?.watchedSeconds || 0),
        Number(courseProgress?.watchedSecondsByLesson?.[lessonId] || 0),
        Number(lesson.watchedSeconds || 0)
      ) || 0
    )
  );

  const genuineDurationSec =
    typeof backendDurationSeconds === 'number' && backendDurationSeconds > 0
      ? Math.floor(backendDurationSeconds)
      : parseBackendLessonDurationSeconds(lesson);

  const fullyWatchedByBackendDuration =
    genuineDurationSec > 0 && watchedSeconds >= Math.max(1, genuineDurationSec - 1);

  const isWatchRestricted =
    isCurriculumLocked || explicitWatchDeny || completed || fullyWatchedByBackendDuration;

  let restrictionReason = '';
  if (isWatchRestricted) {
    if (watchTimeOverride?.message && explicitWatchDeny) {
      restrictionReason = watchTimeOverride.message;
    } else if (isCurriculumLocked && !completed && !fullyWatchedByBackendDuration) {
      restrictionReason = CURRICULUM_LOCKED_MESSAGE;
    } else {
      restrictionReason = REWATCH_RESTRICTED_MESSAGE;
    }
  }

  return {
    completed,
    watchedSeconds,
    isWatchRestricted,
    isCurriculumLocked,
    restrictionReason,
  };
}

/**
 * Detects whether a watch-time API error represents a backend rewatch/already-watched block.
 */
export function isBackendWatchRestrictionError(
  status?: number,
  errorMessage?: string,
  data?: WatchTimeUpdateResponse | Record<string, unknown> | null
): boolean {
  if (status === 403 || status === 409) return true;
  if (data && typeof data === 'object') {
    const rec = data as Record<string, unknown>;
    if (
      rec.canWatch === false ||
      rec.rewatchAllowed === false ||
      rec.allowRewatch === false ||
      rec.watchLimitReached === true ||
      rec.maxWatchesReached === true ||
      rec.viewingRestricted === true
    ) {
      return true;
    }
  }
  if (typeof errorMessage === 'string' && errorMessage.trim().length > 0) {
    return /already\s*(watched|completed|viewed)|rewatch|watch\s*limit|view(ing)?\s*limit|only\s*once|one[\s-]*time|not\s*permitted/i.test(
      errorMessage
    );
  }
  return false;
}

/**
 * Accumulates elapsed active playback milliseconds without counting paused,
 * unfocused, buffering, or OS-suspended time.
 */
export function accumulateActivePlaybackMs(params: {
  currentMs: number;
  lastSampleMs: number | null;
  nowMs: number;
  isActivelyPlaying: boolean;
  isAppActive: boolean;
  isScreenFocused: boolean;
  isBuffering: boolean;
  maxStepMs?: number;
}): { nextTotalMs: number; nextSampleMs: number | null; addedMs: number } {
  const {
    currentMs,
    lastSampleMs,
    nowMs,
    isActivelyPlaying,
    isAppActive,
    isScreenFocused,
    isBuffering,
    maxStepMs = 2000,
  } = params;

  if (!isActivelyPlaying || !isAppActive || !isScreenFocused || isBuffering) {
    return {
      nextTotalMs: currentMs,
      nextSampleMs: null,
      addedMs: 0,
    };
  }

  if (lastSampleMs === null) {
    return {
      nextTotalMs: currentMs,
      nextSampleMs: nowMs,
      addedMs: 0,
    };
  }

  const rawDelta = Math.max(0, nowMs - lastSampleMs);
  const addedMs = Math.min(rawDelta, maxStepMs);
  return {
    nextTotalMs: currentMs + addedMs,
    nextSampleMs: nowMs,
    addedMs,
  };
}

/**
 * Determines whether a watch-time PATCH request should be emitted now,
 * enforcing batching/throttling during playback and final-flush on stop/pause.
 */
export function shouldSyncWatchTime(params: {
  totalWatchedSeconds: number;
  lastSentSeconds: number;
  lastSyncAtMs: number;
  nowMs: number;
  forceFlush?: boolean;
  minDeltaSeconds?: number;
  minIntervalMs?: number;
}): boolean {
  const {
    totalWatchedSeconds,
    lastSentSeconds,
    lastSyncAtMs,
    nowMs,
    forceFlush = false,
    minDeltaSeconds = 5,
    minIntervalMs = 5000,
  } = params;

  const floored = Math.max(0, Math.floor(totalWatchedSeconds));
  if (floored <= 0 || floored <= lastSentSeconds) {
    return false;
  }

  if (forceFlush) {
    return true;
  }

  return floored - lastSentSeconds >= minDeltaSeconds && nowMs - lastSyncAtMs >= minIntervalMs;
}

/**
 * Parses postMessage events emitted directly from Vimeo or YouTube iframes on Web.
 */
export function parseRawIframePostMessage(
  rawData: unknown,
  origin: string,
  prevState: { lastTime: number; lastDuration: number }
): PlayerTelemetryEvent | null {
  if (!rawData) return null;

  let parsed: any = rawData;
  if (typeof rawData === 'string') {
    const trimmed = rawData.trim();
    if (!trimmed.startsWith('{')) return null;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object') return null;

  if (parsed.source === 'lms-player' && parsed.type) {
    return parsed as PlayerTelemetryEvent;
  }

  const normalizedOrigin = (origin || '').toLowerCase();

  // Vimeo iframe protocol
  if (normalizedOrigin.includes('vimeo.com')) {
    const evt = parsed.event;
    const payload = parsed.data || {};
    if (evt === 'ready') {
      return { source: 'lms-player', type: 'ready' };
    }
    if (parsed.method === 'getDuration' && typeof parsed.value === 'number') {
      return { source: 'lms-player', type: 'duration', duration: parsed.value };
    }
    if (evt === 'play') {
      return {
        source: 'lms-player',
        type: 'play',
        currentTime: typeof payload.seconds === 'number' ? payload.seconds : prevState.lastTime,
        duration: typeof payload.duration === 'number' ? payload.duration : prevState.lastDuration,
      };
    }
    if (evt === 'pause') {
      return {
        source: 'lms-player',
        type: 'pause',
        currentTime: typeof payload.seconds === 'number' ? payload.seconds : prevState.lastTime,
        duration: typeof payload.duration === 'number' ? payload.duration : prevState.lastDuration,
      };
    }
    if (evt === 'bufferstart') {
      return {
        source: 'lms-player',
        type: 'buffering',
        currentTime: prevState.lastTime,
        duration: prevState.lastDuration,
      };
    }
    if (evt === 'finish' || evt === 'ended') {
      return {
        source: 'lms-player',
        type: 'ended',
        currentTime:
          typeof payload.duration === 'number'
            ? payload.duration
            : prevState.lastDuration || prevState.lastTime,
        duration: typeof payload.duration === 'number' ? payload.duration : prevState.lastDuration,
      };
    }
    if (evt === 'seek') {
      return {
        source: 'lms-player',
        type: 'seeked',
        currentTime: typeof payload.seconds === 'number' ? payload.seconds : prevState.lastTime,
        duration: typeof payload.duration === 'number' ? payload.duration : prevState.lastDuration,
      };
    }
    if (evt === 'timeupdate') {
      return {
        source: 'lms-player',
        type: 'timeupdate',
        currentTime: typeof payload.seconds === 'number' ? payload.seconds : prevState.lastTime,
        duration: typeof payload.duration === 'number' ? payload.duration : prevState.lastDuration,
        percent: typeof payload.percent === 'number' ? payload.percent : undefined,
      };
    }
  }

  // YouTube / YouTube-nocookie iframe protocol
  if (normalizedOrigin.includes('youtube.com') || normalizedOrigin.includes('youtube-nocookie.com')) {
    if (parsed.event === 'infoDelivery' && parsed.info && typeof parsed.info === 'object') {
      const info = parsed.info as Record<string, any>;
      const duration =
        typeof info.duration === 'number' && info.duration > 0
          ? info.duration
          : prevState.lastDuration;
      const currentTime =
        typeof info.currentTime === 'number' ? info.currentTime : prevState.lastTime;

      if (typeof info.playerState === 'number') {
        if (info.playerState === 1) {
          return { source: 'lms-player', type: 'play', currentTime, duration };
        }
        if (info.playerState === 2) {
          return { source: 'lms-player', type: 'pause', currentTime, duration };
        }
        if (info.playerState === 3) {
          return { source: 'lms-player', type: 'buffering', currentTime, duration };
        }
        if (info.playerState === 0) {
          return {
            source: 'lms-player',
            type: 'ended',
            currentTime: duration > 0 ? duration : currentTime,
            duration,
          };
        }
      }

      if (typeof info.currentTime === 'number') {
        const isJump = Math.abs(info.currentTime - prevState.lastTime) > 2.5;
        return {
          source: 'lms-player',
          type: isJump ? 'seeked' : 'timeupdate',
          currentTime: info.currentTime,
          duration,
        };
      }

      if (typeof info.duration === 'number' && info.duration > 0) {
        return {
          source: 'lms-player',
          type: 'duration',
          duration: info.duration,
          currentTime,
        };
      }
    }
  }

  return null;
}

/**
 * Resolves backend video URLs (Vimeo, YouTube, direct MP4/HLS) into safe embeddable
 * HTML + URL with native WebView telemetry event bridging (`play`, `pause`, `timeupdate`, `ended`).
 */
export function resolveTrackedVideoSource(
  rawUrl?: string,
  initialSeekSeconds = 0
): VideoSourceInfo {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { type: 'none', embedUrl: '', html: '' };
  }

  let url = rawUrl.trim();
  if (url.toLowerCase().startsWith('<iframe')) {
    const match = url.match(/src=["'](.*?)["']/);
    if (match && match[1]) url = match[1];
  }

  const seekSec = Math.max(0, Math.floor(initialSeekSeconds || 0));

  // 1. Vimeo Detection & Normalization
  let vimeoId = '';
  let vimeoHash = '';

  if (url.includes('vimeo.com') || /^\d{7,11}$/.test(url)) {
    if (/^\d{7,11}$/.test(url)) {
      vimeoId = url;
    } else {
      if (url.includes('?')) {
        const queryPart = url.split('?')[1] || '';
        const hMatch = queryPart.match(/(?:^|&)h=([a-zA-Z0-9]+)/);
        if (hMatch && hMatch[1]) {
          vimeoHash = hMatch[1];
        }
      }

      const pathMatch = url.match(/(?:video\/|vimeo\.com\/)(\d+)(?:\/([a-zA-Z0-9]+))?/);
      if (pathMatch && pathMatch[1]) {
        vimeoId = pathMatch[1];
        if (!vimeoHash && pathMatch[2]) {
          vimeoHash = pathMatch[2];
        }
      }
    }

    if (vimeoId) {
      const queryParams = [
        'autoplay=1',
        'api=1',
        'player_id=lms_vimeo_player',
        'title=0',
        'byline=0',
        'portrait=0',
        'dnt=1',
        'playsinline=1',
      ];
      if (vimeoHash) {
        queryParams.unshift(`h=${vimeoHash}`);
      }
      const timeFragment = seekSec > 0 ? `#t=${seekSec}s` : '';
      const embedUrl = `https://player.vimeo.com/video/${vimeoId}?${queryParams.join('&')}${timeFragment}`;
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"><style>*{margin:0;padding:0;box-sizing:border-box;}html,body{width:100%;height:100%;background:#000000;overflow:hidden;}iframe{width:100%;height:100%;border:0;position:absolute;top:0;left:0;}</style></head><body><iframe id="lms_vimeo_player" src="${embedUrl}" frameborder="0" allow="autoplay;fullscreen;picture-in-picture;encrypted-media" allowfullscreen></iframe><script>(function(){
var iframe=document.getElementById('lms_vimeo_player');
var listenersAttached=false;
function emit(p){try{if(window.ReactNativeWebView&&window.ReactNativeWebView.postMessage){window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({source:'lms-player'},p)));}}catch(e){}}
function postVimeo(method,value){if(!iframe||!iframe.contentWindow)return;var msg={method:method};if(value!==undefined)msg.value=value;iframe.contentWindow.postMessage(JSON.stringify(msg),'https://player.vimeo.com');}
function attachVimeoListeners(){if(listenersAttached)return;listenersAttached=true;['play','pause','finish','ended','timeupdate','seek','bufferstart','bufferend'].forEach(function(ev){postVimeo('addEventListener',ev);});postVimeo('getDuration');}
window.__playLmsVideo=function(){postVimeo('play');};
window.__pauseLmsVideo=function(){postVimeo('pause');};
iframe.addEventListener('load',function(){setTimeout(attachVimeoListeners,400);});
window.addEventListener('message',function(event){if(!event||!event.origin||event.origin.indexOf('vimeo.com')===-1)return;var data=event.data;if(typeof data==='string'){try{data=JSON.parse(data);}catch(e){return;}}if(!data||typeof data!=='object')return;
if(data.event==='ready'){listenersAttached=false;attachVimeoListeners();emit({type:'ready'});return;}
if(data.method==='getDuration'&&typeof data.value==='number'){emit({type:'duration',duration:data.value});return;}
var d=data.data||{};
if(data.event==='play'){emit({type:'play',currentTime:d.seconds,duration:d.duration});}
else if(data.event==='pause'){emit({type:'pause',currentTime:d.seconds,duration:d.duration});}
else if(data.event==='bufferstart'){emit({type:'buffering'});}
else if(data.event==='finish'||data.event==='ended'){emit({type:'ended',currentTime:d.duration,duration:d.duration});}
else if(data.event==='seek'){emit({type:'seeked',currentTime:d.seconds,duration:d.duration});}
else if(data.event==='timeupdate'){emit({type:'timeupdate',currentTime:d.seconds,duration:d.duration,percent:d.percent});}
});})();</script></body></html>`;

      return { type: 'vimeo', embedUrl, html };
    }
  }

  // 2. YouTube
  let ytId = '';
  if (url.includes('youtube.com/embed/')) {
    ytId = url.split('youtube.com/embed/')[1].split(/[?#]/)[0];
  } else if (url.includes('youtube.com/watch')) {
    const v = url.split('v=')[1];
    ytId = v ? v.split('&')[0] : '';
  } else if (url.includes('youtu.be/')) {
    ytId = url.split('youtu.be/')[1].split(/[?#]/)[0];
  }
  if (ytId) {
    const ytParams = [
      'autoplay=1',
      'playsinline=1',
      'rel=0',
      'modestbranding=1',
      'enablejsapi=1',
      'origin=https://launchpaad.tech',
    ];
    if (seekSec > 0) {
      ytParams.push(`start=${seekSec}`);
    }
    const embedUrl = `https://www.youtube-nocookie.com/embed/${ytId}?${ytParams.join('&')}`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"><style>*{margin:0;padding:0;box-sizing:border-box;}html,body{width:100%;height:100%;background:#000000;overflow:hidden;}iframe{width:100%;height:100%;border:0;position:absolute;top:0;left:0;}</style></head><body><iframe id="lms_yt_player" src="${embedUrl}" frameborder="0" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe><script>(function(){
var iframe=document.getElementById('lms_yt_player');
var lastTime=0;
var lastDur=0;
var listeningTimer=null;
function emit(p){try{if(window.ReactNativeWebView&&window.ReactNativeWebView.postMessage){window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({source:'lms-player'},p)));}}catch(e){}}
function sendYt(payload){if(!iframe||!iframe.contentWindow)return;iframe.contentWindow.postMessage(JSON.stringify(payload),'*');}
function startListening(){sendYt({event:'listening',id:'lms_yt_player'});}
window.__playLmsVideo=function(){sendYt({event:'command',func:'playVideo',args:[]});};
window.__pauseLmsVideo=function(){sendYt({event:'command',func:'pauseVideo',args:[]});};
iframe.addEventListener('load',function(){startListening();listeningTimer=setInterval(startListening,600);setTimeout(function(){if(listeningTimer)clearInterval(listeningTimer);},5000);});
window.addEventListener('message',function(event){if(!event||!event.origin||(event.origin.indexOf('youtube.com')===-1&&event.origin.indexOf('youtube-nocookie.com')===-1))return;var data=event.data;if(typeof data==='string'){try{data=JSON.parse(data);}catch(e){return;}}if(!data||typeof data!=='object')return;
if(data.event==='infoDelivery'&&data.info){if(listeningTimer){clearInterval(listeningTimer);listeningTimer=null;}var info=data.info;
if(typeof info.duration==='number'&&info.duration>0){lastDur=info.duration;}
if(typeof info.playerState==='number'){
var tNow=typeof info.currentTime==='number'?info.currentTime:lastTime;
if(info.playerState===1){emit({type:'play',currentTime:tNow,duration:lastDur});}
else if(info.playerState===2){emit({type:'pause',currentTime:tNow,duration:lastDur});}
else if(info.playerState===3){emit({type:'buffering',currentTime:tNow,duration:lastDur});}
else if(info.playerState===0){emit({type:'ended',currentTime:lastDur||tNow,duration:lastDur});}
}
if(typeof info.currentTime==='number'){var jump=Math.abs(info.currentTime-lastTime)>2.5;lastTime=info.currentTime;emit({type:jump?'seeked':'timeupdate',currentTime:info.currentTime,duration:lastDur});}
else if(typeof info.duration==='number'&&info.duration>0){emit({type:'duration',duration:info.duration,currentTime:lastTime});}
}});})();</script></body></html>`;
    return { type: 'youtube', embedUrl, html };
  }

  // 3. Direct Video file (MP4, HLS/m3u8, WebM)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const escapedUrl = url.replace(/"/g, '&quot;');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"><style>*{margin:0;padding:0;box-sizing:border-box;}html,body{width:100%;height:100%;background:#000000;overflow:hidden;display:flex;align-items:center;justify-content:center;}video{width:100%;height:100%;object-fit:contain;}</style></head><body><video id="lms_direct_video" src="${escapedUrl}" controls autoplay playsinline controlsList="nodownload noplaybackrate" disablePictureInPicture oncontextmenu="return false;" style="width:100%;height:100%;"></video><script>(function(){
var v=document.getElementById('lms_direct_video');
var initialSeek=${seekSec};
var didSeek=false;
function emit(p){try{if(window.ReactNativeWebView&&window.ReactNativeWebView.postMessage){window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({source:'lms-player'},p)));}}catch(e){}}
window.__playLmsVideo=function(){try{v&&v.play();}catch(e){}};
window.__pauseLmsVideo=function(){try{v&&v.pause();}catch(e){}};
v.addEventListener('loadedmetadata',function(){if(!didSeek&&initialSeek>0&&v.duration>0&&initialSeek<v.duration-2){didSeek=true;v.currentTime=initialSeek;}emit({type:'duration',duration:v.duration||0,currentTime:v.currentTime||0});});
v.addEventListener('playing',function(){emit({type:'play',currentTime:v.currentTime||0,duration:v.duration||0});});
v.addEventListener('play',function(){emit({type:'play',currentTime:v.currentTime||0,duration:v.duration||0});});
v.addEventListener('pause',function(){emit({type:'pause',currentTime:v.currentTime||0,duration:v.duration||0});});
v.addEventListener('waiting',function(){emit({type:'buffering',currentTime:v.currentTime||0,duration:v.duration||0});});
v.addEventListener('timeupdate',function(){emit({type:'timeupdate',currentTime:v.currentTime||0,duration:v.duration||0});});
v.addEventListener('seeked',function(){emit({type:'seeked',currentTime:v.currentTime||0,duration:v.duration||0});});
v.addEventListener('ended',function(){emit({type:'ended',currentTime:v.duration||v.currentTime||0,duration:v.duration||0});});
})();</script></body></html>`;
    return { type: 'direct', embedUrl: url, html };
  }

  return { type: 'none', embedUrl: '', html: '' };
}
