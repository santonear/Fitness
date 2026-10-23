import { readBodyReferral, clearBodyReferral } from '../../../assistant/body-change-session';
import { type BodyChange } from '../../../assistant/body-change';
import { currentWorkoutContext } from '../../../assistant/client-context';
import { useFeature } from '../../useFeature';
import { assistantCopy as copy } from '../../../i18n/features/coach/assistant';
import { useEffect, useRef, useState } from 'react';
import type { CoachApplication, CoachPanelProps } from '../CoachPanel';
import { repository } from '../../../persistence/repository';
import { type AssistantConversation } from '../../../persistence/assistant-conversations';
import { assistantPreferences, type AssistantPreference } from '../../../persistence/assistant-preferences';
import { store, fresh, rememberedBody } from './assistant-store';

/** State, effects and conversation helpers of the assistant panel, in the panel's original hook order. */
export function useAssistantState(props: CoachPanelProps) {
  const { open, onClose, request, expectedRevision, onApply, beforeSend, onResponse, initialSend } = props;
  const locale = props.locale ?? request?.locale ?? 'zh',
    t = copy[locale];
  const [chat, setChat] = useState(fresh),
    [rows, setRows] = useState<AssistantConversation[]>([]),
    [text, setText] = useState(''),
    [busy, setBusy] = useState(false),
    [applying, setApplying] = useState(false),
    [body, setBody] = useState(rememberedBody),
    [history, setHistory] = useState(false),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false),
    [candidate, setCandidate] = useState<CoachApplication>(),
    [saved, setSaved] = useState(false),
    [historyOpen, setHistoryOpen] = useState(false),
    [remembered, setRemembered] = useState<{ ids: string[]; items: AssistantPreference[] }>();
  const [workoutContext, setWorkoutContext] = useState<Awaited<ReturnType<typeof currentWorkoutContext>>>();
  const [preferenceCount, setPreferenceCount] = useState(0);
  const activeWorkoutId = request?.task === 'ADJUST_TODAY' ? request.workoutId : undefined;
  const [localReply, setLocalReply] = useState(false);
  const [bodyChange, setBodyChange] = useState<BodyChange>();
  useEffect(() => {
    let alive = true;
    if (open)
      void repository.db.v8State
        .get('v8')
        .then(state => {
          const row = readBodyReferral(chat.id);
          if (!alive || !row) return;
          const population = state?.coachProfile?.population?.kind;
          if (
            (row.kind === population || (row.kind === 'pregnancy' && population === 'pregnant')) &&
            state?.coachProfile?.screening?.completedAt &&
            state.coachProfile.screening.rescreenRequired !== true
          ) {
            clearBodyReferral(chat.id);
            setBodyChange(undefined);
          } else setBodyChange(row.dismissed.has(row.kind) ? undefined : row.kind);
        })
        .catch(() => {
          /* Keep pending local referral when storage cannot be read. */
        });
    return () => {
      alive = false;
    };
  }, [open, chat.id, expectedRevision]);
  const nutritionEnabled = useFeature('nutrition') && !props.disableNutrition;
  const [diet, setDiet] = useState(false),
    [dietWithdrawn, setDietWithdrawn] = useState(false);
  useEffect(() => {
    if (!open && diet) {
      setDiet(false);
      setDietWithdrawn(true);
    }
  }, [open, diet]);
  const [bodyFields, setBodyFields] = useState<string[] | undefined>();
  const engineEnabled = useFeature('trainingEngine' as Parameters<typeof useFeature>[0]);
  const [localNotices, setLocalNotices] = useState<string[]>([]);
  const [health, setHealth] = useState(false);
  useEffect(() => {
    setHealth(false);
  }, [request?.requestId]);
  const candidateAnchor = useRef<HTMLElement>(null);
  useEffect(() => {
    if (candidate) candidateAnchor.current?.scrollIntoView({ block: 'start' });
  }, [candidate]);
  const [guide, setGuide] = useState<string>(),
    [guideOpen, setGuideOpen] = useState(false),
    guideTrigger = useRef<HTMLElement | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false),
    toolsTrigger = useRef<HTMLElement | null>(null);
  const [onlyToday, setOnlyToday] = useState(false);
  const [retryMessage, setRetryMessage] = useState('');
  const [intentStatus, setIntentStatus] = useState('');
  const loaded = useRef(false),
    applyLock = useRef(false);
  const [privacy, setPrivacy] = useState(() => {
    try {
      return localStorage.getItem('fitness-assistant-privacy') !== 'seen';
    } catch {
      return true;
    }
  });
  const fallbackTrigger = useRef<HTMLElement>(null);
  const controller = useRef<AbortController>(null),
    lock = useRef(false),
    sequence = useRef(0),
    consumed = useRef(new Set<string>()),
    end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open)
      void store
        .list()
        .then(found => {
          setRows(found);
          if (!loaded.current) {
            loaded.current = true;
            if (found[0] && !lock.current && !initialSend) {
              setChat(found[0]);
              setBody(found[0].consent?.body ?? false);
              setBodyFields(found[0].consent?.bodyFields);
              setHistory(found[0].consent?.history ?? false);
            }
          }
        })
        .catch(() => setError(t.storage));
  }, [open, t.storage]);
  useEffect(() => {
    let alive = true;
    if (open)
      void currentWorkoutContext(request, repository.db)
        .then(value => {
          if (alive) setWorkoutContext(value);
        })
        .catch(() => {
          if (alive) setWorkoutContext(undefined);
        });
    return () => {
      alive = false;
    };
  }, [open, activeWorkoutId, expectedRevision, request?.restoreGeneration]);
  useEffect(() => {
    let alive = true;
    if (open)
      void assistantPreferences
        .forRequest()
        .then(items => {
          if (alive) setPreferenceCount(items.length);
        })
        .catch(() => {
          if (alive) setPreferenceCount(0);
        });
    return () => {
      alive = false;
    };
  }, [open, remembered]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [chat.messages, pending]);
  useEffect(
    () => () => {
      sequence.current++;
      controller.current?.abort();
    },
    [],
  );
  useEffect(() => {
    sequence.current++;
    controller.current?.abort();
    lock.current = false;
    setBusy(false);
    setCandidate(undefined);
    setBody(rememberedBody());
    setHistory(false);
    setHealth(false);
  }, [request?.restoreGeneration]);
  useEffect(() => {
    const draft = props.draft;
    if (open && draft && !consumed.current.has(draft.nonce)) {
      consumed.current.add(draft.nonce);
      setText(draft.text.slice(0, 1600));
    }
  }, [open, props.draft?.nonce]);
  async function persist(next: AssistantConversation) {
    try {
      await store.save(next);
      setRows(await store.list());
    } catch {
      setError(t.storage);
    }
  }
  function select(next: AssistantConversation) {
    const referral = readBodyReferral(next.id);
    setBodyChange(referral && !referral.dismissed.has(referral.kind) ? referral.kind : undefined);
    setHealth(false);
    setDiet(false);
    setDietWithdrawn(false);
    setLocalReply(false);
    setChat(next);
    setBodyFields(next.consent?.bodyFields);
    setCandidate(undefined);
    setGuide(undefined);
    setSaved(false);
    setRemembered(undefined);
    setOnlyToday(false);
    setBody(next.consent?.body ?? rememberedBody());
    setHistory(next.consent?.history ?? false);
    setText('');
    setHistoryOpen(false);
    setError('');
    setIntentStatus('');
  }
  function setConsent(key: 'body' | 'history', value: boolean, fields = bodyFields) {
    const consent = { body, history, ...(fields ? { bodyFields: fields } : {}), [key]: value };
    if (key === 'body') {
      setBody(value);
      try {
        localStorage.setItem('fitness-assistant-body-consent', value ? 'yes' : 'no');
      } catch {
        /* The current conversation still remembers consent. */
      }
    } else setHistory(value);
    const next = { ...chat, consent };
    setChat(next);
    if (next.messages.length) void persist(next);
  }
  return {
    props,
    open,
    onClose,
    request,
    expectedRevision,
    onApply,
    beforeSend,
    onResponse,
    initialSend,
    locale,
    t,
    chat,
    setChat,
    rows,
    setRows,
    text,
    setText,
    busy,
    setBusy,
    applying,
    setApplying,
    body,
    setBody,
    history,
    setHistory,
    error,
    setError,
    pending,
    setPending,
    candidate,
    setCandidate,
    saved,
    setSaved,
    historyOpen,
    setHistoryOpen,
    remembered,
    setRemembered,
    workoutContext,
    setWorkoutContext,
    preferenceCount,
    setPreferenceCount,
    activeWorkoutId,
    localReply,
    setLocalReply,
    bodyChange,
    setBodyChange,
    nutritionEnabled,
    diet,
    setDiet,
    dietWithdrawn,
    setDietWithdrawn,
    bodyFields,
    setBodyFields,
    engineEnabled,
    localNotices,
    setLocalNotices,
    health,
    setHealth,
    candidateAnchor,
    guide,
    setGuide,
    guideOpen,
    setGuideOpen,
    guideTrigger,
    toolsOpen,
    setToolsOpen,
    toolsTrigger,
    onlyToday,
    setOnlyToday,
    retryMessage,
    setRetryMessage,
    intentStatus,
    setIntentStatus,
    loaded,
    applyLock,
    privacy,
    setPrivacy,
    fallbackTrigger,
    controller,
    lock,
    sequence,
    consumed,
    end,
    persist,
    select,
    setConsent,
  };
}
export type AssistantState = ReturnType<typeof useAssistantState>;
