import { useState } from 'react';
import { exerciseMedia, youtubeEmbedUrl } from '../../catalog/media';
import type { Locale } from '../../domain/models';

export function ExerciseMedia({ exerciseId, exerciseName, locale }: { exerciseId: string; exerciseName: string; locale: Locale }) {
 const media = exerciseMedia[exerciseId];
 const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle');
 const [imageFailed, setImageFailed] = useState(false);
 const zh = locale === 'zh';
 if (!media) return null;
 const url = media.videoId && youtubeEmbedUrl(media.videoId);
 return <section aria-label={zh ? `${exerciseName} 媒体参考` : `${exerciseName} media reference`}>
  {!imageFailed && <img src={media.illustration} alt={zh ? `${exerciseName} 原创示意图` : `${exerciseName} original illustration`} width="280" height="160" style={{ maxWidth: '100%', height: 'auto' }} onError={() => setImageFailed(true)} />}
  {imageFailed && <p role="status">{zh ? '示意图不可用，仍可阅读动作步骤。' : 'Illustration unavailable. Written steps remain available.'}</p>}
  <p className="muted">{zh ? '原创示意图；动作姿势尚未经专业审核。' : 'Original illustration; movement form has not been professionally reviewed.'}</p>
  <p><a href={media.source.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{zh ? '查看来源（连接第三方）' : 'Open source (connects to a third party)'}: {media.source.title}</a></p>
  {url ? <>
   <p className="muted">{zh ? '来源标题与动作对应；视频内容尚待审核，嵌入播放可用性未确认。点击后连接 YouTube；本站不发送训练记录。' : 'Source title matches this exercise; video content awaits review and embed availability is unconfirmed. Loading connects to YouTube; this app sends no training records.'}</p>
   {state === 'idle' && <button type="button" onClick={() => setState('loading')}>{zh ? '加载 YouTube 视频（连接第三方）' : 'Load YouTube video (connects to a third party)'}</button>}
   {state === 'loading' && <>
    <iframe src={url} title={`${exerciseName} — YouTube`} width="280" height="158" style={{ maxWidth: '100%', border: 0 }} referrerPolicy="no-referrer" allow="fullscreen" sandbox="allow-scripts allow-same-origin allow-presentation" onError={() => setState('failed')} />
    <p>{zh ? '播放器可能被网络或平台限制。可使用来源链接或继续阅读步骤。' : 'The player may be blocked by the network or platform. Use the source link or continue reading the steps.'}</p>
    <button type="button" onClick={() => setState('failed')}>{zh ? '视频无法播放' : 'Video not working'}</button>
    <button type="button" onClick={() => setState('idle')}>{zh ? '关闭视频' : 'Close video'}</button>
   </>}
   {state === 'failed' && <p role="status">{zh ? '视频不可用，仍可阅读动作步骤。' : 'Video unavailable. Written steps remain available.'}</p>}
  </> : <p className="muted">{zh ? '尚无经确认的对应视频。可查看来源和动作步骤。' : 'No confirmed matching video yet. Use the source and written steps.'}</p>}
 </section>;
}
